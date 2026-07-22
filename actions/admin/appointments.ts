'use server'

import { createAdminClient } from '@/lib/supabase/admin'
import { requireAdmin } from '@/lib/supabase/require-admin'
import { CLOSED_WEEKDAYS, timeToMinutes, minutesToTime } from '@/lib/business-rules/slots'
import { getEffectiveHours } from '@/lib/schedule/settings'
import type { AppointmentStatus } from '@/types'

function accessCode(): string {
  return Array.from(crypto.getRandomValues(new Uint8Array(8)), (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]).join('')
}

function weekdayOf(dateStr: string): number {
  return new Date(dateStr + 'T12:00:00Z').getUTCDay() // 0=Sun
}

// Validate a date/time against the shop rules (not past, not Sunday, within
// the day's effective hours). Admins have no lead-time restriction and are
// not limited to the client booking window — they can book further ahead.
async function validateSlot(date: string, start: string, durationMinutes: number): Promise<{ end?: string; error?: string }> {
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  if (date < today) return { error: 'A data não pode ser no passado.' }
  if (CLOSED_WEEKDAYS.includes(weekdayOf(date))) return { error: 'Dia sem atendimento (domingo).' }

  const { hours } = await getEffectiveHours(date)
  const startMin = timeToMinutes(start)
  const endMin = startMin + durationMinutes
  if (startMin < timeToMinutes(hours.start) || endMin > timeToMinutes(hours.end)) {
    return { error: 'Horário fora do expediente.' }
  }
  return { end: minutesToTime(endMin) }
}

export async function createGuestAppointment(data: {
  guest_name: string
  guest_phone?: string
  service_id: string
  date: string
  start_time: string
}): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  if (!data.guest_name?.trim()) return { error: 'Nome do cliente é obrigatório.' }
  if (!data.service_id) return { error: 'Serviço é obrigatório.' }
  if (!data.date || !data.start_time) return { error: 'Data e horário são obrigatórios.' }

  const supabase = createAdminClient()
  const { data: service } = await supabase
    .from('services')
    .select('duration_minutes')
    .eq('id', data.service_id)
    .eq('active', true)
    .single()
  if (!service) return { error: 'Serviço não encontrado ou inativo.' }

  const { end, error: slotError } = await validateSlot(data.date, data.start_time, service.duration_minutes)
  if (slotError) return { error: slotError }

  const { error } = await supabase
    .from('appointments')
    .insert({
      client_id: null,
      guest_name: data.guest_name.trim(),
      guest_phone: data.guest_phone?.trim() || null,
      service_id: data.service_id,
      date: data.date,
      start_time: data.start_time,
      end_time: end,
      status: 'scheduled',
      access_code: accessCode(),
    })

  if (error) {
    if ((error as { code?: string }).code === '23P01') return { error: 'Horário indisponível nesse dia.' }
    return { error: 'Erro ao criar agendamento.' }
  }

  return {}
}

export async function rescheduleAppointmentAdmin(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
): Promise<{ error?: string }> {
  const authError = await requireAdmin()
  if (authError) return authError

  const supabase = createAdminClient()
  const { data: appt } = await supabase
    .from('appointments')
    .select('id, status, service:services(duration_minutes)')
    .eq('id', appointmentId)
    .single()
  if (!appt) return { error: 'Agendamento não encontrado.' }
  if (appt.status !== 'scheduled') return { error: 'Agendamento não está agendado.' }

  const duration = (appt.service as unknown as { duration_minutes: number } | null)?.duration_minutes
  if (!duration) return { error: 'Serviço inválido.' }

  const { end, error: slotError } = await validateSlot(newDate, newStartTime, duration)
  if (slotError) return { error: slotError }

  const { error } = await supabase
    .from('appointments')
    .update({ date: newDate, start_time: newStartTime, end_time: end })
    .eq('id', appointmentId)

  if (error) {
    if ((error as { code?: string }).code === '23P01') return { error: 'Horário indisponível nesse dia.' }
    return { error: 'Erro ao remarcar.' }
  }

  return {}
}

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
    .select('id')

  if (error) return { error: error.message }
  if (!data || data.length === 0) {
    return { error: 'Agendamento não encontrado ou não está agendado.' }
  }

  return {}
}
