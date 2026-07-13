'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { validateHoursInput, validateOverrideDate, isHalfHourStep } from '@/lib/schedule/validation'
import { getEffectiveHours, getScheduleSettings } from '@/lib/schedule/settings'
import { computeDayGrid, computeExtension, computeShrink, type GridSlot, type ShrinkSlotInfo } from '@/lib/schedule/grid'
import { timeToMinutes, minutesToTime, SLOT_MINUTES, type EffectiveHours } from '@/lib/business-rules/slots'
import type { Appointment, DayOverride, ScheduleBlock } from '@/types'

function todaySP(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

function revalidateSchedulePages() {
  revalidatePath('/admin/horarios')
  revalidatePath('/agendar')
}

export async function updateScheduleSettings(data: {
  open_time: string
  close_time: string
  min_lead_minutes: number
}): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const hoursError = validateHoursInput(data.open_time, data.close_time)
  if (hoursError) return { error: hoursError }
  if (!Number.isInteger(data.min_lead_minutes) || data.min_lead_minutes < 0 || data.min_lead_minutes > 1440) {
    return { error: 'Antecedência deve ser entre 0 e 1440 minutos.' }
  }

  const supabase = createAdminClient()
  const { error } = await supabase
    .from('settings')
    .update({
      open_time: data.open_time,
      close_time: data.close_time,
      min_lead_minutes: data.min_lead_minutes,
      updated_at: new Date().toISOString(),
    })
    .eq('id', 1)

  if (error) return { error: error.message }
  revalidateSchedulePages()
  return {}
}

export async function upsertDayOverride(data: {
  date: string
  open_time: string
  close_time: string
}): Promise<{ override?: DayOverride; error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const dateError = validateOverrideDate(data.date, todaySP())
  if (dateError) return { error: dateError }
  const hoursError = validateHoursInput(data.open_time, data.close_time)
  if (hoursError) return { error: hoursError }

  const supabase = createAdminClient()
  const { data: override, error } = await supabase
    .from('day_overrides')
    .upsert(
      {
        date: data.date,
        open_time: data.open_time,
        close_time: data.close_time,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'date' },
    )
    .select()
    .single()

  if (error) return { error: error.message }
  revalidateSchedulePages()
  return { override: override as DayOverride }
}

export async function removeDayOverride(date: string): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { error } = await supabase.from('day_overrides').delete().eq('date', date)
  if (error) return { error: error.message }
  revalidateSchedulePages()
  return {}
}

export async function getDaySchedule(date: string): Promise<{
  hours?: EffectiveHours
  fromOverride?: boolean
  blocks?: ScheduleBlock[]
  error?: string
}> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { hours, fromOverride } = await getEffectiveHours(date)
  const { data: blocks, error } = await supabase
    .from('schedule_blocks')
    .select('*')
    .eq('active', true)
    .lte('date', date)
    .or(`date_end.gte.${date},and(date.eq.${date},date_end.is.null)`)

  if (error) return { error: error.message }
  return { hours, fromOverride, blocks: (blocks ?? []) as ScheduleBlock[] }
}

async function loadDayData(date: string): Promise<{
  hours: EffectiveHours
  fromOverride: boolean
  blocks: ScheduleBlock[]
  appointments: Appointment[]
}> {
  const supabase = createAdminClient()
  const { hours, fromOverride } = await getEffectiveHours(date)
  const [{ data: blocks }, { data: appointments }] = await Promise.all([
    supabase
      .from('schedule_blocks')
      .select('*')
      .eq('active', true)
      .lte('date', date)
      .or(`date_end.gte.${date},and(date.eq.${date},date_end.is.null)`),
    supabase.from('appointments').select('*').eq('date', date).eq('status', 'scheduled'),
  ])
  return {
    hours,
    fromOverride,
    blocks: (blocks ?? []) as ScheduleBlock[],
    appointments: (appointments ?? []) as Appointment[],
  }
}

export async function getDayGrid(date: string): Promise<{
  grid?: GridSlot[]
  hours?: EffectiveHours
  fromOverride?: boolean
  error?: string
}> {
  const authError = await requireAdmin()
  if (authError) return authError

  const { hours, fromOverride, blocks, appointments } = await loadDayData(date)
  return { grid: computeDayGrid(date, hours, blocks, appointments), hours, fromOverride }
}

