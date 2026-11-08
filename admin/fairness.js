import { esc, fmt } from './ui.js';

export const statusText = status => ({ valid: 'Проверки пройдены', warning: 'Есть предупреждения',
  needs_review: 'Нужна проверка QA', invalid: 'Ошибка результата оценки' }[status] || 'Проверка не завершена');
const reasonText = reason => ({
  human_confirmed_recording_start_missing: 'Начало записи отсутствует: приветствие проверить нельзя.',
  human_reported_asr_uncertainty: 'По аудиоревью есть неясность распознавания речи.',
  personal_introduction_not_confirmed_not_proven_absent: 'Личное представление не подтверждено; это не доказательство его отсутствия.',
  human_audio_final_c01_decision_pending: 'Аудионаблюдения записаны; окончательное решение QA ещё не принято.',
  human_audio_checklist_decision_pending: 'Наблюдения по аудио требуют решения по текущему чек-листу звонков.',
  legacy_c08_security_approval_pending: 'Для старой оценки «нет грубых ошибок» не хватает доказательств. Требуется отдельная проверка безопасности.',
  evaluator_validation_problems: 'Оценщик сохранил замечания к доказательствам; требуется проверка цитат.',
  invalid_message_evidence: 'Цитата или номер сообщения не совпадают с исходным диалогом.',
  invalid_range_evidence: 'Указан неверный участок диалога.',
  evidence_speaker_mismatch: 'Доказательство не подтверждает действие оператора.',
  missing_original_reference: 'Нет ссылки на подтверждающее сообщение.',
  audio_source_unverified: 'Не подтверждён источник аудио для оценки тона.',
  missing_transcript_probe: 'Проверка качества этой транскрипции ещё не выполнена.',
  stale_or_unbound_probe: 'Проверка транскрипции относится к другой версии диалога.',
  stale_or_unbound_human_audio_review: 'Аудиоревью требует сверки с текущим диалогом или чек-листом.',
  transcript_uncertainty: 'Начало разговора не позволяет уверенно оценить приветствие.',
  greeting_probe_disagrees: 'Проверка приветствия расходится с ответом AI; решение принимает QA.',
  contact_evidence_not_first_reply: 'Для приветствия нужно проверить первую реплику оператора.',
  identity_evidence_speaker_mismatch: 'Проверка личности не подтверждена репликой оператора или системным событием.',
  unsupported_na: 'Применение N/A требует проверки.',
}[reason] || 'Обнаружено замечание проверки; проверьте исходные доказательства.');

export function summaryHTML(validation) {
  if (!validation) return '<p class="small">Оценка предварительная · проверка доказательств не завершена.</p>';
  const reasons = [...new Set(validation.findings.map(f => reasonText(f.reason)))];
  return `<div class="banner banner--info"><div><b>${esc(statusText(validation.status))}</b>
    <p>Предварительный балл AI: ${esc(fmt(validation.provisional_total, 2))}. Подтверждённый балл QA: —.</p>
    <p>${validation.publishable ? 'Автоматические проверки завершены; это не подтверждение человеком.' : 'Результат не готов к публикации как подтверждённый. Ошибка транскрипции или проверки не означает ошибку сотрудника.'}</p>
    ${reasons.length ? `<ul>${reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div></div>`;
}

export function criterionHTML(validation, criterionId) {
  const row = validation?.criteria?.find(c => c.criterion_id === criterionId);
  if (!row) return '<p class="small muted">Статус проверки: ожидается.</p>';
  const findings = validation.findings.filter(f => f.criterion_id === criterionId || f.criterion_id === null);
  return `<p class="small"><b>Проверка:</b> ${esc(statusText(row.validation_status))}</p>
    ${[...new Set(findings.map(f => reasonText(f.reason)))].map(r => `<p class="small muted">${esc(r)}</p>`).join('')}`;
}

export async function loadFairness(view, evaluation) {
  const summary = view.querySelector('[data-fairness-summary]');
  if (!summary) return;
  summary.innerHTML = summaryHTML(null);
  try {
    const response = await fetch('/api/validate-evaluation', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation: evaluation.conv, checklist: evaluation.cl, result: evaluation.base }),
      signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error('Validation unavailable');
    const data = await response.json();
    if (!summary.isConnected) return; // A different card may have opened while validation ran.
    if (!data.enabled) { summary.innerHTML = summaryHTML(null); return; }
    summary.innerHTML = summaryHTML(data.fairness);
    view.querySelectorAll('[data-fairness-criterion]').forEach(el => {
      el.innerHTML = criterionHTML(data.fairness, el.dataset.fairnessCriterion);
    });
  } catch {
    if (summary.isConnected) summary.innerHTML = '<p class="small">Проверка недоступна. Балл остаётся предварительным; оценка AI не изменена.</p>';
  }
}
