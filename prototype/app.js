// Freedom CQA clickable prototype. No build step. Serve the repo root: python3 -m http.server 8080 → /prototype/
// Data: ../data/datasets/DEV.json + ../data/checklists/freedom-chat-v1.json. Evaluation = MOCK (mock-evaluator.js).
// Covers the whole defense flow: list → card → evidence jump → N/A → appeal → reviewer decision → new total → edit criterion → re-apply.

import { score, tier, maxStep, selfTest } from './scoring.js?v=3';
import { mockEvaluate } from './mock-evaluator.js?v=3';

/* ---------------- state ---------------- */
const LS_KEY = 'cqa-prototype-v1';
const S = { convs: [], byId: {}, checklists: [], activeVersion: 1, appeals: [], role: 'qa', cache: {}, lastTotals: {} };

const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ checklists: S.checklists, activeVersion: S.activeVersion, appeals: S.appeals, role: S.role })); } catch {} };
const restore = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const checklist = () => S.checklists.find((c) => c.version === S.activeVersion) || S.checklists[S.checklists.length - 1];

/* ---------------- helpers ---------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => (n == null ? '—' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 }));
const uid = () => Math.random().toString(36).slice(2, 9);
const ICON = {
  list: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>',
  flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 22V4m0 0h13l-2 4 2 4H4"/></svg>',
  sliders: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/></svg>',
  palette: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/><path d="M12 21a3 3 0 0 1 0-6h2"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round"><path d="m5 12 5 5L20 7"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  dash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.25" stroke-linecap="round"><path d="M6 12h12"/></svg>',
  alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m15 18-6-6 6-6"/></svg>',
  quote: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M7 17h4V9H5v4h2zm8 0h4V9h-6v4h2z"/></svg>',
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  up: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m18 15-6-6-6 6"/></svg>',
  down: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 9 6 6 6-6"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round"><path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/></svg>',
};

function toast(msg) {
  document.querySelectorAll('.cqa-toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'cqa-toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${ICON.check}<span>${esc(msg)}</span>`;
  $('#cqa-root').appendChild(el);
  setTimeout(() => el.remove(), 3200);
}

function answerBadge(c, a) {
  if (c.type === 'flag') return a === 'yes' ? `<span class="cqa-badge cqa-badge--gross">${ICON.alert} Грубая ошибка</span>` : `<span class="cqa-badge cqa-badge--pass">${ICON.check} Нет нарушений</span>`;
  if (a === 'na') return `<span class="cqa-badge cqa-badge--na">${ICON.dash} N/A</span>`;
  if (a === 'yes') return `<span class="cqa-badge cqa-badge--pass">${ICON.check} Да</span>`;
  if (a === 'no') return `<span class="cqa-badge cqa-badge--fail">${ICON.x} Нет</span>`;
  const m = maxStep(c); const cls = a >= m ? 'pass' : a === 0 ? 'fail' : 'partial';
  return `<span class="cqa-badge cqa-badge--${cls}">${a} / ${m}</span>`;
}
const answerText = (c, a) => (a === 'na' ? 'N/A' : a === 'yes' ? (c.type === 'flag' ? 'Да (нарушение)' : 'Да') : a === 'no' ? 'Нет' : `${a} из ${maxStep(c)}`);

/* call audio offsets: chat = MM:SS, call = ISO 8601 */
function offsetSec(conv, i) {
  const ts = conv.transcript[i]?.timestamp || '';
  if (/^\d{1,2}:\d{2}$/.test(ts)) { const [m, s] = ts.split(':').map(Number); return m * 60 + s; }
  const t0 = Date.parse(conv.transcript[0].timestamp); const t = Date.parse(ts);
  return Number.isFinite(t - t0) ? Math.max(0, (t - t0) / 1000) : 0;
}
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const tsLabel = (conv, i) => (conv.channel === 'voice call' ? mmss(offsetSec(conv, i)) : conv.transcript[i].timestamp);

/* ---------------- evaluation model ---------------- */
function evaluation(convId) {
  const cl = checklist();
  const key = `${convId}@v${cl.version}`;
  if (!S.cache[key]) S.cache[key] = mockEvaluate(S.byId[convId], cl);
  const ai = S.cache[key];
  const aiAnswers = Object.fromEntries(Object.entries(ai).map(([k, v]) => [k, v.answer]));
  const appeals = S.appeals.filter((a) => a.conversation_id === convId && a.checklist_version === cl.version);
  const finalAnswers = { ...aiAnswers };
  for (const a of appeals) if (a.status === 'changed') finalAnswers[a.criterion_id] = a.decision.new_answer;
  return { cl, ai, aiScore: score(cl, aiAnswers), finalScore: score(cl, finalAnswers), finalAnswers, appeals };
}

/* ---------------- router ---------------- */
const NAV = [
  { id: 'dialogs', label: 'Диалоги', icon: ICON.list },
  { id: 'appeals', label: 'Апелляции', icon: ICON.flag },
  { id: 'checklist', label: 'Чек-лист', icon: ICON.sliders },
  { id: 'design', label: 'Дизайн-система', icon: ICON.palette },
];
function renderNav(active) {
  const open = S.appeals.filter((a) => a.status === 'open').length;
  $('#nav').innerHTML = NAV.map((n) => `<button class="cqa-nav" data-go="#/${n.id}" ${active === n.id ? 'aria-current="page"' : ''}>${n.icon}<span>${n.label}</span>${n.id === 'appeals' && open ? `<span class="cqa-badge cqa-badge--appeal">${open}</span>` : ''}${n.id === 'checklist' ? `<span class="cqa-badge cqa-badge--outline">v${checklist().version}</span>` : ''}</button>`).join('');
}
function route() {
  const [, page = 'dialogs', arg] = location.hash.split('/');
  renderNav(page === 'dialog' ? 'dialogs' : page);
  const view = $('#view');
  view.className = 'cqa-main';
  ({ dialogs: viewDialogs, dialog: (v) => renderCard(v, decodeURIComponent(arg || '')), appeals: viewAppeals, checklist: viewChecklist, design: viewDesign }[page] || viewDialogs)(view);
  view.focus({ preventScroll: true });
}

