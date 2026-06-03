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

// Re-run calendar sync for every scheduled appointment currently in error.
export async function retryFailedSyncs(): Promise<{
  retried: number
  errors: number
  error?: string
}> {
  const authError = await requireAdmin()
  if (authError) return { retried: 0, errors: 0, error: authError.error }

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('appointments')
    .select('id')
    .eq('sync_status', 'error')
    .eq('status', 'scheduled')

  if (error) return { retried: 0, errors: 0, error: error.message }

  let retried = 0
  let errors = 0
  for (const appt of data ?? []) {
    const result = await syncAppointmentEvent(appt.id)
    if (result.error) errors++
    else retried++
  }
  return { retried, errors }
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
