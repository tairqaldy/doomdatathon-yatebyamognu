// Thin direct OpenAI client (no SDK, no deps). Same chatJSON() contract as lib/openrouter.js.
// Key: OPENAI_API_KEY (local .env or Vercel env). Never put it in frontend code.
// Only call it through lib/llm.js, which callers wrap with lib/cache.js.
const BASE = process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1';

// USD per 1M tokens [input, output]. OpenAI returns token counts but no cost, so we compute it.
// Rates as listed on 2026-11-07 (OpenRouter pass-through of OpenAI prices). Override with
// CQA_OPENAI_PRICE_IN / CQA_OPENAI_PRICE_OUT when using a model that is not listed here.
export const PRICES = {
  'gpt-6-luna': [0.10, 0.50],
  'gpt-6-luna-pro': [0.10, 0.50],
  'gpt-5.6-luna': [0.20, 1.20],
  'gpt-5-nano': [0.05, 0.40],
  'gpt-5-mini': [0.25, 2.00],
  'gpt-4.1-mini': [0.40, 1.60],
  'gpt-4o-mini': [0.15, 0.60],
  'gpt-6.1-terra': [1.00, 5.00],
};

export function priceFor(model) {
  const envIn = Number(process.env.CQA_OPENAI_PRICE_IN), envOut = Number(process.env.CQA_OPENAI_PRICE_OUT);
  if (Number.isFinite(envIn) && Number.isFinite(envOut) && process.env.CQA_OPENAI_PRICE_IN) return [envIn, envOut];
  const base = model.replace(/-\d{4}-\d{2}-\d{2}$/, ''); // dated snapshots share the family price
  return PRICES[model] || PRICES[base] || null;
}

export function costOf(model, usage) {
  const p = priceFor(model);
  if (!p || !usage) return null;
  const inTok = usage.prompt_tokens || 0, outTok = usage.completion_tokens || 0;
  return +((inTok * p[0] + outTok * p[1]) / 1e6).toFixed(6);
}

function headers() {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error('OPENAI_API_KEY is not set'), { status: 503 });
  return { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' };
}

async function request(method, pathname, body, { timeoutMs = 90_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}${pathname}`, { method, headers: headers(), body: body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!r.ok) throw Object.assign(new Error(json?.error?.message || `OpenAI ${r.status}`), { status: r.status, body: json });
    return { json, latency_ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

/** Model ids this key can use (for picking/validating CQA_EVAL_MODEL). */
export async function listModels() {
  const res = await request('GET', '/models');
  return (res.json.data || []).map((m) => m.id).sort();
}

/**
 * Chat completion that must return JSON. Tries strict json_schema first, falls back to json_object.
 * Some newer models reject `temperature`; we retry once without it.
 * Returns { data, model, usage: { prompt_tokens, completion_tokens, cost }, latency_ms }.
 */
export async function chatJSON({ model, messages, schema, temperature = 0, maxTokens = 4000 }) {
  const base = { model, messages, temperature, max_completion_tokens: maxTokens };
  const strict = { type: 'json_schema', json_schema: { name: 'cqa_evaluation', strict: true, schema } };
  const send = async (body) => {
    try { return await request('POST', '/chat/completions', body); }
    catch (e) {
      if (e.status === 400 && /temperature/i.test(e.message) && 'temperature' in body) {
        const { temperature: _drop, ...rest } = body;
        return await request('POST', '/chat/completions', rest);
      }
      throw e;
    }
  };
  let res;
  try {
    res = await send({ ...base, response_format: strict });
  } catch (e) {
    if (e.status && e.status < 500 && e.status !== 401 && e.status !== 403 && e.status !== 429) {
      res = await send({ ...base, response_format: { type: 'json_object' } });
    } else throw e;
  }
  const msg = res.json.choices?.[0]?.message?.content ?? '';
  const { parseJSONLoose } = await import('./openrouter.js');
  const data = parseJSONLoose(msg);
  const u = res.json.usage || {};
  const usage = { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, cost: costOf(model, u) };
  return { data, model: res.json.model || model, usage, latency_ms: res.latency_ms };
}
