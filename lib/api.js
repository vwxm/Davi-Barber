import { NextResponse } from 'next/server';

export function json(data, status = 200) {
  return NextResponse.json(data, { status });
}

export function requireAdmin(request) {
  const expected = process.env.ADMIN_ACCESS_TOKEN;
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();

  if (!expected) {
    return { ok: false, response: json({ error: 'ADMIN_ACCESS_TOKEN não configurado.' }, 500) };
  }

  if (token !== expected) {
    return { ok: false, response: json({ error: 'Acesso administrativo negado.' }, 401) };
  }

  return { ok: true };
}
