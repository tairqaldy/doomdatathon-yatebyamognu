// GET /api/audio?id=<conversation_id>[&group=DEV] → 302 to a fresh mp3 link (organizer links expire after ~1h).
import { send, fail } from '../lib/http.js';
import { findConversation } from '../lib/data.js';
import { resolveAudio } from '../lib/audio.js';

export default async function handler(req, res) {
  try {
    const u = new URL(req.url, 'http://x');
    const conv = await findConversation(u.searchParams.get('id'), u.searchParams.get('group') || 'DEV');
    if (!conv?.audio_url) return send(res, 404, { error: 'no audio for this conversation' });
    const mp3 = await resolveAudio(conv.audio_url);
    res.statusCode = 302; res.setHeader('Location', mp3); res.setHeader('Cache-Control', 'no-store'); res.end();
  } catch (e) { fail(res, e); }
}
