import { json, requireAdmin } from '../../../../lib/api';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const body = await request.json();
  const token = String(body.token || '');
  const authRequest = new Request(request.url, {
    headers: { Authorization: `Bearer ${token}` }
  });

  const auth = requireAdmin(authRequest);
  if (!auth.ok) return auth.response;

  return json({ ok: true });
}
