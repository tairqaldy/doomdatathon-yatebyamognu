// POST /api/transcribe { conversation_id, group?, language? } → Nemotron 3.5 Transcribe text (cached forever per call).
import { send, preflight, body, fail } from '../lib/http.js';
import { findConversation } from '../lib/data.js';
import { resolveAudio, downloadBase64 } from '../lib/audio.js';
import { transcribe, MODELS } from '../lib/openrouter.js';
import { cached } from '../lib/cache.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const conv = await findConversation(b.conversation_id, b.group || 'DEV');
    if (!conv?.audio_url) return send(res, 404, { error: 'no audio for this conversation' });
    const lang = b.language || { RU: 'ru', KZ: 'kk', EN: 'en' }[conv.language];
    const r = await cached('asr', [MODELS.transcribe, conv.conversation_id, lang], async () => {
      const { base64, bytes } = await downloadBase64(await resolveAudio(conv.audio_url));
      return { ...(await transcribe({ base64, format: 'mp3', language: lang })), bytes };
    });
    send(res, 200, { conversation_id: conv.conversation_id, cached: r.cached, ...r.value });
  } catch (e) { fail(res, e); }
}
