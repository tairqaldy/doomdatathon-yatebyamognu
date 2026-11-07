// POST /api/agent-voice { audio: <base64>, format: 'webm'|'mp4'|'mp3'|'wav'|'ogg', language: 'RU'|'KZ'|'EN' } → { text, language, cached, latency_ms }
// Push-to-talk for the /broker agent: NVIDIA Nemotron 3.5 Transcribe via OpenRouter (lib/openrouter.js).
// Cached under the "asr" namespace, which is gitignored (eval/cache/asr/): a client's voice text is never committed.
import { send, preflight, body, fail } from '../lib/http.js';
import { transcribe, MODELS } from '../lib/openrouter.js';
import { cached, hashKey } from '../lib/cache.js';
import { maskPII } from '../lib/nav-agent.js';

export const config = { maxDuration: 60 };
const MAX_B64 = 3_000_000; // ~2.2 MB of audio, well under Vercel's 4.5 MB body limit (≈ 1–2 min of opus)
const FORMATS = new Set(['webm', 'mp4', 'mp3', 'wav', 'ogg', 'm4a']);

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const audio = typeof b.audio === 'string' ? b.audio.replace(/^data:[^,]*,/, '') : '';
    if (!audio) return send(res, 400, { error: 'audio (base64) required' });
    if (audio.length > MAX_B64) return send(res, 413, { error: 'recording too long, keep it under a minute' });
    const format = FORMATS.has(b.format) ? b.format : 'webm';
    const lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[b.language] || undefined;
    const r = await cached('asr', [MODELS.transcribe, 'agent-voice', hashKey(audio), format, lang || ''], () =>
      transcribe({ base64: audio, format, language: lang }));
    send(res, 200, { text: maskPII(r.value.text || '').trim(), language: r.value.language || lang || null, cached: r.cached, latency_ms: r.value.latency_ms ?? null, model: MODELS.transcribe });
  } catch (e) { fail(res, e); }
}