// After blocking, edge slots blocked by their own solo blocks become
// "fechado": the day's range shrinks past them and the throwaway blocks are
// deleted. If the range lands back on the default, the override is removed.
async function normalizeDayEdges(date: string): Promise<string | undefined> {
  const supabase = createAdminClient()
  const { hours, blocks, appointments } = await loadDayData(date)
  const settings = await getScheduleSettings()
  const grid = computeDayGrid(date, hours, blocks, appointments)

  const openMin = timeToMinutes(hours.start)
  const closeMin = timeToMinutes(hours.end)

  const inside: ShrinkSlotInfo[] = grid
    .filter((s) => {
      const t = timeToMinutes(s.start)
      return t >= openMin && t + SLOT_MINUTES <= closeMin
    })
    .map((s) => {
      const t = timeToMinutes(s.start)
      const covering = blocks.filter(
        (b) =>
          b.full_day ||
          (b.start_time && b.end_time &&
            t < timeToMinutes(b.end_time) &&
            t + SLOT_MINUTES > timeToMinutes(b.start_time)),
      )
      const soloBlocked =
        covering.length > 0 &&
        covering.every(
          (b) =>
            !b.full_day &&
            !b.date_end &&
            b.date === date &&
            b.start_time?.slice(0, 5) === s.start &&
            timeToMinutes(b.end_time!) === t + SLOT_MINUTES,
        )
      return { start: s.start, state: s.state, soloBlocked }
    })

  const shrink = computeShrink(hours, inside)
  if (!shrink) return undefined

  // Remove the throwaway single-slot blocks of the closed edge slots.
  for (const startTime of shrink.removed) {
    const { error } = await supabase
      .from('schedule_blocks')
      .delete()
      .eq('date', date)
      .is('date_end', null)
      .eq('full_day', false)
      .eq('start_time', startTime)
    if (error) return error.message
  }

  if (shrink.open === settings.open_time && shrink.close === settings.close_time) {
    const { error } = await supabase.from('day_overrides').delete().eq('date', date)
    if (error) return error.message
  } else {
    const { error } = await supabase.from('day_overrides').upsert(
      { date, open_time: shrink.open, close_time: shrink.close, updated_at: new Date().toISOString() },
      { onConflict: 'date' },
    )
    if (error) return error.message
  }
  return undefined
}

// One tap on a grid slot: aberto -> bloqueia (nas pontas do expediente,
// fecha o horário de vez); bloqueado -> reabre;
// fechado -> estende o expediente do dia (gaps entram bloqueados).
export async function toggleSlot(date: string, start: string): Promise<{
  grid?: GridSlot[]
  hours?: EffectiveHours
  fromOverride?: boolean
  error?: string
}> {
  const authError = await requireAdmin()
  if (authError) return authError

  const dateError = validateOverrideDate(date, todaySP())
  if (dateError) return { error: dateError }
  if (!isHalfHourStep(start)) return { error: 'Horário inválido.' }

  const supabase = createAdminClient()
  const { hours, blocks, appointments } = await loadDayData(date)
  const grid = computeDayGrid(date, hours, blocks, appointments)
  const slot = grid.find((s) => s.start === start)
  if (!slot) return { error: 'Horário inválido.' }

  const slotEndMin = timeToMinutes(start) + SLOT_MINUTES

  if (slot.state === 'ocupado') {
    return { error: 'Horário ocupado por um cliente.' }
  }

  if (slot.state === 'aberto') {
    const { error } = await supabase.from('schedule_blocks').insert({
      date,
      date_end: null,
      full_day: false,
      start_time: start,
      end_time: minutesToTime(slotEndMin),
      reason: null,
      active: true,
    })
    if (error) return { error: error.message }
    // Blocking an edge slot means "close this hour": shrink the day's range.
    const shrinkError = await normalizeDayEdges(date)
    if (shrinkError) return { error: shrinkError }
  }

  if (slot.state === 'bloqueado') {
    const covering = blocks.filter(
      (b) =>
        b.full_day ||
        (b.start_time && b.end_time &&
          timeToMinutes(start) < timeToMinutes(b.end_time) &&
          slotEndMin > timeToMinutes(b.start_time)),
    )
    if (covering.some((b) => b.full_day || b.date_end)) {
      return { error: 'Este horário faz parte de um bloqueio de dia inteiro ou período. Remova-o na lista de bloqueios.' }
    }
    for (const b of covering) {
      const { error } = await supabase.from('schedule_blocks').update({ active: false }).eq('id', b.id)
      if (error) return { error: error.message }
      // Split: keep the other slots of a wider same-day block closed.
      const inserts = []
      for (let t = timeToMinutes(b.start_time!); t < timeToMinutes(b.end_time!); t += SLOT_MINUTES) {
        if (t === timeToMinutes(start)) continue
        inserts.push({
          date,
          date_end: null,
          full_day: false,
          start_time: minutesToTime(t),
          end_time: minutesToTime(t + SLOT_MINUTES),
          reason: b.reason,
          active: true,
        })
      }
      if (inserts.length > 0) {
        const { error: splitError } = await supabase.from('schedule_blocks').insert(inserts)
        if (splitError) return { error: splitError.message }
      }
    }
  }

  if (slot.state === 'fechado') {
    const ext = computeExtension(hours, start)
    const settings = await getScheduleSettings()
    if (ext.gaps.length === 0 && ext.open === settings.open_time && ext.close === settings.close_time) {
      // Extension lands exactly on the default hours: drop the override.
      const { error } = await supabase.from('day_overrides').delete().eq('date', date)
      if (error) return { error: error.message }
    } else {
      const { error } = await supabase.from('day_overrides').upsert(
        { date, open_time: ext.open, close_time: ext.close, updated_at: new Date().toISOString() },
        { onConflict: 'date' },
      )
      if (error) return { error: error.message }
    }
    if (ext.gaps.length > 0) {
      const { error: gapError } = await supabase.from('schedule_blocks').insert(
        ext.gaps.map((g) => ({
          date,
          date_end: null,
          full_day: false,
          start_time: g,
          end_time: minutesToTime(timeToMinutes(g) + SLOT_MINUTES),
          reason: null,
          active: true,
        })),
      )
      if (gapError) return { error: gapError.message }
    }
  }

  revalidateSchedulePages()
  const fresh = await loadDayData(date)
  return {
    grid: computeDayGrid(date, fresh.hours, fresh.blocks, fresh.appointments),
    hours: fresh.hours,
    fromOverride: fresh.fromOverride,
  }
}
