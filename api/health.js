// GET /api/health: what's configured (never returns secret values).
import { send } from '../lib/http.js';
import { MODELS } from '../lib/openrouter.js';
import { PROMPT_VERSION } from '../lib/evaluator.js';

export default function handler(req, res) {
  send(res, 200, {
    ok: true,
    openrouter: Boolean(process.env.OPENROUTER_API_KEY),
    openai: Boolean(process.env.OPENAI_API_KEY), // direct OpenAI for eval models named openai:<id> (lib/llm.js)
    organizer_api: Boolean(process.env.CQA_API_URL),
    shared_cache: Boolean(process.env.UPSTASH_REDIS_REST_URL),
    models: MODELS, prompt_version: PROMPT_VERSION,
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || null, branch: process.env.VERCEL_GIT_COMMIT_REF || null,
  });
}
