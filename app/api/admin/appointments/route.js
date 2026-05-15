import { createAdminAppointment } from '../../../../lib/adminAppointments';
import { isDateTodayOrFuture } from '../../../../lib/businessRules';
import { json, requireAdmin } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  if (!isDateTodayOrFuture(String(body.date || ''))) {
    return json({ error: 'Agendamento manual so pode ser criado a partir de hoje.' }, 400);
  }

  try {
    const appointment = await createAdminAppointment(getSupabaseAdmin(), body);
    return json({ appointment }, 201);
  } catch (error) {
    return json({ error: error.message }, 400);
  }
}
