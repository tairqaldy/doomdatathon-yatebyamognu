// Thin direct OpenAI client (no SDK, no deps). Same chatJSON() / transcribe() contract as lib/openrouter.js, plus speak().
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

// ---------- voice: speech-to-text and text-to-speech ----------
// ASR: whisper-1 by default (CQA_OPENAI_ASR_MODEL to override). listModels() on 2026-11-07 also offers
// gpt-4o-mini-transcribe (half the price), gpt-4o-transcribe, gpt-transcribe and gpt-live-transcribe; latency of each
// is measured in eval/runs/voice-bench-*.json (scripts/voice-bench.mjs).
// TTS: gpt-4o-mini-tts takes a tone instruction; voice "sage" is calm and reads RU, KZ and EN text.
export const VOICE = {
  asr: () => process.env.CQA_OPENAI_ASR_MODEL || 'whisper-1',
  tts: () => process.env.CQA_TTS_MODEL || 'gpt-4o-mini-tts',
  voice: () => process.env.CQA_TTS_VOICE || 'sage',
};
export const TTS_INSTRUCTIONS = 'You are AIM, the support assistant of Freedom Broker. Speak calmly and warmly, at a natural, '
  + 'slightly brisk pace, like a friendly specialist on the phone. Read the text exactly in its own language '
  + '(Russian, Kazakh or English); say numbers, amounts and tickers clearly.';

// USD rates from OpenAI's pricing page (checked 2026-11-07). Speech has no token usage in the response, so cost is
// estimated: ASR from audio seconds, TTS per character (tts-1*) or per spoken minute at ~14 characters a second.
export const AUDIO_PRICES = {
  'whisper-1': { per_min: 0.006 },
  'gpt-4o-transcribe': { per_min: 0.006 },
  'gpt-4o-mini-transcribe': { per_min: 0.003 },
  'tts-1': { per_1m_chars: 15 },
  'tts-1-hd': { per_1m_chars: 30 },
  'gpt-4o-mini-tts': { per_min: 0.015 },
};
const CHARS_PER_SEC = 14;
function audioPrice(model) { return AUDIO_PRICES[model] || AUDIO_PRICES[model.replace(/-\d{4}-\d{2}-\d{2}$/, '')] || null; }
export function asrCost(model, seconds) {
  const p = audioPrice(model);
  return p?.per_min && Number.isFinite(seconds) ? +((seconds / 60) * p.per_min).toFixed(6) : null;
}
export function ttsCost(model, chars) {
  const p = audioPrice(model);
  if (!p || !chars) return null;
  if (p.per_1m_chars) return +((chars / 1e6) * p.per_1m_chars).toFixed(6);
  return +((chars / CHARS_PER_SEC / 60) * p.per_min).toFixed(6);
}

const MIME = { webm: 'audio/webm', mp4: 'audio/mp4', m4a: 'audio/mp4', mp3: 'audio/mpeg', wav: 'audio/wav', ogg: 'audio/ogg', flac: 'audio/flac' };
/** Seconds of audio in a PCM WAV (16 kHz mono from our widgets), or null for compressed formats. */
function wavSeconds(buf) {
  if (buf.length < 44 || buf.toString('ascii', 0, 4) !== 'RIFF' || buf.toString('ascii', 8, 12) !== 'WAVE') return null;
  const byteRate = buf.readUInt32LE(28);
  return byteRate ? +((buf.length - 44) / byteRate).toFixed(2) : null;
}

/**
 * Speech-to-text. audio: base64 string; language: ISO-639-1 hint ('ru' | 'kk' | 'en'), optional.
 * Returns { text, language, duration, model, usage: { seconds, cost }, latency_ms } (same shape as openrouter.transcribe).
 */
export async function transcribe({ base64, format = 'webm', language, prompt, model = VOICE.asr() }) {
  const buf = Buffer.from(base64, 'base64');
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: MIME[format] || 'application/octet-stream' }), `speech.${format === 'm4a' ? 'mp4' : format}`);
  fd.append('model', model);
  // whisper-1 can return the detected language and duration; the gpt-4o* transcribers only return json.
  fd.append('response_format', model.startsWith('whisper') ? 'verbose_json' : 'json');
  fd.append('temperature', '0');
  if (language) fd.append('language', language);
  if (prompt) fd.append('prompt', prompt);
  const res = await request('POST', '/audio/transcriptions', fd, { timeoutMs: 60_000 });
  const j = res.json;
  const seconds = j.duration ?? j.usage?.seconds ?? wavSeconds(buf);
  const lang = { russian: 'ru', kazakh: 'kk', english: 'en' }[String(j.language || '').toLowerCase()] || j.language || language || null;
  return { text: j.text ?? '', language: lang, duration: seconds ?? null, model, usage: { seconds: seconds ?? null, cost: asrCost(model, seconds) }, latency_ms: res.latency_ms };
}

/**
 * Text-to-speech. Returns { audio: base64, mime, format, model, voice, chars, usage: { cost }, latency_ms }.
 * format: 'mp3' (default, plays everywhere) | 'opus' | 'aac' | 'wav'.
 */
export async function speak({ text, voice = VOICE.voice(), format = 'mp3', model = VOICE.tts(), instructions = TTS_INSTRUCTIONS, speed }) {
  const body = { model, voice, input: text, response_format: format };
  if (instructions && !model.startsWith('tts-1')) body.instructions = instructions; // tts-1 rejects instructions
  if (speed) body.speed = speed;
  const res = await request('POST', '/audio/speech', body, { timeoutMs: 30_000, binary: true });
  const mime = { mp3: 'audio/mpeg', opus: 'audio/ogg', aac: 'audio/aac', wav: 'audio/wav' }[format] || 'audio/mpeg';
  return { audio: res.buf.toString('base64'), mime, format, model, voice, chars: text.length, usage: { cost: ttsCost(model, text.length) }, latency_ms: res.latency_ms };
}

function headers(json = true) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw Object.assign(new Error('OPENAI_API_KEY is not set'), { status: 503 });
  return json ? { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } : { Authorization: `Bearer ${key}` };
}

async function request(method, pathname, body, { timeoutMs = 90_000, binary = false } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeoutMs);
  const t0 = Date.now();
  const form = typeof FormData !== 'undefined' && body instanceof FormData; // multipart: fetch sets the boundary
  try {
    const r = await fetch(`${BASE}${pathname}`, { method, headers: headers(!form), body: form ? body : body ? JSON.stringify(body) : undefined, signal: ctrl.signal });
    if (binary && r.ok) return { buf: Buffer.from(await r.arrayBuffer()), latency_ms: Date.now() - t0 };
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
