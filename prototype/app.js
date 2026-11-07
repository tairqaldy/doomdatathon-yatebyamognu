// Freedom CQA prototype. No build step.
//   npm run dev  → http://localhost:3000/prototype/   (static + /api with real AI, needs OPENROUTER_API_KEY in .env)
//   python3 -m http.server 8080 → /prototype/        (static only → MOCK evaluator)
// Layout follows Freedom's own "Рабочее место контроля качества" slide (docs/case/opening-ceremony.md).
// Flow: list → analysis card → evidence jump/seek → N/A → deduction reasons → appeal → reviewer decision → new total → edit criterion → re-apply.

import { score, tier, maxStep, selfTest } from './scoring.js?v=7';
import { mockEvaluate, mockSummary } from './mock-evaluator.js?v=7';

/* ================= state ================= */
const LS_KEY = 'cqa-prototype-v2';
const S = {
  convs: [], byId: {}, checklists: [], activeVersion: 1, appeals: [], role: 'qa',
  ai: {}, mock: {}, lastTotals: {}, api: { ok: false, openrouter: false, model: null }, busy: null, singleEval: null,
};
const persist = () => { try { localStorage.setItem(LS_KEY, JSON.stringify({ checklists: S.checklists, activeVersion: S.activeVersion, appeals: S.appeals, role: S.role, ai: S.ai })); } catch {} };
const restore = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const checklist = () => S.checklists.find((c) => c.version === S.activeVersion) || S.checklists.at(-1);

/* ================= helpers ================= */
const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n, d = 2) => (n == null ? '—' : Number(n).toLocaleString('ru-RU', { maximumFractionDigits: d }));
const uid = () => Math.random().toString(36).slice(2, 9);
const strHash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
const clHash = (cl) => strHash(JSON.stringify(cl.criteria.map(({ id, title, description, type, weight, na_allowed, na_condition, scale }) => [id, title, description, type, weight, na_allowed, na_condition, scale])));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const SPK = { client: 'Клиент', operator: 'Оператор', bot: 'Бот', system: 'Система' };

const I = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" ${extra}>${d}</svg>`;
const ICON = {
  list: I('<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>'),
  wave: I('<path d="M2 12h2M6 8v8M10 5v14M14 8v8M18 10v4M22 12h0"/>'),
  flag: I('<path d="M4 22V4m0 0h13l-2 4 2 4H4"/>'),
  sliders: I('<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>'),
  palette: I('<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.2"/><circle cx="12" cy="7.5" r="1.2"/><circle cx="16" cy="10" r="1.2"/>'),
  check: I('<path d="m5 12 5 5L20 7"/>', 'stroke-width="2.4"'),
  x: I('<path d="M18 6 6 18M6 6l12 12"/>', 'stroke-width="2.4"'),
  dash: I('<path d="M6 12h12"/>', 'stroke-width="2.4"'),
  alert: I('<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  back: I('<path d="m15 18-6-6 6-6"/>'), next: I('<path d="m9 18 6-6-6-6"/>'),
  play: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 5h4v14H7zM13 5h4v14h-4z"/></svg>',
  plus: I('<path d="M12 5v14M5 12h14"/>'), up: I('<path d="m18 15-6-6-6 6"/>'), down: I('<path d="m6 9 6 6 6-6"/>'),
  trash: I('<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>'),
  spark: I('<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6"/>'),
  target: I('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  user: I('<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>'),
  flagEnd: I('<path d="M5 12h14M13 6l6 6-6 6"/>'),
  chat: I('<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>'),
  phone: I('<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>'),
};

function toast(msg, kind = 'ok') {
  document.querySelectorAll('.cqa-toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = 'cqa-toast'; el.setAttribute('role', 'status');
  el.innerHTML = `${kind === 'ok' ? ICON.check : ICON.alert}<span>${esc(msg)}</span>`;
  $('#cqa-root').appendChild(el);
  setTimeout(() => el.remove(), 3600);
}

/* time: chat = MM:SS, call = ISO 8601 → seconds from start */
function offsetSec(conv, i) {
  const ts = conv.transcript[i]?.timestamp || '';
  if (/^\d{1,2}:\d{2}$/.test(ts)) { const [m, s] = ts.split(':').map(Number); return m * 60 + s; }
  const t0 = Date.parse(conv.transcript[0].timestamp), t = Date.parse(ts);
  return Number.isFinite(t - t0) ? Math.max(0, (t - t0) / 1000) : 0;
}
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const duration = (conv) => offsetSec(conv, conv.transcript.length - 1) + 8;

function answerBadge(c, a) {
  if (a == null) return '<span class="cqa-badge cqa-badge--outline">нет ответа</span>';
  if (c.type === 'flag') return a === 'yes' ? `<span class="cqa-badge cqa-badge--gross">${ICON.alert} Нарушение</span>` : `<span class="cqa-badge cqa-badge--pass">${ICON.check} Нет нарушений</span>`;
  if (a === 'na') return `<span class="cqa-badge cqa-badge--na">${ICON.dash} N/A</span>`;
  if (a === 'yes') return `<span class="cqa-badge cqa-badge--pass">${ICON.check} Да</span>`;
  if (a === 'no') return `<span class="cqa-badge cqa-badge--fail">${ICON.x} Нет</span>`;
  const m = maxStep(c); return `<span class="cqa-badge cqa-badge--${a >= m ? 'pass' : a === 0 ? 'fail' : 'partial'}">${a} / ${m}</span>`;
}
const answerText = (c, a) => (a === 'na' ? 'N/A' : a === 'yes' ? (c.type === 'flag' ? 'Да (нарушение)' : 'Да') : a === 'no' ? 'Нет' : `${a} из ${maxStep(c)}`);

/* ================= evaluation model (AI if available, else MOCK) ================= */
const aiKey = (convId, cl) => `${convId}|${clHash(cl)}`;
function evaluation(convId) {
  const cl = checklist(); const conv = S.byId[convId];
  const ai = S.ai[aiKey(convId, cl)];
  let src, base;
  if (ai) { src = 'ai'; base = ai; }
  else {
    const k = `${convId}|${clHash(cl)}`;
    if (!S.mock[k]) S.mock[k] = { answers: mockEvaluate(conv, cl), summary: mockSummary(conv), model: 'mock' };
    src = 'mock'; base = S.mock[k];
  }
  const aiAnswers = Object.fromEntries(cl.criteria.map((c) => [c.id, base.answers[c.id]?.answer]));
  const appeals = S.appeals.filter((a) => a.conversation_id === convId && a.checklist_hash === clHash(cl));
  const finalAnswers = { ...aiAnswers };
  for (const a of appeals) if (a.status === 'changed') finalAnswers[a.criterion_id] = a.decision.new_answer;
  return { cl, conv, src, model: base.model, base, answers: base.answers, summary: base.summary, aiScore: score(cl, aiAnswers), finalScore: score(cl, finalAnswers), finalAnswers, appeals };
}

/** Deductions = criteria where the final answer doesn't give full points (+ gross flags). */
function deductions(E) {
  return [...E.cl.criteria].sort((a, b) => a.order - b.order).flatMap((c) => {
    const row = E.finalScore.criteria.find((r) => r.criterion_id === c.id); const a = E.finalAnswers[c.id];
    if (c.type === 'flag') return a === 'yes' ? [{ c, lost: null, gross: true }] : [];
    if (a == null || a === 'na' || row.points == null) return [];
    const lost = +(row.effective_weight - row.points).toFixed(2);
    return lost > 0.001 ? [{ c, lost, gross: false }] : [];
  });
}
const reasonOf = (E, c) => E.answers[c.id]?.deduction_reason || E.answers[c.id]?.explanation || '';

/* ================= API ================= */
async function apiHealth() {
  try { const r = await fetch('/api/health', { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json(); S.api = { ok: true, openrouter: j.openrouter, model: j.models?.eval, commit: j.commit, branch: j.branch }; }
  catch { S.api = { ok: false, openrouter: false, model: null }; }
}
async function aiEvaluate(convId, { force = false } = {}) {
  const cl = checklist();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  let r;
  try { r = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ conversation_id: convId, checklist: { id: cl.id, version: cl.version, criteria: cl.criteria, sections: cl.sections }, force }), signal: controller.signal }); }
  finally { clearTimeout(timeout); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(j.error || `API ${r.status}`), { status: r.status });
  S.ai[aiKey(convId, cl)] = { answers: j.answers, summary: j.summary, model: j.model, usage: j.usage, latency_ms: j.latency_ms, cached: j.cached, problems: j.problems };
  persist();
  return j;
}
async function aiEvaluateAll(ids, label) {
  if (!(S.api.ok && S.api.openrouter)) { toast('AI не подключён: оценка по MOCK. Добавьте OPENROUTER_API_KEY', 'warn'); return; }
  let done = 0, cost = 0, failed = 0; S.busy = { label, done, total: ids.length }; renderBusy();
  const queue = [...ids];
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try { const j = await aiEvaluate(id); cost += j.cached ? 0 : j.usage?.cost || 0; } catch { failed++; }
      S.busy.done = ++done; renderBusy();
    }
  }));
  S.busy = null; renderBusy();
  toast(`AI-оценка: ${done - failed}/${ids.length} диалогов · $${cost.toFixed(4)}${failed ? ` · ошибок ${failed}` : ''}`, failed ? 'warn' : 'ok');
  route();
}
function renderBusy() {
  let el = $('#busy');
  if (!S.busy) { el?.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'busy'; el.className = 'busy-pill'; $('#cqa-root').appendChild(el); }
  el.innerHTML = `<span class="spinner"></span><span>${esc(S.busy.label)} · ${S.busy.done}/${S.busy.total}</span><div class="cqa-progress" style="width:120px"><span style="width:${(S.busy.done / S.busy.total) * 100}%"></span></div>`;
}

