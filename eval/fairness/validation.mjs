// Structural checks only. Existing references are not proof of semantic correctness.
import { createHash } from 'node:crypto';

export const GUARD_VERSION = 'transcript-guard-v2';
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const text = value => typeof value === 'string' && value.trim().length > 0;
const finite = value => typeof value === 'number' && Number.isFinite(value);
function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (object(value)) return Object.fromEntries(Object.keys(value).sort().map(key => [key, stable(value[key])]));
  return value;
}
export const fingerprint = value => createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');

export function validateEvaluation(conversation, result, checklist, { operatorCriteria = [], contactId = null, identityId = null } = {}) {
  const issues = [];
  const add = (reason, criterion_id = null) => issues.push({ reason, criterion_id });
  const transcript = conversation?.transcript;
  if (!text(conversation?.conversation_id) || !Array.isArray(transcript) || !transcript.length
    || transcript.some(m => !object(m) || !text(m.text) || !text(m.timestamp)
      || !['operator', 'client', 'bot', 'system'].includes(m.speaker))) add('invalid_transcript');
  const criteria = checklist?.criteria;
  if (!text(checklist?.id) || !Number.isInteger(checklist?.version) || !Array.isArray(criteria) || !criteria.length) {
    add('invalid_checklist');
    return { issues, answers: {}, valid: false };
  }
  const ids = new Set();
  for (const c of criteria) {
    if (!object(c) || !text(c.id) || ids.has(c.id) || !text(c.title) || !text(c.description)
      || !finite(c.weight) || c.weight < 0 || !finite(c.order)
      || !['binary', 'scale', 'flag'].includes(c.type) || typeof c.na_allowed !== 'boolean'
      || (c.na_allowed && !text(c.na_condition)) || (c.type === 'flag' && c.weight !== 0)) add('invalid_criterion', c?.id ?? null);
    if (c?.type === 'scale' && (!Array.isArray(c.scale) || !c.scale.length
      || c.scale.some(s => !finite(s.value) || s.value < 0 || !text(s.label))
      || new Set(c.scale.map(s => s.value)).size !== c.scale.length
      || Math.max(...c.scale.map(s => s.value)) <= 0)) add('invalid_scale', c.id);
    ids.add(c?.id);
  }
  if (!object(result) || !object(result.answers)) {
    add('incomplete_evaluation');
    return { issues, answers: {}, valid: false };
  }
  if (!text(result.model) || !text(result.prompt_version)
    || !finite(result.latency_ms) || result.latency_ms < 0
    || !Number.isInteger(result.attempts) || result.attempts < 1
    || !object(result.usage) || !(result.usage.cost === null || (finite(result.usage.cost) && result.usage.cost >= 0))) add('invalid_result_metadata');
  if (!object(result.summary) || ['reason', 'operator_actions', 'outcome'].some(key => !text(result.summary[key]))) add('invalid_summary');
  if (!Array.isArray(result.problems) || result.problems.some(p => typeof p !== 'string')) add('invalid_problems');
  else if (result.problems.length) add('evaluator_validation_problems');
  if (result.conversation_id !== undefined && result.conversation_id !== conversation?.conversation_id) add('result_conversation_mismatch');
  for (const id of Object.keys(result.answers)) if (!ids.has(id)) add('unexpected_criterion', id);
  const answers = Object.create(null);
  const inRange = index => Number.isInteger(index) && Array.isArray(transcript) && index >= 0 && index < transcript.length;
  for (const c of criteria.filter(object)) {
    const row = result.answers[c.id];
    if (!object(row)) { add('incomplete_evaluation', c.id); continue; }
    answers[c.id] = row.answer;
    const allowed = c.type === 'scale' ? (c.scale || []).map(s => s.value) : ['yes', 'no'];
    if (c.na_allowed) allowed.push('na');
    if (!allowed.includes(row.answer)) add('invalid_answer', c.id);
    if (!text(row.explanation) || typeof row.deduction_reason !== 'string' || !Array.isArray(row.evidence)) {
      add('invalid_criterion_fields', c.id); continue;
    }
    if (!row.evidence.length) add('missing_original_reference', c.id);
    for (const e of row.evidence) {
      if (!object(e)) { add('invalid_evidence', c.id); continue; }
      if (e.kind === 'message') {
        if (!inRange(e.turn_index) || !text(e.quote)
          || !transcript[e.turn_index]?.text?.includes(e.quote)) add('invalid_message_evidence', c.id);
      } else if (e.kind === 'range') {
        if (!Array.isArray(e.range) || e.range.length !== 2 || !e.range.every(inRange)
          || e.range[0] > e.range[1]) add('invalid_range_evidence', c.id);
      } else if (e.kind === 'na_condition') {
        if (row.answer !== 'na' || !c.na_allowed || !text(e.quote)) add('invalid_na_evidence', c.id);
      } else add('invalid_evidence', c.id);
    }
    // For an actual verdict, condition prose alone cannot replace a source anchor.
    if (!row.evidence.some(e => e?.kind === 'message' || e?.kind === 'range')) add('missing_original_reference', c.id);
    const indices = row.evidence.flatMap(e => e?.kind === 'message' && inRange(e.turn_index) ? [e.turn_index]
      : e?.kind === 'range' && Array.isArray(e.range) && e.range.every(inRange) && e.range[0] <= e.range[1]
        ? Array.from({ length: e.range[1] - e.range[0] + 1 }, (_, i) => e.range[0] + i) : []);
    if (row.answer !== 'na' && operatorCriteria.includes(c.id)
      && !(c.type === 'flag' && row.answer === 'no')
      && !indices.some(i => transcript[i]?.speaker === 'operator')) add('evidence_speaker_mismatch', c.id);
    if (c.id === contactId && (!Array.isArray(transcript)
      || !indices.includes(transcript.findIndex(m => m?.speaker === 'operator')))) add('contact_evidence_not_first_reply', c.id);
    if (c.id === identityId && row.answer === 'yes'
      && !indices.some(i => ['operator', 'system'].includes(transcript[i]?.speaker))) add('identity_evidence_speaker_mismatch', c.id);
  }
  return { issues, answers, valid: issues.length === 0 };
}

export function validateProbe(conversation, probe) {
  if (!object(probe)) return [{ criterion_id: null, reason: 'missing_transcript_probe' }];
  const reasons = [];
  const add = reason => reasons.push({ criterion_id: null, reason });
  if (probe.id !== conversation?.conversation_id || probe.guard_version !== GUARD_VERSION
    || !Array.isArray(conversation?.transcript) || probe.transcript_sha256 !== fingerprint(conversation.transcript)) add('stale_or_unbound_probe');
  if (probe.quality_checks_completed !== true || !Array.isArray(probe.quality_flags)
    || !['supported', 'not_supported', 'needs_review'].includes(probe.status)) add('incomplete_transcript_probe');
  if (!Number.isInteger(probe.message_index) || probe.message_index < 0
    || !Array.isArray(conversation?.transcript)
    || probe.message_index !== conversation.transcript.findIndex(m => m?.speaker === 'operator')) add('probe_speaker_mismatch');
  if (Array.isArray(probe.quality_flags) && probe.quality_flags.length) add('transcript_quality_warning');
  if (conversation?.audio_missing || conversation?.audio_corrupted
    || (Array.isArray(conversation?.transcript) && conversation.transcript.some(m => m?.speaker_uncertain || m?.segment_missing || m?.audio_corrupted
      || (finite(m?.asr_confidence) && m.asr_confidence >= 0 && m.asr_confidence < 0.75)))) add('source_quality_uncertainty');
  return reasons;
}
