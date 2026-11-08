// Read-only saved-result revalidation. This endpoint has no inference entry point.
import { send, preflight, body, fail } from '../lib/http.js';
import { fairnessEnabled, validateFairness } from '../lib/fairness.js';

export default async function handler(req, res) {
  if (preflight(req, res)) return;
  if (req.method !== 'POST') return send(res, 405, { error: 'POST only' });
  if (!fairnessEnabled()) return send(res, 200, { enabled: false });
  try {
    const b = await body(req);
    if (!b.conversation?.conversation_id || !Array.isArray(b.conversation?.transcript)
      || !b.checklist?.criteria?.length || !b.result?.answers) return send(res, 400, { error: 'conversation, checklist and saved result required' });
    if (b.conversation.transcript.length > 600 || b.checklist.criteria.length > 100
      || JSON.stringify(b).length > 2_000_000) return send(res, 413, { error: 'validation input too large' });
    return send(res, 200, { enabled: true, fairness: validateFairness(b.conversation, b.result, b.checklist, { legacy: true }) });
  } catch (error) { fail(res, error); }
}