/* ---------------- view: dialogs + analytics ---------------- */
const F = { q: '', lang: '', channel: '', tier: '' };
function viewDialogs(view) {
  const cl = checklist();
  const rows = S.convs.map((c) => ({ c, e: evaluation(c.conversation_id) }));
  const scored = rows.filter((r) => r.e.finalScore.total != null);
  const avg = scored.reduce((s, r) => s + r.e.finalScore.total, 0) / (scored.length || 1);
  const gross = rows.filter((r) => r.e.finalScore.gross_error).length;
  const openAppeals = S.appeals.filter((a) => a.status === 'open').length;
  const failRates = cl.criteria.filter((c) => c.type !== 'flag').map((c) => {
    const applicable = rows.filter((r) => r.e.finalAnswers[c.id] !== 'na');
    const bad = applicable.filter((r) => { const a = r.e.finalAnswers[c.id]; return a === 'no' || (typeof a === 'number' && a < maxStep(c)); });
    return { c, rate: applicable.length ? bad.length / applicable.length : 0, na: rows.length - applicable.length };
  }).sort((a, b) => b.rate - a.rate);

  const filtered = rows.filter(({ c, e }) => (!F.q || c.conversation_id.includes(F.q.toLowerCase()) || c.transcript.some((m) => m.text.toLowerCase().includes(F.q.toLowerCase())))
    && (!F.lang || c.language === F.lang) && (!F.channel || c.channel === F.channel) && (!F.tier || tier(e.finalScore.total) === F.tier));

  view.innerHTML = `
    <div class="cqa-topbar">
      <div><div class="cqa-overline">Набор DEV · чек-лист «${esc(cl.name)}» v${cl.version}</div><h1 class="cqa-title">Диалоги</h1></div>
      <div class="cqa-row"><button class="cqa-btn" id="reeval">Переоценить все</button><button class="cqa-btn cqa-btn--primary" data-go="#/dialog/${S.convs[0].conversation_id}">Открыть первый диалог</button></div>
    </div>
    <section class="kpis cqa-stagger" aria-label="Сводка">
      <div class="cqa-card cqa-card--tint"><div class="cqa-small cqa-muted">Средний балл</div><div class="kpi__value">${fmt(avg)}</div></div>
      <div class="cqa-card cqa-card--tint"><div class="cqa-small cqa-muted">Диалогов оценено</div><div class="kpi__value">${scored.length}<span class="cqa-muted" style="font-size:16px"> / ${rows.length}</span></div></div>
      <div class="cqa-card ${gross ? 'cqa-card--tint' : 'cqa-card--tint'}"><div class="cqa-small cqa-muted">Грубые ошибки</div><div class="kpi__value" style="color:${gross ? 'var(--cqa-gross-ink)' : 'inherit'}">${gross}</div></div>
      <div class="cqa-card cqa-card--tint"><div class="cqa-small cqa-muted">Открытые апелляции</div><div class="kpi__value">${openAppeals}</div></div>
    </section>
    <section class="cqa-card" style="margin-bottom:24px">
      <div class="cqa-spread" style="margin-bottom:16px"><h2 class="cqa-h2">Где теряются баллы</h2><span class="cqa-small cqa-muted">доля «Нет»/неполных ответов среди применимых</span></div>
      <div class="bars">${failRates.map(({ c, rate, na }) => `
        <div class="bar"><span>${esc(c.title)}</span><div class="cqa-progress"><span class="${rate > 0.3 ? 'is-bad' : ''}" style="width:${Math.round(rate * 100)}%"></span></div>
        <span class="cqa-num" title="N/A: ${na}">${Math.round(rate * 100)}%</span></div>`).join('')}</div>
    </section>
    <div class="filters">
      <input class="cqa-input" id="f-q" placeholder="Поиск по ID или тексту" value="${esc(F.q)}">
      <select class="cqa-select" id="f-lang"><option value="">Все языки</option>${['RU', 'KZ', 'EN'].map((l) => `<option ${F.lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="cqa-select" id="f-channel"><option value="">Все каналы</option><option value="agent chat" ${F.channel === 'agent chat' ? 'selected' : ''}>Чат</option><option value="voice call" ${F.channel === 'voice call' ? 'selected' : ''}>Звонок</option></select>
      <select class="cqa-select" id="f-tier"><option value="">Любой балл</option><option value="high" ${F.tier === 'high' ? 'selected' : ''}>≥ 85</option><option value="mid" ${F.tier === 'mid' ? 'selected' : ''}>60–84</option><option value="low" ${F.tier === 'low' ? 'selected' : ''}>&lt; 60</option><option value="none" ${F.tier === 'none' ? 'selected' : ''}>Не рассчитан</option></select>
      <span class="cqa-small cqa-muted">${filtered.length} из ${rows.length}</span>
    </div>
    <div class="pane"><table class="cqa-table">
      <thead><tr><th>Диалог</th><th>Язык</th><th>Канал</th><th>Реплик</th><th>Статус</th><th style="text-align:right">Итог</th></tr></thead>
      <tbody>${filtered.map(({ c, e }) => {
        const t = e.finalScore.total; const open = e.appeals.filter((a) => a.status === 'open').length; const changed = e.appeals.filter((a) => a.status !== 'open').length;
        return `<tr data-href="#/dialog/${c.conversation_id}" tabindex="0">
          <td><b>${c.conversation_id}</b><div class="cqa-small cqa-muted" style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(c.transcript.find((m) => m.speaker === 'client')?.text || '')}</div></td>
          <td><span class="cqa-badge cqa-badge--lang">${c.language}</span></td>
          <td>${c.channel === 'voice call' ? '📞 Звонок' : '💬 Чат'}</td>
          <td class="cqa-num">${c.transcript.length}</td>
          <td><div class="cqa-row" style="gap:6px;flex-wrap:wrap">${e.finalScore.gross_error ? '<span class="cqa-badge cqa-badge--gross">Грубая ошибка</span>' : ''}${open ? `<span class="cqa-badge cqa-badge--appeal">Апелляция</span>` : ''}${changed ? `<span class="cqa-badge cqa-badge--brand">Пересмотрено</span>` : ''}</div></td>
          <td style="text-align:right"><div class="cqa-score cqa-score--s cqa-score--${tier(t)}" style="--p:${t ?? 0};margin-left:auto"><span class="cqa-score__value">${t == null ? '—' : Math.round(t)}</span></div></td></tr>`;
      }).join('')}</tbody></table></div>`;

  const bind = (id, key) => $(id).addEventListener('input', (ev) => { F[key] = ev.target.value; viewDialogs(view); const el = $(id); el.focus(); if (el.setSelectionRange && key === 'q') el.setSelectionRange(el.value.length, el.value.length); });
  bind('#f-q', 'q'); bind('#f-lang', 'lang'); bind('#f-channel', 'channel'); bind('#f-tier', 'tier');
  $('#reeval').onclick = () => { S.cache = {}; toast(`Переоценено ${S.convs.length} диалогов по чек-листу v${cl.version}`); viewDialogs(view); };
}

/* ---------------- view: dialog card ---------------- */
function renderCard(view, convId) {
  const conv = S.byId[convId];
  if (!conv) { view.innerHTML = `<div class="cqa-empty"><div class="cqa-glow"></div><h2 class="cqa-header-4">Диалог не найден</h2><button class="cqa-btn cqa-btn--primary" data-go="#/dialogs">К списку</button></div>`; return; }
  const { cl, ai, aiScore, finalScore, finalAnswers, appeals } = evaluation(convId);
  const crits = [...cl.criteria].sort((a, b) => a.order - b.order);
  const total = finalScore.total; const prev = S.lastTotals[convId];
  const idx = S.convs.findIndex((c) => c.conversation_id === convId);
  const prevId = S.convs[idx - 1]?.conversation_id, nextId = S.convs[idx + 1]?.conversation_id;
  const changed = aiScore.total !== finalScore.total;

  view.innerHTML = `
    <div class="cqa-topbar">
      <div>
        <button class="cqa-btn cqa-btn--ghost cqa-btn--s" data-go="#/dialogs" style="margin-left:-12px">${ICON.back} Все диалоги</button>
        <div class="cqa-row" style="margin-top:6px"><h1 class="cqa-title">${conv.conversation_id}</h1><span class="cqa-badge cqa-badge--lang">${conv.language}</span><span class="cqa-badge cqa-badge--outline">${conv.channel === 'voice call' ? 'Звонок' : 'Чат'}</span></div>
      </div>
      <div class="cqa-row">
        <button class="cqa-btn cqa-btn--s" ${prevId ? `data-go="#/dialog/${prevId}"` : 'disabled'}>← Пред.</button>
        <button class="cqa-btn cqa-btn--s" ${nextId ? `data-go="#/dialog/${nextId}"` : 'disabled'}>След. →</button>
      </div>
    </div>
    <div class="card-layout">
      <section class="pane" aria-label="Транскрипт">
        <div class="pane__head"><h2 class="cqa-h3">Транскрипт</h2><span class="cqa-small cqa-muted">${conv.transcript.length} реплик · бот и система = контекст</span></div>
        ${conv.audio_url ? `<div style="padding:12px 16px 0"><div class="cqa-player">${ICON.play}<audio id="player" controls preload="none" src="${esc(conv.audio_url)}"></audio><span class="cqa-mono" id="player-pos">00:00</span></div></div>` : ''}
        <div class="cqa-transcript" id="transcript">${conv.transcript.map((m, i) => `
          <div class="cqa-msg cqa-msg--${m.speaker}" id="m-${i}" data-i="${i}">
            <div class="cqa-msg__meta"><span>${{ client: 'Клиент', operator: 'Оператор', bot: 'Бот', system: 'Система' }[m.speaker] || m.speaker}</span><span class="cqa-msg__idx">#${i} · ${tsLabel(conv, i)}</span></div>
            <div>${esc(m.text)}</div></div>`).join('')}</div>
      </section>
      <section class="result-panel" aria-label="Результат оценки">
        ${finalScore.gross_error ? `<div class="cqa-banner cqa-banner--gross cqa-anim-pop">${ICON.alert}<div><b>Грубая ошибка</b><div>${esc(ai.c08?.explanation || 'Отмечено проверяющим')}</div></div></div>` : ''}
        <div class="cqa-card">
          <div class="result-head">
            <div class="cqa-score cqa-score--${tier(total)}" id="ring" style="--p:${prev ?? 0}"><div><span class="cqa-score__value" id="total">${prev == null ? '0' : Math.round(prev)}</span><span class="cqa-score__label">из 100</span></div></div>
            <div class="cqa-stack" style="gap:6px">
              <div class="cqa-overline">${changed ? 'Итог после пересмотра' : 'Автооценка'}</div>
              <div class="cqa-h2">${total == null ? 'Итог не рассчитан' : total >= 85 ? 'Хорошая работа' : total >= 60 ? 'Есть замечания' : 'Требует внимания'}</div>
              <div class="cqa-small cqa-muted">Чек-лист v${cl.version} · применимый вес ${finalScore.applicable_weight} из ${finalScore.nominal_weight} → пересчитан до 100</div>
              ${changed ? `<div class="cqa-row" style="gap:8px"><span class="cqa-small">Исходная: <b class="cqa-num">${fmt(aiScore.total)}</b></span><span class="delta ${finalScore.total >= aiScore.total ? 'up' : 'down'}">${finalScore.total >= aiScore.total ? '+' : ''}${fmt(finalScore.total - aiScore.total)}</span></div>` : ''}
            </div>
          </div>
          ${finalScore.sections.length ? `<div class="sections" style="margin-top:16px">${finalScore.sections.filter((s) => s.max > 0).map((s) => `<div class="section-chip"><span class="cqa-muted">${esc(s.title)}</span><b>${fmt(s.points)} / ${fmt(s.max)}</b></div>`).join('')}</div>` : ''}
        </div>
        <div class="crit-list cqa-stagger">${crits.map((c) => {
          const r = ai[c.id]; const fa = finalAnswers[c.id]; const row = finalScore.criteria.find((x) => x.criterion_id === c.id);
          const ap = appeals.filter((a) => a.criterion_id === c.id); const last = ap[ap.length - 1];
          return `<article class="cqa-crit ${last?.status === 'open' ? 'is-appealed' : last?.status === 'changed' ? 'is-overridden' : ''}">
            <div><div class="cqa-crit__name">${String(c.order).padStart(2, '0')} · ${esc(c.title)}</div><div class="cqa-small cqa-muted">${c.type === 'flag' ? 'без баллов' : `вес ${c.weight}${row.effective_weight != null && row.effective_weight !== c.weight ? ` → ${fmt(row.effective_weight)}` : ''}`}</div></div>
            <div class="cqa-crit__meta">${answerBadge(c, fa)}<span class="cqa-crit__points">${c.type === 'flag' ? '' : row.points == null ? '—' : `${fmt(row.points)}`}</span></div>
            <div class="cqa-crit__body">${esc(r.explanation)}</div>
            <div class="cqa-crit__actions">
              ${r.evidence.map((e) => e.kind === 'message' ? `<button class="cqa-evidence" data-jump="${e.turn_index}">${ICON.quote}<span class="cqa-mono">#${e.turn_index} · ${tsLabel(conv, e.turn_index)}</span><q>${esc(e.quote)}</q></button>`
                : e.kind === 'range' ? `<button class="cqa-evidence" data-range="${e.range.join(',')}"><span class="cqa-mono">#${e.range[0]}–#${e.range[1]}</span><span>проверенный участок</span></button>`
                : `<span class="cqa-evidence" style="cursor:default">${ICON.dash}<span>N/A: ${esc(e.quote)}</span></span>`).join('')}
              <span style="flex:1"></span>
              ${last?.status === 'open' ? `<span class="cqa-badge cqa-badge--appeal">На рассмотрении</span>${S.role === 'reviewer' ? `<button class="cqa-btn cqa-btn--s cqa-btn--primary" data-review="${last.id}">Проверить</button>` : ''}`
                : `<button class="cqa-btn cqa-btn--s cqa-btn--ghost" data-appeal="${c.id}">Оспорить</button>`}
            </div>
            ${ap.length ? `<div class="cqa-timeline" style="grid-column:1/-1;margin-top:6px">
              <div class="cqa-timeline__item" style="--c:var(--cqa-na)"><b>Автооценка:</b> ${answerText(c, r.answer)}</div>
              ${ap.map((a) => `<div class="cqa-timeline__item" style="--c:var(--cqa-notify)"><b>Апелляция</b> · ${new Date(a.created_at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })}: «${esc(a.comment)}»</div>
                ${a.decision ? `<div class="cqa-timeline__item" style="--c:${a.status === 'changed' ? 'var(--cqa-brand-primary)' : 'var(--cqa-text-tertiary)'}"><b>Решение проверяющего:</b> ${a.status === 'changed' ? `изменено на «${answerText(c, a.decision.new_answer)}»` : 'оценка подтверждена'}. ${esc(a.decision.reason)}</div>` : ''}`).join('')}
            </div>` : ''}
          </article>`;
        }).join('')}</div>
      </section>
    </div>`;

  // score count-up from the previously shown value
  animateScore(prev ?? 0, total);
  S.lastTotals[convId] = total;

  const player = $('#player');
  if (player) player.addEventListener('timeupdate', () => { $('#player-pos').textContent = mmss(player.currentTime); });
  view.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => jumpTo(conv, [Number(b.dataset.jump)])));
  view.querySelectorAll('[data-range]').forEach((b) => b.addEventListener('click', () => { const [a, z] = b.dataset.range.split(',').map(Number); jumpTo(conv, Array.from({ length: z - a + 1 }, (_, k) => a + k)); }));
  view.querySelectorAll('[data-appeal]').forEach((b) => b.addEventListener('click', () => openAppeal(conv, b.dataset.appeal)));
  view.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => openReview(b.dataset.review)));
}
function animateScore(from, to) {
  const ring = $('#ring'), num = $('#total'); if (!ring) return;
  if (to == null) { ring.style.setProperty('--p', 0); num.textContent = '—'; return; }
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const t0 = performance.now(), d = reduce ? 1 : 1000;
  const step = (now) => { const k = Math.min(1, (now - t0) / d); const e = 1 - Math.pow(1 - k, 3); const v = from + (to - from) * e;
    ring.style.setProperty('--p', v); num.textContent = k < 1 ? Math.round(v) : fmt(to); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
}

function jumpTo(conv, indices) {
  document.querySelectorAll('.cqa-msg.is-evidence').forEach((el) => el.classList.remove('is-evidence', 'is-flash'));
  indices.forEach((i) => { const el = $(`#m-${i}`); if (el) { el.classList.add('is-evidence'); void el.offsetWidth; el.classList.add('is-flash'); } });
  const first = $(`#m-${indices[0]}`);
  if (first) first.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'center' });
  const player = $('#player');
  if (player && conv.channel === 'voice call') { const sec = offsetSec(conv, indices[0]); try { player.currentTime = sec; } catch {} toast(`Запись: переход к ${mmss(sec)}`); }
}

