import { createAdminAppointment } from '../../../../lib/adminAppointments';
import { getRemainingMonthDatesByWeekday, normalizePhone } from '../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../lib/api';
import { deleteFutureMonthlySchedule } from '../../../../lib/monthlySchedule';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const name = String(body.name || '').trim();
  const phone = normalizePhone(body.phone);
  const notes = String(body.notes || '').trim();
  const serviceId = String(body.serviceId || '');
  const weekday = Number(body.weekday);
  const startTime = String(body.startTime || '');

  if (!name || phone.length < 10 || !serviceId || !Number.isInteger(weekday) || weekday < 0 || weekday > 6 || !startTime) {
    return json({ error: 'Informe nome, telefone, servico, dia fixo e horario.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const service = await supabase.from('services').select('*').eq('id', serviceId).eq('active', true).single();
  if (service.error) return json({ error: 'Servico nao encontrado.' }, 404);

  const client = await supabase
    .from('clients')
    .upsert({ id: phone, name, phone, is_monthly: true }, { onConflict: 'phone' })
    .select()
    .single();

  if (client.error) return json({ error: client.error.message }, 500);

  const monthly = await supabase
    .from('monthly_clients')
    .upsert({
      client_id: client.data.id,
      name: client.data.name,
      phone: client.data.phone,
      notes,
      service_id: service.data.id,
      service_name: service.data.name,
      weekday,
      start_time: startTime,
      active: true
    }, { onConflict: 'client_id' })
    .select()
    .single();

  if (monthly.error) return json({ error: monthly.error.message }, 500);

  try {
    await deleteFutureMonthlySchedule(supabase, monthly.data);
  } catch (error) {
    return json({ error: error.message }, 500);
  }

  const created = [];
  const skipped = [];
  for (const date of getRemainingMonthDatesByWeekday(weekday)) {
    try {
      const appointment = await createAdminAppointment(supabase, {
        name,
        phone,
        serviceId,
        date,
        startTime,
        monthlyClientId: monthly.data.id
      });
      created.push(appointment);
    } catch (error) {
      const existing = await supabase
        .from('appointments')
        .select('*')
        .eq('client_id', client.data.id)
        .eq('date', date)
        .eq('start_time', startTime)
        .eq('status', 'scheduled')
        .maybeSingle();

      if (existing.data) {
        const linked = await supabase
          .from('appointments')
          .update({ monthly_client_id: monthly.data.id })
          .eq('id', existing.data.id)
          .select()
          .single();

        if (!linked.error) {
          created.push(linked.data);
          continue;
        }
      }

      skipped.push({ date, startTime, error: error.message });
    }
  }

  return json({ monthlyClient: monthly.data, created, skipped }, 201);
}
