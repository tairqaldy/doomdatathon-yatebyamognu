// Response cache for every AI call. AGENTS.md §8.1: never call a model uncached.
// Same request on the same logic → same answer, instantly and for $0.
// Changed logic → new key → fresh answer. Each namespace's key includes a fingerprint (sha1) of the source file
// that builds the prompt/normalises the output (LOGIC below), so editing lib/evaluator.js regenerates evaluations,
// editing lib/support-bot.js regenerates bot replies, and so on. Old entries are simply never read again.
//
// Tiers, checked in order:
//   1. memory  (per process / warm serverless instance)
//   2. file    (eval/cache/<ns>/<key>.json; written locally, committed so teammates/CI/Vercel reuse paid answers;
//               read-only on Vercel where it's bundled with the functions)
//   3. shared  (optional, across Vercel instances and laptops), first configured of:
//              - Upstash Redis REST: UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN
//                (or KV_REST_API_URL + KV_REST_API_TOKEN, the names Vercel's Upstash/KV integration injects)
//              - Cloudflare Workers KV: CF_ACCOUNT_ID + CF_KV_NAMESPACE_ID + CF_API_TOKEN (token: "Workers KV Storage: Edit")
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const mem = new Map();
const MEM_MAX = 500;
const TTL_S = 60 * 60 * 24 * 30;

export const hashKey = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);

/** Namespace → source files whose content defines the answer. Edit a file → that namespace regenerates. */
export const LOGIC = {
  eval: ['./evaluator.js'],
  chat: ['./support-bot.js'],
  insights: ['./insights.js'],
  nav: ['./nav-agent.js'],
};
const fpCache = new Map();
export function logicFingerprint(ns) {
  if (!LOGIC[ns]) return 'static';
  if (fpCache.has(ns)) return fpCache.get(ns);
  const h = createHash('sha1');
  for (const rel of LOGIC[ns]) {
    try { h.update(readFileSync(new URL(rel, import.meta.url))); } catch { h.update(`missing:${rel}`); }
  }
  const fp = h.digest('hex').slice(0, 12);
  fpCache.set(ns, fp);
  return fp;
}

const root = () => process.env.CQA_CACHE_DIR || path.join(process.cwd(), 'eval', 'cache');
const fileWritable = () => !process.env.VERCEL; // Vercel's bundle is read-only

// ---------- shared backends ----------
function redisConf() {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  return url && token ? { url, token } : null;
}
function cfConf() {
  const { CF_ACCOUNT_ID: acc, CF_KV_NAMESPACE_ID: ns, CF_API_TOKEN: token } = process.env;
  return acc && ns && token ? { base: `https://api.cloudflare.com/client/v4/accounts/${acc}/storage/kv/namespaces/${ns}/values/`, token } : null;
}
export function sharedBackend() { return redisConf() ? 'redis' : cfConf() ? 'cloudflare-kv' : null; }

async function sharedGet(k) {
  try {
    const r = redisConf();
    if (r) {
      const res = await fetch(r.url, { method: 'POST', headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['GET', `cqa:${k}`]) });
      if (!res.ok) return undefined;
      const v = (await res.json()).result;
      return v ? JSON.parse(v) : undefined;
    }
    const c = cfConf();
    if (c) {
      const res = await fetch(c.base + encodeURIComponent(`cqa:${k}`), { headers: { Authorization: `Bearer ${c.token}` } });
      return res.ok ? JSON.parse(await res.text()) : undefined;
    }
  } catch { /* cache must never break a request */ }
  return undefined;
}
async function sharedSet(k, value) {
  try {
    const body = JSON.stringify(value);
    const r = redisConf();
    if (r) {
      await fetch(r.url, { method: 'POST', headers: { Authorization: `Bearer ${r.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(['SET', `cqa:${k}`, body, 'EX', TTL_S]) });
      return;
    }
    const c = cfConf();
    if (c) await fetch(`${c.base}${encodeURIComponent(`cqa:${k}`)}?expiration_ttl=${TTL_S}`, { method: 'PUT', headers: { Authorization: `Bearer ${c.token}` }, body });
  } catch { /* ignore */ }
}

// ---------- public API ----------
export async function cacheGet(ns, key) {
  const k = `${ns}:${key}`;
  if (mem.has(k)) return { value: mem.get(k), tier: 'memory' };
  try {
    const v = JSON.parse(await readFile(path.join(root(), ns, `${key}.json`), 'utf8'));
    remember(k, v); return { value: v, tier: 'file' };
  } catch {}
  const s = await sharedGet(k);
  if (s !== undefined) { remember(k, s); return { value: s, tier: sharedBackend() }; }
  return null;
}

export async function cacheSet(ns, key, value) {
  const k = `${ns}:${key}`;
  remember(k, value);
  if (fileWritable()) {
    try {
      const dir = path.join(root(), ns);
      await mkdir(dir, { recursive: true });
      await writeFile(path.join(dir, `${key}.json`), JSON.stringify(value, null, 1));
    } catch {}
  }
  await sharedSet(k, value);
}

function remember(k, v) {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value);
  mem.set(k, v);
}

/** Wrap an async producer with the cache. The key = namespace + logic fingerprint + caller's parts. */
export async function cached(ns, keyParts, produce) {
  const key = hashKey(ns, logicFingerprint(ns), ...keyParts);
  const hit = await cacheGet(ns, key);
  if (hit) return { value: hit.value, cached: true, tier: hit.tier, key };
  const value = await produce();
  await cacheSet(ns, key, value);
  return { value, cached: false, tier: 'none', key };
}
