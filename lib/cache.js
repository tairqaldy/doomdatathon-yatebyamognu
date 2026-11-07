// Response cache for every AI call (evaluation + transcription). AGENTS.md §8: never call a model uncached.
// Same request (model + prompt version + input) → same answer, instantly and for $0.
// Tiers, checked in order:
//   1. memory  (per process / warm serverless instance)
//   2. file    (local scripts & dev server: eval/cache/<ns>/<hash>.json, committed so teammates reuse paid answers)
//   3. upstash (optional, on Vercel: set UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)
//   4. static  (on Vercel: committed eval/cache files are bundled with the functions, read-only)
import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const mem = new Map();
const MEM_MAX = 500;

export const hashKey = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex').slice(0, 40);

const root = () => process.env.CQA_CACHE_DIR || path.join(process.cwd(), 'eval', 'cache');
const fileWritable = () => !process.env.VERCEL; // Vercel's bundle is read-only; /tmp is per-instance and not worth it

async function upstash(cmd) {
  const url = process.env.UPSTASH_REDIS_REST_URL, token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return undefined;
  try {
    const r = await fetch(url, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
    if (!r.ok) return undefined;
    return (await r.json()).result;
  } catch { return undefined; }
}

export async function cacheGet(ns, key) {
  const k = `${ns}:${key}`;
  if (mem.has(k)) return { value: mem.get(k), tier: 'memory' };
  try {
    const v = JSON.parse(await readFile(path.join(root(), ns, `${key}.json`), 'utf8'));
    remember(k, v); return { value: v, tier: 'file' };
  } catch {}
  const u = await upstash(['GET', `cqa:${k}`]);
  if (u) { const v = JSON.parse(u); remember(k, v); return { value: v, tier: 'upstash' }; }
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
  await upstash(['SET', `cqa:${k}`, JSON.stringify(value), 'EX', 60 * 60 * 24 * 30]);
}

function remember(k, v) {
  if (mem.size >= MEM_MAX) mem.delete(mem.keys().next().value);
  mem.set(k, v);
}

/** Wrap an async producer with the cache. Returns { value, cached, tier }. */
export async function cached(ns, keyParts, produce) {
  const key = hashKey(...keyParts);
  const hit = await cacheGet(ns, key);
  if (hit) return { value: hit.value, cached: true, tier: hit.tier, key };
  const value = await produce();
  await cacheSet(ns, key, value);
  return { value, cached: false, tier: 'none', key };
}
