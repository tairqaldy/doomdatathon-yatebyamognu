// POST /api/evaluate { conversation_id, group?, checklist, model?, force? } → AI answers + evidence (cached).
// Points/total are computed client-side by the deterministic scoring engine.
import { send, preflight, body, fail } from '../lib/http.js';
import { evaluateWithAudio as evaluate } from '../lib/tone.js'; // text criteria → lib/evaluator.js, audio criteria (calls) → lib/tone.js
import { findConversation } from '../lib/data.js';

// 3 parallel samples: chats ≈ 30–60 s, long calls ≈ 2–2.5 min. Fluid compute allows 300 s.
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const conv = b.conversation || (await findConversation(b.conversation_id, b.group || 'DEV'));
    if (!conv) return send(res, 404, { error: 'conversation not found' });
    if (!b.checklist?.criteria?.length) return send(res, 400, { error: 'checklist with criteria required' });
    const t0 = Date.now();
    // Vote over every sample that finishes within 4 min (the evaluator's own Vercel default is 45 s, set for the old 60 s limit).
    const deadlineMs = Number(process.env.CQA_EVAL_DEADLINE_MS) || 240000;
    const r = await evaluate(conv, b.checklist, { model: b.model, force: Boolean(b.force), deadlineMs });
    send(res, 200, { conversation_id: conv.conversation_id, cached: r.cached, cache_tier: r.tier, served_ms: Date.now() - t0, ...r.value });
  } catch (e) { fail(res, e); }
}
