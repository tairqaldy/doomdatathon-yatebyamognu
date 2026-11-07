import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildMessages } from '../../lib/evaluator.js';
import { buildFairnessMessages, reviewEvaluation } from './evaluator-candidate.mjs';
import { fingerprint, GUARD_VERSION } from './validation.mjs';

const load = file => JSON.parse(readFileSync(file, 'utf8'));
const checklist = load('data/checklists/freedom-chat-v1.json');
const dataset = load('data/datasets/DEV.json').data.records;
const evaluations = load('data/evaluations/DEV.json').results;
const conversation = dataset.find(c => c.conversation_id === 'p4-ru-005');
const boundProbe = (c, status) => ({ id: c.conversation_id, status, guard_version: GUARD_VERSION,
  transcript_sha256: fingerprint(c.transcript), quality_checks_completed: true, quality_flags: [],
  message_index: c.transcript.findIndex(m => m.speaker === 'operator') });

test('candidate preserves transcript, checklist, original prompt and index anchors', () => {
  const original = buildMessages(conversation, checklist);
  const before = structuredClone({ conversation, checklist });
  const messages = buildFairnessMessages(conversation, checklist);
  assert.equal(messages[1].content, original[1].content);
  assert.ok(messages[0].content.startsWith(original[0].content));
  assert.deepEqual({ conversation, checklist }, before);
  assert.match(messages[0].content, /ASR/);
});

test('uncertain voice deduction is withheld from confirmed score; no unauthorized N/A', () => {
  const before = structuredClone(evaluations[conversation.conversation_id]);
  const review = reviewEvaluation(conversation, before, checklist, boundProbe(conversation, 'needs_review'));
  assert.equal(review.publishable, false);
  assert.equal(review.confirmed_total, null);
  assert.equal(typeof review.provisional_total, 'number');
  assert.equal(before.answers.c01.answer, 'no');
  assert.deepEqual(before, evaluations[conversation.conversation_id]);
});

test('quality uncertainty never clears a detected critical violation', () => {
  const c = dataset.find(c => c.conversation_id === 'p1-kz-015');
  const review = reviewEvaluation(c, evaluations[c.conversation_id], checklist, boundProbe(c, 'needs_review'));
  assert.equal(review.gross_error, true);
  assert.equal(review.confirmed_total, null);
});

test('clear case preserves existing deterministic total', () => {
  const c = dataset.find(c => c.conversation_id === 'p1-ru-002');
  const review = reviewEvaluation(c, evaluations[c.conversation_id], checklist, boundProbe(c, 'supported'));
  assert.equal(review.pending_review.length, 0);
  assert.equal(review.publishable, true);
  assert.equal(review.confirmed_total, review.provisional_total);
});

test('missing criteria or evaluator validation problems prevent confirmation', () => {
  const result = structuredClone(evaluations[conversation.conversation_id]);
  delete result.answers.c03;
  result.problems = ['c03: missing'];
  const review = reviewEvaluation(conversation, result, checklist, boundProbe(conversation, 'supported'));
  assert.equal(review.publishable, false);
  assert.ok(review.pending_review.some(p => p.reason === 'incomplete_evaluation'));
});

test('dynamic criterion replacement does not trigger obsolete c01 policy', () => {
  const custom = structuredClone(checklist);
  custom.criteria.find(c => c.id === 'c01').id = 'custom-opening';
  const result = structuredClone(evaluations[conversation.conversation_id]);
  result.answers['custom-opening'] = result.answers.c01;
  delete result.answers.c01;
  const messages = buildFairnessMessages(conversation, custom);
  assert.match(messages[1].content, /id: custom-opening/);
  const review = reviewEvaluation(conversation, result, custom, boundProbe(conversation, 'needs_review'));
  assert.equal(review.pending_review.length, 0);
});

test('editing criterion meaning with the same ID also disables the greeting policy', () => {
  const custom = structuredClone(checklist);
  custom.criteria.find(c => c.id === 'c01').description = 'Check whether an account was verified.';
  const review = reviewEvaluation(conversation, evaluations[conversation.conversation_id], custom, boundProbe(conversation, 'needs_review'));
  assert.equal(review.pending_review.length, 0);
  assert.doesNotMatch(buildFairnessMessages(conversation, custom)[0].content, /официальный c01 требует/);
});
