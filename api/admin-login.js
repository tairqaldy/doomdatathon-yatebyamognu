// POST /api/admin-login { passcode } → { token, expires_in }   ·   GET with Authorization → { ok }
import { send, preflight, body, fail } from '../lib/http.js';
import { checkPasscode, issueToken, verify } from '../lib/auth.js';
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  try {
    if (req.method === 'GET') return send(res, verify(req) ? 200 : 401, { ok: Boolean(verify(req)) });
    const b = await body(req);
    if (!checkPasscode(b.passcode)) return send(res, 401, { error: 'wrong passcode' });
    send(res, 200, { token: issueToken(), expires_in: 12 * 3600 });
  } catch (e) { fail(res, e); }
}
