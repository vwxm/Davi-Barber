import { randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto';
import { normalizePhone } from './businessRules';
import { getSupabaseAdmin } from './supabaseAdmin';

const SESSION_DAYS = 30;

export function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = scryptSync(String(password), salt, 64).toString('hex');
  return { hash, salt };
}

export function verifyPassword(password, hash, salt) {
  if (!hash || !salt) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = Buffer.from(hashPassword(password, salt).hash, 'hex');
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function hashToken(token) {
  return createHash('sha256').update(String(token)).digest('hex');
}

export async function createClientSession(clientId) {
  const supabase = getSupabaseAdmin();
  const token = randomBytes(32).toString('hex');
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_DAYS);

  const { error } = await supabase.from('client_sessions').insert({
    client_id: clientId,
    token_hash: hashToken(token),
    expires_at: expiresAt.toISOString()
  });

  if (error) throw new Error(error.message);
  return token;
}

export async function getClientFromRequest(request) {
  const header = request.headers.get('authorization') || '';
  const token = header.replace(/^Bearer\s+/i, '').trim();
  if (!token) return null;

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('client_sessions')
    .select('client:clients(id,name,phone)')
    .eq('token_hash', hashToken(token))
    .gt('expires_at', new Date().toISOString())
    .single();

  if (error || !data?.client) return null;
  return data.client;
}

export function parseClientCredentials(body) {
  return {
    name: String(body.name || '').trim(),
    phone: normalizePhone(body.phone),
    password: String(body.password || '')
  };
}
