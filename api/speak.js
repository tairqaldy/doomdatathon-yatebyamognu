// POST /api/speak { text, language?: 'RU'|'KZ'|'EN', ui?: true } → { audio: <base64>, mime, cached, tier, latency_ms, … }
// GET  /api/speak → voice config { tts, voice, asr, asr_formats } so clients pick formats and fallbacks up front.
// Spoken replies for AIM (/broker and /support). OpenAI TTS via lib/llm.js, always behind lib/cache.js:
// the same text (+ model + voice) is synthesised once, then served from memory / file / Redis for $0.
//   ns "tts"    → gitignored (eval/cache/tts/): bot replies can repeat what a client said.
//   ns "tts-ui" → committed: fixed UI phrases (greetings) the client marks with ui: true, so a deploy plays them at once.
// No OPENAI_API_KEY → 501 { code: 'tts_unavailable' } and the client falls back to the browser's speechSynthesis.
import { send, preflight, body, fail } from '../lib/http.js';
import { speak, voiceConfig } from '../lib/llm.js';
import { cached } from '../lib/cache.js';

export const config = { maxDuration: 30 };
const MAX_CHARS = 600; // clients send one sentence at a time; this caps a single request (≈ 40 s of speech)
const UI_MAX_CHARS = 240;
// Bumped when the voice instructions change, so cached audio regenerates (like PROMPT_VERSION for evaluations).
export const VOICE_VERSION = 'tts-v1';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method === 'GET') return send(res, 200, { ...voiceConfig(), max_chars: MAX_CHARS, version: VOICE_VERSION });
  if (req.method !== 'POST') return send(res, 405, { error: 'GET or POST only' });
  const t0 = Date.now();
  try {
    const b = await body(req);
    const text = String(b.text || '').replace(/[«»"“”]/g, '').replace(/\s+/g, ' ').trim();
    if (!text) return send(res, 400, { error: 'text required' });
    if (text.length > MAX_CHARS) return send(res, 413, { error: `text too long (max ${MAX_CHARS} characters per request; split by sentence)` });
    const cfg = voiceConfig();
    if (!cfg.tts) return send(res, 501, { error: 'no server voice configured: use the browser voice', code: 'tts_unavailable' });
    const ns = b.ui === true && text.length <= UI_MAX_CHARS ? 'tts-ui' : 'tts';
    const r = await cached(ns, [VOICE_VERSION, cfg.tts, cfg.voice, text], () => speak({ text, format: 'mp3' }));
    const v = r.value;
    send(res, 200, {
      audio: v.audio, mime: v.mime, format: v.format, chars: v.chars,
      cached: r.cached, tier: r.tier, latency_ms: r.cached ? 0 : v.latency_ms, server_ms: Date.now() - t0,
      model: v.model, voice: v.voice, cost_usd: r.cached ? 0 : v.usage?.cost ?? null,
    });
  } catch (e) {
    if (e.code === 'tts_unavailable') return send(res, 501, { error: e.message, code: e.code });
    fail(res, e);
  }
}
