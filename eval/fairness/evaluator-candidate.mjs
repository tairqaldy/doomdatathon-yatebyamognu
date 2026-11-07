// Offline integration candidate. Production evaluator and API do not import it.
import { readFileSync } from 'node:fs';
import { buildMessages } from '../../lib/evaluator.js';
import { score } from '../../prototype/scoring.js';
import { fingerprint, validateEvaluation, validateProbe } from './validation.mjs';
import { VALIDATION_VERSION, LEGACY_VERSIONS, riskStatus, isBlocking, finding, classifyEvaluation, classifyTranscript } from './policy.mjs';

export const CANDIDATE_VERSION = 'eval-v4-transcript-fairness-candidate-2';
const addendum = readFileSync(new URL('./prompt-addendum.txt', import.meta.url), 'utf8');
const officialCriteria = JSON.parse(readFileSync(new URL('../../data/checklists/freedom-chat-v1.json', import.meta.url), 'utf8')).criteria;
const officialContact = officialCriteria.find(c => c.id === 'c01');
const sameContactRule = criterion => criterion?.id === officialContact.id
  && fingerprint(criterion) === fingerprint(officialContact);

export function buildFairnessMessages(conversation, checklist) {
  const messages = buildMessages(conversation, checklist);
  const applicableAddendum = checklist.criteria.some(sameContactRule) ? addendum
    : addendum.split('\n').filter(line => !line.startsWith('1. ')).join('\n');
  return messages.map((message, i) => i === 0
    ? { ...message, content: `${message.content}\n\n${applicableAddendum}` } : { ...message });
}

