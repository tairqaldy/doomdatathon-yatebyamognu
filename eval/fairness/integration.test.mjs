import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { attachFairness, validateFairness } from '../../lib/fairness.js';
import handler from '../../api/validate-evaluation.js';
import { summaryHTML, criterionHTML } from '../../admin/fairness.js';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const dataset = read('data/datasets/DEV.json').data.records;
const saved = read('data/evaluations/DEV.json');
const chat = read('data/checklists/freedom-chat-v1.json');
const call = read('data/checklists/freedom-call-v1.json');
const fixture = (id = 'p4-ru-002') => ({ conversation: structuredClone(dataset.find(c => c.conversation_id === id)), result: structuredClone(saved.results[id]), checklist: structuredClone(id.startsWith('p4-') ? call : chat) });
const withFlag = async (value, fn) => {
  const old = process.env.CQA_TRANSCRIPT_FAIRNESS, fetch = globalThis.fetch;
  process.env.CQA_TRANSCRIPT_FAIRNESS = value;
  globalThis.fetch = () => { throw new Error('Network forbidden'); };
  try { return await fn(); } finally {
    globalThis.fetch = fetch;
    if (old === undefined) delete process.env.CQA_TRANSCRIPT_FAIRNESS; else process.env.CQA_TRANSCRIPT_FAIRNESS = old;
  }
};
const invoke = async body => {
  let response;
  const res = { setHeader() {}, end(text) { response = { status: this.statusCode, data: JSON.parse(text) }; } };
  await handler({ method: 'POST', body }, res);
  return response;
};
test('disabled flag preserves the exact existing evaluator value', () => withFlag('0', () => {
  const f = fixture(); assert.equal(attachFairness(f.conversation, f.result, f.checklist), f.result);
}));
test('enabled post-generation validation preserves answers, transcripts and cache reuse', () => withFlag('1', () => {
  const f = fixture(), before = structuredClone(f);
  const a = attachFairness(f.conversation, f.result, f.checklist, { legacy: true });
  const b = attachFairness(f.conversation, f.result, f.checklist, { legacy: true });
  assert.deepEqual(f, before); assert.equal(a.answers, f.result.answers);
  assert.deepEqual(a.fairness, b.fairness); assert.equal(a.fairness.confirmed_total, null);
  assert.equal(a.fairness.official_result_changed, false);
  assert.equal(a.fairness.dimensions.transcription_reliability.audio_reviewed, true);
}));
test('read-only API is disabled by default and revalidates saved data without inference', async () => {
  await withFlag('0', async () => assert.deepEqual((await invoke({})).data, { enabled: false }));
  await withFlag('1', async () => {
    const result = await invoke(fixture());
    assert.equal(result.status, 200); assert.equal(result.data.enabled, true);
    assert.equal(result.data.fairness.confirmed_total, null);
    assert.equal((await invoke({})).status, 400);
  });
});
test('C09 is accepted with call checklist and operator evidence; chat still rejects unknown criterion', () => {
  const f = fixture('p4-ru-001');
  const a = validateFairness(f.conversation, f.result, f.checklist, { legacy: true });
  assert.ok(!a.findings.some(f => f.reason === 'unexpected_criterion'));
  assert.ok(a.criteria.some(c => c.criterion_id === 'c09'));
  const b = validateFairness(f.conversation, f.result, chat, { legacy: true });
  assert.equal(b.status, 'invalid');
  assert.ok(b.findings.some(f => f.reason === 'unexpected_criterion' && f.criterion_id === 'c09'));
});
test('audio source, speaker, original quote and index requirements remain enforced', () => {
  const f = fixture('p4-ru-001');
  delete f.result.audio_model;
  assert.ok(validateFairness(f.conversation, f.result, call).findings.some(f => f.reason === 'audio_source_unverified'));
  f.result.audio_model = 'test-audio-model';
  const client = f.conversation.transcript.findIndex(m => m.speaker === 'client');
  f.result.answers.c09.evidence = [{ kind: 'message', turn_index: client, quote: f.conversation.transcript[client].text }];
  assert.ok(validateFairness(f.conversation, f.result, call).findings.some(f => f.reason === 'evidence_speaker_mismatch' && f.criterion_id === 'c09'));
  f.result.answers.c09.evidence[0] = { kind: 'message', turn_index: 99999, quote: 'invented' };
  assert.ok(validateFairness(f.conversation, f.result, call).findings.some(f => f.reason === 'invalid_message_evidence'));
});
test('unapproved legacy C08 exception blocks confirmation, positive violations stay visible', () => {
  const f = fixture('p1-ru-002');
  f.result.answers.c08 = { answer: 'no', evidence: [], explanation: 'No gross error found.', deduction_reason: '' };
  const a = validateFairness(f.conversation, f.result, chat, { legacy: true });
  assert.ok(a.findings.some(f => f.reason === 'legacy_c08_security_approval_pending'));
  assert.equal(a.confirmed_total, null);
  for (const c of dataset.filter(c => saved.results[c.conversation_id].answers.c08.answer === 'yes')) {
    assert.equal(validateFairness(c, saved.results[c.conversation_id], c.channel === 'voice call' ? call : chat, { legacy: true }).gross_error, true);
  }
});
test('all three human C01 findings remain provisional with C09 present', () => {
  for (const id of ['p4-ru-002', 'p4-ru-005', 'p4-ru-004']) {
    const f = fixture(id), a = validateFairness(f.conversation, f.result, call, { legacy: true });
    assert.equal(a.criteria.find(c => c.criterion_id === 'c01').validation_status, 'needs_review');
    assert.equal(a.confirmed_total, null); assert.equal(a.dimensions.transcription_reliability.audio_reviewed, true);
    assert.equal(a.gross_error, f.result.gross_error);
  }
});
test('unknown or edited transcripts cannot inherit a completed probe or human approval', () => {
  const f = fixture(); f.conversation.transcript[2].text += ' changed';
  const a = validateFairness(f.conversation, f.result, call);
  assert.equal(a.publishable, false);
  assert.ok(a.findings.some(f => f.reason === 'stale_or_unbound_human_audio_review'));
});
test('valid, warning, needs_review and invalid remain distinct; legacy policy stays versioned', () => {
  const valid = fixture('p1-ru-002'), warning = fixture('p1-ru-009');
  assert.equal(validateFairness(valid.conversation, valid.result, chat, { legacy: true }).status, 'valid');
  assert.equal(validateFairness(warning.conversation, warning.result, chat, { legacy: true }).status, 'warning');
  assert.equal(validateFairness(valid.conversation, valid.result, chat).validation_mode, 'current');
  valid.result.answers.c01.answer = 'na';
  assert.equal(validateFairness(valid.conversation, valid.result, chat).status, 'invalid');
});
test('changed call C01 still preserves human observations without approving the new rule', () => {
  const f = fixture(); f.checklist.criteria[0].description = 'A replacement criterion';
  const a = validateFairness(f.conversation, f.result, f.checklist, { legacy: true });
  assert.equal(a.dimensions.transcription_reliability.audio_reviewed, true);
  assert.ok(a.findings.some(f => f.reason === 'human_audio_checklist_decision_pending'));
  assert.equal(a.confirmed_total, null);
});
test('QA formatting separates validation status and preliminary score from AI verdict', () => {
  const f = fixture(), a = validateFairness(f.conversation, f.result, call, { legacy: true });
  const html = summaryHTML(a), criterion = criterionHTML(a, 'c01');
  assert.match(html, /Предварительный балл AI/); assert.match(html, /Подтверждённый балл QA: —/);
  assert.match(criterion, /Начало записи отсутствует/);
  assert.match(summaryHTML(null), /не завершена/);
});
