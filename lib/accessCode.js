import { randomBytes } from 'crypto';

export function createAccessCode() {
  return randomBytes(4).toString('hex').slice(0, 6).toUpperCase();
}

export function normalizeAccessCode(value) {
  return String(value || '').replace(/[^a-z0-9]/gi, '').toUpperCase();
}
