// Saved-result and actual file-cache validation only. No inference, repairs or cache writes.
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { reviewEvaluation, revalidateCachedEvaluation, CANDIDATE_VERSION } from './evaluator-candidate.mjs';
import { fingerprint } from './validation.mjs';
import { rawPoints, score } from '../../prototype/scoring.js';

globalThis.fetch = () => { throw new Error('Network forbidden in offline audit'); };
const read = path => JSON.parse(readFileSync(path, 'utf8'));
const save = (name, value) => writeFileSync(`eval/runs/${name}`, JSON.stringify(value, null, 2)+'\n');
const ds = read('data/datasets/DEV.json').data.records;
const analysis = read('data/evaluations/DEV.json');
const cl = read('data/checklists/freedom-chat-v1.json');
const guard = read('eval/runs/transcript-validation-guard.json');
const byId = new Map(ds.map(c => [c.conversation_id, c]));
const reviews = [];
const cacheReviews = [];
for (const c of ds) {
  const probe = guard.c01_probes.find(p => p.id === c.conversation_id);
  reviews.push(reviewEvaluation(c, analysis.results[c.conversation_id], cl, probe));
  // This is the real lib/cache.js filename formula, checked against the complete input.
  const keyParts = [analysis.prompt_version, analysis.model, c.conversation_id, c.transcript, cl.criteria];
  const key = createHash('sha256').update(JSON.stringify(keyParts)).digest('hex').slice(0, 40);
  const filename = `eval/cache/eval/${key}.json`;
  if (!existsSync(filename)) { cacheReviews.push({ id: c.conversation_id, cache_hit: false }); continue; }
  const value = read(filename);
  const envelope = { value, transcript_sha256: fingerprint(c.transcript), checklist_sha256: fingerprint(cl) };
  const review = revalidateCachedEvaluation(envelope, c, cl, probe);
  cacheReviews.push({ id: c.conversation_id, cache_hit: true, filename,
    publishable: review.publishable, issues: review.pending_review });
}
const reasons = {};
for (const r of reviews) for (const reason of new Set(r.pending_review.map(p => p.reason))) reasons[reason] = (reasons[reason] || 0) + 1;
let n = 0, strict = 0, lenient = 0, comparable = 0, downward = 0, upward = 0, lenientDown = 0, lenientUp = 0, naMismatch = 0;
let tp = 0, fp = 0, fn = 0; const diffs = [];
for (const file of readdirSync('eval/gold').filter(f => f.endsWith('.json'))) {
  const g = read(`eval/gold/${file}`); if (g.status !== 'reviewed') continue;
  const result = analysis.results[g.conversation_id]; if (!result) continue;
  for (const c of cl.criteria) {
    const expected = g.labels[c.id]; const actual = result.answers[c.id]?.answer;
    const exact = actual === expected.answer;
    const acceptable = exact || (expected.also_acceptable || []).includes(actual);
    n++; strict += Number(exact); lenient += Number(acceptable);
    if (c.type === 'flag') {
      tp += Number(actual === 'yes' && expected.answer === 'yes');
      fp += Number(actual === 'yes' && expected.answer === 'no');
      fn += Number(actual === 'no' && expected.answer === 'yes'); continue;
    }
    if (actual === 'na' || expected.answer === 'na') { naMismatch += Number(!exact); continue; }
    comparable++;
    const delta = rawPoints(c, actual) - rawPoints(c, expected.answer);
    downward += Number(delta < 0); upward += Number(delta > 0);
    lenientDown += Number(delta < 0 && !acceptable); lenientUp += Number(delta > 0 && !acceptable);
  }
  const goldScore = score(cl, Object.fromEntries(Object.entries(g.labels).map(([id, row]) => [id, row.answer]))).total;
  const modelScore = score(cl, Object.fromEntries(Object.entries(result.answers).map(([id, row]) => [id, row.answer]))).total;
  if (goldScore !== null && modelScore !== null) diffs.push(Math.abs(goldScore - modelScore));
}
const pct = (num, den) => den ? Math.round(num / den * 10000) / 100 : null;
const summary = {
  policy_version: CANDIDATE_VERSION, paid_calls: 0, all_dialogs: reviews.length,
  scope: 'Structural review of saved results, not semantic/audio verification or new LLM evaluation.',
  checklist: `${cl.id}@${cl.version}`, calls_used_chat_checklist: true,
  publishable: reviews.filter(r => r.publishable).length,
  pending: reviews.filter(r => !r.publishable).length,
  pending_rate_pct: pct(reviews.filter(r => !r.publishable).length, reviews.length), reasons,
  dialogs: reviews.map(r => ({ id: r.conversation_id, publishable: r.publishable,
    provisional_total: r.provisional_total, confirmed_total: r.confirmed_total, gross_error: r.gross_error, pending_review: r.pending_review })),
  file_cache: { hits: cacheReviews.filter(r => r.cache_hit).length,
    publishable: cacheReviews.filter(r => r.publishable).length, dialogs: cacheReviews },
  baseline_metrics: { scope: 'Saved answers against existing development gold; not audio-grounded fairness rates.',
    labels: n, strict: pct(strict, n), lenient: pct(lenient, n), comparable_weighted_pairs: comparable,
    downward_disagreements: downward, upward_disagreements: upward,
    false_penalty_proxy_pct: pct(downward, comparable), false_pass_proxy_pct: pct(upward, comparable),
    lenient_false_penalty_proxy_pct: pct(lenientDown, comparable), lenient_false_pass_proxy_pct: pct(lenientUp, comparable),
    na_mismatches: naMismatch, gross: { tp, fp, fn, recall_pct: pct(tp, tp + fn) },
    mae: Math.round(diffs.reduce((a, b) => a + b, 0) / diffs.length * 100) / 100 },
  limitations: ['New candidate answers were not generated.', 'Reference validity is not evidence sufficiency.',
    'Human/audio review and independent test set unavailable.', 'The stricter reference policy needs owner approval before integration.'],
};
save('transcript-validation-audit.json', summary);
const queue = ['p4-ru-002', 'p4-ru-005', 'p4-ru-004'].map(id => {
  const c = byId.get(id), i = c.transcript.findIndex(m => m.speaker === 'operator');
  return { conversation_id: id, criterion_id: 'c01', turn_index: i, timestamp: c.transcript[i].timestamp,
    original_transcript: c.transcript[i].text, audio_endpoint: `/api/audio?id=${id}`,
    verbatim_audio: null, corrected_transcript: null, recording_start_complete: null,
    reviewer: null, decision: null, score_effect: null, status: 'awaiting_human_audio_review' };
});
save('transcript-validation-audio-queue.json', queue);
const lines = ['# Формат аналитики — офлайн-пример', '', 'Это экспорт кандидата, не изменённый интерфейс приложения.', ''];
const escape = value => String(value ?? '—').replaceAll('|', '\\|').replaceAll('\n', ' ');
for (const id of ['p1-ru-002', 'p4-ru-005']) {
  const r = reviews.find(r => r.conversation_id === id);
  lines.push(`## ${id}`, '', `Предварительный балл: ${r.provisional_total ?? 'не рассчитан'}. Подтверждённый автоматической проверкой: ${r.confirmed_total ?? 'ожидает проверки'}.`, '',
    '| Критерий | Баллы | Вердикт | Evidence | Объяснение | Предупреждение записи | Review |', '|---|---:|---|---|---|---|---|');
  for (const row of r.criteria) lines.push(`| ${row.criterion_id} | ${row.score ?? '—'} | ${row.verdict} | ${escape(row.evidence.map(e => e.kind === 'message' ? `[${e.turn_index}] ${e.quote}` : e.kind === 'range' ? `[${e.range.join('–')}]` : e.quote).join('; '))} | ${escape(row.explanation)} | ${escape(row.transcription_warning)} | ${row.review_status} |`);
  lines.push('');
}
writeFileSync('eval/runs/transcript-validation-preview.md', lines.join('\n'));
console.log(JSON.stringify({ dialogs: summary.all_dialogs, publishable: summary.publishable, pending: summary.pending,
  reasons, file_cache_hits: summary.file_cache.hits, metrics: summary.baseline_metrics }, null, 2));
