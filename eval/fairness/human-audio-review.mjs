// Human observations are sidecars, never replacement transcripts or score overrides.
import { fingerprint } from './validation.mjs';
export const HUMAN_AUDIO_REVIEW_VERSION = 'human-audio-validation-v2';

export function assessHumanAudioReview(conversation, checklist, review, { observationsOnly = false } = {}) {
  const invalid = reason => ({ status: 'needs_review', observation_status: 'unbound', findings: [
    { reason, criterion_id: 'c01', dimension: 'transcription', severity: 'needs_review' }],
    score_override: null, na_override: false });
  if (!review || !Array.isArray(conversation?.transcript) || !checklist
    || review.conversation_id !== conversation?.conversation_id
    || review.transcript_sha256 !== fingerprint(conversation?.transcript)
    || (!observationsOnly && review.checklist_sha256 !== fingerprint(checklist))) return invalid('stale_or_unbound_human_audio_review');
  if (review.source !== 'user_reported_manual_audio_listening' || review.observation_status !== 'recorded'
    || !review.reviewer?.session_user || !Array.isArray(review.issues) || !review.issues.length
    || review.wording?.verbatim_confirmed !== false || review.final_c01_verdict !== null) return invalid('incomplete_human_audio_review');
  const issues = new Set(review.issues);
  const findings = [];
  if (review.checklist_sha256 !== fingerprint(checklist)) findings.push({ reason: 'human_audio_checklist_decision_pending',
    criterion_id: 'c01', dimension: 'verdict', severity: 'needs_review' });
  if (issues.has('recording_start_missing')) findings.push({ reason: 'human_confirmed_recording_start_missing',
    criterion_id: 'c01', dimension: 'transcription', severity: 'needs_review' });
  if (issues.has('possible_asr_company_name_mismatch') || issues.has('fast_or_unclear_speech')) findings.push({
    reason: 'human_reported_asr_uncertainty', criterion_id: 'c01', dimension: 'transcription', severity: 'needs_review' });
  findings.push({ reason: review.personal_introduction === 'not_confirmed'
    ? 'personal_introduction_not_confirmed_not_proven_absent' : 'human_audio_final_c01_decision_pending',
    criterion_id: 'c01', dimension: 'verdict', severity: 'needs_review' });
  return { status: 'needs_review', observation_status: 'recorded', findings,
    greeting: review.greeting, personal_introduction: review.personal_introduction,
    do_not_penalize_for_source_error: true, operator_error_established: false,
    score_override: null, na_override: false,
    policy_followup: issues.has('recording_start_missing')
      ? 'Organizer Q&A #2978 permits C01 N/A for calls without recorded greeting; reconcile official chat checklist na_allowed=false through explicit call-policy decision before applying.'
      : 'C01 requires greeting and personal introduction in the first response; uncertain wording or later greeting alone cannot establish full compliance.',
    security_approval: 'not_granted_by_audio_review' };
}
