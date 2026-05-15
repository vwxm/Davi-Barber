import { createAdminAppointment } from '../../../../../lib/adminAppointments';
import { getRemainingMonthDatesByWeekday, normalizePhone } from '../../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../../lib/api';
import { deleteFutureMonthlySchedule, unlinkPastMonthlyAppointments } from '../../../../../lib/monthlySchedule';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const { id } = await params;
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
  const current = await supabase.from('monthly_clients').select('*').eq('id', id).single();
  if (current.error) return json({ error: current.error.message }, 404);

  try {
    await deleteFutureMonthlySchedule(supabase, current.data);
  } catch (error) {
    return json({ error: error.message }, 500);
  }

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
    .update({
      client_id: client.data.id,
      name,
      phone,
      notes,
      service_id: service.data.id,
      service_name: service.data.name,
      weekday,
      start_time: startTime,
      active: true
    })
    .eq('id', id)
    .select()
    .single();

  if (monthly.error) return json({ error: monthly.error.message }, 500);

  const created = [];
  const skipped = [];
  for (const date of getRemainingMonthDatesByWeekday(weekday)) {
    try {
      const appointment = await createAdminAppointment(supabase, { name, phone, serviceId, date, startTime, monthlyClientId: id });
      created.push(appointment);
    } catch (error) {
      skipped.push({ date, startTime, error: error.message });
    }
  }

  return json({ monthlyClient: monthly.data, created, skipped });
}

export async function DELETE(request, { params }) {
  const { id } = await params;
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const supabase = getSupabaseAdmin();
  const current = await supabase.from('monthly_clients').select('*').eq('id', id).single();
  if (current.error) return json({ error: current.error.message }, 404);

  try {
    await deleteFutureMonthlySchedule(supabase, current.data);
    await unlinkPastMonthlyAppointments(supabase, id);
  } catch (error) {
    return json({ error: error.message }, 500);
  }

  const deleted = await supabase.from('monthly_clients').delete().eq('id', id);
  if (deleted.error) return json({ error: deleted.error.message }, 500);

  await supabase.from('clients').update({ is_monthly: false }).eq('id', current.data.client_id);
  return json({ ok: true });
}
