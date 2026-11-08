// POST /api/evaluate { conversation_id, group?, checklist, model?, force? } → AI answers + evidence (cached).
// Points/total are computed client-side by the deterministic scoring engine.
import { send, preflight, body, fail } from '../lib/http.js';
import { evaluateWithAudio as evaluate } from '../lib/tone.js'; // text criteria → lib/evaluator.js, audio criteria (calls) → lib/tone.js
import { findConversation } from '../lib/data.js';
import { annotateRoles, NO_CLIENT_MESSAGE } from '../lib/roles.js';

const SPEAKERS = new Set(['client', 'operator', 'bot', 'system']);
const ORGANIZER_AUDIO = /^https:\/\/[a-z0-9.-]+\.powerplatform\.com\//i;
/** A dialog sent inline (pasted or uploaded in /admin «Загрузка»): check the shape and cap sizes, so any new transcript
 *  can be evaluated without being in a bundled dataset. audio_url is kept only for the organizers' host (no open fetch). */
export function cleanConversation(c, { requireOperator = true } = {}) {
  const bad = (m) => Object.assign(new Error(`conversation: ${m}`), { status: 400 });
  if (!c || typeof c !== 'object') throw bad('object required');
  const id = String(c.conversation_id || '').trim();
  if (!id || id.length > 120) throw bad('conversation_id required (≤ 120 chars)');
  if (!Array.isArray(c.transcript) || !c.transcript.length) throw bad('transcript must be a non-empty array');
  if (c.transcript.length > 600) throw bad('transcript is too long (> 600 turns)');
  const transcript = c.transcript.map((m, i) => {
    const speaker = String(m?.speaker || '').toLowerCase();
    if (!SPEAKERS.has(speaker)) throw bad(`turn ${i}: speaker must be client, operator, bot or system`);
    const text = String(m?.text ?? '').slice(0, 6000);
    return { timestamp: String(m?.timestamp ?? '').slice(0, 40), speaker, text };
  });
  if (requireOperator && !transcript.some((m) => m.speaker === 'operator')) throw bad('no operator turns to evaluate');
  const audio = typeof c.audio_url === 'string' && ORGANIZER_AUDIO.test(c.audio_url) ? c.audio_url : null;
  return { conversation_id: id, channel: String(c.channel || 'agent chat').slice(0, 40), language: String(c.language || 'RU').toUpperCase().slice(0, 4), transcript, audio_url: audio };
}

// 3 parallel samples: chats ≈ 30–60 s, long calls ≈ 2–2.5 min. Fluid compute allows 300 s.
export const config = { maxDuration: 300 };

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  try {
    const b = await body(req);
    const raw = b.conversation || await findConversation(b.conversation_id, b.group || 'DEV');
    if (!raw) return send(res, 404, { error: 'conversation not found' });
    if (!b.checklist?.criteria?.length) return send(res, 400, { error: 'checklist with criteria required' });
    // lib/roles.js: operator → colleague turns become system context, «operator:Имя» speakers are normalised.
    // Single-operator dialogs keep the same transcript, so their cache keys (and answers) do not change.
    const { roles, ...annotated } = annotateRoles(raw);
    if (roles.no_client) {
      // nothing to grade: the checklist is about the operator's work with a client, so no model call
      const c = b.conversation ? cleanConversation(annotated, { requireOperator: false }) : annotated;
      return send(res, 200, { conversation_id: c.conversation_id, no_client: true, message: NO_CLIENT_MESSAGE, answers: {}, summary: null,
        model: null, cached: false, usage: { cost: 0 }, problems: [], roles });
    }
    const conv = b.conversation ? cleanConversation(annotated) : annotated;
    const t0 = Date.now();
    // Vote over every sample that finishes within 4 min (the evaluator's own Vercel default is 45 s, set for the old 60 s limit).
    const deadlineMs = Number(process.env.CQA_EVAL_DEADLINE_MS) || 240000;
    const r = await evaluate(conv, b.checklist, { model: b.model, force: Boolean(b.force), deadlineMs });
    send(res, 200, { conversation_id: conv.conversation_id, cached: r.cached, cache_tier: r.tier, served_ms: Date.now() - t0, ...r.value, roles });
  } catch (e) { fail(res, e); }
}
