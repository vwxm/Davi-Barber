'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { syncAppointmentEvent } from '@/lib/google-calendar/sync-appointment'
import { BUSINESS_HOURS, timeToMinutes, minutesToTime } from '@/lib/business-rules/slots'
import { currentWeekMonday } from '@/lib/business-rules/monthly'

// Move a monthly client's appointment within the current week only (punctual
// change). The recurring template is untouched, so next week reverts.
export async function rescheduleMonthlyAppointment(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  const { data: appt, error: fetchError } = await supabase
    .from('appointments')
    .select('id, status, week_start, monthly_client_id, service:services(duration_minutes)')
    .eq('id', appointmentId)
    .single()

  if (fetchError || !appt) return { error: 'Agendamento não encontrado.' }
  if (!appt.monthly_client_id) return { error: 'Não é um agendamento de mensalista.' }
  if (appt.status !== 'scheduled') return { error: 'Agendamento não está agendado.' }

  // Must stay in the same week so generation dedup (monthly_client_id, week_start)
  // still holds and we don't create a second occurrence.
  if (currentWeekMonday(newDate + 'T12:00:00Z') !== appt.week_start) {
    return { error: 'Só é possível trocar dentro da mesma semana.' }
  }

  const weekday = new Date(newDate + 'T12:00:00Z').getUTCDay()
  if (BUSINESS_HOURS.closedWeekdays.includes(weekday)) {
    return { error: 'Dia sem atendimento.' }
  }

  const duration = (appt.service as unknown as { duration_minutes: number } | null)?.duration_minutes
  if (!duration) return { error: 'Serviço inválido.' }

  const startMin = timeToMinutes(newStartTime)
  const endMin = startMin + duration
  if (startMin < timeToMinutes(BUSINESS_HOURS.start) || endMin > timeToMinutes(BUSINESS_HOURS.end)) {
    return { error: 'Horário fora do expediente.' }
  }
  const start = minutesToTime(startMin)
  const end = minutesToTime(endMin)

  // Conflict with any other scheduled appointment on the new date.
  const { data: sameDay } = await supabase
    .from('appointments')
    .select('id, start_time, end_time')
    .eq('date', newDate)
    .eq('status', 'scheduled')
  const conflict = (sameDay ?? []).some(
    (a) =>
      a.id !== appointmentId &&
      timeToMinutes(start) < timeToMinutes(a.end_time) &&
      timeToMinutes(end) > timeToMinutes(a.start_time),
  )
  if (conflict) return { error: 'Horário indisponível nesse dia.' }

  const { error: updateError } = await supabase
    .from('appointments')
    .update({ date: newDate, start_time: start, end_time: end })
    .eq('id', appointmentId)
  if (updateError) return { error: updateError.message }

  // Re-sync calendar (patches the existing event if already synced).
  await syncAppointmentEvent(appointmentId).catch(() => {})

  return {}
}
