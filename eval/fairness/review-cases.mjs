import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync, spawnSync } from 'node:child_process';
import { fingerprint } from './validation.mjs';
import { revalidateCachedEvaluation, reviewEvaluation } from './evaluator-candidate.mjs';
import { applyEvidenceProposal, validateCurrentCase } from './review-cases-lib.mjs';

const read = file => JSON.parse(readFileSync(file, 'utf8'));
const save = (name, value) => writeFileSync(`eval/runs/review-cases-${name}.json`, JSON.stringify(value, null, 2)+'\n');
const dataset = read('data/datasets/DEV.json').data.records;
const current = read('data/evaluations/DEV.json');
const checklist = read('data/checklists/freedom-chat-v1.json');
const historical = read('eval/runs/transcript-compat-audit.json');
const guard = read('eval/runs/transcript-compat-guard.json');
const caseIds = ['p1-ru-010', 'p1-en-010', 'p4-ru-002', 'p4-ru-005', 'p4-ru-004'];
const cases = [], proposals = [];
for (const id of caseIds) {
  const c = dataset.find(c => c.conversation_id === id);
  const result = current.results[id];
  const probe = guard.c01_probes.find(p => p.id === id);
  const criterionId = id.startsWith('p4-') ? 'c01' : id === 'p1-ru-010' ? 'c08' : 'c06';
  const row = result.answers[criterionId];
  const review = reviewEvaluation(c, result, checklist, probe, { mode: 'legacy' });
  const entry = { id, criterion_id: criterionId, current_prompt_version: result.prompt_version,
    transcript_sha256: fingerprint(c.transcript), current_answer: row.answer, evidence: row.evidence,
    current_publication_status: review.status, current_diagnostics: result.problems,
    case_status: id.startsWith('p4-') ? 'awaiting_human_audio_review' : 'resolved_upstream_text_checked',
    human_verified: false, independent_audio_review: false };
  if (!id.startsWith('p4-')) {
    if (!validateCurrentCase(c, result, criterionId)) throw new Error(`Current upstream evidence changed: ${id}`);
    entry.text_review_basis = id === 'p1-ru-010'
      ? 'All operator turns 10..31 were read. Identity is confirmed by system turn 14 before the protected check; no insult, private paid offer or unverified account disclosure is present in these turns.'
      : 'Operator turn 9 directly answers the account-use question; client turn 10 confirms understanding. Clear and ordered answer supports c06=10. Closing quality is evaluated separately.';
    const legacyFile = historical.file_cache.dialogs.find(d => d.id === id)?.filename;
    if (!legacyFile || !existsSync(legacyFile)) throw new Error(`Historical v4 cache not available: ${id}`);
    const legacy = read(legacyFile);
    const proposal = { status: 'proposed_for_owner_review', reviewer_type: 'assistant_text_review_not_human_QA',
      conversation_id: id, criterion_id: criterionId, original_answer: legacy.answers[criterionId].answer,
      transcript_sha256: fingerprint(c.transcript), checklist_sha256: fingerprint(checklist), result_sha256: fingerprint(legacy),
      source_cache_file: legacyFile, source_prompt_version: legacy.prompt_version, evidence: structuredClone(row.evidence),
      note: 'Evidence-only in-memory proposal after reading the original transcript; no cache changes or score overrides.' };
    const patched = applyEvidenceProposal(legacy, c, checklist, proposal);
    const validation = revalidateCachedEvaluation({ value: patched, transcript_sha256: fingerprint(c.transcript),
      checklist_sha256: fingerprint(checklist) }, c, checklist, probe);
    proposal.dry_run_status = validation.status;
    proposal.answer_preserved = patched.answers[criterionId].answer === legacy.answers[criterionId].answer;
    proposals.push(proposal);
    entry.legacy_evidence = legacy.answers[criterionId].evidence;
    entry.legacy_proposal_status = 'prepared_not_applied';
    entry.legacy_proposal_dry_run_status = validation.status;
  } else {
    entry.first_operator_index = probe.message_index;
    entry.source_timestamp = c.transcript[probe.message_index].timestamp;
    entry.original_transcript = c.transcript[probe.message_index].text;
    entry.audio_link = `https://freedom-cqa.vercel.app/api/audio?id=${id}`;
    entry.verified_audio_wording = null; entry.corrected_transcript = null; entry.human_verdict = null;
    entry.score_effect = null; entry.recording_start_complete = null;
  }
  cases.push(entry);
}
if (process.argv.includes('--check-audio')) {
  await Promise.all(cases.filter(c => c.audio_link).map(async entry => {
    try {
      const response = await fetch(entry.audio_link, { redirect: 'manual', signal: AbortSignal.timeout(15000) });
      const location = response.headers.get('location');
      entry.audio_availability = { resolver_http_status: response.status };
      if (response.status >= 300 && response.status < 400 && location) {
        const audioURL = new URL(location, entry.audio_link);
        const audio = await fetch(audioURL, { method: 'HEAD', signal: AbortSignal.timeout(15000) });
        entry.audio_availability.audio_http_status = audio.status;
        entry.audio_availability.content_type = audio.headers.get('content-type');
        entry.audio_availability.content_length = audio.headers.get('content-length');
        if (audio.status === 405) {
          // Some audio proxies support GET only. Probe one byte and cancel if Range is ignored.
          const sample = await fetch(audioURL, { headers: { Range: 'bytes=0-0' }, signal: AbortSignal.timeout(15000) });
          entry.audio_availability.get_http_status = sample.status;
          entry.audio_availability.get_content_type = sample.headers.get('content-type');
          entry.audio_availability.content_range = sample.headers.get('content-range');
          await sample.body?.cancel();
        }
      }
    } catch (error) { entry.audio_availability = { error_code: error.cause?.code || error.name }; }
  }));
}
const v51 = 'eval/runs/2026-11-07T15-00-49-475Z-v51-dev-DEV-openai_gpt-6-luna.evaluations.json';
const metricsFile = 'eval/runs/review-cases-v51.metrics.json';
const metricRun = spawnSync(process.execPath, ['eval/accuracy.ts', v51, '--reviewed-only', '--json', metricsFile], { encoding: 'utf8' });
if (metricRun.status !== 0) throw new Error(metricRun.stderr || metricRun.stdout);
const exported = read(v51);
const rows = Array.isArray(exported) ? exported : exported.evaluations;
const disagreements = rows.filter(e => Object.entries(current.results[e.conversation_id].answers)
  .some(([id, row]) => e.criteria.find(c => c.criterion_id === id)?.answer !== row.answer)).map(e => e.conversation_id);