/* ---------------- drawers: appeal + review ---------------- */
function drawer(title, body, foot) {
  closeDrawer();
  const wrap = document.createElement('div'); wrap.id = 'drawer';
  wrap.innerHTML = `<div class="cqa-scrim" data-close></div><aside class="cqa-drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="cqa-drawer__head"><h2 class="cqa-h2">${esc(title)}</h2><button class="cqa-btn cqa-btn--ghost cqa-btn--icon cqa-btn--s" data-close aria-label="Закрыть">${ICON.x}</button></div>
    <div class="cqa-drawer__body">${body}</div><div class="cqa-drawer__foot">${foot}</div></aside>`;
  $('#cqa-root').appendChild(wrap);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', escClose);
  setTimeout(() => wrap.querySelector('textarea, select, input, button:not([data-close])')?.focus(), 50);
  return wrap;
}
function escClose(e) { if (e.key === 'Escape') closeDrawer(); }
function closeDrawer() { $('#drawer')?.remove(); document.removeEventListener('keydown', escClose); }

function fragment(conv, evid) {
  const ids = evid.flatMap((e) => (e.kind === 'message' ? [e.turn_index] : e.kind === 'range' ? [e.range[0], e.range[1]] : []));
  if (!ids.length) return '<div class="cqa-small cqa-muted">Доказательство — условие N/A, реплики нет.</div>';
  const lo = Math.max(0, Math.min(...ids) - 1), hi = Math.min(conv.transcript.length - 1, Math.max(...ids) + 1);
  return `<div class="cqa-transcript" style="padding:12px;background:var(--cqa-bg-primary);border-radius:16px;max-height:260px">${conv.transcript.slice(lo, hi + 1).map((m, k) => {
    const i = lo + k; return `<div class="cqa-msg cqa-msg--${m.speaker} ${ids.includes(i) ? 'is-evidence' : ''}"><div class="cqa-msg__meta"><span>${m.speaker}</span><span class="cqa-msg__idx">#${i}</span></div>${esc(m.text)}</div>`; }).join('')}</div>`;
}

