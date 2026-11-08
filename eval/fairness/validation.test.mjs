import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewEvaluation, revalidateCachedEvaluation } from './evaluator-candidate.mjs';
import { fingerprint, GUARD_VERSION } from './validation.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const seed = read('data/checklists/freedom-chat-v1.json');
const conv = read('data/datasets/DEV.json').data.records.find(c => c.conversation_id === 'p1-ru-002');
const stored = read('data/evaluations/DEV.json').results[conv.conversation_id];
function fixture() {
  const c = structuredClone(conv), r = structuredClone(stored), cl = structuredClone(seed);
  const p = { id: c.conversation_id, guard_version: GUARD_VERSION, transcript_sha256: fingerprint(c.transcript),
    status: 'supported', message_index: c.transcript.findIndex(m => m.speaker === 'operator'),
    quality_checks_completed: true, quality_flags: [] };
  return { c, r, cl, p };
}
const reject = (name, mutate, reason) => test(name, () => {
  const f = fixture(); mutate(f);
  const before = structuredClone(f);
  const result = reviewEvaluation(f.c, f.r, f.cl, f.p);
  assert.equal(result.publishable, false);
  assert.equal(result.confirmed_total, null);
  if (reason) assert.ok(result.pending_review.some(p => p.reason === reason), JSON.stringify(result.pending_review));
  assert.deepEqual(f, before, 'validator must not edit inputs or answers');
});

reject('missing probe fails closed', f => { f.p = undefined; }, 'missing_transcript_probe');
reject('unbound legacy probe fails closed', f => { f.p = { status: 'supported' }; }, 'stale_or_unbound_probe');
reject('probe from another dialog fails closed', f => { f.p.id = 'other'; }, 'stale_or_unbound_probe');
reject('editing transcript invalidates old probe', f => { f.c.transcript[0].text += ' changed'; }, 'stale_or_unbound_probe');
reject('missing quality check fails closed', f => { f.p.quality_checks_completed = false; }, 'incomplete_transcript_probe');
reject('bot turn cannot be used as first operator probe', f => { f.p.message_index = 0; }, 'probe_speaker_mismatch');
reject('unknown probe status fails closed', f => { f.p.status = 'confirmed'; }, 'incomplete_transcript_probe');
reject('missing answers is a diagnostic, not an exception', f => { delete f.r.answers; }, 'incomplete_evaluation');
reject('null result is a diagnostic, not an exception', f => { f.r = null; }, 'incomplete_evaluation');
reject('missing model metadata prevents scoring', f => { delete f.r.model; }, 'invalid_result_metadata');
reject('missing summary prevents scoring', f => { delete f.r.summary; }, 'invalid_summary');
reject('invalid binary answer cannot become a pass', f => { f.r.answers.c01.answer = true; }, 'invalid_answer');
reject('scale answer must be an actual configured step', f => { f.r.answers.c04.answer = 17; }, 'invalid_answer');
reject('prohibited NA cannot hide uncertainty', f => { f.r.answers.c01.answer = 'na'; }, 'invalid_answer');
reject('missing explanation is rejected', f => { delete f.r.answers.c04.explanation; }, 'invalid_criterion_fields');
reject('invented quote is rejected', f => { f.r.answers.c01.evidence[0].quote = 'Invented greeting'; }, 'invalid_message_evidence');
reject('nonexistent evidence index is rejected', f => { f.r.answers.c01.evidence[0].turn_index = 99999; }, 'invalid_message_evidence');
reject('reversed range is rejected', f => { f.r.answers.c04.evidence = [{ kind: 'range', range: [3, 1] }]; }, 'invalid_range_evidence');
reject('bot greeting is not operator evidence', f => {
  const index = f.c.transcript.findIndex(m => m.speaker === 'bot');
  f.r.answers.c01.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
}, 'evidence_speaker_mismatch');
reject('consultation verdict cannot cite only a customer question', f => {
  const index = f.c.transcript.findIndex(m => m.speaker === 'client');
  f.r.answers.c04.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
}, 'evidence_speaker_mismatch');
reject('severe violation cannot be attributed from bot-only evidence', f => {
  const index = f.c.transcript.findIndex(m => m.speaker === 'bot');
  f.r.answers.c08.answer = 'yes';
  f.r.answers.c08.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
}, 'evidence_speaker_mismatch');
reject('customer assertion alone does not establish completed identity verification', f => {
  const index = f.c.transcript.findIndex(m => m.speaker === 'client');
  f.r.answers.c03.answer = 'yes';
  f.r.answers.c03.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
}, 'identity_evidence_speaker_mismatch');
reject('ambiguous identity context needs review, not an automatic failed identity answer', f => {
  // Exercise uncertainty on a concrete operator segment independently of cached evidence shape.
  f.p.quality_flags = [{ index: f.p.message_index, kind: 'damaged_segment' }];
}, 'transcript_quality_warning');
reject('missing audio segment prevents final publication', f => { f.c.audio_missing = true; }, 'source_quality_uncertainty');
reject('low confidence cannot be hidden by a clean probe', f => {
  f.c.transcript[f.p.message_index].asr_confidence = 0.5; f.p.transcript_sha256 = fingerprint(f.c.transcript);
}, 'source_quality_uncertainty');
reject('unknown extra verdict cannot survive a changed checklist', f => { f.r.answers.old_criterion = f.r.answers.c01; }, 'unexpected_criterion');
reject('duplicate checklist IDs are rejected', f => { f.cl.criteria.push(structuredClone(f.cl.criteria[0])); }, 'invalid_criterion');
reject('invalid scale cannot reach scoring', f => { f.cl.criteria.find(c => c.type === 'scale').scale = []; }, 'invalid_scale');
reject('null checklist returns diagnostics', f => { f.cl = null; }, 'invalid_checklist');
reject('non-array transcript cannot crash validation', f => { f.c.transcript = 'broken'; }, 'invalid_transcript');
reject('non-array scale cannot crash validation', f => { f.cl.criteria.find(c => c.type === 'scale').scale = {}; }, 'invalid_scale');
reject('null scale entry cannot crash validation', f => { f.cl.criteria.find(c => c.type === 'scale').scale = [null]; }, 'invalid_scale');
reject('non-string evidence source cannot crash validation', f => {
  f.c.transcript[f.p.message_index].text = 42; f.p.transcript_sha256 = fingerprint(f.c.transcript);
}, 'invalid_transcript');