/* ================= router + shell ================= */
const NAV = [
  { id: 'dialogs', label: 'Диалоги', icon: ICON.list },
  { id: 'appeals', label: 'Апелляции', icon: ICON.flag },
  { id: 'checklist', label: 'Чек-лист', icon: ICON.sliders },
  { id: 'design', label: 'Дизайн-система', icon: ICON.palette },
];
function renderNav(active) {
  const open = S.appeals.filter((a) => a.status === 'open').length;
  $('#nav').innerHTML = NAV.map((n) => `<button class="cqa-nav" data-go="#/${n.id}" ${active === n.id ? 'aria-current="page"' : ''}>${n.icon}<span>${n.label}</span>${n.id === 'appeals' && open ? `<span class="cqa-badge cqa-badge--appeal">${open}</span>` : ''}${n.id === 'checklist' ? `<span class="cqa-badge cqa-badge--outline">v${checklist().version}</span>` : ''}</button>`).join('');
  $('#ai-status').innerHTML = S.api.ok && S.api.openrouter
    ? `<span class="dot dot--ok"></span><div><b>AI подключён</b><div class="cqa-mono">${esc(S.api.model || '')}</div></div>`
    : `<span class="dot dot--warn"></span><div><b>${S.api.ok ? 'AI без ключа' : 'Офлайн-режим'}</b><div class="cqa-small cqa-muted">оценка = MOCK</div></div>`;
}
function route() {
  const [, page = 'dialogs', arg] = location.hash.split('/');
  renderNav(page === 'dialog' ? 'dialogs' : page);
  if (page !== 'dialog' && audioEl) { audioEl.pause(); audioEl = null; }
  const view = $('#view');
  ({ dialogs: viewDialogs, dialog: (v) => viewCard(v, decodeURIComponent(arg || '')), appeals: viewAppeals, checklist: viewChecklist, design: viewDesign }[page] || viewDialogs)(view);
}

