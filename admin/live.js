// Живые диалоги: operator console over the shared live-store (customer chat at /support/ in another window).
import { $, $$, esc, fmt, clock, timeOf, ring, icon, tierColor } from './ui.js';
import { checklist, crits, liveRow, maxStepOf } from './data.js';
import * as live from '/shared/live-store.js';

const STATUS = {
  bot: { label: 'бот', cls: 'st--bot' },
  waiting_operator: { label: 'ждёт оператора', cls: 'st--wait' },
  operator: { label: 'оператор', cls: 'st--op' },
  closed: { label: 'закрыт', cls: 'st--closed' },
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
const since = (s) => (s.status === 'waiting_operator' && s.handoff?.at ? `<span class="timer mono" data-since="${esc(s.handoff.at)}" aria-label="ожидание">${clock(Date.now() - new Date(s.handoff.at))}</span>` : '');
const ansLabel = (c, a) => (a === 'yes' ? 'Да' : a === 'no' ? 'Нет' : a === 'na' ? 'N/A' : a == null ? '—' : `${a} из ${maxStepOf(c)}`);
const ansCls = (c, a, row) => (a === 'na' ? 'ans--na' : c.type === 'flag' ? (a === 'yes' ? 'ans--bad' : 'ans--ok') : row?.points != null && row.points >= row.effective_weight - 0.001 ? 'ans--ok' : row?.points > 0 ? 'ans--mid' : 'ans--bad');

export function viewLive(view, id) {
  view.innerHTML = `<div class="live ${id ? 'live--detail' : ''}">
    <aside class="live__list" aria-label="Сессии"><header class="live__listhead"><span class="g-label">Сессии</span><span class="g-label" id="l-count"></span></header><ul id="l-items" class="sessions"></ul>
      <div class="live__tools"><a class="g-btn g-btn--ghost btn-s" href="/support/" target="_blank" rel="noopener">Чат клиента ↗</a><button class="g-btn g-btn--ghost btn-s" type="button" id="l-demo">Демо-сессия</button></div></aside>
    <section class="live__detail" id="l-detail" aria-live="off"></section>
  </div>`;

  const drawList = () => {
    const ss = live.all().sort((a, b) => (ORDER[a.status] ?? 9) - (ORDER[b.status] ?? 9) || String(b.started_at).localeCompare(String(a.started_at)));
    $('#l-count', view).textContent = `${ss.length}`;
    $('#l-items', view).innerHTML = ss.length ? ss.map((s) => {
      const last = [...s.messages].reverse().find((m) => m.speaker !== 'system') || s.messages.at(-1);
      return `<li><a class="session ${s.id === id ? 'is-active' : ''}" href="#/live/${encodeURIComponent(s.id)}" ${s.id === id ? 'aria-current="true"' : ''}>
        <span class="session__top">${chip(s)}${since(s)}<span class="session__time mono">${timeOf(s.started_at)}</span></span>
        <span class="session__text">${esc(last ? last.text : 'Пока без сообщений')}</span>
        <span class="session__meta g-label">${esc(s.language || 'RU')} · ${esc(s.id.replace('live-', ''))}${s.operator_name ? ` · ${esc(s.operator_name)}` : ''}${s.evaluation ? ' · оценён' : ''}${s.csat ? ` · CSAT ${esc(s.csat)}` : ''}</span>
      </a></li>`; }).join('') : `<li class="empty-list"><p>Активных сессий нет.</p><p class="g-muted">Откройте чат клиента в соседнем окне: сессии появятся здесь сами.</p></li>`;
  };

  const drawDetail = () => {
    const box = $('#l-detail', view);
    const s = id ? live.get(id) : null;
    if (!id) { box.innerHTML = `<div class="empty"><div class="g-label">Консоль оператора</div><h2 class="g-display">Выберите сессию</h2><p class="g-muted">Сессии, где бот передал разговор человеку, стоят первыми и отмечены пульсирующей точкой.</p></div>`; return; }
    if (!s) { box.innerHTML = `<div class="empty"><h2 class="g-display">Сессия не найдена</h2><p class="g-muted">Возможно, она удалена в другом окне.</p><a class="g-btn g-btn--ghost" href="#/live">К списку</a></div>`; return; }

    const active = document.activeElement;
    const keepFocus = active && box.contains(active) && active.id ? active.id : null;
    const caret = active?.selectionStart;
    const opn = s.operator_name;
    const row = liveRow(s);
    box.innerHTML = `
      <header class="ld__head">
        <a class="icon-btn ld__back" href="#/live" aria-label="К списку сессий">${icon('back')}</a>
        <div class="ld__title"><div class="g-label">${esc(s.channel || 'web chat')} · ${esc(s.language || 'RU')} · начат ${timeOf(s.started_at)}</div><h2 class="g-display">${esc(s.id)}</h2></div>
        <div class="ld__status">${chip(s)}${since(s)}</div>
      </header>
      ${s.handoff ? `<aside class="brief" aria-label="Бриф для оператора"><div class="g-label">Бриф от бота · ${timeOf(s.handoff.at)}</div><p>${esc(s.handoff.reason || 'Причина не указана')}</p>${s.handoff.summary ? `<p class="g-muted">${esc(s.handoff.summary)}</p>` : ''}</aside>` : ''}
      <ol class="transcript" id="l-tr" aria-label="Переписка">
        ${s.messages.map((m, i) => `<li class="msg msg--${esc(m.speaker)}" data-i="${i}" id="msg-${i}">
          ${m.speaker === 'system' ? `<span>${esc(m.text)}</span><span class="mono msg__t">${esc(m.timestamp || '')}</span>` : `
          <div class="msg__who g-label">${esc(m.speaker === 'operator' ? (opn || 'Оператор') : SPEAKER[m.speaker] || m.speaker)} <span class="msg__t">#${i} · ${esc(m.timestamp || '')}</span></div>
          <div class="msg__bubble">${esc(m.text)}</div>`}
        </li>`).join('') || '<li class="msg msg--system"><span>Сообщений пока нет</span></li>'}
      </ol>
      <div class="ld__controls">${controls(s)}</div>
      ${s.status === 'closed' ? `<section class="ld__eval" aria-label="Оценка качества">${evalBlock(s, row)}</section>` : ''}`;

    const tr = $('#l-tr', box); tr.scrollTop = tr.scrollHeight;
    if (wantReplyFocus && $('#l-reply', box)) { wantReplyFocus = false; $('#l-reply', box).focus({ preventScroll: true }); }
    else if (keepFocus) { const el = $(`#${keepFocus}`, box); if (el) { el.focus({ preventScroll: true }); if (caret != null && el.setSelectionRange) try { el.setSelectionRange(caret, caret); } catch {} } }
  };

  const controls = (s) => {
    if (s.status === 'closed') return `<div class="ctl-row"><span class="g-muted">Диалог закрыт${s.operator_name ? `, вела ${esc(s.operator_name)}` : ''}.</span>${s.csat ? `<span class="csat" aria-label="Оценка клиента">CSAT <b>${esc(s.csat)}</b><small>/5</small></span>` : '<span class="g-label">CSAT не оставлен</span>'}</div>${s.csat_comment ? `<p class="csat-comment">«${esc(s.csat_comment)}»</p>` : ''}`;
    if (s.status === 'operator') return `
      <form class="reply" id="l-reply-form">
        <label class="sr-only" for="l-reply">Ответ клиенту</label>
        <textarea id="l-reply" class="input" rows="2" placeholder="Ответ клиенту. Enter — отправить, Shift+Enter — перенос">${esc(drafts.get(s.id) || '')}</textarea>
        <div class="reply__actions"><button class="g-btn g-btn--primary btn-s" type="submit">${icon('send')} Отправить</button><button class="g-btn g-btn--ghost btn-s" type="button" id="l-close">Завершить</button></div>
      </form>`;
    return `<form class="accept" id="l-accept-form">
      <label class="field field--inline"><span class="g-label">Имя оператора</span><input id="l-name" class="input" value="${esc(opName())}" autocomplete="off" required></label>
      <button class="g-btn g-btn--primary btn-s" type="submit">Принять диалог</button>
      ${s.status === 'bot' ? '<span class="g-muted small">Бот ещё ведёт разговор. Вы можете подключиться раньше.</span>' : ''}
    </form>`;
  };

  const evalBlock = (s, row) => {
    if (evaluating.has(s.id)) return `<div class="eval-loading"><div class="g-label">Оцениваем по чек-листу</div><span class="shimmer" style="width:60%"></span><span class="shimmer" style="width:85%"></span><span class="shimmer" style="width:40%"></span></div>`;
    if (!row) return `<div class="eval-empty"><div><div class="g-label">Оценка качества</div><p>Этот диалог ещё не оценён. Оценка по базовому чек-листу занимает 5–15 секунд.</p>${evalErrors.get(s.id) ? `<p class="err" role="alert">${esc(evalErrors.get(s.id))}</p>` : ''}</div><button class="g-btn g-btn--primary btn-s" type="button" id="l-eval">Оценить</button></div>`;
    const ev = s.evaluation;
    return `
      <header class="eval-head">${ring(row.total, row.tier)}
        <div><div class="g-label">Оценка качества · ${esc(String(ev.model || '').replace('openai:', ''))}${ev.cached ? ' · из кэша' : ''}</div>
          <h3 class="g-display eval-total" style="color:${tierColor(row.tier)}">${row.total == null ? 'не рассчитан' : `${fmt(row.total, 2)} <small>/ 100</small>`}</h3>
          ${row.gross ? `<p class="gross-flag">${icon('flag')} Грубая ошибка</p>` : ''}</div>
        ${s.csat ? `<div class="eval-csat"><div class="g-label">Оценка клиента</div><b class="g-display">${esc(s.csat)}</b><small>/5</small></div>` : ''}
      </header>
      ${ev.summary ? `<dl class="summary"><div><dt class="g-label">Запрос</dt><dd>${esc(ev.summary.reason)}</dd></div><div><dt class="g-label">Действия</dt><dd>${esc(ev.summary.operator_actions)}</dd></div><div><dt class="g-label">Итог</dt><dd>${esc(ev.summary.outcome)}</dd></div></dl>` : ''}
      <ul class="crit-list">${crits().map((c) => { const a = ev.answers?.[c.id] || {}; const r = row.sc.criteria.find((x) => x.criterion_id === c.id);
        return `<li class="crit">
          <div class="crit__head"><span class="g-label">${esc(c.id)}</span><span class="crit__title">${esc(c.title)}</span>
            <span class="ans ${ansCls(c, a.answer, r)}">${esc(ansLabel(c, a.answer))}</span>
            <span class="crit__pts mono">${c.type === 'flag' ? '' : r?.points == null ? 'не учит.' : `${fmt(r.points, 1)} / ${fmt(r.effective_weight, 1)}`}</span></div>
          ${a.deduction_reason ? `<p class="crit__reason">${esc(a.deduction_reason)}</p>` : a.explanation ? `<p class="crit__expl">${esc(a.explanation)}</p>` : ''}
          ${(a.evidence || []).filter((e) => e.quote || e.turn_index != null || e.range).map((e) => `<button type="button" class="evidence" data-jump="${e.turn_index ?? (e.range ? e.range[0] : '')}"><span class="mono">${e.kind === 'range' && e.range ? `#${e.range[0]}–${e.range[1]}` : e.turn_index != null ? `#${e.turn_index}` : 'N/A'}</span>${esc(e.quote || (e.kind === 'na_condition' ? 'Условие N/A выполнено' : 'Проверенный участок'))}</button>`).join('')}
        </li>`; }).join('')}</ul>`;
  };

  const draw = () => { drawList(); drawDetail(); };
  draw();

  // Events (delegated so re-renders keep working)
  const onSubmit = (e) => {
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
  };
  const onClick = async (e) => {
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
    if (j && j.dataset.jump !== '') { const el = $(`#msg-${j.dataset.jump}`, view); if (el) { el.scrollIntoView({ behavior: 'smooth', block: 'center' }); el.classList.remove('is-hl'); void el.offsetWidth; el.classList.add('is-hl'); } return; }
    if (e.target.closest('#l-eval')) {
      evaluating.add(s.id); evalErrors.delete(s.id); drawDetail();
      try {
        const r = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation: live.toConversation(s), checklist: checklist() }) });
        const data = await r.json().catch(() => ({}));
        if (!r.ok || !data.answers) throw new Error(data.error || `Ошибка ${r.status}`);
        evaluating.delete(s.id);
        live.update(s.id, { evaluation: data });
      } catch (err) { evaluating.delete(s.id); evalErrors.set(s.id, `Не удалось оценить: ${err.message}`); drawDetail(); }
    }
  };
  const onInput = (e) => { if (e.target.id === 'l-reply' && id) drafts.set(id, e.target.value); if (e.target.id === 'l-name') setOpName(e.target.value); };
  const onKey = (e) => { if (e.target.id === 'l-reply' && e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); e.target.form.requestSubmit(); } };
  view.addEventListener('submit', onSubmit); view.addEventListener('click', onClick); view.addEventListener('input', onInput); view.addEventListener('keydown', onKey);

  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(draw, 40); });
  const tick = setInterval(() => $$('[data-since]', view).forEach((el) => { el.textContent = clock(Date.now() - new Date(el.dataset.since)); }), 1000);
  return () => { off(); clearInterval(tick); clearTimeout(t); };
}
