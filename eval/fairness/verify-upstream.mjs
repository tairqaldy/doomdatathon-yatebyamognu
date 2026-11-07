// Inspect and execute pinned upstream code in memory. No checkout/merge or model call.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

const revision = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
const show = path => execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8' });
const moduleOf = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const scoring = await moduleOf(show('prototype/scoring.js'));
const checklist = JSON.parse(readFileSync('data/checklists/freedom-chat-v1.json', 'utf8'));
const checks = scoring.selfTest(checklist).map(([name, passed]) => ({ name, passed }));
const perfectNA = { c01: 'yes', c02: 'na', c03: 'yes', c04: 20, c05: 'yes', c06: 10, c07: 'yes', c08: 'no' };
checks.push({ name: 'perfect applicable answers return 100.00, never 99.99', passed: scoring.score(checklist, perfectNA).total === 100 });
const goldRows = readdirSync('eval/gold').filter(f => f.endsWith('.json')).map(f => {
  const g = JSON.parse(readFileSync(`eval/gold/${f}`, 'utf8'));
  const answers = Object.fromEntries(Object.entries(g.labels).map(([id, value]) => [id, value.answer]));
  const applicable = checklist.criteria.filter(c => c.weight > 0 && answers[c.id] !== 'na');
  const raw = applicable.reduce((sum, c) => sum + (c.type === 'scale'
    ? c.weight * answers[c.id] / Math.max(...c.scale.map(s => s.value)) : answers[c.id] === 'yes' ? c.weight : 0), 0);
  const expected = Math.round(raw / applicable.reduce((sum, c) => sum + c.weight, 0) * 10000 + 1e-7) / 100;
  const total = scoring.score(checklist, answers).total;
  return { id: g.conversation_id, total, expected, passed: total === expected };
});
let evaluatorSource = show('lib/evaluator.js');
for (const name of ['llm', 'cache']) evaluatorSource = evaluatorSource.replace(`'./${name}.js'`, `'${pathToFileURL(resolve(`lib/${name}.js`)).href}'`);
const { normalize } = await moduleOf(evaluatorSource);
const conv = { transcript: [{ speaker: 'operator', text: 'Hello, my name is John.' }] };
const flag = { criteria: [checklist.criteria.find(c => c.id === 'c08')] };
const normal = normalize({ criteria: [{ criterion_id: 'c08', answer: 'yes', evidence: [] }] }, conv, flag);
checks.push({ name: 'upstream diagnoses unsupported c08=yes', passed: normal.problems.some(p => p.includes('no transcript evidence')) });
const report = { revision, mode: 'in-memory upstream verification, no inference', checks, gold_rounding: goldRows,
  note: 'Other evaluator retry and quote behaviors were inspected, not exhaustively retested here.' };
writeFileSync('eval/runs/transcript-upstream-check.json', JSON.stringify(report, null, 2)+'\n');
assert.ok(checks.every(c => c.passed), 'upstream regression failed');
assert.ok(goldRows.every(c => c.passed), 'gold total regression failed');
console.log(`${revision.slice(0, 7)}: ${checks.length} checks + ${goldRows.length} gold totals passed`);
