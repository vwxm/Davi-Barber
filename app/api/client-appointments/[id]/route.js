import {
  getAvailableSlots,
  isDateInClientBookingWindow,
  minutesToTime,
  timeToMinutes
} from '../../../../lib/businessRules';
import { getClientFromRequest } from '../../../../lib/clientAuth';
import { json } from '../../../../lib/api';
import { updateCalendarEventStatus, updateCalendarEventTime } from '../../../../lib/googleCalendar';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const { id } = await params;
  const client = await getClientFromRequest(request);
  if (!client) return json({ error: 'Login de cliente obrigatorio.' }, 401);

  const { searchParams } = new URL(request.url);
  const date = String(searchParams.get('date') || '');
  if (!date) return json({ error: 'Informe a data.' }, 400);

  const supabase = getSupabaseAdmin();
  const current = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('client_id', client.id)
    .single();

  if (current.error) return json({ error: 'Agendamento nao encontrado.' }, 404);
  if (current.data.status !== 'scheduled') return json({ slots: [] });
  if (!isDateInClientBookingWindow(date)) return json({ slots: [] });

  const [appointments, blocks] = await Promise.all([
    supabase
      .from('appointments')
      .select('id,date,start_time,end_time,status')
      .eq('date', date)
      .neq('status', 'canceled'),
    supabase
      .from('schedule_blocks')
      .select('date,start_time,end_time,full_day,active')
      .eq('date', date)
      .eq('active', true)
  ]);

  if (appointments.error) return json({ error: appointments.error.message }, 500);
  if (blocks.error) return json({ error: blocks.error.message }, 500);

  const otherAppointments = appointments.data.filter((appointment) => appointment.id !== current.data.id);
  const slots = getAvailableSlots(date, current.data.service_duration, otherAppointments, blocks.data);
  return json({ slots });
}

export async function PATCH(request, { params }) {
  const { id } = await params;
  const client = await getClientFromRequest(request);
  if (!client) return json({ error: 'Login de cliente obrigatorio.' }, 401);

  const body = await request.json();
  const action = String(body.action || '');
  const supabase = getSupabaseAdmin();

  const current = await supabase
    .from('appointments')
    .select('*')
    .eq('id', id)
    .eq('client_id', client.id)
    .single();

  if (current.error) return json({ error: 'Agendamento nao encontrado.' }, 404);
  if (current.data.status !== 'scheduled') {
    return json({ error: 'Somente agendamentos ativos podem ser alterados.' }, 400);
  }

  if (action === 'cancel') {
    const { data, error } = await supabase
      .from('appointments')
      .update({ status: 'canceled' })
      .eq('id', current.data.id)
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    try {
      await updateCalendarEventStatus(current.data.google_event_id, 'canceled');
    } catch (calendarError) {
      await supabase
        .from('appointments')
        .update({ sync_status: 'google_error', sync_error: calendarError.message })
        .eq('id', current.data.id);
    }

    return json({ appointment: data });
  }

  if (action === 'reschedule') {
    const date = String(body.date || '');
    const startTime = String(body.startTime || '');

    if (!date || !startTime) {
      return json({ error: 'Informe a nova data e o novo horario.' }, 400);
    }

    if (!isDateInClientBookingWindow(date)) {
      return json({ error: 'So e permitido reagendar de hoje ate sabado da semana atual.' }, 400);
    }

    const [appointments, blocks] = await Promise.all([
      supabase
        .from('appointments')
        .select('id,date,start_time,end_time,status')
        .eq('date', date)
        .neq('status', 'canceled'),
      supabase
        .from('schedule_blocks')
        .select('date,start_time,end_time,full_day,active')
        .eq('date', date)
        .eq('active', true)
    ]);

    if (appointments.error) return json({ error: appointments.error.message }, 500);
    if (blocks.error) return json({ error: blocks.error.message }, 500);

    const otherAppointments = appointments.data.filter((appointment) => appointment.id !== current.data.id);
    const slots = getAvailableSlots(date, current.data.service_duration, otherAppointments, blocks.data);
    if (!slots.includes(startTime)) {
      return json({ error: 'Novo horario indisponivel.' }, 409);
    }

    const endTime = minutesToTime(timeToMinutes(startTime) + current.data.service_duration);
    const { data, error } = await supabase
      .from('appointments')
      .update({
        date,
        start_time: startTime,
        end_time: endTime,
        sync_status: current.data.google_event_id ? 'synced' : current.data.sync_status,
        sync_error: null
      })
      .eq('id', current.data.id)
      .select()
      .single();

    if (error) return json({ error: error.message }, 500);

    try {
      await updateCalendarEventTime(data);
    } catch (calendarError) {
      await supabase
        .from('appointments')
        .update({ sync_status: 'google_error', sync_error: calendarError.message })
        .eq('id', current.data.id);
    }

    return json({ appointment: data });
  }

  return json({ error: 'Acao invalida.' }, 400);
}
