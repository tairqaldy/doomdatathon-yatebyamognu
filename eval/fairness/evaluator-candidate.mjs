// Offline integration candidate. Production evaluator and API do not import it.
import { readFileSync } from 'node:fs';
import { buildMessages } from '../../lib/evaluator.js';
import { score } from '../../prototype/scoring.js';

export const CANDIDATE_VERSION = 'eval-v4-transcript-fairness-candidate-1';
const addendum = readFileSync(new URL('./prompt-addendum.txt', import.meta.url), 'utf8');
const officialContact = JSON.parse(readFileSync(new URL('../../data/checklists/freedom-chat-v1.json', import.meta.url), 'utf8')).criteria.find(c => c.id === 'c01');
const sameContactRule = criterion => criterion?.id === officialContact.id
  && ['type', 'title', 'description', 'na_allowed'].every(key => criterion[key] === officialContact[key]);

export function buildFairnessMessages(conversation, checklist) {
  const messages = buildMessages(conversation, checklist);
  return messages.map((message, i) => i === 0
    ? { ...message, content: `${message.content}\n\n${addendum}` } : { ...message });
}

export function reviewEvaluation(conversation, result, checklist, probe) {
  const answers = Object.fromEntries(Object.entries(result.answers).map(([id, row]) => [id, row.answer]));
  const provisional = score(checklist, answers);
  const pending = [];
  const contact = checklist.criteria.find(sameContactRule);
  if (contact && probe?.status === 'needs_review') {
    pending.push({ criterion_id: contact.id, reason: 'transcript_uncertainty',
      turn_index: probe.message_index ?? null });
  }
  // A heuristic contradiction is a review request, never an automatic answer override.
  if (contact && probe?.status === 'supported' && answers[contact.id] === 'no') {
    pending.push({ criterion_id: contact.id, reason: 'greeting_probe_disagrees',
      turn_index: probe.message_index ?? null });
  }
  if ((result.problems || []).length) {
    pending.push({ criterion_id: null, reason: 'evaluator_validation_problems' });
  }
  const incomplete = checklist.criteria.some(c => !Object.hasOwn(answers, c.id));
  if (incomplete) pending.push({ criterion_id: null, reason: 'incomplete_evaluation' });
  return {
    conversation_id: conversation.conversation_id,
    policy_version: CANDIDATE_VERSION,
    official_result_changed: false,
    pending_review: pending,
    publishable: pending.length === 0,
    provisional_total: provisional.total,
    confirmed_total: pending.length ? null : provisional.total,
    gross_error: provisional.gross_error,
    display: pending.length ? 'Предварительная оценка · требуется проверка записи'
      : 'Автоматическая оценка · нет обнаруженных сигналов неопределённости',
  };
}
