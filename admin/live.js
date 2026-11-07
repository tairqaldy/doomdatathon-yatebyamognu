// Живые чаты: operator console over the shared live-store (customer chat at /support/ in another window).
// Sessions handed over by the bot come first; the operator accepts, replies, closes; a closed chat is evaluated live.
import { $, $$, esc, fmt, clock, timeOf, ring, icon, tierVar, setHead, plural } from './ui.js';
import { checklist, liveEvaluation, sortedCrits, tier, maxStep, liveStats } from './store.js';
import * as live from '/shared/live-store.js';

const STATUS = {
  bot: { label: 'Бот', cls: 'st--bot' },
  waiting_operator: { label: 'Ждёт оператора', cls: 'st--wait' },
  operator: { label: 'Оператор', cls: 'st--op' },
  closed: { label: 'Закрыт', cls: 'st--closed' },
};
const ORDER = { waiting_operator: 0, operator: 1, bot: 2, closed: 3 };
const SPEAKER = { client: 'Клиент', bot: 'AIM · бот', system: 'Система' };
const NAME_KEY = 'cqa-admin-operator';
const drafts = new Map();
const evaluating = new Set();
const evalErrors = new Map();
let wantReplyFocus = false;

const opName = () => { try { return sessionStorage.getItem(NAME_KEY) || 'Айгерим'; } catch { return 'Айгерим'; } };
const setOpName = (v) => { try { sessionStorage.setItem(NAME_KEY, v); } catch {} };
const chip = (s) => { const st = STATUS[s.status] || STATUS.bot; return `<span class="st ${st.cls}">${s.status === 'waiting_operator' ? '<span class="pulse" aria-hidden="true"></span>' : ''}${st.label}</span>`; };
const since = (s) => (s.status === 'waiting_operator' && s.handoff?.at ? `<span class="timer mono" data-since="${esc(s.handoff.at)}" aria-label="Время ожидания">${clock(Date.now() - new Date(s.handoff.at))}</span>` : '');
const ansLabel = (c, a) => (a === 'yes' ? (c.type === 'flag' ? 'Нарушение' : 'Да') : a === 'no' ? (c.type === 'flag' ? 'Нет нарушений' : 'Нет') : a === 'na' ? 'N/A' : a == null ? '—' : `${a} из ${maxStep(c)}`);
const ansCls = (c, a, row) => (a === 'na' || a == null ? 'ans--na' : c.type === 'flag' ? (a === 'yes' ? 'ans--gross' : 'ans--ok') : row?.points != null && row.points >= row.effective_weight - 0.001 ? 'ans--ok' : row?.points > 0 ? 'ans--mid' : 'ans--bad');

