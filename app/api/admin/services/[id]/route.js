import { json, requireAdmin } from '../../../../../lib/api';
import { getSupabaseAdmin } from '../../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function PATCH(request, { params }) {
  const { id } = await params;
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const duration = Number(body.durationMinutes);
  const active = body.active === undefined ? true : Boolean(body.active);

  if (!name || !Number.isFinite(price) || !Number.isFinite(duration) || duration <= 0) {
    return json({ error: 'Servico, preco e duracao sao obrigatorios.' }, 400);
  }

  if (duration % 15 !== 0) {
    return json({ error: 'A duracao deve ser multipla de 15 minutos.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .update({ name, price, duration_minutes: duration, active })
    .eq('id', id)
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ service: data });
}
