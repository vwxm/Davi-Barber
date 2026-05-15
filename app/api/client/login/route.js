import { createClientSession, parseClientCredentials, verifyPassword } from '../../../../lib/clientAuth';
import { json } from '../../../../lib/api';
import { getSupabaseAdmin } from '../../../../lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json();
  const { phone, password } = parseClientCredentials(body);

  if (phone.length < 10 || !password) {
    return json({ error: 'Informe telefone e senha.' }, 400);
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('clients')
    .select('id,name,phone,password_hash,password_salt')
    .eq('phone', phone)
    .single();

  if (error || !data || !verifyPassword(password, data.password_hash, data.password_salt)) {
    return json({ error: 'Telefone ou senha invalidos.' }, 401);
  }

  const token = await createClientSession(data.id);
  return json({
    token,
    client: {
      id: data.id,
      name: data.name,
      phone: data.phone
    }
  });
}
