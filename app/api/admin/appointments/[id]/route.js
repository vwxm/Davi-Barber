import {
  getAvailableSlots,
  isDateTodayOrFuture,
  minutesToTime,
  timeToMinutes
} from '../../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../../lib/api';
import { updateCalendarEventStatus, updateCalendarEventTime } from '../../../../../lib/googleCalendar';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const action = String(body.action || '');
  const supabase = getSupabaseAdmin();

  if (action === 'reschedule') {
    const date = String(body.date || '');
    const startTime = String(body.startTime || '');
    if (!isDateTodayOrFuture(date) || !startTime) {
      return json({ error: 'Informe uma data futura e um horario.' }, 400);
    }

    const current = await supabase.from('appointments').select('*').eq('id', id).single();
    if (current.error) return json({ error: current.error.message }, 404);

    const [appointments, blocks] = await Promise.all([
      supabase.from('appointments').select('id,date,start_time,end_time,status').eq('date', date).neq('status', 'canceled'),
      supabase.from('schedule_blocks').select('date,start_time,end_time,full_day,active').eq('date', date).eq('active', true)
    ]);

    if (appointments.error) return json({ error: appointments.error.message }, 500);
    if (blocks.error) return json({ error: blocks.error.message }, 500);

    const slots = getAvailableSlots(
      date,
      current.data.service_duration,
      appointments.data.filter((appointment) => appointment.id !== current.data.id),
      blocks.data,
      new Date(),
      { allowAnyFutureDate: true }
    );
    if (!slots.includes(startTime)) return json({ error: 'Novo horario indisponivel.' }, 409);

    const endTime = minutesToTime(timeToMinutes(startTime) + current.data.service_duration);
    const updated = await supabase
      .from('appointments')
      .update({ date, start_time: startTime, end_time: endTime, sync_error: null })
      .eq('id', id)
      .select()
      .single();

    if (updated.error) return json({ error: updated.error.message }, 500);

    try {
      await updateCalendarEventTime(updated.data);
    } catch (calendarError) {
      await supabase.from('appointments').update({ sync_status: 'google_error', sync_error: calendarError.message }).eq('id', id);
    }

    return json({ appointment: updated.data });
  }

  const status = String(body.status || '');
  if (!['scheduled', 'completed', 'canceled'].includes(status)) {
    return json({ error: 'Status invalido.' }, 400);
  }

  const current = await supabase
    .from('appointments')
    .select('id,google_event_id')
    .eq('id', id)
    .single();

  if (current.error) return json({ error: current.error.message }, 404);

  const { data, error } = await supabase
    .from('appointments')
    .update({ status })
    .eq('id', id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);

  try {
    await updateCalendarEventStatus(current.data.google_event_id, status);
  } catch (calendarError) {
    await supabase
      .from('appointments')
      .update({ sync_status: 'google_error', sync_error: calendarError.message })
      .eq('id', id);
  }

  return json({ appointment: data });
}
