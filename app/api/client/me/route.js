import { getClientFromRequest } from '../../../../lib/clientAuth';
import { json } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const client = await getClientFromRequest(request);
  if (!client) return json({ error: 'Login de cliente obrigatorio.' }, 401);
  return json({ client });
}
