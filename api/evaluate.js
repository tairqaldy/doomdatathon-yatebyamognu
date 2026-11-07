// POST /api/evaluate { conversation_id, group?, checklist, model?, force? } → AI answers + evidence (cached).
// Points/total are computed client-side by the deterministic scoring engine.
import { send, preflight, body, fail } from '../lib/http.js';
import { evaluate } from '../lib/evaluator.js';
import { findConversation } from '../lib/data.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const conv = b.conversation || (await findConversation(b.conversation_id, b.group || 'DEV'));
    if (!conv) return send(res, 404, { error: 'conversation not found' });
    if (!b.checklist?.criteria?.length) return send(res, 400, { error: 'checklist with criteria required' });
    const t0 = Date.now();
    const r = await evaluate(conv, b.checklist, { model: b.model, force: Boolean(b.force) });
    send(res, 200, { conversation_id: conv.conversation_id, cached: r.cached, cache_tier: r.tier, served_ms: Date.now() - t0, ...r.value });
  } catch (e) { fail(res, e); }
}
