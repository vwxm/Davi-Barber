import { createClientSession, hashPassword, parseClientCredentials } from '../../../../lib/clientAuth';
import { json } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json();
  const { name, phone, password } = parseClientCredentials(body);

  if (!name || phone.length < 10 || password.length < 6) {
    return json({ error: 'Informe nome, telefone e uma senha com pelo menos 6 caracteres.' }, 400);
  }

  const { hash, salt } = hashPassword(password);
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .upsert({
      id: phone,
      name,
      phone,
      password_hash: hash,
      password_salt: salt
    }, { onConflict: 'phone' })
    .select('id,name,phone')
    .single();

  if (error) return json({ error: error.message }, 500);

  const token = await createClientSession(data.id);
  return json({ token, client: data }, 201);
}
