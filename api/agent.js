// POST /api/agent { messages: [{speaker, text}], page: { screen, catalog, dom, text }, language }
//   → { reply, language, handoff, handoff_reason, actions[], cached, model, latency_ms, usage, prompt_version }
// Navigation agent for the /broker mock app (lib/nav-agent.js). Actions are validated against what the page declared.
import { send, preflight, body, fail } from '../lib/http.js';
import { navReply } from '../lib/nav-agent.js';

export const config = { maxDuration: 30 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const messages = (b.messages || [])
      .filter((m) => m && typeof m.text === 'string' && ['client', 'bot', 'operator', 'system'].includes(m.speaker))
      .map((m) => ({ speaker: m.speaker, text: m.text.slice(0, 2000) }))
      .slice(-30);
    if (!messages.some((m) => m.speaker === 'client')) return send(res, 400, { error: 'at least one client message required' });
    const page = b.page && typeof b.page === 'object' ? b.page : {};
    const language = ['RU', 'KZ', 'EN'].includes(b.language) ? b.language : 'RU';
    send(res, 200, await navReply(messages, page, { language }));
  } catch (e) { fail(res, e); }
}
