'use server'

import { revalidatePath } from 'next/cache'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { validateHoursInput, validateOverrideDate } from '@/lib/schedule/validation'
import { getEffectiveHours } from '@/lib/schedule/settings'
import type { EffectiveHours } from '@/lib/business-rules/slots'
import type { DayOverride, ScheduleBlock } from '@/types'

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
