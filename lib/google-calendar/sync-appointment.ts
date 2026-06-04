import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  createCalendarEvent,
  updateCalendarEvent,
} from './sync'

// Core calendar-sync logic, with NO auth guard. Callable from both the
// client booking flow (no admin session) and the admin action (which adds
// its own requireAdmin check). Records sync_status / sync_error on the row.
export async function syncAppointmentEvent(
  appointmentId: string,
): Promise<{ error?: string }> {
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
        // Fall back to guest details for admin-booked walk-ins.
        client: (appointment.client as { name: string; phone: string } | null)
          ?? (appointment.guest_name
            ? { name: appointment.guest_name as string, phone: (appointment.guest_phone as string) ?? '' }
            : null),
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