const report = { checked_at: new Date().toISOString(), commit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  paid_calls: 0, current_prompt_version: current.prompt_version, source_result_sha256: fingerprint(current),
  historical_report_scope: 'transcript-compat-* describes frozen v4, not current v5.1.', cases,
  legacy_cache_modified: false, production_modified: false,
  security_approval: { technical_owner: 'Nazar Akanov (lane C)', approver: null, status: 'pending',
    exception: 'legacy c08=no without original transcript anchor', production_deployment_approved: false },
  audio_review_status: 'not_performed_by_a_human',
  current_metrics: read(metricsFile), source_run_answer_differences: disagreements,
  independent_test: { status: 'not_available_as_new_human_reviewed_unseen_data',
    note: 'Existing 12/7 split was already known during earlier work; blind-24 metadata alone does not establish human provenance.' },
  controlled_comparison: { status: 'not_executed', note: 'Full v5.1 architecture, schema, samples, effective generation settings and validation must be shared between arms.' } };
save('report', report); save('legacy-proposals', proposals);
console.log(JSON.stringify({ current: current.prompt_version, resolved_upstream_text: 2, pending_human_audio: 3,
  legacy_proposals_applied: false, security_approval: report.security_approval.status,
  source_run_answer_differences: disagreements, audio_availability: cases.filter(c => c.audio_link).map(c => ({ id: c.id, ...c.audio_availability })),
  metrics: { strict: report.current_metrics.overall.strict, lenient: report.current_metrics.overall.lenient,
    gross: report.current_metrics.gross_error, total: report.current_metrics.total } }, null, 2));
