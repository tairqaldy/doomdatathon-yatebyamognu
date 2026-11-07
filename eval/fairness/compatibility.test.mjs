import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { reviewEvaluation, revalidateCachedEvaluation } from './evaluator-candidate.mjs';
import { fingerprint, GUARD_VERSION } from './validation.mjs';
import { VALIDATION_VERSION } from './policy.mjs';
import { score } from '../../prototype/scoring.js';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
function fixture() {
  const c = read('data/datasets/DEV.json').data.records.find(c => c.conversation_id === 'p1-ru-002');
  const cl = read('data/checklists/freedom-chat-v1.json');
  const r = read('data/evaluations/DEV.json').results[c.conversation_id];
  const p = { id: c.conversation_id, status: 'supported', message_index: c.transcript.findIndex(m => m.speaker === 'operator'),
    guard_version: GUARD_VERSION, transcript_sha256: fingerprint(c.transcript), quality_checks_completed: true, quality_flags: [] };
  return { c, cl, r, p };
}
const review = (f, options = {}) => reviewEvaluation(f.c, f.r, f.cl, f.p, options);
function makeNA(f) {
  f.r.answers.c03 = { answer: 'na', explanation: 'Общий вопрос о тарифах не требовал проверки личности.', deduction_reason: '',
    evidence: [{ kind: 'na_condition', quote: 'Защищённых действий или запроса личных данных не было.' }] };
}
function envelope(f, validation_version) {
  return { value: f.r, transcript_sha256: fingerprint(f.c.transcript), checklist_sha256: fingerprint(f.cl), validation_version };
}
function applicability(f, applies) {
  return { c03: { source: 'human_review', reviewer: 'test-fixture-reviewer', applies,
    reason: applies ? 'По проверенному контексту требовалась идентификация.' : 'Проверен общий вопрос, идентификация не требовалась.',
    transcript_sha256: fingerprint(f.c.transcript), checklist_sha256: fingerprint(f.cl) } };
}

test('documented NA may use condition-only evidence without a direct quote', () => {
  const f = fixture(); makeNA(f); const before = structuredClone(f);
  const r = review(f);
  assert.equal(r.status, 'valid'); assert.equal(r.publishable, true);
  assert.equal(r.criteria.find(c => c.criterion_id === 'c03').na_assessment.status, 'valid');
  assert.equal(r.dimensions.evaluation_correctness.status, 'not_independently_verified');
  assert.deepEqual(f, before);
});

test('clear NA explanation alone is acceptable; absence does not require an invented quote', () => {
  const f = fixture(); makeNA(f); f.r.answers.c03.evidence = [];
  assert.equal(review(f).publishable, true);
});

test('NA never silently increases or changes existing answers or denominator', () => {
  const f = fixture(); makeNA(f);
  const expected = score(f.cl, Object.fromEntries(Object.entries(f.r.answers).map(([id, row]) => [id, row.answer])));
  const r = review(f);
  assert.equal(r.provisional_total, expected.total);
  assert.equal(f.r.answers.c03.answer, 'na');
});

for (const reason of ['', 'N/A', 'Не применимо', 'Неизвестно, не могу определить по записи']) {
  test(`insufficient NA explanation requires evidence review: ${JSON.stringify(reason)}`, () => {
    const f = fixture(); makeNA(f); f.r.answers.c03.explanation = reason; f.r.answers.c03.evidence = [];
    const r = review(f, { mode: 'legacy' });
    assert.equal(r.status, 'needs_review'); assert.equal(r.confirmed_total, null);
    assert.equal(r.criteria.find(c => c.criterion_id === 'c03').na_assessment.status, 'unsupported');
    assert.equal(r.dimensions.schema_validation.status, 'valid');
  });
}

test('prohibited NA is invalid, not a compatibility warning', () => {
  const f = fixture(); f.r.answers.c01.answer = 'na'; const r = review(f, { mode: 'legacy' });
  assert.equal(r.status, 'invalid'); assert.equal(r.provisional_total, null);
  assert.equal(r.criteria[0].na_assessment.status, 'invalid');
});

test('bound applicability review contradicting NA requests correction, not automatic yes/no', () => {
  const f = fixture(); makeNA(f); const r = review(f, { applicability: applicability(f, true) });
  assert.equal(r.status, 'needs_review'); assert.equal(r.confirmed_total, null);
  assert.ok(r.findings.some(f => f.reason === 'invalid_na_verdict' && f.action === 'correct_after_review'));
  assert.equal(r.dimensions.evaluation_correctness.status, 'contradicted_by_applicability_review');
  assert.equal(f.r.answers.c03.answer, 'na');
});

