'use server'

import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots } from '@/lib/business-rules/slots'
import { isDateInBookingWindow } from '@/lib/business-rules/booking-window'
import { syncAppointmentEvent } from '@/lib/google-calendar/sync-appointment'
import type { Appointment, TimeSlot, BookingInput, ScheduleBlock } from '@/types'

export async function getAvailableSlotsForDate(
  date: string,
  serviceId: string,
): Promise<{ slots?: TimeSlot[]; error?: string }> {
  if (!isDateInBookingWindow(date)) {
    return { error: 'Data fora do período de agendamento.' }
  }

  try {
    const supabase = await createClient()

    // Fetch service for duration
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', serviceId)
      .single()

    if (serviceError || !service) {
      return { error: 'Serviço não encontrado.' }
    }

    if (!service.active) {
      return { error: 'Serviço indisponível.' }
    }

    // Fetch existing scheduled appointments for the date
    const { data: appointments, error: apptError } = await supabase
      .from('appointments')
      .select('*')
      .eq('date', date)
      .eq('status', 'scheduled')

    if (apptError) {
      return { error: 'Erro ao buscar agendamentos.' }
    }

    // Fetch schedule blocks for the date
    const { data: blocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('date', date)
      .eq('active', true)

    if (blocksError) {
      return { error: 'Erro ao buscar bloqueios.' }
    }

    const slots = getAvailableSlots(
      date,
      service.duration_minutes,
      (appointments ?? []) as Appointment[],
      (blocks ?? []) as ScheduleBlock[],
      new Date().toISOString(),
    )

    return { slots }
  } catch {
    return { error: 'Erro interno. Tente novamente.' }
  }
}

export async function bookAppointment(
  input: BookingInput,
): Promise<{ appointment?: Appointment; error?: string }> {
  try {
    const supabase = await createClient()

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return { error: 'Você precisa estar logado para agendar.' }
    }

    if (!isDateInBookingWindow(input.date)) {
      return { error: 'Data fora do período de agendamento.' }
    }

    // Validate service is active
    const { data: service, error: serviceError } = await supabase
      .from('services')
      .select('*')
      .eq('id', input.service_id)
      .eq('active', true)
      .single()

    if (serviceError || !service) {
      return { error: 'Serviço não encontrado ou indisponível.' }
    }

    // Calculate end_time based on duration
    const [startHour, startMin] = input.start_time.split(':').map(Number)
    const startTotalMin = startHour * 60 + startMin
    const endTotalMin = startTotalMin + service.duration_minutes
    const endHour = Math.floor(endTotalMin / 60).toString().padStart(2, '0')
    const endMinStr = (endTotalMin % 60).toString().padStart(2, '0')
    const end_time = `${endHour}:${endMinStr}`

    // Check slot availability: any non-cancelled appointment that overlaps
    const { data: conflicting } = await supabase
      .from('appointments')
      .select('id')
      .eq('date', input.date)
      .eq('status', 'scheduled')
      .lt('start_time', end_time)
      .gt('end_time', input.start_time)

    if (conflicting && conflicting.length > 0) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
    }

    // Generate cryptographically random access code
    const access_code = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]
    ).join('')

    // Insert appointment
    const { data: newAppointment, error: insertError } = await supabase
      .from('appointments')
      .insert({
        client_id: authData.user.id,
        service_id: input.service_id,
        date: input.date,
        start_time: input.start_time,
        end_time,
        status: 'scheduled',
        access_code,
      })
      .select('*, service:services(*)')
      .single()

    if (insertError) {
      // Check for overlap constraint violation
      if (
        insertError.code === '23P01' ||
        insertError.message?.includes('overlap') ||
        insertError.message?.includes('no_overlap')
      ) {
        return { error: 'Horário não disponível. Escolha outro horário.' }
      }
      return { error: 'Erro ao agendar. Tente novamente.' }
    }

    if (!newAppointment) {
      return { error: 'Erro ao agendar. Tente novamente.' }
    }

    // Await calendar sync so it completes before the serverless function ends,
    // but swallow errors so a calendar failure never blocks the booking.
    // syncAppointmentEvent records its own sync_status/sync_error on the row.
    await syncAppointmentEvent(newAppointment.id).catch(() => {})

    return { appointment: newAppointment as Appointment }
  } catch {
    return { error: 'Erro ao agendar. Tente novamente.' }
  }
}

export async function cancelAppointment(
  appointmentId: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return { error: 'Você precisa estar logado para cancelar.' }
    }

    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'canceled' })
      .eq('id', appointmentId)
      .eq('client_id', authData.user.id)
      .eq('status', 'scheduled')
      .select('id')

    if (error) {
      return { error: 'Erro ao cancelar agendamento.' }
    }

    if (!data || data.length === 0) {
      return { error: 'Agendamento não encontrado ou já cancelado.' }
    }

    return {}
  } catch {
    return { error: 'Erro ao cancelar agendamento.' }
  }
}

export async function getMyAppointments(): Promise<{
  appointments?: Appointment[]
  error?: string
}> {
  try {
    const supabase = await createClient()

    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return { error: 'Você precisa estar logado para ver seus agendamentos.' }
    }

    const { data: appointments, error } = await supabase
      .from('appointments')
      .select('*, service:services(*)')
      .eq('client_id', authData.user.id)
      .neq('status', 'canceled')
      .order('date', { ascending: false })

    if (error) {
      return { error: 'Erro ao buscar agendamentos.' }
    }

    return { appointments: (appointments ?? []) as Appointment[] }
  } catch {
    return { error: 'Erro interno. Tente novamente.' }
  }
}
