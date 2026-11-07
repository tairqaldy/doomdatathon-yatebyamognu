// Offline integration candidate. Production evaluator and API do not import it.
import { readFileSync } from 'node:fs';
import { buildMessages } from '../../lib/evaluator.js';
import { score } from '../../prototype/scoring.js';
import { fingerprint, validateEvaluation, validateProbe } from './validation.mjs';

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

export function reviewEvaluation(conversation, result, checklist, probe) {
  const criteria = Array.isArray(checklist?.criteria) ? checklist.criteria.filter(c => c && typeof c.id === 'string') : [];
  const matches = id => criteria.some(c => c.id === id && fingerprint(c) === fingerprint(officialCriteria.find(o => o.id === id)));
  const validated = validateEvaluation(conversation, result, checklist, {
    operatorCriteria: ['c01', 'c04', 'c05', 'c06', 'c08'].filter(matches),
    contactId: matches('c01') ? 'c01' : null, identityId: matches('c03') ? 'c03' : null,
  });
  const { answers } = validated;
  const pending = [...validated.issues, ...validateProbe(conversation, probe)];
  const contact = criteria.find(sameContactRule);
  if (contact && probe?.status === 'needs_review') {
    pending.push({ criterion_id: contact.id, reason: 'transcript_uncertainty',
      turn_index: probe.message_index ?? null });
  }
  // A heuristic contradiction is a review request, never an automatic answer override.
  if (contact && ((probe?.status === 'supported' && answers[contact.id] === 'no')
    || (probe?.status === 'not_supported' && answers[contact.id] === 'yes'))) {
    pending.push({ criterion_id: contact.id, reason: 'greeting_probe_disagrees',
      turn_index: probe.message_index ?? null });
  }
  // Do not call the arithmetic engine on malformed/partial verdicts.
  const provisional = validated.valid ? score(checklist, answers) : null;
  const flag = criteria.some(c => c.type === 'flag' && answers[c.id] === 'yes') || result?.gross_error === true;
  if (provisional && typeof result?.gross_error === 'boolean' && result.gross_error !== provisional.gross_error) {
    pending.push({ criterion_id: null, reason: 'gross_flag_mismatch' });
  }
  return {
    conversation_id: conversation?.conversation_id ?? null,
    policy_version: CANDIDATE_VERSION,
    official_result_changed: false,
    pending_review: pending,
    publishable: pending.length === 0,
    provisional_total: provisional?.total ?? null,
    confirmed_total: pending.length ? null : provisional?.total ?? null,
    gross_error: Boolean(flag),
    gross_error_confirmed: pending.length === 0 && Boolean(flag),
    criteria: criteria.map(c => {
      const row = result?.answers?.[c.id];
      const needsReview = pending.some(p => p.criterion_id === null || p.criterion_id === c.id);
      const points = provisional?.criteria.find(r => r.criterion_id === c.id)?.points ?? null;
      const warnings = pending.filter(p => p.criterion_id === null || p.criterion_id === c.id).map(p => p.reason);
      return { criterion_id: c.id, answer: row?.answer ?? null, score: points,
        verdict: needsReview ? 'needs_review' : row?.answer === 'na' ? 'not_applicable'
          : c.type === 'flag' ? (row?.answer === 'yes' ? 'violation' : 'no_violation')
          : row?.answer === 'no' || row?.answer === 0 ? 'failed' : c.type === 'scale'
            && row?.answer < Math.max(...c.scale.map(s => s.value)) ? 'partial' : 'passed',
        evidence: structuredClone(Array.isArray(row?.evidence) ? row.evidence : []), explanation: typeof row?.explanation === 'string' ? row.explanation : '',
        validation_warnings: warnings,
        transcription_warning: warnings.filter(reason => ['transcript_uncertainty', 'transcript_quality_warning'].includes(reason)).join('; '),
        review_status: needsReview ? 'awaiting_verification' : 'automated_validated' };
    }),
    display: pending.length ? 'Предварительная оценка · требуется проверка записи'
      : 'Автоматическая оценка · нет обнаруженных сигналов неопределённости',
  };
}

/** Re-run validation on every cache hit; never mutate cache or trigger paid inference. */
export function revalidateCachedEvaluation(envelope, conversation, checklist, probe) {
  const review = reviewEvaluation(conversation, envelope?.value, checklist, probe);
  if (envelope?.transcript_sha256 !== fingerprint(conversation?.transcript ?? null)
    || envelope?.checklist_sha256 !== fingerprint(checklist ?? null)) {
    review.pending_review.push({ criterion_id: null, reason: 'cache_context_mismatch' });
    review.publishable = false;
    review.confirmed_total = null;
    review.gross_error_confirmed = false;
    review.display = 'Предварительная оценка · требуется проверка cache';
    for (const row of review.criteria) {
      row.verdict = 'needs_review'; row.review_status = 'awaiting_verification';
      row.validation_warnings.push('cache_context_mismatch');
    }
  }
  return review;
}
