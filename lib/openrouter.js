// Thin OpenRouter client (no SDK, no deps). All model calls in this repo go through here + lib/cache.js.
// Key: OPENROUTER_API_KEY (local .env or Vercel env). Never put it in frontend code.
const BASE = 'https://openrouter.ai/api/v1';

export const MODELS = {
  // Evaluation default: OpenAI GPT-6 Luna called directly (lib/llm.js routes "openai:" to lib/openai.js).
  // Chosen on the 19-dialog gold set: 86.2% strict vs 75.7% for anthropic/claude-haiku-5.5, $0.00112/eval (#7).
  // Override with CQA_EVAL_MODEL (any OpenRouter id, or openai:<id>). Log changes in docs/TOOLING.md.
  eval: process.env.CQA_EVAL_MODEL || 'openai:gpt-6-luna',
  // Speech-to-text for the 5 calls: NVIDIA Nemotron 3.5 Transcribe (~$0.06 per audio hour on OpenRouter, 40 languages).
  transcribe: process.env.CQA_ASR_MODEL || 'nvidia/nemotron-3.5-transcribe',
};

function headers() {
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw Object.assign(new Error('OPENROUTER_API_KEY is not set'), { status: 503 });
  return {
    Authorization: `Bearer ${key}`,
    'Content-Type': 'application/json',
    'HTTP-Referer': 'https://github.com/tairqaldy/doomdatathon-yatebyamognu',
    'X-Title': 'Freedom CQA (NU datathon)',
  };
}

async function post(pathname, body, { timeoutMs = 90_000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  try {
    const r = await fetch(`${BASE}${pathname}`, { method: 'POST', headers: headers(), body: JSON.stringify(body), signal: ctrl.signal });
    const text = await r.text();
    let json; try { json = JSON.parse(text); } catch { json = { raw: text }; }
    if (!r.ok) throw Object.assign(new Error(json?.error?.message || `OpenRouter ${r.status}`), { status: r.status, body: json });
    return { json, latency_ms: Date.now() - t0 };
  } finally { clearTimeout(t); }
}

/**
 * Chat completion that must return JSON. Tries strict json_schema first, falls back to json_object.
 * Returns { data, model, usage: { prompt_tokens, completion_tokens, cost }, latency_ms }.
 */
export async function chatJSON({ model = MODELS.eval, messages, schema, temperature = 0, maxTokens = 4000 }) {
  const base = { model, messages, temperature, max_tokens: maxTokens, usage: { include: true } };
  let res;
  try {
    res = await post('/chat/completions', { ...base, response_format: { type: 'json_schema', json_schema: { name: 'cqa_evaluation', strict: true, schema } } });
  } catch (e) {
    if (e.status && e.status < 500 && e.status !== 401 && e.status !== 402) {
      res = await post('/chat/completions', { ...base, response_format: { type: 'json_object' } });
    } else throw e;
  }
  const msg = res.json.choices?.[0]?.message?.content ?? '';
  const data = parseJSONLoose(msg);
  const u = res.json.usage || {};
  return { data, model: res.json.model || model, usage: { prompt_tokens: u.prompt_tokens, completion_tokens: u.completion_tokens, cost: u.cost ?? null }, latency_ms: res.latency_ms };
}

/** Speech-to-text. audio: base64 string. Returns { text, segments?, language?, usage, latency_ms }. */
export async function transcribe({ model = MODELS.transcribe, base64, format = 'mp3', language }) {
  const body = { model, input_audio: { data: base64, format }, response_format: 'verbose_json', ...(language ? { language } : {}) };
  const res = await post('/audio/transcriptions', body, { timeoutMs: 180_000 });
  const j = res.json;
  return { text: j.text ?? '', segments: j.segments ?? null, language: j.language ?? language ?? null, duration: j.duration ?? null, usage: j.usage ?? null, model, latency_ms: res.latency_ms };
}

export function parseJSONLoose(s) {
  if (typeof s !== 'string') return s;
  try { return JSON.parse(s); } catch {}
  const m = s.match(/\{[\s\S]*\}/);
  if (m) { try { return JSON.parse(m[0]); } catch {} }
  throw Object.assign(new Error('Model did not return valid JSON'), { status: 502, raw: s.slice(0, 500) });
}
