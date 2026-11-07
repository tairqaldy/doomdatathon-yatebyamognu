// POST /api/insights { question, stats } (admin token required) → { answer, findings, actions, risks, follow_up_questions }
import { send, preflight, body, fail } from '../lib/http.js';
import { verify } from '../lib/auth.js';
import { askInsights } from '../lib/insights.js';
export const config = { maxDuration: 60 };
export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!verify(req)) return send(res, 401, { error: 'admin login required' });
  try {
    const b = await body(req);
    if (!b.question || !b.stats) return send(res, 400, { error: 'question and stats required' });
    send(res, 200, await askInsights(String(b.question).slice(0, 600), b.stats));
  } catch (e) { fail(res, e); }
}
