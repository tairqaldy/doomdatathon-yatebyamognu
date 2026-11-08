// Optional post-generation validation; never calls evaluate(), a provider, or cache writers.
import { readFileSync } from 'node:fs';
import { reviewEvaluation } from '../eval/fairness/evaluator-candidate.mjs';
import { fingerprint } from '../eval/fairness/validation.mjs';

export const fairnessEnabled = () => process.env.CQA_TRANSCRIPT_FAIRNESS === '1';
const read = path => JSON.parse(readFileSync(new URL(path, import.meta.url), 'utf8'));
const probes = read('../eval/runs/transcript-compat-guard.json').c01_probes;
const humanReviews = read('../eval/fairness/human-audio-findings.json').reviews;

export function validateFairness(conversation, result, checklist, { legacy = false } = {}) {
  const probe = probes.find(p => p.id === conversation.conversation_id);
  const humanAudioReview = humanReviews.find(r => r.conversation_id === conversation.conversation_id);
  const validation = reviewEvaluation(conversation, result, checklist, probe, {
    mode: legacy ? 'legacy' : 'current', humanAudioReview, requireLegacyC08Approval: true,
  });
  // Checklists may carry different names/version metadata while criteria are unchanged. The sidecar
  // remains strictly bound to the reviewed checklist; a mismatch stays a review request, never a pass.
  return { ...validation, input_sha256: fingerprint({ transcript: conversation.transcript, checklist, result }),
    verification: 'automated_validation_not_human_score_approval', generation_modified: false };
}

export function attachFairness(conversation, result, checklist, options) {
  if (!fairnessEnabled()) return result;
  return { ...result, fairness: validateFairness(conversation, result, checklist, options) };
}
