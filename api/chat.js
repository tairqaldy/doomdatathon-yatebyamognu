// POST /api/chat { messages: [{speaker, text}] } → { reply, handoff, handoff_reason, topic, language, ... }
import { send, preflight, body, fail } from '../lib/http.js';
import { botReply } from '../lib/support-bot.js';
export const config = { maxDuration: 30 };
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const messages = (b.messages || []).filter((m) => m && typeof m.text === 'string').map((m) => ({ speaker: m.speaker, text: m.text.slice(0, 2000) })).slice(-30);
    if (!messages.length) return send(res, 400, { error: 'messages required' });
    send(res, 200, await botReply(messages, { lang: ['RU', 'KZ', 'EN'].includes(b.lang) ? b.lang : null }));
  } catch (e) { fail(res, e); }
}
