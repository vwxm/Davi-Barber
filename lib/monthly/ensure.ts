import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { syncAppointmentEvent } from '@/lib/google-calendar/sync-appointment'
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

    const { data: monthlyClients } = await supabase
      .from('monthly_clients')
      .select('id, client_id, service_id, weekday, start_time, active, service:services(duration_minutes)')
      .eq('active', true)

    // Materialize each bookable week (current + next), one occurrence per
    // (monthly client, week).
    for (let w = 0; w < BOOKING_WEEKS; w++) {
      const weekMonday = addDays(baseMonday, w * 7)

      for (const mc of (monthlyClients ?? []) as unknown as MonthlyRow[]) {
        const duration = mc.service?.duration_minutes
        if (!duration) continue

        // weekday 1=Mon..6=Sat, 0=Sun -> offset from Monday
        const offset = mc.weekday === 0 ? 6 : mc.weekday - 1
        const date = addDays(weekMonday, offset)
        if (date < today) continue // occurrence already passed

        // Already materialized for this week?
        const { data: existing } = await supabase
          .from('appointments')
          .select('id')
          .eq('monthly_client_id', mc.id)
          .eq('week_start', weekMonday)
          .maybeSingle()
        if (existing) continue

        const start = minutesToTime(timeToMinutes(mc.start_time))
        const end = minutesToTime(timeToMinutes(mc.start_time) + duration)

        // Conflict with an existing scheduled appointment on that date?
        const { data: sameDay } = await supabase
          .from('appointments')
          .select('start_time, end_time')
          .eq('date', date)
          .eq('status', 'scheduled')
        const conflict = (sameDay ?? []).some((a) =>
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

        generated++
        if (inserted) {
          await syncAppointmentEvent(inserted.id).catch(() => {})
        }
      }
    }
  } catch {
    // Generation is best-effort; never break the calling page.
  }

  return { generated, conflicts }
}
