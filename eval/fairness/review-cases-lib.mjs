// Evidence-only proposals. No cache writes, no answer overrides, no claim of human verification.
import { fingerprint } from './validation.mjs';

export function applyEvidenceProposal(result, conversation, checklist, proposal) {
  if (proposal.status !== 'proposed_for_owner_review'
    || proposal.conversation_id !== conversation.conversation_id
    || proposal.transcript_sha256 !== fingerprint(conversation.transcript)
    || proposal.checklist_sha256 !== fingerprint(checklist)
    || proposal.result_sha256 !== fingerprint(result)) throw new Error('Stale or unbound proposal');
  const before = result.answers?.[proposal.criterion_id];
  if (!before || before.answer !== proposal.original_answer || !Array.isArray(proposal.evidence) || !proposal.evidence.length) throw new Error('Proposal must preserve an existing verdict');
  const n = conversation.transcript.length;
  const inRange = i => Number.isInteger(i) && i >= 0 && i < n;
  for (const e of proposal.evidence) {
    if (e.kind === 'message' && inRange(e.turn_index) && typeof e.quote === 'string'
      && e.quote.length && conversation.transcript[e.turn_index].text.includes(e.quote)) continue;
    if (e.kind === 'range' && Array.isArray(e.range) && e.range.length === 2 && e.range.every(inRange) && e.range[0] <= e.range[1]) continue;
    throw new Error('Evidence must exist in the original transcript');
  }
  const patched = structuredClone(result);
  patched.answers[proposal.criterion_id].evidence = structuredClone(proposal.evidence);
  return patched;
}

export function validateCurrentCase(conversation, result, criterionId) {
  const row = result.answers[criterionId];
  if (criterionId === 'c08') return row.answer === 'no'
    && row.evidence.some(e => e.kind === 'range' && e.range?.[0] === 10 && e.range?.[1] === 31);
  return row.answer === 10 && row.evidence.some(e => e.kind === 'message' && e.turn_index === 9
    && conversation.transcript[9].speaker === 'operator' && conversation.transcript[9].text.includes(e.quote));
}
