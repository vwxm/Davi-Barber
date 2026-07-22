import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { timeToMinutes, minutesToTime, TIMEZONE } from '@/lib/business-rules/slots'
import { currentWeekMonday, addDays } from '@/lib/business-rules/monthly'
import { BOOKING_WEEKS } from '@/lib/business-rules/booking-window'

function generateAccessCode(): string {
  return Array.from(
    crypto.getRandomValues(new Uint8Array(8)),
    (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32],
  ).join('')
}

function rangesOverlap(s1: string, e1: string, s2: string, e2: string): boolean {
  return timeToMinutes(s1) < timeToMinutes(e2) && timeToMinutes(e1) > timeToMinutes(s2)
}

interface MonthlyRow {
  id: string
  client_id: string
  service_id: string
  weekday: number
  start_time: string
  active: boolean
  service: { duration_minutes: number } | null
}

// Idempotently materialize the current week's appointment for each active
// monthly client. Safe to call on any read path. Never throws.
//
// Reads are batched per week (existing materializations + same-week
// appointments fetched once, not once per monthly client) so a call that has
// nothing new to generate — the common case — costs a small, constant number
// of round trips regardless of how many monthly clients exist.
export async function ensureCurrentWeekMonthlyAppointments(): Promise<{
  generated: number
  conflicts: string[]
}> {
  const conflicts: string[] = []
  let generated = 0

  try {
    const supabase = createAdminClient()
    const nowISO = new Date().toISOString()
    const baseMonday = currentWeekMonday(nowISO)
    const today = new Date().toLocaleDateString('en-CA', { timeZone: TIMEZONE })

    const { data: monthlyClientsData } = await supabase
      .from('monthly_clients')
      .select('id, client_id, service_id, weekday, start_time, active, service:services(duration_minutes)')
      .eq('active', true)
    const monthlyClients = (monthlyClientsData ?? []) as unknown as MonthlyRow[]
    if (monthlyClients.length === 0) return { generated: 0, conflicts: [] }

    const mcIds = monthlyClients.map((mc) => mc.id)

    // Materialize each bookable week (current + next), one occurrence per
    // (monthly client, week).
    for (let w = 0; w < BOOKING_WEEKS; w++) {
      const weekMonday = addDays(baseMonday, w * 7)
      const weekSaturday = addDays(weekMonday, 5)

      // One query for every monthly client already materialized this week,
      // instead of one query per client.
      const { data: existingRows } = await supabase
        .from('appointments')
        .select('monthly_client_id')
        .in('monthly_client_id', mcIds)
        .eq('week_start', weekMonday)
      const alreadyMaterialized = new Set((existingRows ?? []).map((r) => r.monthly_client_id))

      // One query for every scheduled appointment across the whole week,
      // instead of one query per client per day.
      const { data: weekAppointments } = await supabase
        .from('appointments')
        .select('date, start_time, end_time')
        .eq('status', 'scheduled')
        .gte('date', weekMonday)
        .lte('date', weekSaturday)
      const byDate = new Map<string, { start_time: string; end_time: string }[]>()
      for (const a of weekAppointments ?? []) {
        const list = byDate.get(a.date) ?? []
        list.push(a)
        byDate.set(a.date, list)
      }

      for (const mc of monthlyClients) {
        if (alreadyMaterialized.has(mc.id)) continue

        const duration = mc.service?.duration_minutes
        if (!duration) continue

        // weekday 1=Mon..6=Sat, 0=Sun -> offset from Monday
        const offset = mc.weekday === 0 ? 6 : mc.weekday - 1
        const date = addDays(weekMonday, offset)
        if (date < today) continue // occurrence already passed

        const start = minutesToTime(timeToMinutes(mc.start_time))
        const end = minutesToTime(timeToMinutes(mc.start_time) + duration)

        const conflict = (byDate.get(date) ?? []).some((a) =>
          rangesOverlap(start, end, a.start_time, a.end_time),
        )
        if (conflict) {
          conflicts.push(`${date} ${start} (mensalista ${mc.id})`)
          continue
        }

        const { data: inserted, error } = await supabase
          .from('appointments')
          .insert({
            client_id: mc.client_id,
            service_id: mc.service_id,
            date,
            start_time: start,
            end_time: end,
            status: 'scheduled',
            access_code: generateAccessCode(),
            monthly_client_id: mc.id,
            week_start: weekMonday,
          })
          .select('id')
          .single()

        // Unique/overlap violation (race or conflict): skip.
        if (error) continue

        if (inserted) {
          generated++
          // Keep this week's conflict check accurate for the remaining
          // monthly clients processed in this same loop.
          const list = byDate.get(date) ?? []
          list.push({ start_time: start, end_time: end })
          byDate.set(date, list)
        }
      }
    }
  } catch {
    // Generation is best-effort; never break the calling page.
  }

  return { generated, conflicts }
}