function openAppeal(conv, critId) {
  const { cl, ai } = evaluation(conv.conversation_id);
  const crits = cl.criteria.filter((c) => !S.appeals.some((a) => a.conversation_id === conv.conversation_id && a.criterion_id === c.id && a.status === 'open' && a.checklist_version === cl.version));
  const w = drawer('Апелляция', `
    <div class="cqa-field"><label class="cqa-label" for="ap-crit">Критерий</label>
      <select class="cqa-select" id="ap-crit">${crits.map((c) => `<option value="${c.id}" ${c.id === critId ? 'selected' : ''}>${String(c.order).padStart(2, '0')} · ${esc(c.title)} — ${answerText(c, ai[c.id].answer)}</option>`).join('')}</select></div>
    <div id="ap-ctx"></div>
    <div class="cqa-field"><label class="cqa-label" for="ap-comment">Комментарий</label>
      <textarea class="cqa-textarea" id="ap-comment" placeholder="Почему оценка неверна? Сошлитесь на реплику, например #9."></textarea>
      <span class="cqa-hint">Проверяющий увидит спорную оценку, ваш комментарий и фрагмент диалога.</span></div>`,
    `<button class="cqa-btn" data-close>Отмена</button><button class="cqa-btn cqa-btn--primary" id="ap-save">Отправить апелляцию</button>`);
  const ctx = () => { const id = $('#ap-crit').value; const c = cl.criteria.find((x) => x.id === id);
    $('#ap-ctx').innerHTML = `<div class="cqa-card cqa-card--tint cqa-card--compact cqa-stack" style="gap:8px"><div class="cqa-spread"><b>${esc(c.title)}</b>${answerBadge(c, ai[id].answer)}</div><div class="cqa-small">${esc(ai[id].explanation)}</div>${fragment(conv, ai[id].evidence)}</div>`; };
  ctx(); $('#ap-crit').addEventListener('change', ctx);
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  $('#ap-save').onclick = () => {
    const comment = $('#ap-comment').value.trim();
    if (!comment) { $('#ap-comment').classList.add('is-invalid'); $('#ap-comment').focus(); return; }
    S.appeals.push({ id: uid(), conversation_id: conv.conversation_id, criterion_id: $('#ap-crit').value, checklist_version: cl.version, comment, created_at: new Date().toISOString(), status: 'open' });
    persist(); closeDrawer(); toast('Апелляция сохранена и передана проверяющему'); route();
  };
}

