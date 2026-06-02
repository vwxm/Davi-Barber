'use server'
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { deleteCalendarEvent } from '@/lib/google-calendar/sync'
import { syncAppointmentEvent } from '@/lib/google-calendar/sync-appointment'

export async function syncAppointmentToCalendar(
  appointmentId: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  return syncAppointmentEvent(appointmentId)
}

export async function unsyncAppointmentFromCalendar(
  appointmentId: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('google_event_id')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      return { error: 'Agendamento não encontrado.' }
    }

    if (appointment.google_event_id) {
      const result = await deleteCalendarEvent(appointment.google_event_id)
      if (result.error) {
        return { error: result.error }
      }
    }

    await supabase
      .from('appointments')
      .update({ google_event_id: null, sync_status: 'pending', sync_error: null })
      .eq('id', appointmentId)

    return {}
  } catch (err) {
    return { error: err instanceof Error ? err.message : 'Unsync error' }
  }
}
