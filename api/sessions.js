// Live support sessions on the server (Postgres `cqa_kv` or Upstash Redis, see lib/kv.js). Without either the UI keeps localStorage.
// `postgres: true` means "a server store is on" (field kept for shared/live-store.js); `store` names the backend.
import { send, preflight, body, fail } from '../lib/http.js';
import { enabled, ensure, list, get, put, remove, NS, backend } from '../lib/kv.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  try {
    if (!enabled()) return send(res, 200, { postgres: false, sessions: [] });
    await ensure();
    const url = new URL(req.url, 'http://local');
    const id = String(url.searchParams.get('id') || '').slice(0, 80);

    if (req.method === 'GET') {
      if (id) {
        const s = await get(NS.session, id);
        return send(res, s ? 200 : 404, s ? { postgres: true, session: s } : { error: 'not found' });
      }
      return send(res, 200, { postgres: true, store: backend(), sessions: await list(NS.session) });
    }

    if (req.method === 'PUT' || req.method === 'POST') {
      const s = await body(req);
      if (!s?.id || typeof s.id !== 'string') return send(res, 400, { error: 'id required' });
      if (JSON.stringify(s).length > 512_000) return send(res, 413, { error: 'session too large' });
      const saved = await put(NS.session, s.id, { ...s, updated_at: new Date().toISOString() });
      return send(res, 200, { postgres: true, session: saved });
    }

    if (req.method === 'DELETE') {
      if (!id) return send(res, 400, { error: 'id required' });
      await remove(NS.session, id);
      return send(res, 200, { postgres: true, ok: true });
    }

    send(res, 405, { error: 'GET, PUT or DELETE' });
  } catch (e) { fail(res, e); }
}