function openReview(appealId) {
  const ap = S.appeals.find((a) => a.id === appealId); if (!ap) return;
  const conv = S.byId[ap.conversation_id];
  const { cl, ai } = evaluation(conv.conversation_id);
  const c = cl.criteria.find((x) => x.id === ap.criterion_id);
  const orig = ai[c.id].answer;
  const options = c.type === 'scale' ? [...c.scale.map((s) => s.value), ...(c.na_allowed ? ['na'] : [])] : ['yes', 'no', ...(c.na_allowed ? ['na'] : [])];
  const label = (v) => (v === 'yes' ? 'Да' : v === 'no' ? 'Нет' : v === 'na' ? 'N/A' : String(v));
  let pick = orig, mode = 'confirm';
  const w = drawer(`Проверка апелляции · ${conv.conversation_id}`, `
    <div class="cqa-card cqa-card--tint cqa-card--compact cqa-stack" style="gap:8px">
      <div class="cqa-spread"><b>${String(c.order).padStart(2, '0')} · ${esc(c.title)}</b>${answerBadge(c, orig)}</div>
      <div class="cqa-small"><span class="cqa-muted">Автооценка:</span> ${esc(ai[c.id].explanation)}</div>
      <div class="cqa-banner cqa-banner--warn" style="padding:10px 12px">${ICON.flag}<div><b>Комментарий оценщика</b><div>${esc(ap.comment)}</div></div></div>
    </div>
    <div class="cqa-field"><span class="cqa-label">Фрагмент диалога</span>${fragment(conv, ai[c.id].evidence)}</div>
    <div class="cqa-field"><span class="cqa-label">Решение</span>
      <div class="cqa-seg" id="rv-mode"><button data-m="confirm" aria-pressed="true">Подтвердить оценку</button><button data-m="change" aria-pressed="false">Изменить оценку</button></div></div>
    <div class="cqa-field" id="rv-new" hidden><span class="cqa-label">Новый ответ</span>
      <div class="cqa-seg" id="rv-answer">${options.map((v) => `<button data-v="${v}" aria-pressed="${v === orig}">${label(v)}</button>`).join('')}</div></div>
    <div class="cqa-field"><label class="cqa-label" for="rv-reason">Причина решения</label><textarea class="cqa-textarea" id="rv-reason" placeholder="Обоснование со ссылкой на реплику"></textarea></div>
    <div class="cqa-banner cqa-banner--info" id="rv-preview"></div>`,
    `<button class="cqa-btn" data-close>Отмена</button><button class="cqa-btn cqa-btn--primary" id="rv-save">Сохранить решение</button>`);
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  const preview = () => {
    const base = evaluation(conv.conversation_id);
    const ans = { ...base.finalAnswers, [c.id]: mode === 'change' ? pick : base.finalAnswers[c.id] };
    const nt = score(cl, ans).total, ot = base.finalScore.total;
    $('#rv-preview').innerHTML = `<div>Итог после решения: <b class="cqa-num">${fmt(ot)}</b> → <b class="cqa-num">${fmt(nt)}</b> ${nt !== ot ? `<span class="delta ${nt > ot ? 'up' : 'down'}">${nt > ot ? '+' : ''}${fmt(nt - ot)}</span>` : ''}</div>`;
  };
  $('#rv-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m;
    $('#rv-mode').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#rv-new').hidden = mode !== 'change'; preview(); });
  $('#rv-answer').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pick = b.dataset.v === 'yes' || b.dataset.v === 'no' || b.dataset.v === 'na' ? b.dataset.v : Number(b.dataset.v);
    $('#rv-answer').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); preview(); });
  preview();
  $('#rv-save').onclick = () => {
    const reason = $('#rv-reason').value.trim();
    if (!reason) { $('#rv-reason').classList.add('is-invalid'); $('#rv-reason').focus(); return; }
    const isChange = mode === 'change' && pick !== orig;
    ap.status = isChange ? 'changed' : 'confirmed';
    ap.decision = { new_answer: isChange ? pick : orig, reason, decided_at: new Date().toISOString() };
    persist(); closeDrawer(); toast(isChange ? 'Оценка изменена, итог пересчитан' : 'Оценка подтверждена');
    location.hash = `#/dialog/${conv.conversation_id}`; route();
  };
}

