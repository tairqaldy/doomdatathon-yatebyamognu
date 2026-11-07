// Offline readiness audit. Writes only eval/runs/readiness-*; never invokes evaluate() or an API.
// Exit 1 is expected while production regression requirements fail; see the JSON/TAP artifacts.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { loadEnv } from '../../scripts/env.mjs';

loadEnv();
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const digest = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const git = args => execFileSync('git', args, { encoding: 'utf8' }).trim();
const walk = dir => !fs.existsSync(dir) ? [] : fs.readdirSync(dir, { withFileTypes: true }).flatMap(e =>
  e.isDirectory() ? walk(path.join(dir, e.name)) : e.isFile() ? [path.join(dir, e.name).replaceAll('\\', '/')] : []);
const protectedPaths = ['app', 'server', 'api', 'lib', 'prototype', 'data', 'scripts', 'eval/gold'].flatMap(walk)
  .concat(['eval/GOLD_AUDIT_REPORT.md', 'eval/audit-gold.mjs', 'eval/lib.ts', 'eval/accuracy.ts', 'eval/run-mock.ts'])
  .concat(walk('eval/runs').filter(p => !path.basename(p).startsWith('readiness-')))
  .filter(p => fs.existsSync(p));
const before = Object.fromEntries(protectedPaths.sort().map(p => [p, digest(p)]));
const remote = git(['rev-parse', 'origin/main']);
const gold = fs.readdirSync('eval/gold').filter(f => f.endsWith('.json')).sort().map(f => read(`eval/gold/${f}`));
const remoteGold = gold.map(g => JSON.parse(git(['show', `${remote}:eval/gold/${g.conversation_id}.json`])));
const answerProjection = g => Object.fromEntries(Object.entries(g.labels).map(([k, v]) => [k, [v.answer, v.also_acceptable]]));
const sameAnswers = gold.every((g, i) => JSON.stringify(answerProjection(g)) === JSON.stringify(answerProjection(remoteGold[i])));
const implementationDiff = git(['diff', '--name-only', 'HEAD', remote, '--', 'lib', 'api', 'prototype', 'scripts/eval-run.mjs', 'eval/accuracy.ts', 'eval/lib.ts']);
const env = { ...process.env };
delete env.CQA_READINESS_RUN; // This audit intentionally measures the current mock, not an inherited external file.
const execute = (name, args, log) => {
  const r = spawnSync(process.execPath, args, { encoding: 'utf8', env, timeout: 60_000 });
  const output = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? `\n${r.error.message}\n` : '');
  fs.writeFileSync(log, output);
  const count = key => { const m = output.match(new RegExp(`^# ${key} (\\d+)$`, 'm')); return m ? Number(m[1]) : null; };
  return { name, command: `node ${args.join(' ')}`, exit_code: r.status, signal: r.signal,
    tests: count('tests'), passed: count('pass'), failed: count('fail'), log };
};
fs.mkdirSync('eval/runs', { recursive: true });
const checks = [];
checks.push(execute('mock c08 regression', ['--test', '--test-reporter=tap', 'eval/readiness/c08-regression.test.mjs'], 'eval/runs/readiness-c08-mock.tap.log'));
checks.push(execute('LLM contract regression with synthetic responses', ['--test', '--test-reporter=tap', 'eval/readiness/evaluator-contract.test.mjs'], 'eval/runs/readiness-contract.tap.log'));
checks.push(execute('mock full gold run', ['eval/run-mock.ts', '--out', 'eval/runs/readiness-mock.json'], 'eval/runs/readiness-mock-run.log'));
checks.push(execute('existing accuracy harness', ['eval/accuracy.ts', 'eval/runs/readiness-mock.json', '--json', 'eval/runs/readiness-mock.metrics.json'], 'eval/runs/readiness-accuracy.log'));
checks.push(execute('existing scoring self-tests', ['scripts/test-scoring.mjs'], 'eval/runs/readiness-scoring.log'));

