// JSON documents in Postgres (`cqa_kv`). No-op helpers stay in the API layer when DATABASE_URL is unset.
import { configured, query } from './postgres.js';

const NS = { session: 'live_session' };
let boot;

export { NS };
export const enabled = () => configured();

export async function ensure() {
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
  await ensure();
  const r = await query(
    'SELECT key, data, updated_at FROM cqa_kv WHERE ns = $1 ORDER BY updated_at DESC LIMIT $2',
    [ns, Math.min(500, Math.max(1, Number(limit) || 200))],
  );
  return r.rows.map(rowOf);
}

export async function get(ns, key) {
  await ensure();
  const r = await query('SELECT key, data, updated_at FROM cqa_kv WHERE ns = $1 AND key = $2', [ns, key]);
  return r.rows[0] ? rowOf(r.rows[0]) : null;
}

export async function put(ns, key, data) {
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
  await ensure();
  await query('DELETE FROM cqa_kv WHERE ns = $1 AND key = $2', [ns, key]);
}

function rowOf(r) {
  const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data;
  return { ...data, id: data?.id || r.key, updated_at: data?.updated_at || r.updated_at };
}