/* ---------------- view: appeals queue ---------------- */
function viewAppeals(view) {
  const list = [...S.appeals].sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.created_at.localeCompare(a.created_at));
  view.innerHTML = `
    <div class="cqa-topbar"><div><div class="cqa-overline">Работа с результатом</div><h1 class="cqa-title">Апелляции</h1></div>
      <span class="cqa-small cqa-muted">${S.role === 'reviewer' ? 'Вы — проверяющий: откройте апелляцию, чтобы принять решение.' : 'Переключитесь в режим «Проверяющий» внизу слева, чтобы принимать решения.'}</span></div>
    ${list.length ? `<div class="pane"><table class="cqa-table"><thead><tr><th>Диалог</th><th>Критерий</th><th>Комментарий</th><th>Статус</th><th></th></tr></thead><tbody>
      ${list.map((a) => { const c = S.checklists.find((x) => x.version === a.checklist_version)?.criteria.find((x) => x.id === a.criterion_id);
        return `<tr><td><a href="#/dialog/${a.conversation_id}">${a.conversation_id}</a></td><td>${esc(c?.title || a.criterion_id)}</td><td style="max-width:360px">${esc(a.comment)}</td>
          <td>${a.status === 'open' ? '<span class="cqa-badge cqa-badge--appeal">Открыта</span>' : a.status === 'changed' ? '<span class="cqa-badge cqa-badge--brand">Изменена</span>' : '<span class="cqa-badge cqa-badge--na">Подтверждена</span>'}</td>
          <td style="text-align:right">${a.status === 'open' ? `<button class="cqa-btn cqa-btn--s ${S.role === 'reviewer' ? 'cqa-btn--primary' : ''}" data-review="${a.id}" ${a.checklist_version !== S.activeVersion ? 'disabled title="Апелляция к другой версии чек-листа"' : ''}>Проверить</button>` : ''}</td></tr>`; }).join('')}
    </tbody></table></div>`
    : `<div class="cqa-empty"><div class="cqa-glow" style="top:-200px;left:30%"></div><h2 class="cqa-header-4">Апелляций пока нет</h2><p class="cqa-muted">Откройте диалог и нажмите «Оспорить» у любого критерия.</p><button class="cqa-btn cqa-btn--primary" data-go="#/dialog/${S.convs[0].conversation_id}">Открыть диалог</button></div>`}`;
  view.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => openReview(b.dataset.review)));
}

