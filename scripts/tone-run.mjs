// Audio criteria of the call checklist (input: "audio", e.g. c09 tone of voice) for every call of a group.
//   node scripts/tone-run.mjs [--group DEV] [--only p4-ru-001,...] [--checklist freedom-call-v1] [--force]
// Run after the text evaluation (npm run eval / npm run results). Adds the answers to data/evaluations/<group>.json
// (calls only; the official results file ignores them) and writes eval/runs/<stamp>-<group>-tone.json.
// Re-running is free: answers come from eval/cache/tone/.
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const { evaluateTone, isAudioCriterion, TONE_MODEL, TONE_PROMPT_VERSION } = await import('../lib/tone.js');
const { loadDataset, loadChecklist } = await import('../lib/data.js');
const { score } = await import('../prototype/scoring.js');

const arg = (k, d) => { const i = process.argv.indexOf(`--${k}`); return i > 0 ? process.argv[i + 1] : d; };
const group = arg('group', 'DEV'), force = process.argv.includes('--force');
const checklist = await loadChecklist(arg('checklist', 'freedom-call-v1'));
const crits = checklist.criteria.filter(isAudioCriterion);
if (!crits.length) { console.log('checklist has no audio criteria'); process.exit(0); }
let convs = (await loadDataset(group)).data.records.filter((c) => c.audio_url);
if (arg('only')) { const s = new Set(arg('only').split(',')); convs = convs.filter((c) => s.has(c.conversation_id)); }

const file = `data/evaluations/${group}.json`;
const evals = JSON.parse(await readFile(file, 'utf8'));
const rows = [];
for (const c of convs) {
  const res = evals.results[c.conversation_id];
  if (!res) continue; // text evaluation first: npm run eval
  try {
    const r = await evaluateTone(c, crits, { force });
    Object.assign(res.answers, r.value.answers);
    if (r.value.model) Object.assign(res, { audio_model: r.value.model, audio_prompt_version: r.value.prompt_version, audio_usage: r.value.usage });
    const s = score(checklist, Object.fromEntries(Object.entries(res.answers).map(([k, v]) => [k, v.answer])));
    res.call_checklist_total = s.total; // total under the call checklist incl. audio criteria; res.total stays the text-pipeline total
    if (c.audio_url) {
      rows.push({ id: c.conversation_id, cached: r.cached, answers: Object.fromEntries(crits.map((x) => [x.id, r.value.answers[x.id]?.answer ?? null])), total: s.total,
        audio_tokens: r.value.usage?.audio_tokens ?? null, cost: r.value.usage?.cost ?? null, latency_ms: r.value.latency_ms ?? null, problems: r.value.problems, metrics: r.value.answers[crits[0].id]?.audio_metrics });
      console.log(`${r.cached ? '·' : '✓'} ${c.conversation_id} ${crits.map((x) => `${x.id}=${r.value.answers[x.id]?.answer ?? '—'}`).join(' ')} total ${s.total}${r.value.problems.length ? ` (${r.value.problems.join('; ')})` : ''}`);
    }
  } catch (e) { rows.push({ id: c.conversation_id, error: e.message }); console.log(`✗ ${c.conversation_id} ${e.message}`); }
}
await writeFile(file, JSON.stringify(evals, null, 1));
const fresh = rows.filter((r) => r.cached === false);
const cost = fresh.reduce((s, r) => s + (r.cost || 0), 0);
const report = { group, model: TONE_MODEL, prompt_version: TONE_PROMPT_VERSION, criteria: crits.map((c) => c.id), at: new Date().toISOString(),
  calls: rows.length, fresh_calls: fresh.length, cost_usd_total: +cost.toFixed(5), cost_usd_per_call: fresh.length ? +(cost / fresh.length).toFixed(5) : null, rows };
await mkdir('eval/runs', { recursive: true });
await writeFile(`eval/runs/${report.at.replace(/[:.]/g, '-')}-${group}-tone.json`, JSON.stringify(report, null, 2));
console.log(`\n${rows.length} calls · ${fresh.length} model calls · $${report.cost_usd_total} total · $${report.cost_usd_per_call ?? 0}/call`);
