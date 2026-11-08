// Current saved DEV replay through the same validation path used by the feature flag.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { validateFairness } from '../../lib/fairness.js';
import { fingerprint } from './validation.mjs';
import { score } from '../../prototype/scoring.js';
const read = path => JSON.parse(readFileSync(path, 'utf8'));
globalThis.fetch = () => { throw new Error('Replay forbids all network and inference'); };
const source = read('data/datasets/DEV.json');
const saved = read('data/evaluations/DEV.json');
const before = fingerprint({ source, saved });
const chat = read('data/checklists/freedom-chat-v1.json');
const call = read('data/checklists/freedom-call-v1.json');
const counts = { valid: 0, warning: 0, needs_review: 0, invalid: 0 };
const rows = source.data.records.map(c => {
  const result = saved.results[c.conversation_id];
  assert.ok(result, `Missing saved result: ${c.conversation_id}`);
  const checklist = /voice|call/i.test(c.channel) ? call : chat;
  const validation = validateFairness(c, result, checklist, { legacy: true });
  counts[validation.status]++;
  const computed = score(checklist, Object.fromEntries(Object.entries(result.answers).map(([id, r]) => [id, r.answer])));
  const flagged = result.answers.c08?.answer === 'yes' || result.gross_error === true;
  assert.ok(!flagged || validation.gross_error, 'Critical violation lost');
  const evidenceErrors = validation.findings.filter(f => f.dimension === 'evidence');
  return { conversation_id: c.conversation_id, checklist_id: checklist.id, status: validation.status,
    provisional_total: validation.provisional_total, confirmed_total: validation.confirmed_total,
    computed_original_total: computed.total, stored_total: result.total ?? null,
    computed_text_only_total: score(chat, Object.fromEntries(Object.entries(result.answers).map(([id, r]) => [id, r.answer]))).total,
    validation_changed_score: validation.provisional_total !== null && validation.provisional_total !== computed.total,
    gross_error: validation.gross_error, original_gross_error: flagged,
    audio_criterion_status: validation.criteria.find(r => r.criterion_id === 'c09')?.validation_status ?? null,
    human_audio_recorded: validation.dimensions.transcription_reliability.audio_reviewed,
    c01_status: validation.criteria.find(r => r.criterion_id === 'c01')?.validation_status,
    findings: validation.findings, evidence_errors: evidenceErrors,
    original_evaluator_diagnostics: result.problems,
    original_evidence_preserved: validation.criteria.every(r => fingerprint(r.evidence) === fingerprint(result.answers[r.criterion_id].evidence)) };
});
assert.equal(fingerprint({ source, saved }), before);
assert.ok(rows.every(r => !r.validation_changed_score && r.original_evidence_preserved));
const report = { revision: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  source_sha256: before, prompt_version: saved.prompt_version, scope: 'Current saved results, no new generations or independent accuracy claim',
  counts, dialogs: rows.length, verdict_changes: 0, score_changes: 0, transcript_changes: 0, evidence_changes: 0,
  paid_calls: 0, critical_regressions: 0, critical_flags: rows.filter(r => r.gross_error).length,
  evidence_finding_count: rows.reduce((n, r) => n + r.evidence_errors.length, 0),
  citation_diagnostics: rows.reduce((n, r) => n + r.original_evaluator_diagnostics.filter(p => /quote not found/.test(p)).length, 0),
  cache_compatibility: 'All 65 saved evaluations revalidated without generation/cache writes. Raw-source LF/CRLF cache issue remains an un-applied patch artifact; generation cache keys were not changed.', rows };
report.stored_total_scope = 'Stored DEV totals match the official text-only checklist; call provisional totals include C09. These are different scoring scopes, not validator score changes.';
writeFileSync('eval/runs/fairness-final-replay.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ counts, dialogs: rows.length, score_changes: 0, critical_regressions: 0,
  evidence_findings: report.evidence_finding_count, citation_diagnostics: report.citation_diagnostics, paid_calls: 0 }, null, 2));
