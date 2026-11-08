import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { assessHumanAudioReview } from './human-audio-review.mjs';
import { reviewEvaluation } from './evaluator-candidate.mjs';
const read = p => JSON.parse(readFileSync(p, 'utf8'));
const data = read('data/datasets/DEV.json').data.records;
const checklist = read('data/checklists/freedom-chat-v1.json');
const records = read('eval/fairness/human-audio-findings.json').reviews;
const saved = read('data/evaluations/DEV.json');
const probes = read('eval/runs/transcript-compat-guard.json').c01_probes;
for (const review of records) test(`${review.conversation_id}: record human observation without score or security override`, () => {
  const conv = data.find(c => c.conversation_id === review.conversation_id);
  const result = saved.results[review.conversation_id];
  const before = JSON.stringify({ conv, result, checklist });
  const audio = assessHumanAudioReview(conv, checklist, review);
  assert.equal(audio.observation_status, 'recorded');
  assert.equal(audio.status, 'needs_review');
  assert.equal(audio.score_override, null);
  assert.equal(audio.na_override, false);
  assert.equal(audio.operator_error_established, false);
  assert.equal(audio.security_approval, 'not_granted_by_audio_review');
  const probe = probes.find(p => p.id === conv.conversation_id);
  const base = reviewEvaluation(conv, result, checklist, probe);
  const candidate = reviewEvaluation(conv, result, checklist, probe, { humanAudioReview: review });
  assert.ok(candidate.findings.some(f => f.criterion_id === 'c01' && f.severity === 'needs_review'));
  for (const finding of base.findings) assert.ok(candidate.findings.some(f => JSON.stringify(f) === JSON.stringify(finding)));
  assert.equal(JSON.stringify({ conv, result, checklist }), before);
});
test('missing beginning remains provisional despite organizer N/A ruling', () => {
  const review = records.find(r => r.conversation_id === 'p4-ru-002');
  const audio = assessHumanAudioReview(data.find(c => c.conversation_id === review.conversation_id), checklist, review);
  assert.equal(audio.greeting, 'not_verifiable');
  assert.ok(audio.findings.some(f => f.reason === 'human_confirmed_recording_start_missing'));
  assert.match(audio.policy_followup, /#2978/);
  assert.equal(audio.na_override, false);
});
test('unconfirmed personal introduction does not become proven absence or full pass', () => {
  const review = records.find(r => r.conversation_id === 'p4-ru-005');
  const audio = assessHumanAudioReview(data.find(c => c.conversation_id === review.conversation_id), checklist, review);
  assert.equal(audio.personal_introduction, 'not_confirmed');
  assert.ok(audio.findings.some(f => f.reason === 'personal_introduction_not_confirmed_not_proven_absent'));
});
test('approximate personal introduction retains likely confidence and redaction', () => {
  const review = records.find(r => r.conversation_id === 'p4-ru-004');
  assert.equal(review.personal_introduction, 'likely_confirmed');
  assert.equal(review.wording.verbatim_confirmed, false);
  assert.match(review.wording.approximate_masked, /withheld/);
  assert.equal(review.reviewed_at, null);
});
test('changed source or checklist rejects old human observations', () => {
  const review = records[0], conv = structuredClone(data.find(c => c.conversation_id === review.conversation_id));
  conv.transcript[0].text += ' changed';
  assert.equal(assessHumanAudioReview(conv, checklist, review).observation_status, 'unbound');
  assert.equal(assessHumanAudioReview(data.find(c => c.conversation_id === review.conversation_id), { ...checklist, version: checklist.version + 1 }, review).observation_status, 'unbound');
  assert.equal(assessHumanAudioReview(null, checklist, review).observation_status, 'unbound');
});
test('audio review cannot approve legacy C08', () => {
  const approval = read('eval/fairness/legacy-security-approval.json');
  assert.equal(approval.approval_status, 'pending');
  assert.equal(approval.production_deployment_approved, false);
});
