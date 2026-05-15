import {
  getAvailableSlots,
  isDateInClientBookingWindow,
  minutesToTime,
  timeToMinutes
} from '../../../lib/businessRules';
import { createAccessCode } from '../../../lib/accessCode';
import { getClientFromRequest } from '../../../lib/clientAuth';
import { createCalendarEvent } from '../../../lib/googleCalendar';
import { json } from '../../../lib/api';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const clientAccount = await getClientFromRequest(request);
  if (!clientAccount) {
    return json({ error: 'Faca login como cliente para agendar um horario.' }, 401);
  }

  const body = await request.json();
  const serviceId = String(body.serviceId || '');
  const date = String(body.date || '');
  const startTime = String(body.startTime || '');

  if (!serviceId || !date || !startTime) {
    return json({ error: 'Preencha servico, data e horario.' }, 400);
  }

  if (!isDateInClientBookingWindow(date)) {
    return json({ error: 'So e permitido agendar de hoje ate sabado da semana atual.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const [service, appointments, blocks] = await Promise.all([
    supabase.from('services').select('*').eq('id', serviceId).eq('active', true).single(),
    supabase.from('appointments').select('date,start_time,end_time,status').eq('date', date).neq('status', 'canceled'),
    supabase.from('schedule_blocks').select('date,start_time,end_time,full_day,active').eq('date', date).eq('active', true)
  ]);

  if (service.error) return json({ error: 'Servico nao encontrado.' }, 404);
  if (appointments.error) return json({ error: appointments.error.message }, 500);
  if (blocks.error) return json({ error: blocks.error.message }, 500);

  const slots = getAvailableSlots(date, service.data.duration_minutes, appointments.data, blocks.data);
  if (!slots.includes(startTime)) {
    return json({ error: 'Horario indisponivel. Escolha outro horario.' }, 409);
  }

  const start = timeToMinutes(startTime);
  const endTime = minutesToTime(start + service.data.duration_minutes);
  const payload = {
    client_id: clientAccount.id,
    client_name: clientAccount.name,
    client_phone: clientAccount.phone,
    service_id: service.data.id,
    service_name: service.data.name,
    service_duration: service.data.duration_minutes,
    service_price: service.data.price,
    date,
    start_time: startTime,
    end_time: endTime,
    status: 'scheduled',
    access_code: createAccessCode()
  };

  const inserted = await supabase.from('appointments').insert(payload).select().single();
  if (inserted.error) return json({ error: inserted.error.message }, 500);

  try {
    const googleEvent = await createCalendarEvent(inserted.data);
    if (googleEvent) {
      await supabase
        .from('appointments')
        .update({
          google_event_id: googleEvent.id,
          google_event_link: googleEvent.htmlLink,
          sync_status: 'synced',
          sync_error: null
        })
        .eq('id', inserted.data.id);
    }
  } catch (error) {
    await supabase
      .from('appointments')
      .update({ sync_status: 'google_error', sync_error: error.message })
      .eq('id', inserted.data.id);
  }

  return json({
    appointment: {
      id: inserted.data.id,
      date: inserted.data.date,
      start_time: inserted.data.start_time,
      service_name: inserted.data.service_name,
      access_code: inserted.data.access_code
    }
  }, 201);
}