test('bound human applicability can confirm NA without fabricating transcript references', () => {
  const f = fixture(); makeNA(f); f.r.answers.c03.evidence = [];
  assert.equal(review(f, { applicability: applicability(f, false) }).status, 'valid');
});

test('stale human applicability review is not reused for a changed transcript', () => {
  const f = fixture(); makeNA(f); const checked = applicability(f, false);
  f.c.transcript[0].text += ' changed'; f.p.transcript_sha256 = fingerprint(f.c.transcript);
  const r = review(f, { applicability: checked });
  assert.equal(r.status, 'needs_review');
  assert.equal(r.criteria.find(c => c.criterion_id === 'c03').na_assessment.basis, 'unbound_applicability_review');
});

test('ordinary missing legacy anchor is a warning, without asserting score correctness', () => {
  const f = fixture(); f.r.answers.c06.evidence = []; const before = structuredClone(f);
  const r = review(f, { mode: 'legacy' });
  assert.equal(r.status, 'warning'); assert.equal(r.publishable, true);
  assert.equal(r.confirmed_total, r.provisional_total);
  assert.equal(r.dimensions.evidence_validity.status, 'warning');
  assert.equal(r.dimensions.evaluation_correctness.status, 'not_independently_verified');
  assert.equal(r.criteria.find(c => c.criterion_id === 'c06').review_status, 'automated_validated_with_warning');
  assert.deepEqual(f, before);
});

test('newly generated verdict with missing ordinary evidence still needs review', () => {
  const f = fixture(); f.r.answers.c06.evidence = [];
  assert.equal(review(f).status, 'needs_review');
});

for (const id of ['c03', 'c08']) {
  test(`legacy missing positive safety evidence remains a blocker: ${id}`, () => {
    const f = fixture(); f.r.answers[id].answer = 'yes'; f.r.answers[id].evidence = [];
    if (id === 'c08') f.r.gross_error = true;
    const r = review(f, { mode: 'legacy' });
    assert.equal(r.status, 'needs_review'); assert.equal(r.publishable, false);
  });
}

test('legacy c08=no with na_condition remains unsupported critical evidence', () => {
  const f = fixture(); f.r.answers.c08.evidence = [{ kind: 'na_condition', quote: 'No violation.' }];
  assert.equal(review(f, { mode: 'legacy' }).status, 'needs_review');
});

test('invalid source quote is evidence review, not proof that the score is wrong', () => {
  const f = fixture(); f.r.answers.c06.evidence[0].quote = 'invented'; const r = review(f, { mode: 'legacy' });
  assert.equal(r.status, 'needs_review'); assert.equal(r.dimensions.schema_validation.status, 'valid');
  assert.equal(r.dimensions.evidence_validity.status, 'needs_review');
  assert.equal(r.dimensions.evaluation_correctness.status, 'not_independently_verified');
  assert.equal(typeof r.provisional_total, 'number');
});

test('legacy client follow-up is warning context for a non-top c06, never a fake operator quote', () => {
  const f = fixture(); const index = f.c.transcript.findIndex(m => m.speaker === 'client');
  f.r.answers.c06.answer = 4;
  f.r.answers.c06.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
  assert.equal(review(f, { mode: 'legacy' }).status, 'warning');
  assert.equal(review(f).status, 'needs_review');
});

test('non-impacting transcript warning does not block an unrelated score', () => {
  const f = fixture(); f.c.transcript[0].asr_confidence = 0.5;
  f.p.transcript_sha256 = fingerprint(f.c.transcript);
  const r = review(f); assert.equal(r.status, 'warning'); assert.equal(r.publishable, true);
  assert.equal(r.dimensions.transcription_reliability.status, 'warning');
});

test('uncertainty in the actual opening still blocks contact confirmation', () => {
  const f = fixture(); f.c.transcript[f.p.message_index].asr_confidence = 0.5;
  f.p.transcript_sha256 = fingerprint(f.c.transcript);
  assert.equal(review(f).status, 'needs_review');
});

