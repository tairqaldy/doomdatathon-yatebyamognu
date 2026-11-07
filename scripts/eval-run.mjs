// Batch AI evaluation with caching + cost/latency report.
//   node scripts/eval-run.mjs [--group DEV] [--model anthropic/claude-haiku-5.5] [--limit 10] [--only p1-ru-001,...] [--concurrency 4]
// Writes: data/evaluations/<group>.json (loaded by the app, instant demo) and eval/runs/<stamp>-<group>.json (metrics).
// Re-running is ~free: answers come from eval/cache (commit it so teammates reuse paid calls).
import { writeFile, mkdir, readFile } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const { evaluate, PROMPT_VERSION } = await import('../lib/evaluator.js');
const { MODELS } = await import('../lib/openrouter.js');
const { loadDataset, loadChecklist } = await import('../lib/data.js');
const { score } = await import('../prototype/scoring.js');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const group = arg('group', 'DEV'), model = arg('model', MODELS.eval), conc = Number(arg('concurrency', 4));
const ds = await loadDataset(group);
const checklist = arg('checklist') ? JSON.parse(await readFile(arg('checklist'), 'utf8')) : await loadChecklist();
let convs = ds.data.records;
if (arg('only')) { const s = new Set(arg('only').split(',')); convs = convs.filter((c) => s.has(c.conversation_id)); }
if (arg('limit')) convs = convs.slice(0, Number(arg('limit')));

const results = {}; const rows = []; let i = 0;
async function worker() {
  while (i < convs.length) {
    const c = convs[i++];
    const t0 = Date.now();
    try {
      const r = await evaluate(c, checklist, { model });
      const answers = Object.fromEntries(Object.entries(r.value.answers).map(([k, v]) => [k, v.answer]));
      const s = score(checklist, answers);
      results[c.conversation_id] = { ...r.value, total: s.total, gross_error: s.gross_error };
      rows.push({ id: c.conversation_id, lang: c.language, cached: r.cached, ms: Date.now() - t0, model_ms: r.value.latency_ms, cost: r.value.usage?.cost ?? null, total: s.total, problems: r.value.problems.length });
      process.stdout.write(`${r.cached ? '·' : '✓'} ${c.conversation_id} ${s.total ?? '—'}${r.value.problems.length ? ` (${r.value.problems.length} fixes)` : ''}\n`);
    } catch (e) {
      rows.push({ id: c.conversation_id, error: e.message }); process.stdout.write(`✗ ${c.conversation_id} ${e.message}\n`);
    }
  }
}
await Promise.all(Array.from({ length: conc }, worker));

const fresh = rows.filter((r) => r.cached === false);
const lat = fresh.map((r) => r.model_ms).sort((a, b) => a - b);
const pct = (p) => (lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null);
const cost = fresh.reduce((s, r) => s + (r.cost || 0), 0);
const report = { group, model, prompt_version: PROMPT_VERSION, checklist: checklist.id, version: checklist.version, at: new Date().toISOString(),
  n: rows.length, errors: rows.filter((r) => r.error).length, cached: rows.filter((r) => r.cached).length,
  fresh_calls: fresh.length, cost_usd_total: +cost.toFixed(5), cost_usd_per_eval: fresh.length ? +(cost / fresh.length).toFixed(5) : null,
  latency_ms_p50: pct(0.5), latency_ms_p95: pct(0.95), rows };
await mkdir('data/evaluations', { recursive: true }); await mkdir('eval/runs', { recursive: true });
let prev = {}; try { prev = JSON.parse(await readFile(`data/evaluations/${group}.json`, 'utf8')).results || {}; } catch {}
await writeFile(`data/evaluations/${group}.json`, JSON.stringify({ group, model, prompt_version: PROMPT_VERSION, checklist_id: checklist.id, checklist_version: checklist.version, generated_at: report.at, results: { ...prev, ...results } }, null, 1));
await writeFile(`eval/runs/${report.at.replace(/[:.]/g, '-')}-${group}.json`, JSON.stringify(report, null, 2));
console.log(`\n${rows.length} dialogs · ${report.cached} from cache · ${fresh.length} model calls · $${report.cost_usd_total} total · $${report.cost_usd_per_eval ?? 0}/eval · p50 ${report.latency_ms_p50}ms p95 ${report.latency_ms_p95}ms · errors ${report.errors}`);
