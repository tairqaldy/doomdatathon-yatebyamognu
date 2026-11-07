// Апелляции: queue of disputed scores (same records as /prototype). Reviewer opens one, confirms or changes the score.
import { $, esc, fmt, plural, icon, setHead, seg, dateTime } from './ui.js';
import { S, evaluation, checklistFor, versionsOf, clHash, answerText, appealStats, setRole, rows, checklistLabel } from './store.js';
import { openReview } from './card.js';

let filter = 'open';

export function viewAppeals(view) {
  const st = appealStats();
  setHead('Апелляции', `${st.open} ${plural(st.open, ['открыта', 'открыты', 'открыто'])} · ${st.changed + st.confirmed} ${plural(st.changed + st.confirmed, ['решена', 'решены', 'решено'])}`);
  const allVersions = [...versionsOf('chat'), ...versionsOf('call')];
  const clOf = (a) => allVersions.find((c) => clHash(c) === a.checklist_hash);
  const critOf = (a) => clOf(a)?.criteria.find((x) => x.id === a.criterion_id)
    || [...allVersions].reverse().flatMap((c) => c.criteria).find((x) => x.id === a.criterion_id);
  const verOf = (a) => a.checklist_version ?? '?';
  const all = [...S.appeals].sort((a, b) => (a.status === 'open' ? 0 : 1) - (b.status === 'open' ? 0 : 1) || String(b.created_at).localeCompare(String(a.created_at)));
  const list = all.filter((a) => (filter === 'open' ? a.status === 'open' : filter === 'done' ? a.status !== 'open' : true));
  const reviewer = S.role === 'reviewer';

  if (!all.length) {
    const worst = rows().filter((r) => r.source === 'DEV' && r.dd.length).sort((a, b) => (a.total ?? 0) - (b.total ?? 0))[0];
    view.innerHTML = `<div class="empty"><span class="empty__ic">${icon('appeals')}</span><h2>Апелляций пока нет</h2><p>Откройте анализ диалога и нажмите «Оспорить» у причины снижения. Апелляция появится здесь.</p>${worst ? `<a class="btn btn--primary" href="#/dialog/${encodeURIComponent(worst.id)}">Открыть диалог с низким баллом</a>` : ''}</div>`;
    return;
  }

  view.innerHTML = `<div class="appeals">
    <div class="toolbar">
      ${seg('ap-filter', [{ v: 'open', label: `Открытые · ${st.open}` }, { v: 'done', label: `Решённые · ${st.changed + st.confirmed}` }, { v: 'all', label: 'Все' }], filter, 'Фильтр апелляций')}
      <span class="toolbar__note">${reviewer ? 'Роль: проверяющий. Откройте апелляцию и примите решение.' : 'Решения принимает проверяющий.'}</span>
      ${reviewer ? '' : '<button class="btn btn--s" type="button" id="ap-role">Стать проверяющим</button>'}
    </div>
    ${list.length ? `<ol class="appeal-list">${list.map((a) => {
      const c = critOf(a); const conv = S.byId[a.conversation_id]; const sameVer = !!conv && a.checklist_hash === clHash(checklistFor(conv));
      const E = sameVer ? evaluation(a.conversation_id) : null;
      const auto = E?.answers[a.criterion_id]?.answer;
      return `<li class="card appeal appeal--${a.status}">
        <header class="appeal__head">
          <a class="mono appeal__id" href="#/dialog/${encodeURIComponent(a.conversation_id)}">${esc(a.conversation_id)}</a>
          <b class="appeal__crit">${esc(c?.title || a.criterion_id)}</b>
          ${a.status === 'open' ? '<span class="l-chip l-chip--warn">Открыта</span>' : a.status === 'changed' ? '<span class="l-chip l-chip--info">Оценка изменена</span>' : '<span class="l-chip">Оценка подтверждена</span>'}
          ${sameVer ? '' : `<span class="l-chip" title="Апелляция подана к другой версии чек-листа">${esc(clOf(a) ? checklistLabel(clOf(a)) : `чек-лист v${verOf(a)}`)}</span>`}
          <span class="appeal__date muted small">${esc(dateTime(a.created_at))}</span>
        </header>
        <div class="appeal__body">
          <blockquote class="appeal__comment">${esc(a.comment)}</blockquote>
          ${E && c ? `<dl class="appeal__facts"><div><dt>Автооценка</dt><dd>${esc(answerText(c, auto))}</dd></div>${a.decision ? `<div><dt>Решение</dt><dd>${a.status === 'changed' ? esc(answerText(c, a.decision.new_answer)) : 'без изменений'}</dd></div>` : ''}<div><dt>Итог диалога</dt><dd class="num">${a.status === 'changed' ? `${fmt(E.aiScore.total, 2)} → ${fmt(E.finalScore.total, 2)}` : fmt(E.finalScore.total, 2)}</dd></div></dl>` : ''}
          ${a.decision ? `<p class="appeal__reason"><span class="muted">Причина решения:</span> ${esc(a.decision.reason)}</p>` : ''}
        </div>
        <footer class="appeal__foot">
          <a class="btn btn--s btn--ghost" href="#/dialog/${encodeURIComponent(a.conversation_id)}">Открыть диалог</a>
          ${a.status === 'open' && reviewer ? `<button class="btn btn--s btn--primary" type="button" data-review="${a.id}" ${sameVer ? '' : 'disabled title="Апелляция к другой версии чек-листа"'}>Принять решение</button>` : ''}
        </footer>
      </li>`; }).join('')}</ol>` : `<div class="empty empty--s"><p>${filter === 'open' ? 'Открытых апелляций нет.' : 'Решённых апелляций пока нет.'}</p>${filter === 'open' && st.changed + st.confirmed ? `<button class="btn btn--s" type="button" data-filter="done">Показать решённые · ${st.changed + st.confirmed}</button>` : ''}</div>`}</div>`;

  $('#ap-filter', view).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; filter = b.dataset.v; viewAppeals(view); });
  $('#ap-role', view)?.addEventListener('click', () => setRole('reviewer'));
  $('.appeals', view).addEventListener('click', (e) => {
    const f = e.target.closest('[data-filter]'); if (f) { filter = f.dataset.filter; viewAppeals(view); $('#ap-filter button[aria-pressed="true"]', view)?.focus(); return; }
    const b = e.target.closest('[data-review]'); if (b) openReview(b.dataset.review);
  });
}