/* ================= view: dialogs + analytics ================= */
const F = { q: '', lang: '', channel: '', tier: '' };
function viewDialogs(view) {
  const cl = checklist();
  const rows = S.convs.map((c) => ({ c, E: evaluation(c.conversation_id) }));
  const scored = rows.filter((r) => r.E.finalScore.total != null);
  const avg = scored.reduce((s, r) => s + r.E.finalScore.total, 0) / (scored.length || 1);
  const gross = rows.filter((r) => r.E.finalScore.gross_error).length;
  const aiCount = rows.filter((r) => r.E.src === 'ai').length;
  const openAppeals = S.appeals.filter((a) => a.status === 'open').length;
  const byLang = ['RU', 'KZ', 'EN'].map((l) => { const rs = scored.filter((r) => r.c.language === l); return { l, n: rs.length, avg: rs.reduce((s, r) => s + r.E.finalScore.total, 0) / (rs.length || 1) }; });
  const loss = cl.criteria.filter((c) => c.type !== 'flag').map((c) => {
    const applicable = rows.filter((r) => r.E.finalAnswers[c.id] != null && r.E.finalAnswers[c.id] !== 'na');
    const lost = applicable.reduce((s, r) => { const d = deductions(r.E).find((x) => x.c.id === c.id); return s + (d?.lost || 0); }, 0);
    const bad = applicable.filter((r) => deductions(r.E).some((x) => x.c.id === c.id)).length;
    return { c, rate: applicable.length ? bad / applicable.length : 0, lost: lost / (rows.length || 1), na: rows.length - applicable.length };
  }).sort((a, b) => b.lost - a.lost);
  const maxLost = Math.max(0.01, ...loss.map((x) => x.lost));

  const filtered = rows.filter(({ c, E }) => (!F.q || c.conversation_id.includes(F.q.toLowerCase()) || c.transcript.some((m) => m.text.toLowerCase().includes(F.q.toLowerCase())))
    && (!F.lang || c.language === F.lang) && (!F.channel || c.channel === F.channel) && (!F.tier || tier(E.finalScore.total) === F.tier));

  view.innerHTML = `
    <header class="page-head">
      <div><div class="cqa-overline">Набор DEV · чек-лист v${cl.version} · ${aiCount ? `AI: ${aiCount}/${rows.length}` : 'оценка MOCK'}</div><h1 class="cqa-title">Контроль качества диалогов</h1></div>
      <div class="cqa-row">
        <button class="cqa-btn" id="ai-all" ${S.api.ok && S.api.openrouter ? '' : 'title="Нужен OPENROUTER_API_KEY на сервере"'}>${ICON.spark} AI-оценка всех</button>
        <button class="cqa-btn cqa-btn--primary" data-go="#/dialog/${(filtered[0] || rows[0]).c.conversation_id}">Открыть анализ</button>
      </div>
    </header>
    <section class="kpi-grid">
      <div class="cqa-card kpi kpi--hero">
        <div class="cqa-score cqa-score--${tier(avg)}" style="--p:${avg};--size:104px"><div><span class="cqa-score__value" style="font-size:30px">${fmt(avg, 1)}</span><span class="cqa-score__label">средний балл</span></div></div>
        <div class="cqa-stack" style="gap:10px;flex:1">${byLang.map((b) => `<div class="lang-row"><span class="cqa-badge cqa-badge--lang">${b.l}</span><div class="cqa-progress"><span style="width:${b.avg}%"></span></div><b class="cqa-num">${fmt(b.avg, 1)}</b><span class="cqa-small cqa-muted">${b.n}</span></div>`).join('')}</div>
      </div>
      <div class="cqa-card kpi"><span class="kpi__icon">${ICON.list}</span><div class="cqa-small cqa-muted">Оценено диалогов</div><div class="kpi__value">${scored.length}<small> / ${rows.length}</small></div><div class="cqa-small cqa-muted">${rows.filter((r) => r.c.channel === 'voice call').length} звонков · ${rows.filter((r) => r.c.channel !== 'voice call').length} чатов</div></div>
      <div class="cqa-card kpi ${gross ? 'kpi--danger' : ''}"><span class="kpi__icon">${ICON.alert}</span><div class="cqa-small cqa-muted">Грубые ошибки</div><div class="kpi__value">${gross}</div><div class="cqa-small cqa-muted">отмечаются отдельно, без баллов</div></div>
      <div class="cqa-card kpi"><span class="kpi__icon">${ICON.flag}</span><div class="cqa-small cqa-muted">Открытые апелляции</div><div class="kpi__value">${openAppeals}</div><div class="cqa-small cqa-muted">${S.appeals.filter((a) => a.status !== 'open').length} рассмотрено</div></div>
    </section>
    <section class="cqa-card loss-card">
      <div class="cqa-spread"><div><h2 class="cqa-h2">Где теряются баллы</h2><div class="cqa-small cqa-muted">средняя потеря на диалог · доля диалогов со снижением</div></div></div>
      <div class="loss-list">${loss.map(({ c, rate, lost, na }) => `
        <div class="loss-row"><span class="loss-row__name">${esc(c.title)}</span>
          <div class="loss-row__bar"><span style="width:${(lost / maxLost) * 100}%"></span></div>
          <b class="cqa-num">−${fmt(lost, 1)}</b><span class="cqa-small cqa-muted cqa-num">${Math.round(rate * 100)}%${na ? ` · N/A ${na}` : ''}</span></div>`).join('')}</div>
    </section>
    <div class="filters">
      <input class="cqa-input" id="f-q" placeholder="Поиск по ID или тексту реплик" value="${esc(F.q)}">
      <select class="cqa-select" id="f-lang"><option value="">Все языки</option>${['RU', 'KZ', 'EN'].map((l) => `<option ${F.lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select>
      <select class="cqa-select" id="f-channel"><option value="">Все каналы</option><option value="agent chat" ${F.channel === 'agent chat' ? 'selected' : ''}>Чат</option><option value="voice call" ${F.channel === 'voice call' ? 'selected' : ''}>Звонок</option></select>
      <select class="cqa-select" id="f-tier"><option value="">Любой балл</option><option value="high" ${F.tier === 'high' ? 'selected' : ''}>≥ 85</option><option value="mid" ${F.tier === 'mid' ? 'selected' : ''}>60–84</option><option value="low" ${F.tier === 'low' ? 'selected' : ''}>&lt; 60</option></select>
      <span class="cqa-small cqa-muted">${filtered.length} из ${rows.length}</span>
    </div>
    <div class="pane"><table class="cqa-table">
      <thead><tr><th>Диалог</th><th>Канал</th><th>Главная причина снижения</th><th>Статус</th><th style="text-align:right">Итог</th></tr></thead>
      <tbody>${filtered.map(({ c, E }) => {
        const t = E.finalScore.total; const d = deductions(E).sort((a, b) => (b.gross ? 99 : b.lost) - (a.gross ? 99 : a.lost))[0];
        const open = E.appeals.some((a) => a.status === 'open'), changed = E.appeals.some((a) => a.status !== 'open');
        return `<tr data-href="#/dialog/${c.conversation_id}" tabindex="0">
          <td><div class="cqa-row" style="gap:8px"><b>${c.conversation_id}</b><span class="cqa-badge cqa-badge--lang">${c.language}</span></div><div class="cqa-small cqa-muted ellipsis">${esc(E.summary?.reason || c.transcript.find((m) => m.speaker === 'client')?.text || '')}</div></td>
          <td><span class="chan">${c.channel === 'voice call' ? ICON.phone + 'Звонок' : ICON.chat + 'Чат'}</span></td>
          <td>${d ? `<div class="cqa-small"><b>${esc(d.c.title)}</b>${d.gross ? '' : ` <span class="cqa-muted">−${fmt(d.lost, 1)}</span>`}</div><div class="cqa-small cqa-muted ellipsis">${esc(reasonOf(E, d.c))}</div>` : '<span class="cqa-small cqa-muted">без снижений</span>'}</td>
          <td><div class="cqa-row" style="gap:6px;flex-wrap:wrap">${E.finalScore.gross_error ? '<span class="cqa-badge cqa-badge--gross">Грубая ошибка</span>' : ''}${open ? '<span class="cqa-badge cqa-badge--appeal">Апелляция</span>' : ''}${changed ? '<span class="cqa-badge cqa-badge--brand">Пересмотрено</span>' : ''}${E.src === 'ai' ? '<span class="cqa-badge cqa-badge--outline">AI</span>' : ''}</div></td>
          <td style="text-align:right"><div class="cqa-score cqa-score--s cqa-score--${tier(t)}" style="--p:${t ?? 0};margin-left:auto"><span class="cqa-score__value">${t == null ? '—' : Math.round(t)}</span></div></td></tr>`;
      }).join('')}</tbody></table></div>`;

  const bind = (id, key) => $(id).addEventListener('input', (ev) => { F[key] = ev.target.value; viewDialogs(view); const el = $(id); el.focus(); if (key === 'q') el.setSelectionRange(el.value.length, el.value.length); });
  bind('#f-q', 'q'); bind('#f-lang', 'lang'); bind('#f-channel', 'channel'); bind('#f-tier', 'tier');
  $('#ai-all').onclick = () => aiEvaluateAll(S.convs.map((c) => c.conversation_id), 'AI-оценка всех диалогов');
}

/* ================= view: conversation analysis card ================= */
let audioEl = null;
function viewCard(view, convId) {
  const conv = S.byId[convId];
  if (!conv) { view.innerHTML = `<div class="cqa-empty"><div class="cqa-glow"></div><h2 class="cqa-header-4">Диалог не найден</h2><button class="cqa-btn cqa-btn--primary" data-go="#/dialogs">К списку</button></div>`; return; }
  const E = evaluation(convId);
  const evalState = S.singleEval?.convId === convId ? S.singleEval : null;
  const { cl, answers, finalScore, aiScore, finalAnswers } = E;
  const crits = [...cl.criteria].sort((a, b) => a.order - b.order);
  const dd = deductions(E);
  const total = finalScore.total, prev = S.lastTotals[convId];
  const idx = S.convs.findIndex((c) => c.conversation_id === convId);
  const prevId = S.convs[idx - 1]?.conversation_id, nextId = S.convs[idx + 1]?.conversation_id;
  const changed = aiScore.total !== finalScore.total;
  const isCall = conv.channel === 'voice call';
  const dur = duration(conv);
  const date = isCall ? new Date(conv.transcript[0].timestamp).toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const evidenceIdx = (c) => { const e = answers[c.id]?.evidence?.find((x) => x.kind === 'message' || x.kind === 'range'); return e ? (e.kind === 'message' ? e.turn_index : e.range[0]) : null; };

  view.innerHTML = `
    <header class="page-head">
      <div>
        <button class="cqa-btn cqa-btn--ghost cqa-btn--s" data-go="#/dialogs" style="margin-left:-12px">${ICON.back} Все диалоги</button>
        <h1 class="cqa-title" style="margin-top:4px">Анализ разговора</h1>
        <div class="meta-line"><b>${conv.conversation_id}</b><span>${isCall ? 'Звонок' : 'Чат'}</span><span>${{ RU: 'Русский', KZ: 'Қазақша', EN: 'English' }[conv.language]}</span><span>${mmss(dur)}</span><span>${conv.transcript.length} реплик</span>${date ? `<span>${date}</span>` : ''}</div>
      </div>
      <div class="cqa-row">
        <button class="cqa-btn cqa-btn--s cqa-btn--icon" ${prevId ? `data-go="#/dialog/${prevId}"` : 'disabled'} aria-label="Предыдущий">${ICON.back}</button>
        <button class="cqa-btn cqa-btn--s cqa-btn--icon" ${nextId ? `data-go="#/dialog/${nextId}"` : 'disabled'} aria-label="Следующий">${ICON.next}</button>
      </div>
    </header>

    <section class="cqa-card timeline-card">
      <div class="timeline">
        ${['client', 'operator', 'bot'].map((sp) => `<div class="track"><span class="track__label">${SPK[sp]}</span><div class="track__lane" data-lane="${sp}">${
          conv.transcript.map((m, i) => (m.speaker !== sp ? '' : (() => {
            const x = (offsetSec(conv, i) / dur) * 100; const nx = i + 1 < conv.transcript.length ? (offsetSec(conv, i + 1) / dur) * 100 : 100;
            const w = Math.max(0.8, Math.min(nx - x, Math.max(1.2, m.text.length / 9) * (60 / dur) * 1.5, 14));
            const bars = Math.max(2, Math.round(w * 1.6)); const h0 = parseInt(strHash(m.text).slice(0, 4), 36);
            return `<button class="seg seg--${sp}" style="left:${x}%;width:${w}%" data-jump="${i}" title="#${i} ${esc(m.text.slice(0, 80))}">${Array.from({ length: bars }, (_, k) => `<i style="height:${28 + ((h0 >> (k % 12)) % 7) * 10 + (k % 3) * 6}%"></i>`).join('')}</button>`;
          })())).join('')}</div></div>`).join('')}
        <div class="track track--events"><span class="track__label">События</span><div class="track__lane">
          ${conv.transcript.map((m, i) => (m.speaker === 'system' ? `<button class="evt" style="left:${(offsetSec(conv, i) / dur) * 100}%" data-jump="${i}" title="${esc(m.text)}"></button>` : '')).join('')}
          ${dd.map((d) => { const i = evidenceIdx(d.c); return i == null ? '' : `<button class="mark ${d.gross ? 'mark--gross' : d.lost >= d.c.weight * 0.5 ? 'mark--fail' : 'mark--partial'}" style="left:${(offsetSec(conv, i) / dur) * 100}%" data-jump="${i}" title="${esc(d.c.title)}${d.gross ? '' : ` −${fmt(d.lost, 1)}`}"><span>${d.c.order}</span></button>`; }).join('')}
        </div></div>
        <div class="playhead" id="playhead"></div>
      </div>
      <div class="player-row">
        <button class="play-btn" id="play" ${isCall && S.api.ok ? '' : 'disabled'} aria-label="Воспроизвести">${ICON.play}</button>
        <span class="cqa-mono" id="tpos">00:00</span>
        <div class="scrub" id="scrub"><span id="scrub-fill"></span></div>
        <span class="cqa-mono">${mmss(dur)}</span>
        <span class="cqa-small cqa-muted player-hint">${isCall ? (S.api.ok ? 'запись звонка · клик по дорожке = переход' : 'запись доступна через API (npm run dev / Vercel)') : 'чат · клик по дорожке = переход к реплике'}</span>
      </div>
    </section>

    <section class="understand">
      <div class="understand__item"><span class="understand__icon">${ICON.target}</span><div><div class="cqa-overline">Причина обращения</div><div>${esc(E.summary?.reason || '—')}</div></div></div>
      <div class="understand__item"><span class="understand__icon">${ICON.user}</span><div><div class="cqa-overline">Действия оператора</div><div>${esc(E.summary?.operator_actions || '—')}</div></div></div>
      <div class="understand__item"><span class="understand__icon">${ICON.flagEnd}</span><div><div class="cqa-overline">Результат</div><div>${esc(E.summary?.outcome || '—')}</div></div></div>
    </section>

    <div class="analysis">
      <section class="cqa-card panel">
        <div class="panel__head"><h2 class="cqa-h3">Расшифровка</h2><span class="cqa-small cqa-muted">бот и система — контекст, не оцениваются</span></div>
        <div class="tx" id="transcript">${conv.transcript.map((m, i) => `
          <div class="tx-row tx-row--${m.speaker}" id="m-${i}">
            <span class="tx-time cqa-mono">${isCall ? mmss(offsetSec(conv, i)) : m.timestamp}</span>
            <span class="tx-spk"><i class="spk-dot spk-dot--${m.speaker}"></i>${SPK[m.speaker] || m.speaker}</span>
            <span class="tx-text">${esc(m.text)}</span>
            <span class="tx-idx cqa-mono">#${i}</span>
          </div>`).join('')}</div>
      </section>

      <section class="side">
        ${finalScore.gross_error ? `<div class="cqa-banner cqa-banner--gross">${ICON.alert}<div><b>Грубая ошибка</b><div>${esc(reasonOf(E, crits.find((c) => c.type === 'flag' && finalAnswers[c.id] === 'yes')))}</div></div></div>` : ''}
        <div class="cqa-card panel">
          <div class="panel__head"><h2 class="cqa-h3">Оценка качества</h2>
            <span class="cqa-badge ${E.src === 'ai' ? 'cqa-badge--brand' : 'cqa-badge--outline'}" title="${esc(E.model || '')}">${E.src === 'ai' ? `AI · ${esc((E.model || '').split('/').pop())}` : 'MOCK'}</span></div>
          <div class="score-head">
            <div class="cqa-score cqa-score--${tier(total)}" id="ring" style="--p:${prev ?? 0};--size:112px"><div><span class="cqa-score__value" id="total">${prev == null ? '0' : fmt(prev, 1)}</span><span class="cqa-score__label">из 100</span></div></div>
            <div class="cqa-stack" style="gap:6px;min-width:0">
              <div class="cqa-overline">${changed ? 'Итог после пересмотра' : 'Автооценка'}</div>
              <div class="cqa-h2">${total == null ? 'Итог не рассчитан' : total >= 85 ? 'Хорошая работа' : total >= 60 ? 'Есть замечания' : 'Требует внимания'}</div>
              ${changed ? `<div class="cqa-row" style="gap:8px"><span class="cqa-small">Исходная <b class="cqa-num">${fmt(aiScore.total)}</b></span><span class="delta ${finalScore.total >= aiScore.total ? 'up' : 'down'}">${finalScore.total >= aiScore.total ? '+' : ''}${fmt(finalScore.total - aiScore.total)}</span></div>` : ''}
              <div class="cqa-small cqa-muted">Применимый вес ${finalScore.applicable_weight}/${finalScore.nominal_weight} → нормирован до 100</div>
            </div>
          </div>
          <div class="cqa-row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
            <button class="cqa-btn cqa-btn--primary" id="appeal-main">Оспорить оценку</button>
            <button class="cqa-btn" id="reeval" ${S.singleEval?.pending ? 'disabled aria-busy="true"' : ''} ${S.api.ok && S.api.openrouter ? '' : 'title="Нужен OPENROUTER_API_KEY"'}>${ICON.spark} ${evalState?.pending ? 'Оценка выполняется…' : evalState?.error ? 'Повторить оценку' : E.src === 'ai' ? 'Переоценить AI' : 'Оценить AI'}</button>
          </div>
          ${evalState?.pending ? `<div class="eval-feedback eval-feedback--pending" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><div><b>Анализируем диалог</b><div>Это может занять некоторое время. Текущая оценка останется на экране до завершения.</div></div></div>` : evalState?.error ? `<div class="eval-feedback eval-feedback--error" role="alert"><div><b>Не удалось выполнить оценку</b><div>${esc(evalState.error)} Текущая оценка сохранена. Попробуйте ещё раз.</div></div></div>` : ''}
        </div>

        <div class="cqa-card panel panel--reasons">
          <div class="panel__head"><h2 class="cqa-h3">Причина снижения оценки</h2><span class="cqa-small cqa-muted">${dd.length ? `${dd.length} ${dd.length === 1 ? 'пункт' : 'пункта'}` : ''}</span></div>
          ${dd.length ? `<div class="ded-list">${dd.map((d) => { const i = evidenceIdx(d.c); const ap = E.appeals.filter((x) => x.criterion_id === d.c.id).at(-1); return `
            <div class="ded ${d.gross ? 'ded--gross' : ''}">
              <div class="ded__head"><b>${esc(d.c.title)}</b><span class="ded__lost cqa-num">${d.gross ? 'грубая ошибка' : `−${fmt(d.lost, 2)}`}</span></div>
              <div class="ded__why">${esc(reasonOf(E, d.c))}</div>
              <div class="cqa-row" style="gap:6px;flex-wrap:wrap">
                ${i != null ? `<button class="cqa-evidence" data-jump="${i}"><span class="cqa-mono">#${i} · ${isCall ? mmss(offsetSec(conv, i)) : conv.transcript[i].timestamp}</span><q>${esc(conv.transcript[i].text)}</q></button>` : ''}
                ${ap?.status === 'open' ? `<span class="cqa-badge cqa-badge--appeal">на рассмотрении</span>${S.role === 'reviewer' ? `<button class="cqa-btn cqa-btn--s cqa-btn--primary" data-review="${ap.id}">Проверить</button>` : ''}` : `<button class="cqa-btn cqa-btn--s cqa-btn--ghost" data-appeal="${d.c.id}">Оспорить</button>`}
              </div></div>`; }).join('')}</div>`
          : `<div class="cqa-banner cqa-banner--ok">${ICON.check}<div>Баллы не снижены ни по одному применимому критерию.</div></div>`}
        </div>
        <div class="cqa-card panel panel--criteria">
          <div class="panel__head"><h2 class="cqa-h3">Все критерии</h2><span class="cqa-small cqa-muted">Нажмите для подробностей</span></div>
          <div class="crit-table">${crits.map((c) => {
            const row = finalScore.criteria.find((x) => x.criterion_id === c.id); const a = finalAnswers[c.id];
            const ap = E.appeals.filter((x) => x.criterion_id === c.id).at(-1);
            return `<button class="crit-line ${ap?.status === 'open' ? 'is-appealed' : ap?.status === 'changed' ? 'is-overridden' : ''}" data-open="${c.id}">
              <span class="crit-line__name">${String(c.order).padStart(2, '0')} · ${esc(c.title)}</span>
              ${answerBadge(c, a)}
              <span class="crit-line__pts cqa-num">${c.type === 'flag' ? '' : row.points == null ? '—' : `${fmt(row.points, 1)}<small>/${fmt(row.effective_weight, 1)}</small>`}</span></button>`;
          }).join('')}</div>
        </div>
      </section>
    </div>`;

  animateScore(prev ?? 0, total);
  S.lastTotals[convId] = total;

  // audio (calls): proxied through /api/audio because organizer links are HTML pages with 1h SAS mp3 links
  audioEl?.pause(); audioEl = null;
  if (isCall && S.api.ok) {
    audioEl = new Audio(`/api/audio?id=${encodeURIComponent(convId)}`); audioEl.preload = 'none';
    audioEl.addEventListener('timeupdate', () => setPlayhead(audioEl.currentTime, dur));
    audioEl.addEventListener('ended', () => { $('#play').innerHTML = ICON.play; });
    audioEl.addEventListener('error', () => toast('Не удалось загрузить запись (ссылка организаторов недоступна)', 'warn'));
    $('#play').onclick = () => { if (audioEl.paused) { audioEl.play().catch(() => toast('Запись недоступна', 'warn')); $('#play').innerHTML = ICON.pause; } else { audioEl.pause(); $('#play').innerHTML = ICON.play; } };
  }
  $('#scrub').addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo(conv, ((e.clientX - r.left) / r.width) * dur); });
  view.querySelectorAll('.track__lane').forEach((lane) => lane.addEventListener('click', (e) => { if (e.target.closest('[data-jump]')) return; const r = lane.getBoundingClientRect(); seekTo(conv, ((e.clientX - r.left) / r.width) * dur); }));
  view.querySelectorAll('[data-jump]').forEach((b) => b.addEventListener('click', () => jumpTo(conv, [Number(b.dataset.jump)])));
  view.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => openCriterion(conv, b.dataset.open)));
  view.querySelectorAll('[data-appeal]').forEach((b) => b.addEventListener('click', () => openAppeal(conv, b.dataset.appeal)));
  view.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => openReview(b.dataset.review)));
  $('#appeal-main').onclick = () => openAppeal(conv, dd[0]?.c.id || crits[0].id);
  $('#reeval').onclick = async () => {
    if (S.singleEval?.pending) return;
    if (!(S.api.ok && S.api.openrouter)) {
      S.singleEval = { convId, error: 'Сервис оценки сейчас недоступен.' };
      viewCard(view, convId); return;
    }
    S.singleEval = { convId, pending: true }; viewCard(view, convId);
    try {
      await aiEvaluate(convId, { force: E.src === 'ai' });
      S.singleEval = null;
      if (location.hash === `#/dialog/${encodeURIComponent(convId)}` || location.hash === `#/dialog/${convId}`) {
        viewCard(view, convId); toast('Оценка готова');
      }
    } catch (e) {
      S.singleEval = { convId, error: e.name === 'AbortError' ? 'Оценка занимает слишком много времени.' : 'Проверьте соединение или попробуйте позже.' };
      if (location.hash === `#/dialog/${encodeURIComponent(convId)}` || location.hash === `#/dialog/${convId}`) viewCard(view, convId);
    }
  };
}

