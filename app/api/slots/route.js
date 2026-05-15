import { getAvailableSlots, isDateInClientBookingWindow } from '../../../lib/businessRules';
import { json } from '../../../lib/api';
import { getSupabaseAdmin } from '../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const date = searchParams.get('date');
  const serviceId = searchParams.get('serviceId');

  if (!date || !serviceId) {
    return json({ error: 'Data e servico sao obrigatorios.' }, 400);
  }

  if (!isDateInClientBookingWindow(date)) {
    return json({ slots: [], message: 'Agendamentos so podem ser feitos de hoje ate sabado da semana atual.' });
  }

  const supabase = getSupabaseAdmin();
  const [service, appointments, blocks] = await Promise.all([
    supabase.from('services').select('id,duration_minutes').eq('id', serviceId).eq('active', true).single(),
    supabase.from('appointments').select('date,start_time,end_time,status').eq('date', date).neq('status', 'canceled'),
    supabase.from('schedule_blocks').select('date,start_time,end_time,full_day,active').eq('date', date).eq('active', true)
  ]);

  if (service.error) return json({ error: 'Servico nao encontrado.' }, 404);
  if (appointments.error) return json({ error: appointments.error.message }, 500);
  if (blocks.error) return json({ error: blocks.error.message }, 500);

  const slots = getAvailableSlots(date, service.data.duration_minutes, appointments.data, blocks.data);
  if (!slots.length && blocks.data.length) {
    const fullDayBlock = blocks.data.find((block) => block.full_day);
    const blockWithReason = blocks.data.find((block) => block.reason);
    const reason = fullDayBlock?.reason || blockWithReason?.reason;
    return json({
      slots,
      message: reason || 'Agenda bloqueada nesta data pelo barbeiro.'
    });
  }

  return json({ slots });
}
