// Inspect current saved text samples, separately from the pinned historical v5.1 audit.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { hashKey, logicFingerprint } from '../../lib/cache.js';
import { combineSamples } from '../../lib/evaluator.js';
import { fingerprint } from './validation.mjs';
globalThis.fetch = () => { throw new Error('Offline citation inspection forbids inference'); };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const saved = read('data/evaluations/DEV.json');
const checklist = read('data/checklists/freedom-chat-v1.json');
const dataset = read('data/datasets/DEV.json').data.records;
const canonical = createHash('sha1').update(execFileSync('git', ['show', 'HEAD:lib/evaluator.js'])).digest('hex').slice(0, 12);
const current = logicFingerprint('eval');
const file = (c, i, fp) => `eval/cache/eval/${hashKey('eval', fp, saved.prompt_version, saved.model, c.conversation_id, c.transcript, checklist.criteria, `sample-${i}`)}.json`;
const counts = fp => dataset.reduce((n, c) => n + [0, 1, 2].filter(i => existsSync(file(c, i, fp))).length, 0);
const cases = ['p4-ru-005', 'p4-ru-004'].map(id => {
  const c = dataset.find(c => c.conversation_id === id);
  const samples = [0, 1, 2].map(i => read(file(c, i, canonical)));
  const before = fingerprint(samples);
  const tagged = samples.map((s, i) => ({ ...structuredClone(s), answers: Object.fromEntries(Object.entries(s.answers).map(([id, r]) => [id, { ...structuredClone(r), __sample: i + 1 }])) }));
  const merged = combineSamples(tagged, c, checklist);
  const expected = Object.fromEntries(checklist.criteria.map(k => [k.id, saved.results[id].answers[k.id]]));
  const actual = Object.fromEntries(Object.entries(merged.answers).map(([k, r]) => { const { __sample, ...plain } = r; return [k, plain]; }));
  assert.deepEqual(actual, expected, 'Current sample replay differs; do not infer provenance');
  const diagnostics = samples.flatMap((s, i) => s.problems.map(problem => {
    const match = problem.match(/^(c\d+): quote not found in turn (\d+)$/);
    assert.ok(match, 'Unclassified diagnostic');
    const [, criterion, turn] = match, index = Number(turn), message = c.transcript[index];
    assert.ok(message, 'Reference does not exist');
    return { sample: i + 1, criterion_id: criterion, turn_index: index, speaker: message.speaker,
      selected_sample: merged.answers[criterion].__sample ?? null,
      selected: merged.answers[criterion].__sample === i + 1,
      original_model_quote_recoverable: false, message_sha256: fingerprint(message.text) };
  }));
  assert.equal(fingerprint(samples), before);
  return { conversation_id: id, diagnostics, replay_matches_saved_text_answers: true, warnings_cleared: false };
});
const report = { prompt_version: saved.prompt_version, source_evaluator_sha256: fingerprint(readFileSync('lib/evaluator.js', 'utf8').replace(/\r\n/g, '\n')),
  cache: { git_lf_fingerprint: canonical, worktree_fingerprint: current, lf_hits: counts(canonical), worktree_hits: counts(current), expected: 195 },
  total_diagnostics: cases.reduce((n, c) => n + c.diagnostics.length, 0),
  selected: cases.flatMap(c => c.diagnostics).filter(d => d.selected).length,
  unselected: cases.flatMap(c => c.diagnostics).filter(d => !d.selected).length,
  note: 'The normalized cache replaces original model quotes with transcript prefixes. Exact offending strings cannot be recovered here. No verdict, evidence, cache or warning changes.', paid_calls: 0, cases };
writeFileSync('eval/runs/fairness-current-citations.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ diagnostics: report.total_diagnostics, selected: report.selected, unselected: report.unselected, cache: report.cache }, null, 2));
