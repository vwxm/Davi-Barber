'use server'
import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import {
  createCalendarEvent,
  updateCalendarEvent,
  deleteCalendarEvent,
} from '@/lib/google-calendar/sync'

export async function syncAppointmentToCalendar(
  appointmentId: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()

  try {
    const { data: appointment, error: fetchError } = await supabase
      .from('appointments')
      .select('*, service:services(name, duration_minutes), client:clients(name, phone)')
      .eq('id', appointmentId)
      .single()

    if (fetchError || !appointment) {
      return { error: 'Agendamento não encontrado.' }
    }

    let eventId: string | undefined
    let syncError: string | undefined

    if (appointment.google_event_id) {
      const result = await updateCalendarEvent(appointment.google_event_id, {
        date: appointment.date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        service: appointment.service as { name: string } | null,
      })
      if (result.error) {
        syncError = result.error
      } else {
        eventId = appointment.google_event_id
      }
    } else {
      const result = await createCalendarEvent({
        id: appointment.id,
        date: appointment.date,
        start_time: appointment.start_time,
        end_time: appointment.end_time,
        access_code: appointment.access_code,
        service: appointment.service as { name: string } | null,
        client: appointment.client as { name: string; phone: string } | null,
      })
      if (result.error) {
        syncError = result.error
      } else {
        eventId = result.eventId
      }
    }

    if (syncError) {
      await supabase
        .from('appointments')
        .update({ sync_status: 'error', sync_error: syncError })
        .eq('id', appointmentId)
      return { error: syncError }
    }

    await supabase
      .from('appointments')
      .update({ google_event_id: eventId, sync_status: 'synced', sync_error: null })
      .eq('id', appointmentId)

    return {}
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sync error'
    await supabase
      .from('appointments')
      .update({ sync_status: 'error', sync_error: message })
      .eq('id', appointmentId)
    return { error: message }
  }
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
