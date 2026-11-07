// Policy validity is separate from independent semantic correctness.
import { fingerprint } from './validation.mjs';

export const VALIDATION_VERSION = 'transcript-validation-v3';
export const LEGACY_VERSIONS = new Set([undefined, null, 'transcript-validation-v1', 'transcript-validation-v2']);
const ranks = { valid: 0, warning: 1, needs_review: 2, invalid: 3 };
export const riskStatus = findings => findings.reduce((status, finding) =>
  ranks[finding.severity] > ranks[status] ? finding.severity : status, 'valid');
export const isBlocking = finding => ['needs_review', 'invalid'].includes(finding.severity);
export const finding = (reason, criterion_id, dimension, severity, extra = {}) =>
  ({ reason, criterion_id: criterion_id ?? null, dimension, severity, ...extra });

const schemaReasons = new Set(['invalid_transcript', 'invalid_checklist', 'invalid_criterion', 'invalid_scale',
  'incomplete_evaluation', 'invalid_result_metadata', 'invalid_summary', 'invalid_problems',
  'result_conversation_mismatch', 'unexpected_criterion', 'invalid_answer', 'invalid_criterion_fields', 'invalid_evidence']);
const normal = value => String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const generic = /^(?:n a|na|not applicable|unknown|no data|не применимо|неприменимо|нет данных|данных нет|неизвестно|не знаю|қолданылмайды|дерек жоқ|белгісіз)$/u;
const uncertain = /неразборчив|недостаточно данн|невозможно (?:оценить|определить)|неизвест|cannot determine|can t tell|uncertain|unknown|белгісіз|білмеймін|түсініксіз|(?:audio|recording).*(?:missing|unclear)/u;

function documentedReason(row) {
  const explanation = normal(row?.explanation);
  const conditions = (Array.isArray(row?.evidence) ? row.evidence : []).filter(e => e?.kind === 'na_condition').map(e => normal(e.quote));
  if (!explanation || generic.test(explanation) || uncertain.test(explanation)) return false;
  const reasons = [explanation, ...conditions].filter(s => s && !generic.test(s) && !uncertain.test(s));
  // Do not demand matching words: non-occurrence can be justified from the conversation as a whole.
  // This establishes documented justification, not semantic truth; a bound human review can contradict it.
  return reasons.some(reason => reason.split(' ').length >= 2);
}

export function assessNA(conversation, checklist, criterion, row, applicability) {
  if (row?.answer !== 'na') return null;
  if (!criterion.na_allowed) return { status: 'invalid', basis: 'na_prohibited_by_checklist' };
  const supplied = applicability?.[criterion.id];
  if (supplied) {
    const bound = supplied.source === 'human_review' && typeof supplied.reviewer === 'string' && supplied.reviewer.trim()
      && typeof supplied.applies === 'boolean' && typeof supplied.reason === 'string' && supplied.reason.trim()
      && supplied.transcript_sha256 === fingerprint(conversation.transcript)
      && supplied.checklist_sha256 === fingerprint(checklist);
    if (!bound) return { status: 'unsupported', basis: 'unbound_applicability_review' };
    return { status: supplied.applies ? 'invalid' : 'valid', basis: 'bound_human_applicability_review',
      reason: supplied.reason, reviewer: supplied.reviewer };
  }
  return documentedReason(row)
    ? { status: 'valid', basis: 'documented_condition', independent_semantic_verification: false, reason: row.explanation }
    : { status: 'unsupported', basis: 'insufficient_applicability_explanation' };
}