export function viewLive(view, id) {
  const ls = liveStats();
  setHead('Живые чаты', `${ls.count} ${plural(ls.count, ['сессия', 'сессии', 'сессий'])} · ждут оператора: ${ls.waiting}`);
  view.innerHTML = `<div class="live ${id ? 'live--detail' : ''}">
    <aside class="live__list card" aria-label="Сессии">
      <header class="live__list-head"><h2>Сессии <span class="muted num" id="l-count"></span></h2>
        <div class="live__tools"><a class="btn btn--s btn--ghost" href="/support/" target="_blank" rel="noopener">Чат клиента ${icon('ext')}</a><button class="btn btn--s" type="button" id="l-demo">Демо-сессия</button></div></header>
      <ul class="sessions" id="l-items"></ul>
    </aside>
    <section class="live__detail" id="l-detail"></section>
  </div>`;

  const drawList = () => {
    const ss = live.all().sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(b.started_at).localeCompare(String(a.started_at)));
    $('#l-count', view).textContent = ss.length ? `· ${ss.length}` : '';
    $('#l-items', view).innerHTML = ss.length ? ss.map((s) => {
      const last = [...s.messages].reverse().find((m) => m.speaker !== 'system') || s.messages.at(-1);
      return `<li><a class="session ${s.id === id ? 'is-active' : ''}" href="#/live/${encodeURIComponent(s.id)}" ${s.id === id ? 'aria-current="true"' : ''}>
        <span class="session__top">${chip(s)}${since(s)}<span class="session__time mono">${timeOf(s.started_at)}</span></span>
        <span class="session__text">${esc(last ? last.text : 'Пока без сообщений')}</span>
        <span class="session__meta">${esc(s.language || 'RU')} · <span class="mono">${esc(s.id.replace('live-', ''))}</span>${s.operator_name ? ` · ${esc(s.operator_name)}` : ''}${s.evaluation ? ' · оценён' : ''}${s.csat ? ` · CSAT ${esc(s.csat)}` : ''}</span>
      </a></li>`; }).join('') : '<li class="sessions__empty"><p>Активных сессий нет.</p><p class="muted small">Откройте чат клиента в соседнем окне или создайте демо-сессию. Сессии появятся здесь сами.</p></li>';
  };

  const drawDetail = () => {
    const box = $('#l-detail', view);
    const s = id ? live.get(id) : null;
    if (!id) { box.innerHTML = `<div class="empty card"><span class="empty__ic">${icon('live')}</span><h2>Выберите сессию</h2><p>Сессии, где бот передал разговор оператору, стоят в списке первыми.</p></div>`; return; }
    if (!s) { box.innerHTML = '<div class="empty card"><h2>Сессия не найдена</h2><p>Возможно, она удалена в другом окне.</p><a class="btn" href="#/live">К списку</a></div>'; return; }
    const active = document.activeElement;
    const keepFocus = active && box.contains(active) && active.id ? active.id : null;
    const caret = active?.selectionStart;
    box.innerHTML = `<div class="card ld">
      <header class="ld__head">
        <a class="icon-btn ld__back" href="#/live" aria-label="К списку сессий">${icon('back')}</a>
        <div class="ld__title"><h2 class="mono">${esc(s.id)}</h2><span class="muted small">${esc(s.channel || 'web chat')} · ${esc(s.language || 'RU')} · начат ${timeOf(s.started_at)}</span></div>
        <div class="ld__status">${chip(s)}${since(s)}</div>
      </header>
      ${s.handoff ? `<aside class="brief" aria-label="Бриф от бота"><span class="kicker">Бриф от бота · ${timeOf(s.handoff.at)}</span><p>${esc(s.handoff.reason || 'Причина не указана')}</p>${s.handoff.summary ? `<p class="muted">${esc(s.handoff.summary)}</p>` : ''}</aside>` : ''}
      <ol class="chat" id="l-tr" aria-label="Переписка">
        ${s.messages.map((m, i) => `<li class="msg msg--${esc(m.speaker)}" id="msg-${i}">
          ${m.speaker === 'system' ? `<span>${esc(m.text)}</span>` : `
          <span class="msg__who">${esc(m.speaker === 'operator' ? (s.operator_name || 'Оператор') : SPEAKER[m.speaker] || m.speaker)} <span class="mono">#${i} · ${esc(m.timestamp || '')}</span></span>
          <span class="msg__bubble">${esc(m.text)}</span>`}
        </li>`).join('') || '<li class="msg msg--system"><span>Сообщений пока нет</span></li>'}
      </ol>
      <div class="ld__controls">${controls(s)}</div>
      ${s.status === 'closed' ? `<section class="ld__eval" aria-label="Оценка качества">${evalBlock(s)}</section>` : ''}
    </div>`;
    const tr = $('#l-tr', box); tr.scrollTop = tr.scrollHeight;
    if (wantReplyFocus && $('#l-reply', box)) { wantReplyFocus = false; $('#l-reply', box).focus({ preventScroll: true }); }
    else if (keepFocus) { const el = box.querySelector(`#${keepFocus}`); if (el) { el.focus({ preventScroll: true }); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch {} } }
  };

  const controls = (s) => {
    if (s.status === 'closed') return `<div class="ctl-row"><span class="muted">Диалог закрыт${s.operator_name ? `, вела ${esc(s.operator_name)}` : ''}.</span>${s.csat ? `<span class="csat">Оценка клиента <b class="num">${esc(s.csat)}</b>/5</span>` : '<span class="muted small">Клиент не оставил оценку</span>'}</div>${s.csat_comment ? `<p class="csat-comment">«${esc(s.csat_comment)}»</p>` : ''}`;
    if (s.status === 'operator') return `
      <form class="reply" id="l-reply-form">
        <label class="sr-only" for="l-reply">Ответ клиенту</label>
        <textarea id="l-reply" class="input" rows="2" placeholder="Ответ клиенту. Enter — отправить, Shift+Enter — новая строка">${esc(drafts.get(s.id) || '')}</textarea>
        <div class="reply__actions"><button class="btn btn--primary btn--s" type="submit">${icon('send')}Отправить</button><button class="btn btn--s" type="button" id="l-close">Завершить чат</button></div>
      </form>`;
    return `<form class="accept" id="l-accept-form">
      <label class="field field--inline"><span class="field__label">Имя оператора</span><input id="l-name" class="input input--s" value="${esc(opName())}" autocomplete="off" required></label>
      <button class="btn btn--primary btn--s" type="submit">Принять диалог</button>
      ${s.status === 'bot' ? '<span class="muted small">Бот ещё ведёт разговор. Можно подключиться раньше.</span>' : ''}
    </form>`;
  };

  const evalBlock = (s) => {
    if (evaluating.has(s.id)) return `<div class="run run--pending" role="status"><span class="spinner" aria-hidden="true"></span><div><b>AI оценивает чат: чек-лист чатов v${checklist().version}</b><span class="muted small">Обычно 20–40 секунд, оценка проходит несколько прогонов</span></div></div>`;
    if (!s.evaluation?.answers) return `<div class="eval-empty"><div><b>Оценка качества</b><p class="muted small">Чат ещё не оценён. AI проверит его по активному чек-листу.</p>${evalErrors.get(s.id) ? `<p class="field__err" role="alert">${esc(evalErrors.get(s.id))}</p>` : ''}</div><button class="btn btn--primary btn--s" type="button" id="l-eval">Оценить</button></div>`;
    const E = liveEvaluation(s); const total = E.finalScore.total; const t = tier(total);
    return `
      <header class="eval-head">
        <div class="ring-wrap ring-wrap--s">${ring(total, t, 76, 6)}<span class="ring-wrap__num num">${total == null ? '—' : fmt(total, 0)}</span></div>
        <div><span class="kicker">Оценка AI · ${esc(String(s.evaluation.model || '').replace('openai:', ''))}</span>
          <b class="eval-total num" style="color:${tierVar(t)}">${total == null ? 'не рассчитан' : `${fmt(total, 2)} из 100`}</b>
          ${E.finalScore.gross_error ? `<span class="l-chip l-chip--bad">${icon('alert')}Грубая ошибка</span>` : ''}</div>
        <button class="btn btn--s btn--ghost" type="button" id="l-eval">${icon('refresh')}Оценить заново</button>
      </header>
      ${E.summary ? `<dl class="summary"><div><dt>Запрос</dt><dd>${esc(E.summary.reason)}</dd></div><div><dt>Действия</dt><dd>${esc(E.summary.operator_actions)}</dd></div><div><dt>Итог</dt><dd>${esc(E.summary.outcome)}</dd></div></dl>` : ''}
      <div class="crit-list">${sortedCrits(E.cl).map((c) => { const a = E.answers[c.id] || {}; const r = E.finalScore.criteria.find((x) => x.criterion_id === c.id);
        const ev = (a.evidence || []).find((e) => e.kind === 'message' || e.kind === 'range'); const i = ev ? (ev.kind === 'message' ? ev.turn_index : ev.range[0]) : null;
        return `<article class="crit">
          <header class="crit__head"><span class="crit__title crit__title--static"><span class="crit__n mono">${String(c.order).padStart(2, '0')}</span>${esc(c.title)}</span>
            <span class="ans ${ansCls(c, a.answer, r)}">${esc(ansLabel(c, a.answer))}</span>
            <span class="crit__pts num">${c.type === 'flag' ? '<span class="muted">флаг</span>' : r?.points == null ? '<span class="muted">не учит.</span>' : `${fmt(r.points, 2)}<small> / ${fmt(r.effective_weight, 2)}</small>`}</span></header>
          ${a.deduction_reason ? `<p class="crit__lost">${esc(a.deduction_reason)}</p>` : a.explanation ? `<p class="crit__why">${esc(a.explanation)}</p>` : ''}
          ${i != null ? `<div class="crit__ev"><button type="button" class="evidence evidence--btn" data-jump="${i}"><span class="evidence__meta mono">#${i}</span><q>${esc(ev.quote || s.messages[i]?.text || '')}</q></button></div>` : ''}
        </article>`; }).join('')}</div>`;
  };

  const draw = () => { drawList(); drawDetail(); };
  draw();

  view.addEventListener('submit', (e) => {
    const s = id && live.get(id); if (!s) return;
    if (e.target.id === 'l-accept-form') {
      e.preventDefault();
      const name = $('#l-name', view).value.trim() || 'Оператор'; setOpName(name);
      live.update(s.id, { status: 'operator', operator_name: name, accepted_at: new Date().toISOString() });
      live.addMessage(s.id, 'system', `К разговору подключился специалист: ${name}`);
      wantReplyFocus = true;
    }
    if (e.target.id === 'l-reply-form') {
      e.preventDefault();
      const ta = $('#l-reply', view); const text = ta.value.trim(); if (!text) return;
      drafts.delete(s.id); ta.value = '';
      live.addMessage(s.id, 'operator', text);
    }
  });
  view.addEventListener('click', async (e) => {
    const s = id && live.get(id);
    if (e.target.closest('#l-demo')) {
      const n = live.create({ language: 'RU' });
      live.addMessage(n.id, 'client', 'Здравствуйте, не могу вывести деньги на карту, пишет «операция отклонена».');
      live.addMessage(n.id, 'bot', 'Здравствуйте! Я AIM, AI-ассистент Freedom Broker. Для вывода нужно проверить данные счёта, это может сделать только специалист. Передаю ваш вопрос оператору, обычно это занимает до 3 минут.');
      live.update(n.id, { status: 'waiting_operator', handoff: { at: new Date().toISOString(), reason: 'Вывод средств отклонён. Нужна идентификация и проверка счёта.' } });
      location.hash = `#/live/${n.id}`; return;
    }
    if (!s) return;
    if (e.target.closest('#l-close')) { live.update(s.id, { status: 'closed', closed_at: new Date().toISOString() }); live.addMessage(s.id, 'system', 'Чат закрыт оператором'); return; }
    const j = e.target.closest('[data-jump]');
    if (j) { const el = $(`#msg-${j.dataset.jump}`, view); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('is-hl'); void el.offsetWidth; el.classList.add('is-hl'); } return; }
    if (e.target.closest('#l-eval')) {
      if (evaluating.has(s.id)) return; // one paid evaluation per chat at a time
      evaluating.add(s.id); evalErrors.delete(s.id); drawDetail();
      try {
        const r = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: live.toConversation(s), checklist: checklist(), force: !!s.evaluation }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.answers) throw new Error(data.error || `Ошибка ${r.status}`);
        evaluating.delete(s.id);
        live.update(s.id, { evaluation: data, evaluated_at: new Date().toISOString(), evaluation_status: 'done' });
      } catch (err) { evaluating.delete(s.id); evalErrors.set(s.id, `Не удалось оценить: ${err.message}`); if (view.isConnected) drawDetail(); }
    }
  });
  view.addEventListener('input', (e) => { if (e.target.id === 'l-reply' && id) drafts.set(id, e.target.value); if (e.target.id === 'l-name') setOpName(e.target.value); });
  view.addEventListener('keydown', (e) => { if (e.target.id === 'l-reply' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); } });

  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(() => { if (view.isConnected) { const st = liveStats(); setHead('Живые чаты', `${st.count} ${plural(st.count, ['сессия', 'сессии', 'сессий'])} · ждут оператора: ${st.waiting}`); draw(); } }, 40); });
  const tick = setInterval(() => $$('[data-since]', view).forEach((el) => { el.textContent = clock(Date.now() - new Date(el.dataset.since)); }), 1000);
  return () => { off(); clearInterval(tick); clearTimeout(t); };
}
