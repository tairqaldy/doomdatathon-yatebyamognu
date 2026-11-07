// Results export for the organizers: results/dev/results.json (DEV) and results/prod/results.json (control set).
//   node scripts/results.mjs --group DEV --set dev
//   node scripts/results.mjs --group <CONTROL_GROUP_ID> --set prod      (fetches via CQA_API_URL, saves data/datasets/<ID>.json)
//   flags: --mock (offline heuristic evaluator, $0, for pipeline tests) · --concurrency 6 · --limit N · --model <id>
//          --outdir <dir> (default results/<set>) · --checklist <file>
// Output shape is driven by results/format.json (provisional until the appendix PDF is added). Points/totals always
// come from prototype/scoring.js (half-up, 2 decimals); the LLM only picks answers + evidence (AGENTS.md §6).
// Also writes <outdir>/details.json (answers, evidence, explanations, cost) and, for real runs,
// data/evaluations/<GROUP>.json so the admin UI can show the dialogs.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes(`--${k}`);
const group = arg('group', 'DEV');
const set = arg('set', group === 'DEV' ? 'dev' : 'prod');
const outdir = arg('outdir', `results/${set}`);
const conc = Number(arg('concurrency', 6));
const { loadDataset, fetchDataset, loadChecklist } = await import('../lib/data.js');
const { score } = await import('../prototype/scoring.js');
const fmt = JSON.parse(await readFile('results/format.json', 'utf8'));
const checklist = arg('checklist') ? JSON.parse(await readFile(arg('checklist'), 'utf8')) : await loadChecklist();

// Dataset: DEV from the repo; any other group fetched live and saved for the UI.
let ds;
if (group === 'DEV') ds = await loadDataset('DEV');
else {
  ds = await fetchDataset(group);
  await mkdir('data/datasets', { recursive: true });
  await writeFile(`data/datasets/${group}.json`, JSON.stringify(ds, null, 2) + '\n');
}
let convs = ds.data.records;
if (arg('limit')) convs = convs.slice(0, Number(arg('limit')));
console.log(`${group}: ${convs.length} dialogs · checklist ${checklist.id} v${checklist.version} · ${flag('mock') ? 'MOCK evaluator' : 'AI evaluator'}`);

let evaluate; let MODEL = 'mock';
if (flag('mock')) {
  const { mockEvaluate } = await import('../prototype/mock-evaluator.js');
  evaluate = async (c) => ({ value: { answers: mockEvaluate(c, checklist), summary: null, model: 'mock', usage: { cost: 0 } }, cached: false });
} else {
  const ev = await import('../lib/evaluator.js');
  const { MODELS } = await import('../lib/llm.js');
  MODEL = arg('model', MODELS.eval);
  evaluate = (c) => ev.evaluate(c, checklist, { model: MODEL });
}

const toValue = (crit, a) => {
  if (a == null) return null;
  if (crit.type === 'scale') return a === 'na' ? fmt.scale_na : Number(a);
  return Object.prototype.hasOwnProperty.call(fmt.binary_values, a) ? fmt.binary_values[a] : a;
};

const out = []; const details = {}; const failed = [];
let next = 0; let cost = 0; let fresh = 0; const t0 = Date.now();
async function worker() {
  while (next < convs.length) {
    const c = convs[next++];
    try {
      const r = await evaluate(c);
      const answers = Object.fromEntries(checklist.criteria.map((k) => [k.id, r.value.answers[k.id]?.answer ?? null]));
      const s = score(checklist, answers);
      const row = { conversation_id: c.conversation_id };
      for (const k of checklist.criteria) row[fmt.criterion_keys[k.id] || k.id] = toValue(k, answers[k.id]);
      if (fmt.include.total) row[fmt.include.total] = s.total;
      if (fmt.include.gross) row[fmt.include.gross] = s.gross_error;
      out.push(row);
      details[c.conversation_id] = { answers: r.value.answers, summary: r.value.summary, total: s.total, gross_error: s.gross_error,
        sections: s.sections, model: r.value.model, usage: r.value.usage, problems: r.value.problems || [] };
      if (!r.cached) { fresh++; cost += r.value.usage?.cost || 0; }
      process.stdout.write(`${r.cached ? '·' : '✓'} ${c.conversation_id} ${s.total ?? '—'}${s.gross_error ? ' ⚑ gross' : ''}\n`);
    } catch (e) {
      failed.push(c.conversation_id);
      process.stdout.write(`✗ ${c.conversation_id} ${e.message}\n`);
    }
  }
}
await Promise.all(Array.from({ length: Math.max(1, Math.min(conc, convs.length)) }, worker));
out.sort((a, b) => a.conversation_id.localeCompare(b.conversation_id));

const meta = { group_id: group, checklist_id: checklist.id, checklist_version: checklist.version, model: MODEL,
  generated_at: new Date().toISOString(), count: out.length, failed };
await mkdir(outdir, { recursive: true });
await writeFile(`${outdir}/results.json`, JSON.stringify({ ...meta, results: out }, null, 2) + '\n');
await writeFile(`${outdir}/details.json`, JSON.stringify({ ...meta, details }, null, 1) + '\n');
if (!flag('mock')) {
  await mkdir('data/evaluations', { recursive: true });
  let prev = {};
  try { prev = JSON.parse(await readFile(`data/evaluations/${group}.json`, 'utf8')).results || {}; } catch {}
  await writeFile(`data/evaluations/${group}.json`, JSON.stringify({ group, model: MODEL, checklist_id: checklist.id,
    checklist_version: checklist.version, generated_at: meta.generated_at, results: { ...prev, ...details } }, null, 1));
}
console.log(`\n${outdir}/results.json · ${out.length} dialogs · ${failed.length} failed · ${fresh} model calls · $${cost.toFixed(4)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
if (failed.length) process.exitCode = 1;
