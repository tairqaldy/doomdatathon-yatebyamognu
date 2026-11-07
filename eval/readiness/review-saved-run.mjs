// Read committed artifacts by immutable git SHA, then score locally. No checkout, network or inference.
// node eval/readiness/review-saved-run.mjs <ref> <path/to/evaluations.json>
import fs from 'node:fs';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { execFileSync, spawnSync } from 'node:child_process';
import { hashKey } from '../../lib/cache.js';
import { score, validateAnswer } from '../../prototype/scoring.js';

const [ref, sourcePath] = process.argv.slice(2);
assert(ref && sourcePath, 'Usage: node eval/readiness/review-saved-run.mjs <ref> <evaluations.json>');
const git = args => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
const commit = git(['rev-parse', `${ref}^{commit}`]).trim();
const fromGit = p => git(['show', `${commit}:${p}`]);
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const text = fromGit(sourcePath), raw = JSON.parse(text), rows = Array.isArray(raw) ? raw : raw.evaluations;
assert(Array.isArray(rows) && rows.length > 0, 'Not a saved evaluation run');
const cl = read('data/checklists/freedom-chat-v1.json');
const dataset = read('data/datasets/DEV.json');
assert.deepEqual(JSON.parse(fromGit('data/checklists/freedom-chat-v1.json')), cl, 'Checklist changed since saved run');
assert.deepEqual(JSON.parse(fromGit('data/datasets/DEV.json')), dataset, 'Dataset changed since saved run');
const conversations = new Map(dataset.data.records.map(c => [c.conversation_id, c]));
const gold = fs.readdirSync('eval/gold').filter(f => f.endsWith('.json')).sort().map(f => read(`eval/gold/${f}`));
const remoteGold = gold.map(g => JSON.parse(fromGit(`eval/gold/${g.conversation_id}.json`)));
for (let i = 0; i < gold.length; i++) for (const c of cl.criteria) {
  assert.equal(gold[i].labels[c.id].answer, remoteGold[i].labels[c.id].answer);
  assert.deepEqual(gold[i].labels[c.id].also_acceptable, remoteGold[i].labels[c.id].also_acceptable);
}
const errors = [], checks = [], byId = new Map(rows.map(r => [r.conversation_id, r]));
const check = (ok, message) => { if (!ok) errors.push(message); };
check(byId.size === rows.length, 'Duplicate dialog IDs');
check(rows.length === gold.length && gold.every(g => byId.has(g.conversation_id)), 'Incomplete gold coverage');
let refs = 0, cacheMatches = 0;
const cacheAttempts = [];
for (const r of rows) {
  const conv = conversations.get(r.conversation_id);
  check(!!conv, `${r.conversation_id}: no source`); if (!conv) continue;
  check(r.checklist_id === cl.id && r.checklist_version === cl.version, `${r.conversation_id}: wrong checklist`);
  check(r.criteria.length === cl.criteria.length && new Set(r.criteria.map(c => c.criterion_id)).size === cl.criteria.length, `${r.conversation_id}: criterion count/duplicates`);
  const answers = {};
  for (const c of cl.criteria) {
    const a = r.criteria.find(x => x.criterion_id === c.id), loc = `${r.conversation_id}/${c.id}`;
    check(!!a, `${loc}: missing`); if (!a) continue;
    answers[c.id] = a.answer;
    check(validateAnswer(c, a.answer) === null, `${loc}: invalid answer`);
    check(typeof a.explanation === 'string' && a.explanation.trim().length > 0, `${loc}: missing explanation`);
    check(Array.isArray(a.evidence) && a.evidence.length > 0, `${loc}: missing evidence`);
    for (const ev of a.evidence ?? []) {
      if (ev.kind === 'message') {
        refs++;
        const t = conv.transcript[ev.turn_index];
        check(Number.isInteger(ev.turn_index) && !!t, `${loc}: invalid message`);
        if (ev.quote && t) check(t.text.includes(ev.quote), `${loc}: full quote mismatch`);
      } else if (ev.kind === 'range') {
        refs++;
        const [a, b] = ev.range ?? [];
        check(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b < conv.transcript.length, `${loc}: invalid range`);
      } else if (ev.kind === 'na_condition') {
        check(c.na_allowed && a.answer === 'na', `${loc}: unexpected N/A evidence`);
      } else check(false, `${loc}: unknown evidence kind`);
    }
  }
  const s = score(cl, answers);
  check(s.total === r.total && s.gross_error === r.gross_error, `${r.conversation_id}: stored total/flag differs from engine`);
  for (const c of s.criteria) {
    const saved = r.criteria.find(a => a.criterion_id === c.criterion_id);
    check(saved?.points === c.points && saved?.effective_weight === c.effective_weight, `${r.conversation_id}/${c.criterion_id}: stored scoring fields differ`);
  }
  // Cached answers retain normalization output, not the original model JSON.
  const requestedModel = raw.meta?.evaluator ?? r.model.name;
  const key = hashKey(r.model.prompt_version, requestedModel, r.conversation_id, conv.transcript, cl.criteria);
  try {
    const cached = JSON.parse(fromGit(`eval/cache/eval/${key}.json`));
    const match = r.criteria.every(c => cached.answers[c.criterion_id]?.answer === c.answer && JSON.stringify(cached.answers[c.criterion_id]?.evidence) === JSON.stringify(c.evidence));
    check(match, `${r.conversation_id}: cache/export mismatch`);
    if (match) cacheMatches++;
    cacheAttempts.push({ id: r.conversation_id, attempts: cached.attempts, problems: cached.problems });
  } catch { check(false, `${r.conversation_id}: matching cache missing/unreadable`); }
}
const output = 'eval/runs/readiness-llm.json';
fs.writeFileSync(output, text); // Preserve the source run verbatim; never alter existing run artifacts.
const exec = (name, args, log, env = process.env) => {
  const r = spawnSync(process.execPath, args, { env, encoding: 'utf8', timeout: 60_000 });
  const text = (r.stdout ?? '') + (r.stderr ?? '') + (r.error ? `\n${r.error.message}` : '');
  fs.writeFileSync(log, text);
  const count = k => { const m = text.match(new RegExp(`^# ${k} (\\d+)$`, 'm')); return m ? Number(m[1]) : null; };
  const result = { name, exit_code: r.status, tests: count('tests'), passed: count('pass'), failed: count('fail'), log };
  checks.push(result); return result;
};
exec('saved LLM accuracy', ['eval/accuracy.ts', output, '--json', 'eval/runs/readiness-llm.metrics.json'], 'eval/runs/readiness-llm-accuracy.log');
exec('saved LLM c08 regression', ['--test', '--test-reporter=tap', 'eval/readiness/c08-regression.test.mjs'], 'eval/runs/readiness-c08-llm.tap.log', { ...process.env, CQA_READINESS_RUN: output });
const metrics = read('eval/runs/readiness-llm.metrics.json');
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
const official = answers => {
  let w = 0, p = 0;
  for (const c of cl.criteria) {
    const a = answers[c.id]; if (c.type === 'flag' || c.weight <= 0 || a === 'na' || a == null) continue;
    w += c.weight;
    p += c.type === 'binary' ? (a === 'yes' ? c.weight : 0) : c.weight * a / Math.max(...c.scale.map(s => s.value));
  }
  return w ? round(p / w * 100) : null;
};
const diffs = gold.map(g => Math.abs(official(Object.fromEntries(byId.get(g.conversation_id).criteria.map(c => [c.criterion_id, c.answer]))) - official(Object.fromEntries(Object.entries(g.labels).map(([k, v]) => [k, v.answer])))));
const cases = read('eval/readiness/c08-cases.json').cases.map(c => ({ ...c, result: byId.get(c.conversation_id).criteria.find(r => r.criterion_id === 'c08') }));
const summary = { source_commit: commit, source_path: sourcePath, source_sha256: crypto.createHash('sha256').update(text).digest('hex'),
  replayed_at: new Date().toISOString(), new_api_calls: 0, new_cost_usd: 0, mode: 'Offline rescoring of a teammate-provided saved LLM run; not a new inference run',
  remote_reviewed: remoteGold.filter(g => g.status === 'reviewed').length, local_gold_status_preserved: true,
  validation: { dialogs: rows.length, criteria: rows.reduce((n, r) => n + r.criteria.length, 0), message_and_range_refs: refs, errors, cache_matches: cacheMatches, cache_attempts: cacheAttempts },
  metrics: { strict: metrics.overall.strict, lenient: metrics.overall.lenient, gross_violation_recall: metrics.gross_error.recall,
    tp: metrics.gross_error.tp, fn: metrics.gross_error.fn, fp: metrics.gross_error.fp, total_mae_existing_engine: metrics.total.mae,
    total_mae_official_formula: diffs.reduce((s, d) => s + d, 0) / diffs.length, per_language: metrics.per_language, per_criterion: metrics.per_criterion },
  c08_cases: cases, checks };
fs.writeFileSync('eval/runs/readiness-llm-summary.json', JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify({ source_commit: commit, validation: summary.validation, metrics: summary.metrics, checks }, null, 2));
process.exitCode = errors.length || checks.some(c => c.exit_code !== 0) ? 1 : 0;