export function reviewEvaluation(conversation, result, checklist, probe, options = {}) {
  const criteria = Array.isArray(checklist?.criteria) ? checklist.criteria.filter(c => c && typeof c.id === 'string') : [];
  const matches = id => criteria.some(c => c.id === id && fingerprint(c) === fingerprint(officialCriteria.find(o => o.id === id)));
  const mode = options.mode === 'legacy' ? 'legacy' : 'current';
  const contact = criteria.find(sameContactRule);
  const validated = validateEvaluation(conversation, result, checklist, {
    operatorCriteria: ['c01', 'c04', 'c05', 'c06', 'c08'].filter(matches),
    contactId: matches('c01') ? 'c01' : null, identityId: matches('c03') ? 'c03' : null,
  });
  const { answers } = validated;
  const assessment = classifyEvaluation(validated, conversation, result, checklist, {
    mode, applicability: options.applicability, identityId: matches('c03') ? 'c03' : null,
    contextCriterionId: matches('c06') ? 'c06' : null,
  });
  const findings = [...assessment.findings,
    ...classifyTranscript(validateProbe(conversation, probe), conversation, result, criteria, contact?.id),
    ...(options.contextFindings || [])];
  if (contact && probe?.status === 'needs_review') {
    findings.push(finding('transcript_uncertainty', contact.id, 'transcription', 'needs_review', { turn_index: probe.message_index ?? null }));
  }
  // A heuristic contradiction is a review request, never an automatic answer override.
  if (contact && ((probe?.status === 'supported' && answers[contact.id] === 'no')
    || (probe?.status === 'not_supported' && answers[contact.id] === 'yes'))) {
    findings.push(finding('greeting_probe_disagrees', contact.id, 'verdict', 'needs_review', { turn_index: probe.message_index ?? null }));
  }
  // Evidence gaps do not invalidate a structurally well-formed answer or change its points.
  const provisional = assessment.scoreable ? score(checklist, answers) : null;
  const flag = criteria.some(c => c.type === 'flag' && answers[c.id] === 'yes') || result?.gross_error === true;
  if (provisional && typeof result?.gross_error === 'boolean' && result.gross_error !== provisional.gross_error) {
    findings.push(finding('gross_flag_mismatch', null, 'verdict', 'invalid'));
  }
  const status = riskStatus(findings);
  const pending = findings.filter(isBlocking);
  const publishable = !['needs_review', 'invalid'].includes(status);
  const dimension = name => ({ status: riskStatus(findings.filter(f => f.dimension === name)) });
  return {
    conversation_id: conversation?.conversation_id ?? null,
    policy_version: VALIDATION_VERSION,
    validation_version: VALIDATION_VERSION,
    candidate_version: CANDIDATE_VERSION,
    validation_mode: mode,
    source_validation_version: options.sourceValidationVersion ?? null,
    official_result_changed: false,
    status,
    findings,
    warnings: findings.filter(f => f.severity === 'warning'),
    pending_review: pending,
    publishable,
    dimensions: {
      schema_validation: dimension('schema'),
      verdict_validation: dimension('verdict'),
      evidence_validity: dimension('evidence'),
      transcription_reliability: { ...dimension('transcription'), audio_reviewed: false },
      provenance: dimension('provenance'),
      evaluation_correctness: { status: findings.some(f => f.reason === 'invalid_na_verdict') ? 'contradicted_by_applicability_review' : 'not_independently_verified' },
      publication_readiness: { status, publishable },
    },
    provisional_total: provisional?.total ?? null,
    confirmed_total: publishable ? provisional?.total ?? null : null,
    gross_error: Boolean(flag),
    gross_error_confirmed: publishable && Boolean(flag),
    criteria: criteria.map(c => {
      const row = result?.answers?.[c.id];
      const relevant = findings.filter(f => f.criterion_id === null || f.criterion_id === c.id);
      const criterionStatus = riskStatus(relevant);
      const needsReview = relevant.some(isBlocking);
      const points = provisional?.criteria.find(r => r.criterion_id === c.id)?.points ?? null;
      return { criterion_id: c.id, answer: row?.answer ?? null, score: points,
        validation_status: criterionStatus,
        na_assessment: assessment.na[c.id] ?? null,
        verdict: needsReview ? 'needs_review' : row?.answer === 'na' ? 'not_applicable'
          : c.type === 'flag' ? (row?.answer === 'yes' ? 'violation' : 'no_violation')
          : row?.answer === 'no' || row?.answer === 0 ? 'failed' : c.type === 'scale'
            && row?.answer < Math.max(...c.scale.map(s => s.value)) ? 'partial' : 'passed',
        evidence: structuredClone(Array.isArray(row?.evidence) ? row.evidence : []), explanation: typeof row?.explanation === 'string' ? row.explanation : '',
        validation_warnings: relevant.map(f => f.reason),
        transcription_warning: relevant.filter(f => f.dimension === 'transcription').map(f => f.reason).join('; '),
        review_status: needsReview ? 'awaiting_verification' : criterionStatus === 'warning' ? 'automated_validated_with_warning' : 'automated_validated' };
    }),
    display: status === 'invalid' ? 'Некорректный результат · требуется исправление'
      : status === 'needs_review' ? 'Предварительная оценка · требуется проверка'
        : status === 'warning' ? 'Автоматическая оценка · есть предупреждения'
          : 'Автоматическая оценка · проверки пройдены',
  };
}

/** Re-run validation on every cache hit; never mutate cache or trigger paid inference. */
export function revalidateCachedEvaluation(envelope, conversation, checklist, probe, options = {}) {
  const sourceVersion = envelope?.validation_version;
  const legacy = LEGACY_VERSIONS.has(sourceVersion);
  const contextFindings = [];
  if (!legacy && sourceVersion !== VALIDATION_VERSION) contextFindings.push(finding('unknown_validation_version', null, 'provenance', 'needs_review'));
  if (envelope?.transcript_sha256 !== fingerprint(conversation?.transcript ?? null)
    || envelope?.checklist_sha256 !== fingerprint(checklist ?? null)) {
    contextFindings.push(finding('cache_context_mismatch', null, 'provenance', 'needs_review'));
  }
  return reviewEvaluation(conversation, envelope?.value, checklist, probe, { ...options,
    mode: legacy ? 'legacy' : 'current', sourceValidationVersion: sourceVersion ?? 'unversioned', contextFindings });
}