/* ---------------- view: checklist editor ---------------- */
let draft = null, newId = null;
function viewChecklist(view) {
  const cl = checklist();
  if (!draft || draft.__base !== cl.version) draft = { ...structuredClone(cl), __base: cl.version };
  const weightSum = draft.criteria.filter((c) => c.type !== 'flag').reduce((s, c) => s + Number(c.weight || 0), 0);
  const dirty = JSON.stringify({ ...draft, __base: undefined }) !== JSON.stringify(cl);
  view.innerHTML = `
    <div class="cqa-topbar">
      <div><div class="cqa-overline">Настройка оценки</div><h1 class="cqa-title">Чек-лист · v${cl.version}</h1></div>
      <div class="cqa-row">
        <select class="cqa-select" id="ver" style="width:auto">${S.checklists.map((c) => `<option value="${c.version}" ${c.version === cl.version ? 'selected' : ''}>v${c.version} · ${c.updated_at.slice(0, 16).replace('T', ' ')}</option>`).join('')}</select>
        <button class="cqa-btn" id="add">${ICON.plus} Критерий</button>
        <button class="cqa-btn cqa-btn--primary" id="save" ${dirty ? '' : 'disabled'}>Сохранить v${Math.max(...S.checklists.map((c) => c.version)) + 1} и применить</button>
      </div>
    </div>
    <div class="cqa-banner ${weightSum === 100 ? 'cqa-banner--ok' : 'cqa-banner--warn'}" style="margin-bottom:16px">${weightSum === 100 ? ICON.check : ICON.alert}
      <div>Сумма весов: <span class="weight-total">${weightSum}</span> / 100. ${weightSum === 100 ? 'Итог считается из 100 баллов.' : 'Итог всё равно нормируется до 100 (вес пересчитывается пропорционально), но лучше выровнять до 100.'} N/A перераспределяет вес между применимыми критериями.</div></div>
    <div class="cqa-stack" id="rows">${draft.criteria.sort((a, b) => a.order - b.order).map((c, i) => `
      <div class="editor-row ${c.id === newId ? 'is-new cqa-anim-pop' : ''}" data-id="${c.id}">
        <div class="order-btns"><button class="cqa-btn cqa-btn--ghost cqa-btn--icon cqa-btn--s" data-up ${i === 0 ? 'disabled' : ''} aria-label="Выше">${ICON.up}</button><button class="cqa-btn cqa-btn--ghost cqa-btn--icon cqa-btn--s" data-down ${i === draft.criteria.length - 1 ? 'disabled' : ''} aria-label="Ниже">${ICON.down}</button></div>
        <div class="cqa-field"><label class="cqa-label">Название</label><input class="cqa-input" data-k="title" value="${esc(c.title)}"></div>
        <div class="cqa-field"><label class="cqa-label">Тип ответа</label><select class="cqa-select" data-k="type"><option value="binary" ${c.type === 'binary' ? 'selected' : ''}>Да / Нет</option><option value="scale" ${c.type === 'scale' ? 'selected' : ''}>Шкала</option><option value="flag" ${c.type === 'flag' ? 'selected' : ''}>Флаг (без баллов)</option></select></div>
        <div class="cqa-field"><label class="cqa-label">Вес</label><input class="cqa-input cqa-num" type="number" min="0" max="100" data-k="weight" value="${c.weight}" ${c.type === 'flag' ? 'disabled' : ''}></div>
        <div class="cqa-field"><label class="cqa-label">N/A</label><label class="cqa-check" style="height:44px"><input type="checkbox" class="cqa-switch" data-k="na_allowed" ${c.na_allowed ? 'checked' : ''} ${c.type === 'flag' ? 'disabled' : ''}> разрешён</label></div>
        <div style="padding-top:22px"><button class="cqa-btn cqa-btn--danger cqa-btn--icon cqa-btn--s" data-del aria-label="Удалить">${ICON.trash}</button></div>
        <div class="full">
          <div class="cqa-field"><label class="cqa-label">Формулировка (что значит «Да» / высший балл)</label><textarea class="cqa-textarea" data-k="description" style="min-height:64px">${esc(c.description)}</textarea></div>
          <div class="cqa-stack" style="gap:10px">
            ${c.na_allowed ? `<div class="cqa-field"><label class="cqa-label">Когда N/A</label><input class="cqa-input" data-k="na_condition" value="${esc(c.na_condition || '')}"></div>` : ''}
            ${c.type === 'scale' ? `<div class="cqa-field"><label class="cqa-label">Шкала (ступени через запятую, max = полный вес)</label><input class="cqa-input cqa-num" data-k="scale" value="${(c.scale || []).map((s) => s.value).join(', ')}"></div>` : ''}
            ${draft.sections?.length ? `<div class="cqa-field"><label class="cqa-label">Секция</label><select class="cqa-select" data-k="section_id">${draft.sections.map((s) => `<option value="${s.id}" ${s.id === c.section_id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></div>` : ''}
          </div>
        </div>
      </div>`).join('')}</div>`;

  const rowsEl = $('#rows');
  const find = (el) => draft.criteria.find((c) => c.id === el.closest('[data-id]').dataset.id);
  rowsEl.addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return; const c = find(e.target);
    if (k === 'weight') c.weight = Number(e.target.value);
    else if (k === 'na_allowed') { c.na_allowed = e.target.checked; if (!c.na_allowed) delete c.na_condition; }
    else if (k === 'scale') { const vals = e.target.value.split(/[,;\s]+/).map(Number).filter((n) => Number.isFinite(n)); c.scale = [...new Set(vals)].sort((a, b) => b - a).map((v) => ({ value: v, label: String(v) })); }
    else if (k === 'type') { c.type = e.target.value; if (c.type === 'scale' && !c.scale) c.scale = [10, 5, 0].map((v) => ({ value: v, label: String(v) })); if (c.type === 'flag') { c.weight = 0; c.na_allowed = false; } }
    else c[k] = e.target.value;
    viewChecklist(view);
  });
  rowsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const c = find(b); const list = draft.criteria.sort((x, y) => x.order - y.order); const i = list.indexOf(c);
    if (b.hasAttribute('data-del')) { draft.criteria = list.filter((x) => x !== c); }
    if (b.hasAttribute('data-up') && i > 0) [list[i - 1].order, c.order] = [c.order, list[i - 1].order];
    if (b.hasAttribute('data-down') && i < list.length - 1) [list[i + 1].order, c.order] = [c.order, list[i + 1].order];
    draft.criteria.sort((x, y) => x.order - y.order).forEach((x, k) => { x.order = k + 1; });
    viewChecklist(view);
  });
  $('#add').onclick = () => {
    newId = `c${uid()}`;
    draft.criteria.push({ id: newId, order: draft.criteria.length + 1, section_id: draft.sections?.[0]?.id, title: 'Новый критерий', description: 'Да — …', type: 'binary', weight: 10, na_allowed: false });
    viewChecklist(view); $(`[data-id="${newId}"] input[data-k="title"]`)?.select();
  };
  $('#ver').onchange = (e) => { S.activeVersion = Number(e.target.value); draft = null; persist(); toast(`Активна версия v${S.activeVersion}`); route(); };
  $('#save').onclick = () => {
    const bad = draft.criteria.find((c) => c.type === 'scale' && (!c.scale || c.scale.length < 2));
    if (bad) { toast(`У «${bad.title}» нужна шкала минимум из двух ступеней`); return; }
    const version = Math.max(...S.checklists.map((c) => c.version)) + 1;
    const { __base, ...clean } = draft;
    S.checklists.push({ ...structuredClone(clean), version, updated_at: new Date().toISOString() });
    S.activeVersion = version; draft = null; newId = null; S.cache = {}; persist();
    toast(`Чек-лист v${version} сохранён и применён к ${S.convs.length} диалогам`);
    location.hash = '#/dialogs';
  };
}

/* ---------------- view: design system gallery ---------------- */
function viewDesign(view) {
  const sw = [['brand-primary', '#00B323'], ['brand-secondary', '#13AD64'], ['brand-additional', '#00E183'], ['brand-accent', '#FFA700'], ['brand-tertiary', '#FF3A38'],
    ['text-primary', '#323335'], ['text-tertiary', '#6A788A'], ['text-secondary', '#B2BCC8'], ['bg-primary', '#F3F8FF'], ['bg-secondary', '#DFF5EC'], ['bg-warning', '#FFF8D5'], ['dark-primary', '#0C1411'],
    ['success-ink', '#00801F'], ['error-ink', '#C93A3A'], ['notify-ink', '#8A6200'], ['link', '#0066CC']];
  view.innerHTML = `
    <div class="cqa-topbar"><div><div class="cqa-overline">design/ · docs/research/design-system.md</div><h1 class="cqa-title">Дизайн-система Freedom CQA</h1></div></div>
    <div class="cqa-stack" style="gap:24px">
      <section class="cqa-card" style="position:relative;overflow:hidden"><div class="cqa-glow" style="right:-200px;top:-300px"></div>
        <div style="position:relative" class="cqa-stack"><div class="cqa-display-2">Оценка <span class="cqa-text-gradient">качества</span> диалогов</div>
        <div class="cqa-subheader cqa-muted">Шрифт CoFo Sans → Inter, градиент бренда, мягкие радиусы 20px</div>
        <div class="cqa-row"><button class="cqa-btn cqa-btn--primary cqa-btn--l">Запустить оценку</button><button class="cqa-btn cqa-btn--l">Подробнее</button></div></div></section>
      <section><h2 class="cqa-h2" style="margin-bottom:12px">Цвета</h2><div class="swatches">${sw.map(([n, h]) => `<div class="swatch"><div style="background:var(--cqa-${n})"></div><div><b>${n}</b><div class="cqa-mono">${h}</div></div></div>`).join('')}
        <div class="swatch"><div style="background:var(--cqa-gradient-brand)"></div><div><b>gradient-brand</b><div class="cqa-mono">#7D8DEE → #1CCC9E → #1AE276</div></div></div></div></section>
      <div class="gallery">
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Кнопки</h2>
          <div class="cqa-row" style="flex-wrap:wrap"><button class="cqa-btn cqa-btn--primary">Primary</button><button class="cqa-btn">Secondary</button><button class="cqa-btn cqa-btn--ghost">Ghost</button><button class="cqa-btn cqa-btn--danger">Danger</button></div>
          <div class="cqa-row" style="flex-wrap:wrap"><button class="cqa-btn cqa-btn--primary cqa-btn--s">Small</button><button class="cqa-btn cqa-btn--primary is-loading">Loading</button><button class="cqa-btn" disabled>Disabled</button><button class="cqa-btn cqa-btn--icon" aria-label="Добавить">${ICON.plus}</button></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Статусы ответа</h2>
          <div class="cqa-row" style="flex-wrap:wrap"><span class="cqa-badge cqa-badge--pass">${ICON.check} Да</span><span class="cqa-badge cqa-badge--fail">${ICON.x} Нет</span><span class="cqa-badge cqa-badge--na">${ICON.dash} N/A</span><span class="cqa-badge cqa-badge--partial">15 / 20</span><span class="cqa-badge cqa-badge--gross">${ICON.alert} Грубая ошибка</span><span class="cqa-badge cqa-badge--appeal">Апелляция</span><span class="cqa-badge cqa-badge--lang">KZ</span></div>
          <div class="cqa-row"><div class="cqa-score cqa-score--high" style="--p:92;--size:88px"><span class="cqa-score__value" style="font-size:24px">92</span></div><div class="cqa-score cqa-score--mid" style="--p:71;--size:88px"><span class="cqa-score__value" style="font-size:24px">71</span></div><div class="cqa-score cqa-score--low" style="--p:38;--size:88px"><span class="cqa-score__value" style="font-size:24px">38</span></div><div class="cqa-score cqa-score--none" style="--size:88px"><span class="cqa-score__value" style="font-size:24px">—</span></div></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Формы</h2>
          <div class="cqa-field"><label class="cqa-label">Комментарий</label><input class="cqa-input" placeholder="Плейсхолдер"></div>
          <div class="cqa-row"><div class="cqa-seg"><button data-v="yes" aria-pressed="true">Да</button><button data-v="no" aria-pressed="false">Нет</button><button aria-pressed="false">N/A</button></div><input type="checkbox" class="cqa-switch" checked aria-label="Переключатель"></div>
          <div class="cqa-tabs" role="tablist"><button role="tab" aria-selected="true">Результат</button><button role="tab" aria-selected="false">История</button><button role="tab" aria-selected="false">Аудио</button></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Транскрипт</h2><div class="cqa-transcript" style="padding:0">
          <div class="cqa-msg cqa-msg--system">Эскалация на оператора.</div>
          <div class="cqa-msg cqa-msg--bot"><div class="cqa-msg__meta">Бот</div>Пожалуйста, ожидайте.</div>
          <div class="cqa-msg cqa-msg--operator is-evidence"><div class="cqa-msg__meta">Оператор <span class="cqa-msg__idx">#9 · 01:15</span></div>Здравствуйте! Меня зовут Алина.</div>
          <div class="cqa-msg cqa-msg--client"><div class="cqa-msg__meta">Клиент</div>Нашла, спасибо.</div></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Баннеры</h2>
          <div class="cqa-banner cqa-banner--gross">${ICON.alert}<div><b>Грубая ошибка</b><div>Предложение платной услуги в обход компании.</div></div></div>
          <div class="cqa-banner cqa-banner--warn">${ICON.flag}<div>Апелляция на рассмотрении</div></div>
          <div class="cqa-banner cqa-banner--ok">${ICON.check}<div>Чек-лист v3 применён</div></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Таймлайн пересмотра</h2><div class="cqa-timeline">
          <div class="cqa-timeline__item" style="--c:var(--cqa-na)"><b>Автооценка:</b> Нет</div>
          <div class="cqa-timeline__item" style="--c:var(--cqa-notify)"><b>Апелляция:</b> «Оператор представился во 2-й реплике»</div>
          <div class="cqa-timeline__item"><b>Решение:</b> изменено на «Да»</div></div>
          <div class="cqa-progress"><span style="width:72%"></span></div><div class="cqa-skeleton" style="height:14px;width:60%"></div></section>
      </div>
    </div>`;
}

/* ---------------- boot ---------------- */
async function boot() {
  const view = $('#view');
  view.innerHTML = `<div class="cqa-stack"><div class="cqa-skeleton" style="height:36px;width:240px"></div><div class="kpis">${'<div class="cqa-skeleton" style="height:96px"></div>'.repeat(4)}</div><div class="cqa-skeleton" style="height:320px"></div></div>`;
  try {
    const [ds, cl] = await Promise.all([fetch('../data/datasets/DEV.json').then((r) => r.json()), fetch('../data/checklists/freedom-chat-v1.json').then((r) => r.json())]);
    S.convs = ds.data.records; S.byId = Object.fromEntries(S.convs.map((c) => [c.conversation_id, c]));
    const saved = restore();
    S.checklists = saved?.checklists?.length ? saved.checklists : [{ ...cl, version: 1, updated_at: new Date().toISOString() }];
    S.activeVersion = saved?.activeVersion || 1; S.appeals = saved?.appeals || []; S.role = saved?.role || 'qa';
  } catch (err) {
    view.innerHTML = `<div class="cqa-empty"><div class="cqa-glow"></div><h2 class="cqa-header-4">Не удалось загрузить данные</h2><p class="cqa-muted">Запустите сервер из корня репозитория: <code>python3 -m http.server 8080</code> и откройте <code>/prototype/</code>.</p><code class="cqa-mono">${esc(err.message)}</code></div>`;
    return;
  }
  console.table(selfTest(S.checklists[0]).map(([name, ok]) => ({ test: name, ok })));
  document.querySelectorAll('#role-switch button').forEach((b) => b.setAttribute('aria-pressed', b.dataset.role === S.role));
  $('#role-switch').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; S.role = b.dataset.role; persist();
    document.querySelectorAll('#role-switch button').forEach((x) => x.setAttribute('aria-pressed', x === b)); toast(S.role === 'reviewer' ? 'Режим: проверяющий' : 'Режим: оценщик'); route(); });
  document.addEventListener('click', (e) => {
    const go = e.target.closest('[data-go]'); if (go && !go.disabled) { location.hash = go.dataset.go; return; }
    const row = e.target.closest('tr[data-href]'); if (row && !e.target.closest('a,button')) location.hash = row.dataset.href;
  });
  document.addEventListener('keydown', (e) => { const row = e.target.closest?.('tr[data-href]'); if (row && e.key === 'Enter') location.hash = row.dataset.href; });
  addEventListener('hashchange', route);
  window.CQA = { S, score, reset: () => { localStorage.removeItem(LS_KEY); location.reload(); } };
  route();
}
boot();