function setPlayhead(sec, dur) {
  const p = Math.max(0, Math.min(100, (sec / dur) * 100));
  const ph = $('#playhead'); if (ph) ph.style.setProperty('--p', p / 100);
  const f = $('#scrub-fill'); if (f) f.style.width = `${p}%`;
  const t = $('#tpos'); if (t) t.textContent = mmss(sec);
}
function seekTo(conv, sec) {
  let best = 0; for (let i = 0; i < conv.transcript.length; i++) if (offsetSec(conv, i) <= sec) best = i;
  jumpTo(conv, [best], sec);
}
function jumpTo(conv, indices, sec) {
  document.querySelectorAll('.tx-row.is-evidence').forEach((el) => el.classList.remove('is-evidence', 'is-flash'));
  indices.forEach((i) => { const el = $(`#m-${i}`); if (el) { el.classList.add('is-evidence'); void el.offsetWidth; el.classList.add('is-flash'); } });
  const first = $(`#m-${indices[0]}`); const box = $('#transcript');
  if (first && box) box.scrollTo({ top: first.offsetTop - box.offsetTop - box.clientHeight / 3, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  const t = sec ?? offsetSec(conv, indices[0]);
  setPlayhead(t, duration(conv));
  if (audioEl) { try { audioEl.currentTime = t; } catch {} }
}
function animateScore(from, to) {
  const ring = $('#ring'), num = $('#total'); if (!ring) return;
  if (to == null) { ring.style.setProperty('--p', 0); num.textContent = '—'; return; }
  const d = matchMedia('(prefers-reduced-motion: reduce)').matches ? 1 : 900; const t0 = performance.now();
  const step = (now) => { const k = Math.min(1, (now - t0) / d), e = 1 - (1 - k) ** 3, v = from + (to - from) * e;
    ring.style.setProperty('--p', v); num.textContent = k < 1 ? fmt(v, 0) : fmt(to, 1); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { ring.style.setProperty('--p', to); num.textContent = fmt(to, 1); }, d + 50); // final state even if rAF is throttled
}

/* ================= drawers ================= */
function drawer(title, body, foot) {
  closeDrawer();
  const wrap = document.createElement('div'); wrap.id = 'drawer';
  wrap.innerHTML = `<div class="cqa-scrim" data-close></div><aside class="cqa-drawer" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="cqa-drawer__head"><h2 class="cqa-h2">${esc(title)}</h2><button class="cqa-btn cqa-btn--ghost cqa-btn--icon cqa-btn--s" data-close aria-label="Закрыть">${ICON.x}</button></div>
    <div class="cqa-drawer__body">${body}</div>${foot ? `<div class="cqa-drawer__foot">${foot}</div>` : ''}</aside>`;
  $('#cqa-root').appendChild(wrap);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  document.addEventListener('keydown', escClose);
  setTimeout(() => wrap.querySelector('textarea, select, input, .cqa-drawer__body button')?.focus(), 60);
  return wrap;
}
function escClose(e) { if (e.key === 'Escape') closeDrawer(); }
function closeDrawer() { $('#drawer')?.remove(); document.removeEventListener('keydown', escClose); }

function fragment(conv, evid) {
  const ids = (evid || []).flatMap((e) => (e.kind === 'message' ? [e.turn_index] : e.kind === 'range' ? [e.range[0], e.range[1]] : []));
  const na = (evid || []).find((e) => e.kind === 'na_condition');
  if (!ids.length) return `<div class="cqa-banner cqa-banner--info">${ICON.dash}<div>${na ? `N/A: ${esc(na.quote)}` : 'Нет ссылки на реплику.'}</div></div>`;
  const lo = Math.max(0, Math.min(...ids) - 1), hi = Math.min(conv.transcript.length - 1, Math.max(...ids) + 1);
  return `<div class="tx tx--mini">${conv.transcript.slice(lo, hi + 1).map((m, k) => { const i = lo + k; return `<div class="tx-row tx-row--${m.speaker} ${ids.includes(i) ? 'is-evidence' : ''}"><span class="tx-time cqa-mono">#${i}</span><span class="tx-spk"><i class="spk-dot spk-dot--${m.speaker}"></i>${SPK[m.speaker]}</span><span class="tx-text">${esc(m.text)}</span></div>`; }).join('')}</div>`;
}

function openCriterion(conv, critId) {
  const E = evaluation(conv.conversation_id); const c = E.cl.criteria.find((x) => x.id === critId); const r = E.answers[critId] || {};
  const row = E.finalScore.criteria.find((x) => x.criterion_id === critId); const ap = E.appeals.filter((a) => a.criterion_id === critId);
  const w = drawer(`${String(c.order).padStart(2, '0')} · ${c.title}`, `
    <div class="cqa-spread">${answerBadge(c, E.finalAnswers[critId])}<span class="cqa-num"><b>${row.points == null ? '—' : fmt(row.points)}</b> / ${fmt(row.effective_weight) ?? '—'} <span class="cqa-muted cqa-small">(вес ${c.weight})</span></span></div>
    <div class="cqa-small cqa-muted">${esc(c.description)}</div>
    <div class="cqa-card cqa-card--tint cqa-card--compact cqa-stack" style="gap:6px"><div class="cqa-overline">${E.src === 'ai' ? 'Объяснение AI' : 'Объяснение (MOCK)'}</div><div>${esc(r.explanation || '—')}</div>${r.deduction_reason ? `<div><b>За что снижено:</b> ${esc(r.deduction_reason)}</div>` : ''}</div>
    <div class="cqa-field"><span class="cqa-label">Доказательство</span>${fragment(conv, r.evidence)}</div>
    ${ap.length ? `<div class="cqa-timeline"><div class="cqa-timeline__item" style="--c:var(--cqa-na)"><b>Автооценка:</b> ${answerText(c, r.answer)}</div>${ap.map((a) => `<div class="cqa-timeline__item" style="--c:var(--cqa-notify)"><b>Апелляция:</b> «${esc(a.comment)}»</div>${a.decision ? `<div class="cqa-timeline__item" style="--c:${a.status === 'changed' ? 'var(--cqa-brand-primary)' : 'var(--cqa-text-tertiary)'}"><b>Решение:</b> ${a.status === 'changed' ? `изменено на «${answerText(c, a.decision.new_answer)}»` : 'подтверждено'} — ${esc(a.decision.reason)}</div>` : ''}`).join('')}</div>` : ''}`,
    `<button class="cqa-btn" data-close>Закрыть</button>${(r.evidence || []).some((e) => e.kind !== 'na_condition') ? '<button class="cqa-btn" id="cr-jump">К реплике</button>' : ''}<button class="cqa-btn cqa-btn--primary" id="cr-appeal">Оспорить</button>`);
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  $('#cr-appeal').onclick = () => openAppeal(conv, critId);
  const jb = $('#cr-jump'); if (jb) jb.onclick = () => { const e = r.evidence.find((x) => x.kind !== 'na_condition'); closeDrawer(); jumpTo(conv, e.kind === 'message' ? [e.turn_index] : Array.from({ length: e.range[1] - e.range[0] + 1 }, (_, k) => e.range[0] + k)); };
}

function openAppeal(conv, critId) {
  const E = evaluation(conv.conversation_id); const cl = E.cl;
  const crits = cl.criteria.filter((c) => !E.appeals.some((a) => a.criterion_id === c.id && a.status === 'open'));
  if (!crits.length) return toast('По всем критериям уже есть открытые апелляции', 'warn');
  const w = drawer('Апелляция', `
    <div class="cqa-field"><label class="cqa-label" for="ap-crit">Критерий</label>
      <select class="cqa-select" id="ap-crit">${crits.map((c) => `<option value="${c.id}" ${c.id === critId ? 'selected' : ''}>${String(c.order).padStart(2, '0')} · ${esc(c.title)} — ${answerText(c, E.finalAnswers[c.id])}</option>`).join('')}</select></div>
    <div id="ap-ctx"></div>
    <div class="cqa-field"><label class="cqa-label" for="ap-comment">Комментарий</label>
      <textarea class="cqa-textarea" id="ap-comment" placeholder="Почему оценка неверна? Сошлитесь на реплику, например #9."></textarea>
      <span class="cqa-hint">Проверяющий увидит спорную оценку, комментарий и фрагмент диалога.</span></div>`,
    `<button class="cqa-btn" data-close>Отмена</button><button class="cqa-btn cqa-btn--primary" id="ap-save">Отправить апелляцию</button>`);
  const ctx = () => { const id = $('#ap-crit').value; const c = cl.criteria.find((x) => x.id === id); const r = E.answers[id] || {};
    $('#ap-ctx').innerHTML = `<div class="cqa-card cqa-card--tint cqa-card--compact cqa-stack" style="gap:8px"><div class="cqa-spread"><b>${esc(c.title)}</b>${answerBadge(c, E.finalAnswers[id])}</div><div class="cqa-small">${esc(r.deduction_reason || r.explanation || '')}</div>${fragment(conv, r.evidence)}</div>`; };
  ctx(); $('#ap-crit').addEventListener('change', ctx);
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  $('#ap-save').onclick = () => {
    const comment = $('#ap-comment').value.trim();
    if (!comment) { $('#ap-comment').classList.add('is-invalid'); $('#ap-comment').focus(); return; }
    S.appeals.push({ id: uid(), conversation_id: conv.conversation_id, criterion_id: $('#ap-crit').value, checklist_version: cl.version, checklist_hash: clHash(cl), comment, created_at: new Date().toISOString(), status: 'open' });
    persist(); closeDrawer(); toast('Апелляция сохранена и передана проверяющему'); route();
  };
}

function openReview(appealId) {
  const ap = S.appeals.find((a) => a.id === appealId); if (!ap) return;
  const conv = S.byId[ap.conversation_id]; const E = evaluation(conv.conversation_id); const cl = E.cl;
  const c = cl.criteria.find((x) => x.id === ap.criterion_id); const r = E.answers[c.id] || {}; const orig = r.answer;
  const options = c.type === 'scale' ? [...c.scale.map((s) => s.value), ...(c.na_allowed ? ['na'] : [])] : ['yes', 'no', ...(c.na_allowed ? ['na'] : [])];
  const label = (v) => (v === 'yes' ? 'Да' : v === 'no' ? 'Нет' : v === 'na' ? 'N/A' : String(v));
  let pick = orig, mode = 'confirm';
  const w = drawer(`Проверка апелляции · ${conv.conversation_id}`, `
    <div class="cqa-card cqa-card--tint cqa-card--compact cqa-stack" style="gap:8px">
      <div class="cqa-spread"><b>${String(c.order).padStart(2, '0')} · ${esc(c.title)}</b>${answerBadge(c, orig)}</div>
      <div class="cqa-small"><span class="cqa-muted">Автооценка:</span> ${esc(r.explanation || '')}</div>
      <div class="cqa-banner cqa-banner--warn" style="padding:10px 12px">${ICON.flag}<div><b>Комментарий оценщика</b><div>${esc(ap.comment)}</div></div></div>
    </div>
    <div class="cqa-field"><span class="cqa-label">Фрагмент диалога</span>${fragment(conv, r.evidence)}</div>
    <div class="cqa-field"><span class="cqa-label">Решение</span><div class="cqa-seg" id="rv-mode"><button data-m="confirm" aria-pressed="true">Подтвердить оценку</button><button data-m="change" aria-pressed="false">Изменить оценку</button></div></div>
    <div class="cqa-field" id="rv-new" hidden><span class="cqa-label">Новый ответ</span><div class="cqa-seg" id="rv-answer">${options.map((v) => `<button data-v="${v}" aria-pressed="${v === orig}">${label(v)}</button>`).join('')}</div></div>
    <div class="cqa-field"><label class="cqa-label" for="rv-reason">Причина решения</label><textarea class="cqa-textarea" id="rv-reason" placeholder="Обоснование со ссылкой на реплику"></textarea></div>
    <div class="cqa-banner cqa-banner--info" id="rv-preview"></div>`,
    `<button class="cqa-btn" data-close>Отмена</button><button class="cqa-btn cqa-btn--primary" id="rv-save">Сохранить решение</button>`);
  w.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', closeDrawer));
  const preview = () => { const base = evaluation(conv.conversation_id); const ans = { ...base.finalAnswers, [c.id]: mode === 'change' ? pick : base.finalAnswers[c.id] };
    const nt = score(cl, ans).total, ot = base.finalScore.total;
    $('#rv-preview').innerHTML = `<div>Итог после решения: <b class="cqa-num">${fmt(ot)}</b> → <b class="cqa-num">${fmt(nt)}</b> ${nt !== ot ? `<span class="delta ${nt > ot ? 'up' : 'down'}">${nt > ot ? '+' : ''}${fmt(nt - ot)}</span>` : ''}</div>`; };
  $('#rv-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; $('#rv-mode').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); $('#rv-new').hidden = mode !== 'change'; preview(); });
  $('#rv-answer').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pick = ['yes', 'no', 'na'].includes(b.dataset.v) ? b.dataset.v : Number(b.dataset.v); $('#rv-answer').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', x === b)); preview(); });
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

/* ================= view: appeals ================= */
function viewAppeals(view) {
  const list = [...S.appeals].sort((a, b) => (a.status === 'open' ? -1 : 1) - (b.status === 'open' ? -1 : 1) || b.created_at.localeCompare(a.created_at));
  const titleOf = (a) => S.checklists.flatMap((c) => c.criteria).find((x) => x.id === a.criterion_id)?.title || a.criterion_id;
  view.innerHTML = `
    <header class="page-head"><div><div class="cqa-overline">Работа с результатом</div><h1 class="cqa-title">Апелляции</h1></div>
      <span class="cqa-small cqa-muted">${S.role === 'reviewer' ? 'Вы — проверяющий: откройте апелляцию и примите решение.' : 'Переключите роль на «Проверяющий» слева внизу, чтобы принимать решения.'}</span></header>
    ${list.length ? `<div class="pane"><table class="cqa-table"><thead><tr><th>Диалог</th><th>Критерий</th><th>Комментарий</th><th>Решение</th><th></th></tr></thead><tbody>
      ${list.map((a) => `<tr><td><a href="#/dialog/${a.conversation_id}">${a.conversation_id}</a></td><td>${esc(titleOf(a))}</td><td style="max-width:320px">${esc(a.comment)}</td>
        <td>${a.status === 'open' ? '<span class="cqa-badge cqa-badge--appeal">Открыта</span>' : `${a.status === 'changed' ? '<span class="cqa-badge cqa-badge--brand">Изменена</span>' : '<span class="cqa-badge cqa-badge--na">Подтверждена</span>'}<div class="cqa-small cqa-muted">${esc(a.decision?.reason || '')}</div>`}</td>
        <td style="text-align:right">${a.status === 'open' ? `<button class="cqa-btn cqa-btn--s ${S.role === 'reviewer' ? 'cqa-btn--primary' : ''}" data-review="${a.id}" ${a.checklist_hash !== clHash(checklist()) ? 'disabled title="Апелляция к другой версии чек-листа"' : ''}>Проверить</button>` : ''}</td></tr>`).join('')}
    </tbody></table></div>`
    : `<div class="cqa-empty"><div class="cqa-glow" style="top:-200px;left:30%"></div><h2 class="cqa-header-4">Апелляций пока нет</h2><p class="cqa-muted">Откройте анализ разговора и нажмите «Оспорить» у причины снижения.</p><button class="cqa-btn cqa-btn--primary" data-go="#/dialog/${S.convs[0].conversation_id}">Открыть анализ</button></div>`}`;
  view.querySelectorAll('[data-review]').forEach((b) => b.addEventListener('click', () => openReview(b.dataset.review)));
}

/* ================= view: checklist editor ================= */
let draft = null, newId = null;
function viewChecklist(view) {
  const cl = checklist();
  if (!draft || draft.__base !== cl.version) draft = { ...structuredClone(cl), __base: cl.version };
  const weightSum = draft.criteria.filter((c) => c.type !== 'flag').reduce((s, c) => s + Number(c.weight || 0), 0);
  const { __base, ...cmp } = draft; const dirty = JSON.stringify(cmp) !== JSON.stringify(cl);
  const nextV = Math.max(...S.checklists.map((c) => c.version)) + 1;
  view.innerHTML = `
    <header class="page-head">
      <div><div class="cqa-overline">Настройка оценки</div><h1 class="cqa-title">Чек-лист · v${cl.version}</h1></div>
      <div class="cqa-row">
        <select class="cqa-select" id="ver" style="width:auto">${S.checklists.map((c) => `<option value="${c.version}" ${c.version === cl.version ? 'selected' : ''}>v${c.version} · ${c.updated_at.slice(0, 16).replace('T', ' ')}</option>`).join('')}</select>
        <button class="cqa-btn" id="add">${ICON.plus} Критерий</button>
        <button class="cqa-btn cqa-btn--primary" id="save" ${dirty ? '' : 'disabled'}>Сохранить v${nextV} и применить</button>
      </div>
    </header>
    <div class="cqa-banner ${weightSum === 100 ? 'cqa-banner--ok' : 'cqa-banner--warn'}" style="margin-bottom:16px">${weightSum === 100 ? ICON.check : ICON.alert}
      <div>Сумма весов: <b class="cqa-num">${weightSum}</b> / 100. ${weightSum === 100 ? 'Итог считается из 100 баллов.' : 'Итог всё равно нормируется до 100, но лучше выровнять до 100.'} N/A перераспределяет вес между применимыми критериями. После сохранения все диалоги переоцениваются ${S.api.ok && S.api.openrouter ? 'AI (из кэша, если критерий не менялся)' : 'MOCK-оценщиком'}.</div></div>
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
    else if (k === 'scale') { const vals = e.target.value.split(/[,;\s]+/).map(Number).filter(Number.isFinite); c.scale = [...new Set(vals)].sort((a, b) => b - a).map((v) => ({ value: v, label: String(v) })); }
    else if (k === 'type') { c.type = e.target.value; if (c.type === 'scale' && !c.scale) c.scale = [10, 5, 0].map((v) => ({ value: v, label: String(v) })); if (c.type === 'flag') { c.weight = 0; c.na_allowed = false; } }
    else c[k] = e.target.value;
    viewChecklist(view);
  });
  rowsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const c = find(b); const list = draft.criteria.sort((x, y) => x.order - y.order); const i = list.indexOf(c);
    if (b.hasAttribute('data-del')) draft.criteria = list.filter((x) => x !== c);
    if (b.hasAttribute('data-up') && i > 0) [list[i - 1].order, c.order] = [c.order, list[i - 1].order];
    if (b.hasAttribute('data-down') && i < list.length - 1) [list[i + 1].order, c.order] = [c.order, list[i + 1].order];
    draft.criteria.sort((x, y) => x.order - y.order).forEach((x, k) => { x.order = k + 1; });
    viewChecklist(view);
  });
  $('#add').onclick = () => { newId = `c${uid()}`; draft.criteria.push({ id: newId, order: draft.criteria.length + 1, section_id: draft.sections?.[0]?.id, title: 'Новый критерий', description: 'Да — …', type: 'binary', weight: 10, na_allowed: false }); viewChecklist(view); $(`[data-id="${newId}"] input[data-k="title"]`)?.select(); };
  $('#ver').onchange = (e) => { S.activeVersion = Number(e.target.value); draft = null; persist(); toast(`Активна версия v${S.activeVersion}`); route(); };
  $('#save').onclick = async () => {
    const bad = draft.criteria.find((c) => c.type === 'scale' && (!c.scale || c.scale.length < 2));
    if (bad) return toast(`У «${bad.title}» нужна шкала минимум из двух ступеней`, 'warn');
    const { __base: _, ...clean } = draft;
    S.checklists.push({ ...structuredClone(clean), version: nextV, updated_at: new Date().toISOString() });
    S.activeVersion = nextV; draft = null; newId = null; persist();
    toast(`Чек-лист v${nextV} сохранён и применён к ${S.convs.length} диалогам`);
    location.hash = '#/dialogs';
    if (S.api.ok && S.api.openrouter) aiEvaluateAll(S.convs.map((c) => c.conversation_id), `Переоценка по v${nextV}`);
  };
}

/* ================= view: design system gallery ================= */
function viewDesign(view) {
  const sw = [['brand-primary', '#00B323'], ['brand-secondary', '#13AD64'], ['brand-additional', '#00E183'], ['brand-accent', '#FFA700'], ['brand-tertiary', '#FF3A38'],
    ['text-primary', '#323335'], ['text-tertiary', '#6A788A'], ['text-secondary', '#B2BCC8'], ['bg-primary', '#F3F8FF'], ['bg-secondary', '#DFF5EC'], ['bg-warning', '#FFF8D5'], ['dark-primary', '#0C1411'],
    ['success-ink', '#00801F'], ['error-ink', '#C93A3A'], ['notify-ink', '#8A6200'], ['link', '#0066CC']];
  view.innerHTML = `
    <header class="page-head"><div><div class="cqa-overline">design/ · docs/research/design-system.md</div><h1 class="cqa-title">Дизайн-система Freedom CQA</h1></div></header>
    <div class="cqa-stack" style="gap:24px">
      <section class="cqa-card" style="position:relative;overflow:hidden"><div class="cqa-glow" style="right:-200px;top:-300px"></div>
        <div style="position:relative" class="cqa-stack"><div class="cqa-display-2">Оценка <span class="cqa-text-gradient">качества</span> диалогов</div>
        <div class="cqa-subheader cqa-muted">CoFo Sans → Inter · градиент бренда · радиусы 20px</div>
        <div class="cqa-row"><button class="cqa-btn cqa-btn--primary cqa-btn--l">Запустить оценку</button><button class="cqa-btn cqa-btn--l">Подробнее</button></div></div></section>
      <section><h2 class="cqa-h2" style="margin-bottom:12px">Цвета</h2><div class="swatches">${sw.map(([n, h]) => `<div class="swatch"><div style="background:var(--cqa-${n})"></div><div><b>${n}</b><div class="cqa-mono">${h}</div></div></div>`).join('')}
        <div class="swatch"><div style="background:var(--cqa-gradient-brand)"></div><div><b>gradient-brand</b><div class="cqa-mono">#7D8DEE → #1CCC9E → #1AE276</div></div></div></div></section>
      <div class="gallery">
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Кнопки</h2>
          <div class="cqa-row" style="flex-wrap:wrap"><button class="cqa-btn cqa-btn--primary">Primary</button><button class="cqa-btn">Secondary</button><button class="cqa-btn cqa-btn--ghost">Ghost</button><button class="cqa-btn cqa-btn--danger">Danger</button></div>
          <div class="cqa-row" style="flex-wrap:wrap"><button class="cqa-btn cqa-btn--primary cqa-btn--s">Small</button><button class="cqa-btn cqa-btn--primary is-loading">Loading</button><button class="cqa-btn" disabled>Disabled</button><button class="cqa-btn cqa-btn--icon" aria-label="Добавить">${ICON.plus}</button></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Статусы ответа</h2>
          <div class="cqa-row" style="flex-wrap:wrap"><span class="cqa-badge cqa-badge--pass">${ICON.check} Да</span><span class="cqa-badge cqa-badge--fail">${ICON.x} Нет</span><span class="cqa-badge cqa-badge--na">${ICON.dash} N/A</span><span class="cqa-badge cqa-badge--partial">15 / 20</span><span class="cqa-badge cqa-badge--gross">${ICON.alert} Нарушение</span><span class="cqa-badge cqa-badge--appeal">Апелляция</span><span class="cqa-badge cqa-badge--lang">KZ</span></div>
          <div class="cqa-row">${[[92, 'high'], [71, 'mid'], [38, 'low']].map(([v, t]) => `<div class="cqa-score cqa-score--${t}" style="--p:${v};--size:88px"><span class="cqa-score__value" style="font-size:24px">${v}</span></div>`).join('')}<div class="cqa-score cqa-score--none" style="--size:88px"><span class="cqa-score__value" style="font-size:24px">—</span></div></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Формы</h2>
          <div class="cqa-field"><label class="cqa-label">Комментарий</label><input class="cqa-input" placeholder="Плейсхолдер"></div>
          <div class="cqa-row"><div class="cqa-seg"><button data-v="yes" aria-pressed="true">Да</button><button data-v="no" aria-pressed="false">Нет</button><button aria-pressed="false">N/A</button></div><input type="checkbox" class="cqa-switch" checked aria-label="Переключатель"></div>
          <div class="cqa-tabs" role="tablist"><button role="tab" aria-selected="true">Результат</button><button role="tab" aria-selected="false">История</button></div></section>
        <section class="cqa-card cqa-stack"><h2 class="cqa-h3">Причина снижения</h2>
          <div class="ded"><div class="ded__head"><b>Завершение</b><span class="ded__lost cqa-num">−5,88</span></div><div class="ded__why">Оператор закрыл чат без прощания.</div></div>
          <div class="ded ded--gross"><div class="ded__head"><b>Грубые ошибки</b><span class="ded__lost">грубая ошибка</span></div><div class="ded__why">Предложение перевести деньги лично.</div></div></section>
      </div>
    </div>`;
}

/* ================= boot ================= */
async function boot() {
  const view = $('#view');
  view.innerHTML = `<div class="cqa-stack"><div class="cqa-skeleton" style="height:36px;width:280px"></div><div class="kpi-grid">${'<div class="cqa-skeleton" style="height:120px"></div>'.repeat(4)}</div><div class="cqa-skeleton" style="height:320px"></div></div>`;
  try {
    const [ds, cl] = await Promise.all([fetch('../data/datasets/DEV.json').then((r) => r.json()), fetch('../data/checklists/freedom-chat-v1.json').then((r) => r.json()), apiHealth()]);
    S.convs = ds.data.records; S.byId = Object.fromEntries(S.convs.map((c) => [c.conversation_id, c]));
    const saved = restore();
    S.checklists = saved?.checklists?.length ? saved.checklists : [{ ...cl, version: 1, updated_at: new Date().toISOString() }];
    S.activeVersion = saved?.activeVersion || 1; S.appeals = saved?.appeals || []; S.role = saved?.role || 'qa'; S.ai = saved?.ai || {};
    // precomputed AI results (scripts/eval-run.mjs) for the base checklist → instant demo without calling the API
    const pre = await fetch('../data/evaluations/DEV.json', { cache: 'no-store' }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    if (pre?.results) { const k = clHash(S.checklists[0]); for (const [id, r] of Object.entries(pre.results)) if (!S.ai[`${id}|${k}`]) S.ai[`${id}|${k}`] = { answers: r.answers, summary: r.summary, model: r.model || pre.model, usage: r.usage }; }
  } catch (err) {
    view.innerHTML = `<div class="cqa-empty"><div class="cqa-glow"></div><h2 class="cqa-header-4">Не удалось загрузить данные</h2><p class="cqa-muted">Запустите <code>npm run dev</code> (или <code>python3 -m http.server</code>) из корня репозитория и откройте <code>/prototype/</code>.</p><code class="cqa-mono">${esc(err.message)}</code></div>`;
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
  addEventListener('hashchange', () => { closeDrawer(); route(); window.scrollTo(0, 0); });
  window.CQA = { S, score, evaluation, reset: () => { localStorage.removeItem(LS_KEY); location.reload(); } };
  route();
}
boot();

