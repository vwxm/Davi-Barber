import { json, requireAdmin } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = requireAdmin(request);
  if (!auth.ok) return auth.response;

  const body = await request.json();
  const name = String(body.name || '').trim();
  const price = Number(body.price);
  const duration = Number(body.durationMinutes);

  if (!name || !Number.isFinite(price) || !Number.isFinite(duration) || duration <= 0) {
    return json({ error: 'Serviço, preço e duração são obrigatórios.' }, 400);
  }

  if (duration % 15 !== 0) {
    return json({ error: 'A duração deve ser múltipla de 15 minutos.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('services')
    .insert({
      name,
      price,
      duration_minutes: duration,
      active: true
    })
    .select()
    .single();

  if (error) return json({ error: error.message }, 500);
  return json({ service: data }, 201);
}
