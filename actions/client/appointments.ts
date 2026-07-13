'use server'

import { createClient } from '@/lib/supabase/server'
import { getAvailableSlots, blockCoversDate } from '@/lib/business-rules/slots'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'
import { isDateInBookingWindow } from '@/lib/business-rules/booking-window'
import { getEffectiveHours } from '@/lib/schedule/settings'
import { syncAppointmentEvent } from '@/lib/google-calendar/sync-appointment'
import { deleteCalendarEvent } from '@/lib/google-calendar/sync'
import type { Appointment, TimeSlot, BookingInput, ScheduleBlock } from '@/types'

export async function getAvailableSlotsForDate(
  date: string,
  serviceId: string,
): Promise<{ slots?: TimeSlot[]; error?: string; blockReason?: string }> {
  if (!isDateInBookingWindow(date)) {
    return { error: 'Data fora do período de agendamento.' }
  }

  // Make sure this week's monthly-client appointments exist so their slots are
  // blocked before anyone can book over them.
  await ensureCurrentWeekMonthlyAppointments()

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

    // Fetch active schedule blocks covering the date (single-date or period).
    const { data: blocks, error: blocksError } = await supabase
      .from('schedule_blocks')
      .select('*')
      .eq('active', true)
      .lte('date', date)
      .or(`date_end.gte.${date},and(date.eq.${date},date_end.is.null)`)

    if (blocksError) {
      return { error: 'Erro ao buscar bloqueios.' }
    }

    const blockList = (blocks ?? []) as ScheduleBlock[]

    const { hours, settings } = await getEffectiveHours(date)

    const slots = getAvailableSlots(
      date,
      service.duration_minutes,
      (appointments ?? []) as Appointment[],
      blockList,
      new Date().toISOString(),
      hours,
      settings.min_lead_minutes,
    )

    // If a full-day block covers this date, surface its reason to the client.
    const fullDayBlock = blockList.find(
      (b) => b.full_day && blockCoversDate(b, date),
    )
    const blockReason = fullDayBlock
      ? fullDayBlock.reason ?? 'Não haverá atendimento neste dia.'
      : undefined

    return { slots, blockReason }
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

    await ensureCurrentWeekMonthlyAppointments()

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

    // Revalidate the requested slot server-side (grid, blocks, lead time).
    const slotCheck = await getAvailableSlotsForDate(input.date, input.service_id)
    const requested = slotCheck.slots?.find(
      (s) => s.start === input.start_time && s.available,
    )
    if (!requested) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
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
      .select('id, google_event_id')

    if (error) {
      return { error: 'Erro ao cancelar agendamento.' }
    }

    if (!data || data.length === 0) {
      return { error: 'Agendamento não encontrado ou já cancelado.' }
    }

    // Remove the event from Google Calendar. Await so it completes before the
    // serverless function ends; swallow errors so a calendar failure never
    // blocks the cancellation (the appointment is already canceled).
    const googleEventId = data[0].google_event_id
    if (googleEventId) {
      await deleteCalendarEvent(googleEventId).catch(() => {})
      await supabase
        .from('appointments')
        .update({ google_event_id: null, sync_status: 'pending', sync_error: null })
        .eq('id', appointmentId)
        .eq('client_id', authData.user.id)
    }

    return {}
  } catch {
    return { error: 'Erro ao cancelar agendamento.' }
  }
}

export async function rescheduleAppointment(
  appointmentId: string,
  newDate: string,
  newStartTime: string,
): Promise<{ error?: string }> {
  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    if (!authData.user) {
      return { error: 'Você precisa estar logado para remarcar.' }
    }

    if (!isDateInBookingWindow(newDate)) {
      return { error: 'Data fora do período de agendamento.' }
    }

    const { data: appt } = await supabase
      .from('appointments')
      .select('id, status, service_id, service:services(duration_minutes)')
      .eq('id', appointmentId)
      .eq('client_id', authData.user.id)
      .eq('status', 'scheduled')
      .single()

    if (!appt) return { error: 'Agendamento não encontrado.' }

    const duration = (appt.service as unknown as { duration_minutes: number } | null)?.duration_minutes
    if (!duration) return { error: 'Serviço inválido.' }

    // Revalidate the requested slot server-side (grid, blocks, lead time).
    // Note: slots overlapping the appointment being moved count as occupied,
    // so moving into a slot that overlaps ITSELF is refused (rare; the client
    // can cancel and rebook).
    const slotCheck = await getAvailableSlotsForDate(newDate, appt.service_id)
    const requested = slotCheck.slots?.find(
      (s) => s.start === newStartTime && s.available,
    )
    if (!requested) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
    }

    const [h, m] = newStartTime.split(':').map(Number)
    const endTotal = h * 60 + m + duration
    const end_time = `${String(Math.floor(endTotal / 60)).padStart(2, '0')}:${String(endTotal % 60).padStart(2, '0')}`

    // Slot must be free (ignoring this appointment itself).
    const { data: conflicting } = await supabase
      .from('appointments')
      .select('id')
      .eq('date', newDate)
      .eq('status', 'scheduled')
      .lt('start_time', end_time)
      .gt('end_time', newStartTime)
      .neq('id', appointmentId)

    if (conflicting && conflicting.length > 0) {
      return { error: 'Horário não disponível. Escolha outro horário.' }
    }

    const { error } = await supabase
      .from('appointments')
      .update({ date: newDate, start_time: newStartTime, end_time })
      .eq('id', appointmentId)
      .eq('client_id', authData.user.id)
      .eq('status', 'scheduled')

    if (error) return { error: 'Erro ao remarcar. Tente novamente.' }

    // Keep the calendar event in sync with the new date/time.
    await syncAppointmentEvent(appointmentId).catch(() => {})

    return {}
  } catch {
    return { error: 'Erro ao remarcar. Tente novamente.' }
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
