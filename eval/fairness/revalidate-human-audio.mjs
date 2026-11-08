import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fingerprint } from './validation.mjs';
import { assessHumanAudioReview, HUMAN_AUDIO_REVIEW_VERSION } from './human-audio-review.mjs';
import { reviewEvaluation } from './evaluator-candidate.mjs';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
globalThis.fetch = () => { throw new Error('Audio review revalidation must remain offline'); };
const index = process.argv.indexOf('--ref');
const revision = index < 0 ? null : execFileSync('git', ['rev-parse', process.argv[index + 1]], { encoding: 'utf8' }).trim();
const sourceRead = path => revision ? JSON.parse(execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 })) : read(path);
const dataset = sourceRead('data/datasets/DEV.json').data.records;
const checklist = sourceRead('data/checklists/freedom-chat-v1.json');
const saved = sourceRead('data/evaluations/DEV.json');
const observations = read('eval/fairness/human-audio-findings.json');
const probes = read('eval/runs/transcript-compat-guard.json').c01_probes;
const rows = observations.reviews.map(review => {
  const conversation = dataset.find(c => c.conversation_id === review.conversation_id);
  const result = saved.results[review.conversation_id];
  const before = fingerprint(result);
  const audio = assessHumanAudioReview(conversation, checklist, review);
  const validation = reviewEvaluation(conversation, result, checklist, probes.find(p => p.id === review.conversation_id), { humanAudioReview: review });
  if (fingerprint(result) !== before) throw new Error('Source result changed');
  return { conversation_id: review.conversation_id, prompt_version: saved.prompt_version,
    source_result_sha256: before, existing_c01: result.answers.c01.answer,
    audio, candidate_validation_status: validation.status,
    full_candidate_findings: validation.findings,
    c01_findings: validation.findings.filter(f => f.criterion_id === 'c01'),
    source_result_unchanged: true, confirmed_score: null, final_c01_verdict: null };
});
writeFileSync(revision ? 'eval/runs/human-audio-main-revalidation.json' : 'eval/runs/human-audio-revalidation.json', JSON.stringify({
  scope: 'Offline candidate revalidation of user-reported audio findings; not an applied production decision',
  source_revision: revision, validator_scope: 'Offline fairness candidate, not the deployed evaluator',
  human_audio_validation_version: HUMAN_AUDIO_REVIEW_VERSION,
  compatibility_note: 'Full candidate validation may be invalid for upstream calls containing C09 outside this eight-criterion checklist. Human C01 assessment is reported separately; it does not clear unrelated findings or imply an application defect.',
  source_reviews_sha256: fingerprint(observations), paid_calls: 0, score_changes: 0,
  c08_approval: 'separate_pending_process', rows }, null, 2) + '\n');
console.log(`${rows.length} human observations recorded; final C01 decisions pending; 0 score changes.`);
