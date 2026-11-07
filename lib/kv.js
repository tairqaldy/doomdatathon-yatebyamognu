// JSON documents for live sessions. Backend: Postgres (`cqa_kv`, DATABASE_URL) if set, otherwise Upstash Redis REST
// (UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN, the same database the AI cache uses). Neither → the API
// reports no store and the UI keeps localStorage.
import { configured, query } from './postgres.js';

const NS = { session: 'live_session' };
let boot;

function redis() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
async function rcmd(cmd) {
  const c = redis();
  const res = await fetch(c.url, { method: 'POST', headers: { Authorization: `Bearer ${c.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  if (!res.ok) throw Object.assign(new Error(`redis ${res.status}`), { status: 502 });
  return (await res.json()).result;
}
const hkey = (ns) => `cqa:kv:${ns}`;
const usePg = () => configured();
const useRedis = () => !configured() && Boolean(redis());

export { NS };
export const enabled = () => usePg() || useRedis();
export const backend = () => (usePg() ? 'postgres' : useRedis() ? 'redis' : null);

export async function ensure() {
  if (useRedis()) return true;
  if (!configured()) return false;
  boot ||= query(`
    CREATE TABLE IF NOT EXISTS cqa_kv (
      ns text NOT NULL,
      key text NOT NULL,
      data jsonb NOT NULL,
      updated_at timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ns, key)
    )`);
  await boot;
  return true;
}

export async function list(ns, limit = 200) {
  if (useRedis()) {
    const flat = (await rcmd(['HGETALL', hkey(ns)])) || [];
    const rows = [];
    for (let i = 0; i + 1 < flat.length; i += 2) { try { rows.push(JSON.parse(flat[i + 1])); } catch {} }
    rows.sort((a, b) => String(b.updated_at || '').localeCompare(String(a.updated_at || '')));
    return rows.slice(0, Math.min(500, Math.max(1, Number(limit) || 200)));
  }
  await ensure();
  const r = await query(
    'SELECT key, data, updated_at FROM cqa_kv WHERE ns = $1 ORDER BY updated_at DESC LIMIT $2',
    [ns, Math.min(500, Math.max(1, Number(limit) || 200))],
  );
  return r.rows.map(rowOf);
}

export async function get(ns, key) {
  if (useRedis()) { const v = await rcmd(['HGET', hkey(ns), key]); return v ? JSON.parse(v) : null; }
  await ensure();
  const r = await query('SELECT key, data, updated_at FROM cqa_kv WHERE ns = $1 AND key = $2', [ns, key]);
  return r.rows[0] ? rowOf(r.rows[0]) : null;
}

export async function put(ns, key, data) {
  if (useRedis()) {
    const doc = { ...(typeof data === 'string' ? JSON.parse(data) : data), id: key, updated_at: new Date().toISOString() };
    await rcmd(['HSET', hkey(ns), key, JSON.stringify(doc)]);
    return doc;
  }
  await ensure();
  const body = typeof data === 'string' ? data : JSON.stringify(data);
  await query(
    `INSERT INTO cqa_kv (ns, key, data, updated_at) VALUES ($1, $2, $3::jsonb, now())
     ON CONFLICT (ns, key) DO UPDATE SET data = EXCLUDED.data, updated_at = now()`,
    [ns, key, body],
  );
  return get(ns, key);
}

export async function remove(ns, key) {
  if (useRedis()) { await rcmd(['HDEL', hkey(ns), key]); return; }
  await ensure();
  await query('DELETE FROM cqa_kv WHERE ns = $1 AND key = $2', [ns, key]);
}

function rowOf(r) {
  const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return { ...data, id: data?.id || r.key, updated_at: data?.updated_at || r.updated_at };
}
