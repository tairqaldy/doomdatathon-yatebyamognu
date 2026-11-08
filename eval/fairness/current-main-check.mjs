// Read pinned upstream objects; no checkout, inference or production edits.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fingerprint, validateEvaluation } from './validation.mjs';

globalThis.fetch = () => { throw new Error('Offline verification forbids network calls'); };
const revision = execFileSync('git', ['rev-parse', 'origin/main'], { encoding: 'utf8' }).trim();
const show = path => execFileSync('git', ['show', `${revision}:${path}`], { encoding: 'utf8', maxBuffer: 32 * 1024 * 1024 });
const json = path => JSON.parse(show(path));
const moduleOf = source => import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const dataset = json('data/datasets/DEV.json');
const checklist = json('data/checklists/freedom-chat-v1.json');
const saved = json('data/evaluations/DEV.json');
const scoring = await moduleOf(show('prototype/scoring.js'));
const stub = `data:text/javascript;base64,${Buffer.from("export const MODELS = {}; export const chatJSON = () => { throw Error('Inference forbidden'); }; export const cached = () => { throw Error('Cache mutation forbidden'); };").toString('base64')}`;
let source = show('lib/evaluator.js');
for (const name of ['llm', 'cache']) {
  assert.ok(source.includes(`'./${name}.js'`), `Inspect changed upstream import: ${name}`);
  source = source.replace(`'./${name}.js'`, `'${stub}'`);
}
const evaluator = await moduleOf(source);
assert.equal(saved.prompt_version, evaluator.PROMPT_VERSION, 'Saved results are stale relative to upstream default');
const dialogs = dataset.data.records;
const gold = readdirSync('eval/gold').filter(f => f.endsWith('.json')).map(file => {
  const local = JSON.parse(readFileSync(`eval/gold/${file}`, 'utf8'));
  assert.equal(fingerprint(local), fingerprint(json(`eval/gold/${file}`)), `Gold differs from upstream: ${file}`);
  return local;
}).filter(g => g.status === 'reviewed');
const checks = scoring.selfTest(checklist).map(([name, passed]) => ({ name, passed }));
const perfect = Object.fromEntries(checklist.criteria.map(c => [c.id, c.type === 'flag' ? 'no' : c.type === 'scale' ? Math.max(...c.scale.map(s => s.value)) : 'yes']));
checks.push({ name: 'perfect answers return 100.00', passed: scoring.score(checklist, perfect).total === 100 });
const na = checklist.criteria.find(c => c.na_allowed && c.weight > 0);
if (na) checks.push({ name: 'perfect answers with N/A return 100.00', passed: scoring.score(checklist, { ...perfect, [na.id]: 'na' }).total === 100 });
assert.ok(checks.every(c => c.passed), 'Upstream scoring regression');
const validations = dialogs.map(c => {
  const result = saved.results[c.conversation_id];
  assert.ok(result, `Missing saved evaluation: ${c.conversation_id}`);
  const validation = validateEvaluation(c, result, checklist);
  const answers = Object.fromEntries(Object.entries(result.answers).map(([id, row]) => [id, row.answer]));
  return { conversation_id: c.conversation_id, structural_issues: validation.issues,
    answer_count: Object.keys(result.answers).length, gross_error: result.gross_error,
    computed_gross_error: scoring.score(checklist, answers).gross_error,
    diagnostics: result.problems || [] };
});
// Use the established metrics harness with pinned inputs, without duplicating its math.
assert.equal(show('prototype/scoring.js').replace(/\r\n/g, '\n'), readFileSync('prototype/scoring.js', 'utf8').replace(/\r\n/g, '\n'), 'Local metrics engine differs from upstream');
const temp = mkdtempSync(join(tmpdir(), 'cqa-main-offline-'));
const paths = ['run.json', 'dataset.json', 'checklist.json'].map(f => join(temp, f));
try {
  const evaluations = Object.entries(saved.results).map(([id, result]) => {
    const computed = scoring.score(checklist, Object.fromEntries(Object.entries(result.answers).map(([cid, row]) => [cid, row.answer])));
    return { conversation_id: id, checklist_id: checklist.id, checklist_version: checklist.version,
      total: computed.total, gross_error: computed.gross_error,
      criteria: computed.criteria.map(row => ({ ...row, ...result.answers[row.criterion_id] })) };
  });
  const values = [{ meta: { source_revision: revision, prompt_version: saved.prompt_version, model: saved.model }, evaluations }, dataset, checklist];
  paths.forEach((path, i) => writeFileSync(path, JSON.stringify(values[i])));
  execFileSync(process.execPath, ['eval/accuracy.ts', paths[0], '--dataset', paths[1], '--checklist', paths[2], '--reviewed-only', '--json', 'eval/runs/current-main-saved.metrics.json'], { stdio: 'pipe' });
} finally {
  for (const path of paths) { try { unlinkSync(path); } catch (error) { if (error.code !== 'ENOENT') throw error; } }
  rmdirSync(temp);
}
const addendum = readFileSync('eval/fairness/prompt-addendum.txt', 'utf8');
const pairs = dialogs.map(c => {
  const messages = evaluator.buildMessages(c, checklist, evaluator.PROMPT_VERSION);
  const candidate = messages.map((m, i) => i === 0 ? { ...m, content: `${m.content}\n\n${addendum}` } : m);
  return { conversation_id: c.conversation_id, transcript_sha256: fingerprint(c.transcript), baseline_messages_sha256: fingerprint(messages), candidate_messages_sha256: fingerprint(candidate) };
});
const metrics = JSON.parse(readFileSync('eval/runs/current-main-saved.metrics.json', 'utf8'));
assert.ok(metrics.overall.n > 0 && metrics.scored_dialogs === metrics.gold_dialogs, 'Incomplete gold metric coverage');
const ordinal = { comparable: 0, lower_than_gold: 0, higher_than_gold: 0, na_mismatches: 0 };
for (const g of gold) for (const c of checklist.criteria.filter(c => c.type !== 'flag')) {
  const expected = g.labels[c.id]?.answer, actual = saved.results[g.conversation_id]?.answers[c.id]?.answer;
  if (expected === undefined || actual === undefined) continue;
  if (expected === 'na' || actual === 'na') { ordinal.na_mismatches += Number(expected !== actual); continue; }
  const value = a => a === 'yes' ? 1 : a === 'no' ? 0 : a;
  ordinal.comparable++;
  ordinal.lower_than_gold += Number(value(actual) < value(expected));
  ordinal.higher_than_gold += Number(value(actual) > value(expected));
}
ordinal.false_penalty_rate = ordinal.lower_than_gold / ordinal.comparable;
ordinal.false_pass_rate = ordinal.higher_than_gold / ordinal.comparable;
// Temporary file paths are not durable provenance; bind metrics to the pinned objects instead.
metrics.run = `${revision}:data/evaluations/DEV.json`;
writeFileSync('eval/runs/current-main-saved.metrics.json', JSON.stringify(metrics, null, 2) + '\n');
const report = { revision, mode: 'offline_saved_result_check_not_controlled_AB', paid_calls: 0,
  prompt_version: saved.prompt_version, model: saved.model, checklist_sha256: fingerprint(checklist),
  scoring_checks: checks, dialogs: dialogs.length, validation: validations, ordinal_errors: {
    ...ordinal, definition: 'Strict directional mismatches / comparable non-flag gold criteria; excludes N/A on either side. Also-acceptable alternatives are not applied. Rates describe gold disagreement, not independently established unfairness.' },
  validation_scope: 'Raw findings from the older audit validator, not a publication or invalidity decision. missing_original_reference includes allowed N/A; unexpected_criterion may be newer c09. Requires current policy classification.',
  paired_prompt_preparation: { executed: false, samples_per_arm: evaluator.DEFAULT_SAMPLES,
    schema_sha256: fingerprint(evaluator.schemaFor(checklist, evaluator.PROMPT_VERSION)),
    addendum_sha256: fingerprint(addendum), dialogs: pairs,
    note: 'Hashes only; no generations. Full population manifest, not an approved paid sample selection. Freeze budget and effective provider settings before execution.' },
  human_audio_reviews: 'not_supplied', qa_security_approval: 'pending', independent_human_test: 'not_available' };
writeFileSync('eval/runs/current-main-readiness.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ revision, prompt: saved.prompt_version, dialogs: dialogs.length,
  scoring_checks: checks.length, structural_issue_dialogs: validations.filter(r => r.structural_issues.length).length,
  metrics: metrics.overall, paid_calls: 0 }, null, 2));
