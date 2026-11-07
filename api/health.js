// GET /api/health: what's configured (never returns secret values).
import { send } from '../lib/http.js';
import { sharedBackend, logicFingerprint, LOGIC } from '../lib/cache.js';
import { MODELS } from '../lib/openrouter.js';
import { PROMPT_VERSION } from '../lib/evaluator.js';

export default function handler(req, res) {
  send(res, 200, {
    ok: true,
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY), // direct OpenAI for eval models named openai:<id> (lib/llm.js)
    organizer_api: Boolean(process.env.CQA_API_URL),
    shared_cache: sharedBackend(),            // 'redis' | 'cloudflare-kv' | null
    logic: Object.fromEntries(Object.keys(LOGIC).map((n) => [n, logicFingerprint(n)])), // cache keys change when these change
    postgres: Boolean(process.env.DATABASE_URL || process.env.POSTGRES_URL),
    admin_passcode_set: Boolean(process.env.ADMIN_PASSCODE),
    models: MODELS, prompt_version: PROMPT_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null, branch: process.env.VERCEL_GIT_COMMIT_REF || null,
  });
}
