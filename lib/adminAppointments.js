import { createAccessCode } from './accessCode';
import { getAvailableSlots, minutesToTime, normalizePhone, timeToMinutes } from './businessRules';
import { createCalendarEvent } from './googleCalendar';

export async function createAdminAppointment(supabase, input) {
  const name = String(input.name || '').trim();
  const phone = normalizePhone(input.phone);
  const serviceId = String(input.serviceId || '');
  const date = String(input.date || '');
  const startTime = String(input.startTime || '');

  if (!name || phone.length < 10 || !serviceId || !date || !startTime) {
    throw new Error('Informe cliente, telefone, servico, data e horario.');
  }

  const [service, appointments, blocks] = await Promise.all([
    supabase.from('services').select('*').eq('id', serviceId).eq('active', true).single(),
    supabase.from('appointments').select('date,start_time,end_time,status').eq('date', date).neq('status', 'canceled'),
    supabase.from('schedule_blocks').select('date,start_time,end_time,full_day,active').eq('date', date).eq('active', true)
  ]);

  if (service.error) throw new Error('Servico nao encontrado.');
  if (appointments.error) throw new Error(appointments.error.message);
  if (blocks.error) throw new Error(blocks.error.message);

  const slots = getAvailableSlots(
    date,
    service.data.duration_minutes,
    appointments.data,
    blocks.data,
    new Date(),
    { allowAnyFutureDate: true }
  );
  if (!slots.includes(startTime)) throw new Error(`Horario indisponivel em ${date} as ${startTime}.`);

  const client = await supabase
    .from('clients')
    .upsert({ id: phone, name, phone }, { onConflict: 'phone' })
    .select()
    .single();

  if (client.error) throw new Error(client.error.message);

  const endTime = minutesToTime(timeToMinutes(startTime) + service.data.duration_minutes);
  const inserted = await supabase
    .from('appointments')
    .insert({
      client_id: client.data.id,
      client_name: client.data.name,
      client_phone: client.data.phone,
      service_id: service.data.id,
      service_name: service.data.name,
      service_duration: service.data.duration_minutes,
      service_price: service.data.price,
      date,
      start_time: startTime,
      end_time: endTime,
      status: 'scheduled',
      access_code: createAccessCode(),
      monthly_client_id: input.monthlyClientId || null
    })
    .select()
    .single();

  if (inserted.error) throw new Error(inserted.error.message);

  let appointment = inserted.data;
  try {
    const googleEvent = await createCalendarEvent(inserted.data);
    if (googleEvent) {
      const synced = await supabase
        .from('appointments')
        .update({
          google_event_id: googleEvent.id,
          google_event_link: googleEvent.htmlLink,
          sync_status: 'synced',
          sync_error: null
        })
        .eq('id', inserted.data.id)
        .select()
        .single();
      if (!synced.error) appointment = synced.data;
    }
  } catch (error) {
    const failed = await supabase
      .from('appointments')
      .update({ sync_status: 'google_error', sync_error: error.message })
      .eq('id', inserted.data.id)
      .select()
      .single();
    if (!failed.error) appointment = failed.data;
  }

  return appointment;
}