export function classifyEvaluation(validated, conversation, result, checklist, { mode = 'current', applicability = {}, identityId = null, contextCriterionId = null } = {}) {
  const criteria = Array.isArray(checklist?.criteria) ? checklist.criteria.filter(c => c && typeof c.id === 'string') : [];
  const na = Object.fromEntries(criteria.map(c => [c.id, assessNA(conversation, checklist, c, result?.answers?.[c.id], applicability)]).filter(([, value]) => value));
  const findings = [];
  for (const issue of validated.issues) {
    const c = criteria.find(c => c.id === issue.criterion_id), row = result?.answers?.[issue.criterion_id];
    if (issue.reason === 'missing_original_reference' && row?.answer === 'na' && c?.na_allowed) continue;
    if (schemaReasons.has(issue.reason)) {
      findings.push(finding(issue.reason, issue.criterion_id, 'schema', 'invalid')); continue;
    }
    if (issue.reason === 'invalid_na_evidence' && row?.answer === 'na' && c?.na_allowed && na[c.id]?.status === 'valid') {
      findings.push(finding('empty_na_condition_text', c.id, 'evidence', 'warning')); continue;
    }
    if (issue.reason === 'missing_original_reference') {
      const critical = c?.type === 'flag' && row?.answer === 'yes' || c?.id === identityId && row?.answer === 'yes';
      findings.push(finding(issue.reason, issue.criterion_id, 'evidence', mode === 'legacy' && !critical ? 'warning' : 'needs_review'));
    } else if (issue.reason === 'evidence_speaker_mismatch' && mode === 'legacy' && c?.id === contextCriterionId
      && c.type === 'scale' && typeof row?.answer === 'number' && row.answer < Math.max(...c.scale.map(s => s.value))) {
      // A client re-asking is valid context, but the paired operator response should be linked too.
      findings.push(finding('legacy_context_only_reference', c.id, 'evidence', 'warning'));
    } else {
      findings.push(finding(issue.reason, issue.criterion_id, 'evidence', 'needs_review'));
    }
  }
  for (const [id, assessment] of Object.entries(na)) {
    if (assessment.status === 'unsupported') findings.push(finding('unsupported_na', id, 'verdict', 'needs_review', { basis: assessment.basis }));
    if (assessment.status === 'invalid' && criteria.find(c => c.id === id)?.na_allowed) {
      findings.push(finding('invalid_na_verdict', id, 'verdict', 'needs_review', { action: 'correct_after_review', basis: assessment.basis }));
    }
  }
  const unique = findings.filter((f, i) => findings.findIndex(other => other.reason === f.reason && other.criterion_id === f.criterion_id) === i);
  return { findings: unique, na, scoreable: !unique.some(f => f.dimension === 'schema' && f.severity === 'invalid'), mode };
}

export function classifyTranscript(probeIssues, conversation, result, criteria, contactId) {
  const foundational = probeIssues.filter(issue => !['transcript_quality_warning', 'source_quality_uncertainty'].includes(issue.reason));
  const findings = foundational.map(issue => finding(issue.reason, null, 'transcription', 'needs_review'));
  const source = conversation?.transcript;
  if (!Array.isArray(source)) return findings;
  const flags = [];
  for (const [index, message] of source.entries()) {
    if (message?.speaker_uncertain || message?.segment_missing || message?.audio_corrupted || message?.asr_uncertain
      || typeof message?.asr_confidence === 'number' && message.asr_confidence >= 0 && message.asr_confidence < 0.75) flags.push({ index, reason: 'source_quality_uncertainty' });
    if (message?.speaker_uncertain) flags.push({ index, kind: 'speaker_uncertain', reason: 'source_quality_uncertainty' });
  }
  if (conversation.audio_missing || conversation.audio_corrupted) flags.push({ index: null, reason: 'source_quality_uncertainty' });
  // External quality flags come from the bound guard; missing/bad probe still blocks above.
  for (const issue of probeIssues) if (issue.reason === 'transcript_quality_warning') flags.push(...(issue.flags || []).filter(flag => flag && typeof flag === 'object'));
  for (const flag of flags) {
    const index = flag.index;
    const global = !Number.isInteger(index) || index < 0 || index >= source.length;
    const affected = criteria.filter(c => {
      if (global) return true;
      const row = result?.answers?.[c.id];
      const cited = (Array.isArray(row?.evidence) ? row.evidence : []).some(e => e?.kind === 'message' ? e.turn_index === index
        : e?.kind === 'range' && Array.isArray(e.range) ? e.range[0] <= index && e.range[1] >= index : false);
      return cited || (c.id === contactId && index === source.findIndex(m => m?.speaker === 'operator'))
        || ((source[index]?.speaker === 'operator' || flag.kind === 'speaker_uncertain')
          && (row?.answer === 'na' || c.type === 'flag' && row?.answer === 'no'));
    });
    if (!affected.length) findings.push(finding('transcript_warning_outside_verdict', null, 'transcription', 'warning', { turn_index: index }));
    for (const c of affected) findings.push(finding(flag.reason || 'transcript_quality_warning', c.id, 'transcription', 'needs_review', { turn_index: index }));
  }
  return findings.filter((f, i) => findings.findIndex(other => other.reason === f.reason && other.criterion_id === f.criterion_id && other.turn_index === f.turn_index) === i);
}
