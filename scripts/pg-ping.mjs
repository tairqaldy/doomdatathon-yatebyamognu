// Check DATABASE_URL: SELECT 1. Exit 0 if unset (optional) or ping ok; 1 if configured and failing.
import { loadEnv } from './env.mjs';
loadEnv();
const { configured, ping } = await import('../lib/postgres.js');
if (!configured()) {
  console.log('postgres: not configured (set DATABASE_URL)');
  process.exit(0);
}
try {
  const r = await ping();
  console.log(`postgres: ok transport=${r.transport} db=${r.database} ${r.latency_ms}ms`);
} catch (e) {
  console.error(`postgres: FAIL ${e.message}`);
  process.exit(1);
}