const cl = read('data/checklists/freedom-chat-v1.json');
const official = answers => {
  let p = 0, w = 0;
  for (const c of cl.criteria) {
    const a = answers[c.id];
    if (c.type === 'flag' || c.weight <= 0 || a === 'na' || a == null) continue;
    w += c.weight;
    p += c.type === 'binary' ? (a === 'yes' ? c.weight : 0) : c.weight * a / Math.max(...c.scale.map(s => s.value));
  }
  return w ? Math.round((100 * p / w + Number.EPSILON) * 100) / 100 : null;
};
let metrics = null, independentMAE = null, cases = [];
if (checks[2].exit_code === 0 && checks[3].exit_code === 0) {
  metrics = read('eval/runs/readiness-mock.metrics.json');
  const run = read('eval/runs/readiness-mock.json').evaluations;
  const rows = new Map(run.map(r => [r.conversation_id, r]));
  const diffs = gold.map(g => {
    const r = rows.get(g.conversation_id);
    return Math.abs(official(Object.fromEntries(r.criteria.map(c => [c.criterion_id, c.answer]))) - official(Object.fromEntries(Object.entries(g.labels).map(([k, v]) => [k, v.answer]))));
  });
  independentMAE = diffs.reduce((s, d) => s + d, 0) / diffs.length;
  cases = read('eval/readiness/c08-cases.json').cases.map(c => ({ ...c, observed_mock: rows.get(c.conversation_id).criteria.find(r => r.criterion_id === 'c08').answer }));
}
const runInventory = walk('eval/runs').filter(p => p.endsWith('.json') && !path.basename(p).startsWith('readiness-')).map(p => {
  const raw = read(p), evaluations = Array.isArray(raw) ? raw : raw.evaluations;
  return { file: p, evaluations: Array.isArray(evaluations) ? evaluations.length : 0,
    models: Array.isArray(evaluations) ? [...new Set(evaluations.map(e => e.model?.name).filter(Boolean))] : [] };
});
const changed = protectedPaths.filter(p => !fs.existsSync(p) || digest(p) !== before[p]);
const savedReviewPath = 'eval/runs/readiness-llm-summary.json';
const savedReview = fs.existsSync(savedReviewPath) ? read(savedReviewPath) : null;
const result = {
  generated_at: new Date().toISOString(), node: process.version, branch: git(['branch', '--show-current']),
  head: git(['rev-parse', 'HEAD']), inspected_origin_main: remote,
  evaluator_implementation_matches_origin_main: implementationDiff === '',
  local_gold_status: gold.map(g => ({ id: g.conversation_id, status: g.status })),
  remote_gold_reviewed: remoteGold.filter(g => g.status === 'reviewed').length,
  gold_answers_and_alternatives_match_origin_main: sameAnswers,
  configuration: { env_file_present: fs.existsSync('.env'), api_key_present: Boolean(process.env.OPENROUTER_API_KEY?.trim()),
    model_override_present: Boolean(process.env.CQA_EVAL_MODEL?.trim()), remote_cache_configured: Boolean(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
    local_cache_files: walk(process.env.CQA_CACHE_DIR || 'eval/cache').length, precomputed_files: walk('data/evaluations').length },
  inference: { actual_network_requests: 0, paid_calls: 0, fresh_llm_inference: false,
    saved_llm_rescoring_available: Boolean(savedReview),
    reason: 'This runner measures mock and contract behavior only. Saved LLM rescoring is a separate offline step.' },
  saved_llm_review: savedReview ? { file: savedReviewPath, source_commit: savedReview.source_commit,
    source_path: savedReview.source_path, validation_errors: savedReview.validation.errors, metrics: savedReview.metrics } : null,
  checks, run_inventory: runInventory, c08_cases: cases,
  mock_metrics: metrics ? { dialogs: metrics.scored_dialogs, strict_accuracy: metrics.overall.strict, lenient_accuracy: metrics.overall.lenient,
    gross_violation_recall: metrics.gross_error.recall, gross_tp: metrics.gross_error.tp, gross_fn: metrics.gross_error.fn, gross_fp: metrics.gross_error.fp,
    total_mae_existing_engine: metrics.total.mae, total_mae_official_formula: independentMAE } : null,
  protected_file_hashes: before, changed_protected_files: changed,
};
fs.writeFileSync('eval/runs/readiness-summary.json', JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ checks, configuration: result.configuration, mock_metrics: result.mock_metrics, changed_protected_files: changed }, null, 2));
process.exitCode = changed.length || checks.some(c => c.exit_code !== 0) ? 1 : 0;