test('unversioned cache is revalidated under explicit legacy compatibility rules', () => {
  const f = fixture(); f.r.answers.c06.evidence = []; const e = envelope(f); const before = structuredClone(e);
  const r = revalidateCachedEvaluation(e, f.c, f.cl, f.p);
  assert.equal(r.validation_version, VALIDATION_VERSION); assert.equal(r.source_validation_version, 'unversioned');
  assert.equal(r.validation_mode, 'legacy'); assert.equal(r.status, 'warning');
  assert.deepEqual(e, before);
});

test('old and current validation versions use their declared compatibility interpretation', () => {
  const f = fixture(); f.r.answers.c06.evidence = [];
  assert.equal(revalidateCachedEvaluation(envelope(f, 'transcript-validation-v2'), f.c, f.cl, f.p).status, 'warning');
  assert.equal(revalidateCachedEvaluation(envelope(f, VALIDATION_VERSION), f.c, f.cl, f.p).status, 'needs_review');
});

test('unknown validation version is quarantined, never silently treated as legacy', () => {
  const f = fixture(); const r = revalidateCachedEvaluation(envelope(f, 'future-policy'), f.c, f.cl, f.p);
  assert.equal(r.publishable, false); assert.ok(r.findings.some(f => f.reason === 'unknown_validation_version'));
});

test('legacy mode never bypasses missing probe or cache input binding', () => {
  const f = fixture();
  assert.equal(revalidateCachedEvaluation(envelope(f), f.c, f.cl, undefined).publishable, false);
  assert.equal(revalidateCachedEvaluation({ value: f.r }, f.c, f.cl, f.p).publishable, false);
});

test('warning cannot override a structural invalid result', () => {
  const f = fixture(); f.r.answers.c06.evidence = []; delete f.r.answers.c01;
  const r = review(f, { mode: 'legacy' }); assert.equal(r.status, 'invalid'); assert.equal(r.publishable, false);
  assert.equal(r.provisional_total, null);
});

test('empty conditional quote is a warning if NA has a clear explanation, not a mandatory quotation', () => {
  const f = fixture(); makeNA(f); f.r.answers.c03.evidence[0].quote = '';
  const r = review(f); assert.equal(r.status, 'warning'); assert.equal(r.publishable, true);
});

test('full-credit c06 cannot use only a client question, even in legacy mode', () => {
  const f = fixture(); const index = f.c.transcript.findIndex(m => m.speaker === 'client');
  f.r.answers.c06.answer = 10;
  f.r.answers.c06.evidence = [{ kind: 'message', turn_index: index, quote: f.c.transcript[index].text }];
  assert.equal(review(f, { mode: 'legacy' }).status, 'needs_review');
});

for (const reason of ['General public tariff question; no account information was requested.',
  'Тек жалпы тариф туралы сұрақ қойылды, жеке деректер сұралмады.']) {
  test(`NA justification is not required to reuse Russian checklist keywords: ${reason}`, () => {
    const f = fixture(); makeNA(f); f.r.answers.c03.explanation = reason; f.r.answers.c03.evidence = [];
    assert.equal(review(f).status, 'valid');
  });
}

test('malformed quality flags fail closed without throwing', () => {
  const f = fixture(); f.p.quality_flags = [null];
  assert.equal(review(f).status, 'needs_review');
});

test('a concise event explanation is not rejected because it lacks an arbitrary length', () => {
  const f = fixture(); f.r.answers.c07 = { answer: 'na', explanation: 'Чат оборван.', deduction_reason: '', evidence: [] };
  assert.equal(review(f).status, 'valid');
});

test('uncited uncertainty does not overturn an already supported positive critical verdict', () => {
  const f = fixture();
  f.c = read('data/datasets/DEV.json').data.records.find(c => c.conversation_id === 'p1-ru-022');
  f.r = read('data/evaluations/DEV.json').results[f.c.conversation_id];
  f.cl.criteria = f.cl.criteria.filter(c => c.type === 'flag');
  f.r.answers = { c08: f.r.answers.c08 };
  // Synthetic extra turn on an in-memory fixture; original dataset and labels remain untouched.
  f.c.transcript.push({ speaker: 'operator', timestamp: '09:59', text: 'Спасибо.', asr_confidence: 0.5 });
  f.p.id = f.c.conversation_id; f.p.message_index = f.c.transcript.findIndex(m => m.speaker === 'operator');
  f.p.transcript_sha256 = fingerprint(f.c.transcript);
  const r = review(f);
  assert.equal(r.status, 'warning'); assert.equal(r.publishable, true); assert.equal(r.gross_error, true);
});
