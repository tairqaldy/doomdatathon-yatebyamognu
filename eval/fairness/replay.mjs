// Reuse committed results only. Never import a model client or call fetch.
import { readFileSync, writeFileSync, readdirSync, mkdirSync, copyFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync, execFileSync } from 'node:child_process';
import { reviewEvaluation } from './evaluator-candidate.mjs';

const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (path, value) => writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
const sha = path => createHash('sha256').update(readFileSync(path)).digest('hex');
const datasetPath = 'data/datasets/DEV.json';
const analysisPath = 'data/evaluations/DEV.json';
const dataset = read(datasetPath).data.records;
const analysis = read(analysisPath);
const checklist = read('data/checklists/freedom-chat-v1.json');
const guard = read('eval/runs/transcript-iteration-2.json').dataset;
const metrics = [];
for (const version of ['v1', 'v2', 'v3', 'v4']) {
  const prior = read(`eval/runs/gpt-6-luna-eval-${version}.metrics.json`);
  const destination = `eval/runs/transcript-replay-${version}.metrics.json`;
  const run = spawnSync(process.execPath, ['eval/accuracy.ts', prior.run, '--reviewed-only', '--json', destination], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(run.stderr || run.stdout);
  const measured = read(destination);
  metrics.push({ version, source: prior.run, source_sha256: sha(prior.run), scored: measured.scored_dialogs,
    strict: measured.overall.strict, lenient: measured.overall.lenient,
    gross: measured.gross_error, total: measured.total, evidence: measured.evidence });
}
const source = 'eval/runs/2026-11-07T13-16-16-814Z-DEV-openai_gpt-6-luna.evaluations.json';
const currentMetrics = 'eval/runs/transcript-replay-current.metrics.json';
const run = spawnSync(process.execPath, ['eval/accuracy.ts', source, '--reviewed-only', '--json', currentMetrics], { encoding: 'utf8' });
if (run.status !== 0) throw new Error(run.stderr || run.stdout);
const sidecars = dataset.map(c => reviewEvaluation(c, analysis.results[c.conversation_id], checklist,
  guard.c01_probes.find(p => p.id === c.conversation_id)));
const goldFiles = readdirSync('eval/gold').filter(f => f.endsWith('.json'));
const gold = goldFiles.map(f => ({ file: `eval/gold/${f}`, ...read(`eval/gold/${f}`) }));
const c01negatives = dataset.filter(c => analysis.results[c.conversation_id]?.answers.c01.answer === 'no').map(c => {
  const index = c.transcript.findIndex(m => m.speaker === 'operator');
  return { id: c.conversation_id, channel: c.channel, index,
    explanation: analysis.results[c.conversation_id].answers.c01.explanation,
    probe: guard.c01_probes.find(p => p.id === c.conversation_id)?.status };
});
mkdirSync('eval/fairness/private', { recursive: true });
copyFileSync(datasetPath, 'eval/fairness/private/DEV-dialogs.json');
copyFileSync(analysisPath, 'eval/fairness/private/DEV-analytics.json');
const summary = {
  created_at: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  paid_calls: 0, network_calls_in_replay: 0, source_kind: 'local saved DEV; not an admin browser localStorage export',
  exports: [{ source: datasetPath, sha256: sha(datasetPath), count: dataset.length },
    { source: analysisPath, sha256: sha(analysisPath), count: Object.keys(analysis.results).length, prompt_version: analysis.prompt_version }],
  admin_probe: { checked_on: '2026-11-07', endpoint: '/api/sessions', postgres: false, sessions: 0,
    limitation: 'Browser localStorage sessions are not accessible through this endpoint.' },
  gold: { count: gold.length, reviewed: gold.filter(g => g.status === 'reviewed').length,
    review_provenance: 'Existing repository metadata; no new human or audio review performed.',
    files: gold.map(g => ({ file: g.file, reviewed_by: g.reviewed_by })) },
  historical_replays: metrics, current: read(currentMetrics), c01_negative_cases: c01negatives,
  candidate_policy: { mode: 'offline sidecar, not integrated into production or re-inferred',
    publishable_count: sidecars.filter(r => r.publishable).length,
    pending: sidecars.filter(r => !r.publishable) },
};
save('eval/runs/transcript-replay-summary.json', summary);
console.log(JSON.stringify({ historical_replays: metrics.map(({ version, strict, lenient, gross, total }) => ({ version, strict, lenient, recall: gross.recall, mae: total.mae })),
  pending: summary.candidate_policy.pending.map(p => p.conversation_id) }, null, 2));
