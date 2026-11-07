// One command for the graded submission (issue #22, docs/case/results-format.md).
//   node eval/control-run.mjs --group <CONTROL_ID> --out results/prod/results.json --expect 10 --push
//   node eval/control-run.mjs --group DEV --out results/dev/results.json --expect 65        (rehearsal / DEV file)
// Steps: 1 fetch + save the set (organizers' API, CQA_API_URL) · 2 evaluate every dialog (cached, parallel)
//        3 retry dialogs that failed, once · 4 export results.json · 5 validate · 6 (--push) commit + push.
// Run it from an up-to-date `main` checkout with keys in .env. It never invents results: a dialog that still fails
// is written as status "error" with the reason, as the format requires.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { loadEnv } from '../scripts/env.mjs';
import { datasetUrl } from '../lib/data.js';
import { buildResults } from './export-results.mjs';
import { validate } from './validate-results.mjs';

loadEnv();
const argv = process.argv.slice(2);
const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
const has = (k) => argv.includes(`--${k}`);
const group = opt('group');
if (!group || !/^[A-Za-z0-9_-]+$/.test(group)) { console.error('usage: node eval/control-run.mjs --group <GROUP_ID> [--out results/prod/results.json] [--expect 10] [--concurrency 8] [--push]'); process.exit(2); }
const outPath = opt('out', group === 'DEV' ? 'results/dev/results.json' : 'results/prod/results.json');
const expect = opt('expect') != null ? Number(opt('expect')) : group === 'DEV' ? null : 10;
const conc = String(opt('concurrency', 8));
const datasetPath = `data/datasets/${group}.json`;
const evalPath = `data/evaluations/${group}.json`;
const t0 = Date.now();
const step = (n, text) => console.log(`\n[${n}/6] ${text}  (+${((Date.now() - t0) / 1000).toFixed(0)} s)`);
const git = (...a) => execFileSync('git', a, { encoding: 'utf8' }).trim();

// 1 · dataset
step(1, `dataset ${group}`);
if (!existsSync(datasetPath)) {
  // Direct organizer API if .env has the real link; otherwise our deployed proxy (/api/dataset), which has it in Vercel.
  const base = process.env.CQA_API_URL;
  const direct = base && !base.includes('<') && /^https?:\/\//.test(base);
  const url = direct ? datasetUrl(base, group)
    : `${process.env.CQA_PROXY_URL || 'https://freedom-cqa.vercel.app'}/api/dataset?group_id=${encodeURIComponent(group)}`;
  console.log(direct ? 'fetching from the organizers\' API (CQA_API_URL)' : `CQA_API_URL missing or a placeholder → fetching through ${url.split('/api/')[0]}/api/dataset`);
  const res = await fetch(url);
  const json = await res.json().catch(() => null);
  const errText = typeof json?.error === 'object' ? JSON.stringify(json.error) : json?.error || '';
  if (!res.ok || !json?.isSuccess || !Array.isArray(json?.data?.records)) { console.error(`dataset fetch failed: HTTP ${res.status} ${errText}`); process.exit(1); }
  mkdirSync('data/datasets', { recursive: true });
  writeFileSync(datasetPath, JSON.stringify(json, null, 2) + '\n');
  console.log(`saved ${datasetPath}`);
}
const raw = JSON.parse(readFileSync(datasetPath, 'utf8'));
const dataset = Array.isArray(raw) ? raw : raw.data.records;
console.log(`${dataset.length} dialogs · ids: ${dataset.map((c) => c.conversation_id).slice(0, 12).join(', ')}${dataset.length > 12 ? '…' : ''}`);
if (expect != null && dataset.length !== expect) console.warn(`⚠ the set has ${dataset.length} dialogs, expected ${expect}: the file will contain exactly what the API returned`);

// 2 · evaluate (scripts/eval-run.mjs: cached, cost/latency logged, writes data/evaluations/<group>.json)
const runEval = (extra = []) => spawnSync(process.execPath, ['scripts/eval-run.mjs', '--group', group, '--concurrency', conc, ...extra], { stdio: 'inherit' });
step(2, `evaluate (concurrency ${conc})`);
if (!has('skip-eval')) runEval();

// 3 · retry failures once
const complete = (r) => r && r.answers && Object.keys(r.answers).length >= 8;
const evals = () => (existsSync(evalPath) ? JSON.parse(readFileSync(evalPath, 'utf8')) : { results: {} });
let missing = dataset.filter((c) => !complete(evals().results?.[c.conversation_id])).map((c) => c.conversation_id);
step(3, missing.length ? `retry ${missing.length} dialog(s): ${missing.join(', ')}` : 'nothing to retry');
if (missing.length && !has('skip-eval')) {
  runEval(['--only', missing.join(',')]);
  missing = dataset.filter((c) => !complete(evals().results?.[c.conversation_id])).map((c) => c.conversation_id);
  if (missing.length) console.warn(`⚠ still failing after retry (will be status "error"): ${missing.join(', ')}`);
}

// 4 · export
step(4, `export → ${outPath}`);
const checklist = JSON.parse(readFileSync(opt('checklist', 'data/checklists/freedom-chat-v1.json'), 'utf8'));
const doc = buildResults({ dataset, evaluations: evals(), checklist, teamName: opt('team', process.env.CQA_TEAM_NAME || 'YaTebyaMognu') });
mkdirSync(outPath.split('/').slice(0, -1).join('/') || '.', { recursive: true });
writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
const errs = doc.results.filter((r) => r.status === 'error');
console.log(`${doc.results.length} records · ${doc.results.length - errs.length} ok · ${errs.length} error · model: ${doc.model.name}`);

// 5 · validate
step(5, 'validate');
const check = validate(doc, { dataset, expect });
if (!check.ok) { console.error(`✖ ${check.errors.length} problem(s):`); check.errors.slice(0, 30).forEach((e) => console.error(`  - ${e}`)); process.exit(1); }
console.log(`✔ valid: ${check.stats.records} records`);

// 6 · commit + push
step(6, has('push') ? 'commit + push' : 'skipped (add --push to commit and push)');
if (has('push')) {
  const branch = git('rev-parse', '--abbrev-ref', 'HEAD');
  if (branch !== 'main' && !has('any-branch')) { console.error(`✖ on branch ${branch}: graded files must reach main. Switch to main or pass --any-branch.`); process.exit(1); }
  git('add', outPath, datasetPath, evalPath, 'eval/cache', 'eval/runs');
  const staged = git('diff', '--cached', '--name-only');
  if (staged) {
    git('commit', '-m', `data(c): ${group} results for submission`, '-m',
      `Why: graded results file for the ${group} set (results format JSON 1.0).\nWhat: ${outPath} with ${doc.results.length} records (${errs.length} error), dataset snapshot, evaluations, cache and run log\nHow verified: eval/validate-results.mjs passed${expect != null ? ` with --expect ${expect}` : ''}\nRefs #22`);
  }
  git('pull', '--rebase', '--autostash');
  git('push');
  console.log(`pushed ${git('rev-parse', '--short', 'HEAD')} to ${branch}`);
}
console.log(`\ndone in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
