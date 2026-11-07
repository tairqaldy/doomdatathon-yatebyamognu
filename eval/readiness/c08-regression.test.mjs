// Offline semantic regression gate. Expected failures remain failures (no TODO/skip masking).
// node --test eval/readiness/c08-regression.test.mjs
// Set CQA_READINESS_RUN to a saved Evaluation[] run to check another evaluator without calling it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { mockEvaluate } from '../../prototype/mock-evaluator.js';
import { score } from '../../prototype/scoring.js';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const checklist = read('data/checklists/freedom-chat-v1.json');
const ds = new Map(read('data/datasets/DEV.json').data.records.map(c => [c.conversation_id, c]));
const gold = fs.readdirSync('eval/gold').filter(f => f.endsWith('.json')).sort().map(f => read(`eval/gold/${f}`));
const cases = read('eval/readiness/c08-cases.json').cases;
let saved;
if (process.env.CQA_READINESS_RUN) {
  const raw = read(process.env.CQA_READINESS_RUN);
  const rows = Array.isArray(raw) ? raw : raw.evaluations;
  assert(Array.isArray(rows), 'Expected Evaluation[] or { evaluations: Evaluation[] }');
  saved = new Map(rows.map(r => [r.conversation_id, r]));
  assert.equal(saved.size, rows.length, 'Duplicate conversation IDs in saved run');
}

test('seven fixed cases cover exactly the gold c08 positives and cite real operator turns', () => {
  assert.equal(cases.length, 7);
  assert.equal(new Set(cases.map(c => c.conversation_id)).size, 7);
  assert.deepEqual(cases.map(c => c.conversation_id).sort(), gold.filter(g => g.labels.c08.answer === 'yes').map(g => g.conversation_id).sort());
  for (const c of cases) {
    const conv = ds.get(c.conversation_id);
    assert.equal(conv.language, c.language);
    assert.equal(c.expected_answer, 'yes');
    for (const i of c.context_turns) assert(Number.isInteger(i) && !!conv.transcript[i]);
    for (const i of c.violation_turns) {
      assert.equal(conv.transcript[i].speaker, 'operator');
      assert(gold.find(g => g.conversation_id === c.conversation_id).labels.c08.evidence.includes(i));
    }
  }
});

for (const g of gold) {
  test(`${saved ? 'saved run' : 'MOCK'} ${g.conversation_id}: c08=${g.labels.c08.answer}`, () => {
    const conv = ds.get(g.conversation_id);
    let r, gross;
    if (saved) {
      const evaluation = saved.get(g.conversation_id);
      assert(evaluation, `Missing evaluation: ${g.conversation_id}`);
      assert.equal(evaluation.checklist_id, checklist.id);
      assert.equal(evaluation.checklist_version, checklist.version);
      const rows = evaluation.criteria.filter(x => x.criterion_id === 'c08');
      assert.equal(rows.length, 1, 'Exactly one c08 result required');
      r = rows[0]; gross = evaluation.gross_error;
    } else {
      const raw = mockEvaluate(conv, checklist);
      r = raw.c08;
      gross = score(checklist, Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, v.answer]))).gross_error;
    }
    // Lenient alternatives must never hide missed critical violations in this regression gate.
    assert.equal(r.answer, g.labels.c08.answer, `Missed/misclassified c08 for ${g.conversation_id}`);
    assert.equal(gross, g.labels.c08.answer === 'yes', 'Result flag must agree with c08');
    if (g.labels.c08.answer === 'no') return;
    const relevant = new Set(cases.find(c => c.conversation_id === g.conversation_id).violation_turns);
    const cited = [];
    for (const ev of r.evidence ?? []) {
      if (ev.kind === 'message') {
        assert(Number.isInteger(ev.turn_index) && !!conv.transcript[ev.turn_index], 'Invalid message reference');
        if (ev.quote) assert(conv.transcript[ev.turn_index].text.includes(ev.quote), 'Quote absent from source');
        cited.push(ev.turn_index);
      } else if (ev.kind === 'range') {
        assert(Array.isArray(ev.range) && ev.range.length === 2);
        const [a, b] = ev.range;
        assert(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b < conv.transcript.length);
        for (let i = a; i <= b; i++) cited.push(i);
      } else assert.fail('A positive c08 needs message/range evidence, not N/A');
    }
    assert(cited.some(i => relevant.has(i)), 'Evidence must reach an actual violation turn');
  });
}
