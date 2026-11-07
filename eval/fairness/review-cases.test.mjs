import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyEvidenceProposal, validateCurrentCase } from './review-cases-lib.mjs';
import { fingerprint } from './validation.mjs';
import { buildMessages, schemaFor } from '../../lib/evaluator.js';
import { buildFairnessMessages, CANDIDATE_VERSION } from './evaluator-candidate.mjs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const conversations = read('data/datasets/DEV.json').data.records;
const current = read('data/evaluations/DEV.json');
const checklist = read('data/checklists/freedom-chat-v1.json');
const historic = read('eval/runs/transcript-compat-audit.json');
function fixture(id) {
  const c = structuredClone(conversations.find(c => c.conversation_id === id));
  const filename = historic.file_cache.dialogs.find(d => d.id === id).filename;
  const result = read(filename);
  const criterionId = id === 'p1-ru-010' ? 'c08' : 'c06';
  const p = { status: 'proposed_for_owner_review', conversation_id: id, criterion_id: criterionId,
    transcript_sha256: fingerprint(c.transcript), checklist_sha256: fingerprint(checklist), result_sha256: fingerprint(result),
    original_answer: result.answers[criterionId].answer, evidence: structuredClone(current.results[id].answers[criterionId].evidence) };
  return { c, result, p };
}

test('upstream c08=no now cites checked operator range, not na_condition', () => {
  const c = conversations.find(c => c.conversation_id === 'p1-ru-010');
  assert.equal(validateCurrentCase(c, current.results[c.conversation_id], 'c08'), true);
  assert.ok(!current.results[c.conversation_id].answers.c08.evidence.some(e => e.kind === 'na_condition'));
  assert.equal(c.transcript[14].speaker, 'system');
});

test('upstream full c06 points now cite the actual operator response', () => {
  const c = conversations.find(c => c.conversation_id === 'p1-en-010');
  assert.equal(validateCurrentCase(c, current.results[c.conversation_id], 'c06'), true);
});

for (const id of ['p1-ru-010', 'p1-en-010']) {
  test(`legacy evidence-only proposal leaves verdicts and originals unchanged: ${id}`, () => {
    const { c, result, p } = fixture(id), before = structuredClone(result);
    const patched = applyEvidenceProposal(result, c, checklist, p);
    assert.deepEqual(result, before);
    for (const [criterion, row] of Object.entries(before.answers)) assert.equal(patched.answers[criterion].answer, row.answer);
    assert.deepEqual(patched.answers[p.criterion_id].evidence, current.results[id].answers[p.criterion_id].evidence);
  });
}

test('stale or unbound repair proposals are rejected', () => {
  const { c, result, p } = fixture('p1-ru-010');
  c.transcript[10].text += ' changed';
  assert.throws(() => applyEvidenceProposal(result, c, checklist, p), /Stale/);
});

test('repair proposal cannot forge a quote or change the answer', () => {
  const { c, result, p } = fixture('p1-en-010');
  p.evidence = [{ kind: 'message', turn_index: 9, quote: 'invented quote' }];
  assert.throws(() => applyEvidenceProposal(result, c, checklist, p), /original transcript/);
  p.original_answer = 0;
  assert.throws(() => applyEvidenceProposal(result, c, checklist, p), /preserve/);
});

for (const version of ['eval-v4', 'eval-v5.1']) {
  test(`candidate preserves explicit base prompt/schema generation: ${version}`, () => {
    const c = conversations[0];
    assert.equal(buildFairnessMessages(c, checklist, version)[1].content, buildMessages(c, checklist, version)[1].content);
    assert.equal(Object.hasOwn(schemaFor(checklist, version).properties, 'facts'), version !== 'eval-v4');
    assert.ok(!CANDIDATE_VERSION.includes('eval-v4'));
  });
}
