import { getAvailableSlots } from '../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const { searchParams } = new URL(request.url);
  const date = String(searchParams.get('date') || '');
  const serviceId = String(searchParams.get('serviceId') || '');
  const appointmentId = String(searchParams.get('appointmentId') || '');

  if (!date || (!serviceId && !appointmentId)) {
    return json({ error: 'Informe data e servico ou agendamento.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  let duration = 0;

  if (appointmentId) {
    const current = await supabase.from('appointments').select('id,service_duration').eq('id', appointmentId).single();
    if (current.error) return json({ error: 'Agendamento nao encontrado.' }, 404);
    duration = current.data.service_duration;
  } else {
    const service = await supabase.from('services').select('duration_minutes').eq('id', serviceId).eq('active', true).single();
    if (service.error) return json({ error: 'Servico nao encontrado.' }, 404);
    duration = service.data.duration_minutes;
  }

  const [appointments, blocks] = await Promise.all([
    supabase.from('appointments').select('id,date,start_time,end_time,status').eq('date', date).neq('status', 'canceled'),
    supabase.from('schedule_blocks').select('date,start_time,end_time,full_day,active').eq('date', date).eq('active', true)
  ]);

  if (appointments.error) return json({ error: appointments.error.message }, 500);
  if (blocks.error) return json({ error: blocks.error.message }, 500);

  const slots = getAvailableSlots(
    date,
    duration,
    appointmentId ? appointments.data.filter((appointment) => appointment.id !== appointmentId) : appointments.data,
    blocks.data,
    new Date(),
    { allowAnyFutureDate: true }
  );

  return json({ slots });
}