test('no arithmetic is performed on malformed verdict fields', () => {
  const f = fixture(); delete f.r.answers.c03;
  assert.equal(reviewEvaluation(f.c, f.r, f.cl, f.p).provisional_total, null);
});

for (const [name, answer] of [['injected incorrect-recommendation verdict', 0], ['injected unresolved-request verdict', 5]]) {
  test(`${name} is never upgraded because the opening is uncertain`, () => {
    const f = fixture();
    f.r.answers.c04.answer = answer;
    f.p.status = 'needs_review';
    const review = reviewEvaluation(f.c, f.r, f.cl, f.p);
    assert.equal(f.r.answers.c04.answer, answer);
    assert.equal(review.criteria.find(r => r.criterion_id === 'c04').answer, answer);
    assert.equal(review.publishable, false);
    assert.equal(review.confirmed_total, null);
  });
}

test('a matching cache context is revalidated, and corrupting its quote is caught', () => {
  const f = fixture();
  const envelope = { value: f.r, transcript_sha256: fingerprint(f.c.transcript), checklist_sha256: fingerprint(f.cl) };
  assert.equal(revalidateCachedEvaluation(envelope, f.c, f.cl, f.p).publishable, true);
  envelope.value.answers.c01.evidence[0].quote = 'not in source';
  assert.equal(revalidateCachedEvaluation(envelope, f.c, f.cl, f.p).publishable, false);
});

test('editing a criterion invalidates cache even when the answer still fits its type', () => {
  const f = fixture();
  const envelope = { value: f.r, transcript_sha256: fingerprint(f.c.transcript), checklist_sha256: fingerprint(f.cl) };
  f.cl.criteria[0].description = 'Completely different check';
  const review = revalidateCachedEvaluation(envelope, f.c, f.cl, f.p);
  assert.equal(review.publishable, false);
  assert.ok(review.pending_review.some(p => p.reason === 'cache_context_mismatch'));
  assert.ok(review.criteria.every(r => r.review_status === 'awaiting_verification'));
});

test('cache without input provenance fails closed and never invokes an LLM', () => {
  const f = fixture();
  assert.equal(revalidateCachedEvaluation({ value: f.r }, f.c, f.cl, f.p).publishable, false);
});

test('formatted criterion contains score, verdict, original evidence and separate review state', () => {
  const f = fixture(); const result = reviewEvaluation(f.c, f.r, f.cl, f.p);
  assert.equal(result.publishable, true);
  for (const row of result.criteria) for (const key of ['score', 'verdict', 'evidence', 'explanation', 'transcription_warning', 'review_status']) assert.ok(Object.hasOwn(row, key));
  assert.ok(result.criteria.every(r => r.review_status === 'automated_validated'));
  assert.equal(f.r.answers.c01.answer, 'yes');
});

test('all seven saved gold critical violations remain visible even while pending', () => {
  const conversations = read('data/datasets/DEV.json').data.records;
  const results = read('data/evaluations/DEV.json').results;
  const ids = ['p1-en-013', 'p1-kz-013', 'p1-ru-022', 'p1-ru-029', 'p1-en-014', 'p1-kz-015', 'p1-ru-009'];
  for (const id of ids) {
    const c = conversations.find(c => c.conversation_id === id);
    const r = reviewEvaluation(c, results[id], seed, undefined);
    assert.equal(r.gross_error, true, id);
    assert.equal(r.publishable, false, id);
  }
});
