// Minimal admin auth for the demo: passcode → HMAC-signed token (12h). No user accounts (brief: no login needed
// for the product itself); /admin is gated so judges see a distinct admin surface.
// Env: ADMIN_PASSCODE (default "freedom" for the demo, shown on the login page), ADMIN_SECRET (defaults to a hash of the passcode).
import { createHmac, timingSafeEqual } from 'node:crypto';

const passcode = () => process.env.ADMIN_PASSCODE || 'freedom';
const secret = () => process.env.ADMIN_SECRET || `cqa:${passcode()}:secret`;
const sign = (payload) => createHmac('sha256', secret()).update(payload).digest('base64url');

export function issueToken(name = 'admin') {
  const payload = Buffer.from(JSON.stringify({ sub: name, exp: Date.now() + 12 * 3600 * 1000 })).toString('base64url');
  return `${payload}.${sign(payload)}`;
}
export function checkPasscode(p) {
  const a = Buffer.from(String(p || '')), b = Buffer.from(passcode());
  return a.length === b.length && timingSafeEqual(a, b);
}
export function verify(req) {
  const h = req.headers?.authorization || '';
  const tok = h.startsWith('Bearer ') ? h.slice(7) : '';
  const [payload, sig] = tok.split('.');
  if (!payload || !sig || sign(payload) !== sig) return null;
  try { const p = JSON.parse(Buffer.from(payload, 'base64url').toString()); return p.exp > Date.now() ? p : null; } catch { return null; }
}
