import assert from 'node:assert/strict';
import { parseDatabaseUrl, configured, ping } from './postgres.js';
import handler from '../api/sessions.js';
import health from '../api/health.js';

const neon = parseDatabaseUrl('postgresql://neondb_owner:s3cret@ep-foo-pooler.eu-central-1.aws.neon.tech/neondb?sslmode=require');
assert.equal(neon.neon, true);
assert.equal(neon.ssl, true);
assert.equal(neon.user, 'neondb_owner');
assert.equal(neon.password, 's3cret');
assert.equal(neon.database, 'neondb');
assert.equal(neon.port, 5432);

const local = parseDatabaseUrl('postgres://postgres:pass@localhost:5433/cqa');
assert.equal(local.neon, false);
assert.equal(local.ssl, false);
assert.equal(local.port, 5433);

assert.equal(configured(), false);
const p = await ping();
assert.equal(p.ok, false);
assert.equal(p.configured, false);

function res() {
  return {
    statusCode: 0, body: '',
    setHeader() {},
    end(b) { this.body = b; },
  };
}
const s = res();
await handler({ method: 'GET', url: '/api/sessions' }, s);
assert.equal(s.statusCode, 200);
assert.deepEqual(JSON.parse(s.body), { postgres: false, sessions: [] });

const h = res();
health({ method: 'GET' }, h);
assert.equal(JSON.parse(h.body).postgres, false);

process.env.DATABASE_URL = 'postgresql://u:p@ep-x.eu-central-1.aws.neon.tech/db';
const origFetch = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  assert.match(String(url), /https:\/\/ep-x\.eu-central-1\.aws\.neon\.tech\/sql/);
  assert.equal(opts.headers['Neon-Connection-String'], process.env.DATABASE_URL);
  const body = JSON.parse(opts.body);
  assert.equal(body.query, 'SELECT 1 AS ok');
  return { ok: true, json: async () => ({ command: 'SELECT', rowCount: 1, rows: [{ ok: 1 }] }) };
};
const { query } = await import('./postgres.js');
const q = await query('SELECT 1 AS ok');
assert.equal(q.rows[0].ok, 1);
globalThis.fetch = origFetch;
delete process.env.DATABASE_URL;

console.log('postgres self-test ok');
