'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { deleteCalendarEvent } from '@/lib/google-calendar/sync'
import type { AppointmentStatus } from '@/types'

export async function markAppointmentCompleted(
  appointmentId: string,
): Promise<{ error?: string }> {
  return setAppointmentStatus(appointmentId, 'completed')
}

export async function markAppointmentNoShow(
  appointmentId: string,
): Promise<{ error?: string }> {
  return setAppointmentStatus(appointmentId, 'no_show')
}

async function setAppointmentStatus(
  appointmentId: string,
  status: AppointmentStatus,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', appointmentId)
    .eq('status', 'scheduled')
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Agendamento não encontrado ou não está agendado.' }
  }
  return {}
}

export async function cancelAppointmentAdmin(
  appointmentId: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data, error } = await supabase
    .from('appointments')
    .update({ status: 'canceled' })
    .eq('id', appointmentId)
    .eq('status', 'scheduled')
    .select('id, google_event_id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Agendamento não encontrado ou não está agendado.' }
  }

  const googleEventId = data[0].google_event_id
  if (googleEventId) {
    await deleteCalendarEvent(googleEventId).catch(() => {})
    await supabase
      .from('appointments')
      .update({ google_event_id: null, sync_status: 'pending', sync_error: null })
      .eq('id', appointmentId)
  }

  return {}
}
