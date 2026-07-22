'use server'

import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAvailableSlots, blockCoversDate } from '@/lib/business-rules/slots'
import { ensureCurrentWeekMonthlyAppointments } from '@/lib/monthly/ensure'
import { isDateInBookingWindow } from '@/lib/business-rules/booking-window'
import { getEffectiveHours } from '@/lib/schedule/settings'
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
    // Availability depends on EVERY client's appointments, not just the
    // caller's — RLS on `appointments` only lets a client SELECT their own
    // rows (client_select_own_appt), so this must read with the service role
    // or every other client's bookings are invisible here and their slots
    // wrongly show as free. Nothing sensitive leaves this function: only
    // start/end/available booleans and a block reason string are returned.
    const supabase = createAdminClient()

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

    // Revalidate the requested slot server-side. This also materializes this
    // week's monthly-client appointments and checks the grid/blocks/lead
    // time against everyone's bookings (not just this client's, unlike the
    // RLS-scoped queries below) — the authoritative pre-insert check.
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

    // Generate cryptographically random access code
    const access_code = Array.from(
      crypto.getRandomValues(new Uint8Array(8)),
      (b) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[b % 32]
    ).join('')

    // Insert appointment. The exclusion constraint (appointments_no_overlap)
    // is the final, authoritative guard against double-booking — it applies
    // to every row in the table regardless of RLS, so it still catches a
    // race even though the checks above are what surface a friendly error.
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

    // Revalidate the requested slot server-side (grid, blocks, lead time,
    // everyone's bookings). Note: slots overlapping the appointment being
    // moved count as occupied, so moving into a slot that overlaps ITSELF is
    // refused (rare; the client can cancel and rebook).
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

    const { error } = await supabase
      .from('appointments')
      .update({ date: newDate, start_time: newStartTime, end_time })
      .eq('id', appointmentId)
      .eq('client_id', authData.user.id)
      .eq('status', 'scheduled')

    if (error) {
      if ((error as { code?: string }).code === '23P01') {
        return { error: 'Horário não disponível. Escolha outro horário.' }
      }
      return { error: 'Erro ao remarcar. Tente novamente.' }
    }

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
