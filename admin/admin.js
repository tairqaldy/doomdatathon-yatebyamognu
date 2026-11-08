// Freedom CQA admin console v2: login gate, navigation shell, hash router.
// Views: Обзор · Диалоги (+ анализ диалога) · Апелляции · Чек-лист · Живые чаты · AI-аналитик.
import { $, $$, esc, icon, seg, closeDrawer, toast } from './ui.js';
import * as auth from './auth.js';
import * as live from '/shared/live-store.js';
import { S, load, refresh, on, appealStats, liveStats, setRole, modelLabel, aiReady, LS_KEY } from './store.js';
import { viewOverview } from './overview.js';
import { viewDialogs } from './dialogs.js';
import { viewCard } from './card.js';
import { viewAppeals } from './appeals.js';
import { viewChecklist } from './checklist.js';
import { viewLive } from './live.js';
import { viewAnalyst } from './analyst.js';
import { viewImport } from './import.js';

const ROUTES = {
  overview: { render: viewOverview, nav: 'overview' },
  dialogs: { render: viewDialogs, nav: 'dialogs' },
  dialog: { render: viewCard, nav: 'dialogs', role: true },
  appeals: { render: viewAppeals, nav: 'appeals', role: true },
  checklist: { render: viewChecklist, nav: 'checklist' },
  live: { render: viewLive, nav: 'live' },
  analyst: { render: viewAnalyst, nav: 'analyst' },
  import: { render: viewImport, nav: 'import' },
};
const NAV = [
  { id: 'overview', label: 'Обзор', icon: 'overview' },
  { id: 'dialogs', label: 'Диалоги', icon: 'dialogs' },
  { id: 'import', label: 'Загрузка диалогов', short: 'Загрузка', icon: 'upload' },
  { id: 'appeals', label: 'Апелляции', icon: 'appeals', badge: () => appealStats().open },
  { id: 'checklist', label: 'Чек-лист', icon: 'checklist' },
  { id: 'live', label: 'Живые чаты', short: 'Чаты', icon: 'live', badge: () => liveStats().waiting, pulse: true },
  { id: 'analyst', label: 'AI-аналитик', short: 'Аналитик', icon: 'analyst' },
];

let loaded = false;
let cleanup = null;
let current = { page: 'overview', arg: '', query: new URLSearchParams() };

const parseHash = () => {
  const raw = location.hash.replace(/^#\/?/, '');
  const [path, qs = ''] = raw.split('?');
  const [page = 'overview', ...rest] = path.split('/');
  return { page: ROUTES[page] ? page : 'overview', arg: decodeURIComponent(rest.join('/')), query: new URLSearchParams(qs) };
};

function renderNav() {
  const active = ROUTES[current.page]?.nav || 'overview';
  $('#nav').innerHTML = NAV.map((n) => {
    const b = n.badge?.() || 0;
    const tag = n.tag?.();
    return `<a class="nav-item" href="#/${n.id}" ${active === n.id ? 'aria-current="page"' : ''} title="${esc(n.label)}">
      ${icon(n.icon)}<span class="nav-item__label"><span class="nav-item__long">${esc(n.label)}</span><span class="nav-item__short">${esc(n.short || n.label)}</span></span>
      ${b ? `<span class="nav-item__badge ${n.pulse ? 'nav-item__badge--pulse' : ''}" aria-label="${b} ${n.id === 'live' ? 'ждут оператора' : 'открыто'}">${b}</span>` : ''}
      ${tag && !b ? `<span class="nav-item__tag">${esc(tag)}</span>` : ''}
    </a>`;
  }).join('');
  $('#ai-status').innerHTML = aiReady()
    ? `<span class="dot dot--ok" aria-hidden="true"></span><span><b>AI подключён</b><span class="rail__ai-model">${esc(modelLabel(S.api.model))}</span></span>`
    : `<span class="dot dot--warn" aria-hidden="true"></span><span><b>AI недоступен</b><span class="rail__ai-model">оценка без AI</span></span>`;
}

function renderTools() {
  const r = ROUTES[current.page];
  $('#top-tools').innerHTML = r?.role
    ? `<span class="top__role-label">Роль</span>${seg('role-switch', [{ v: 'qa', label: 'Оценщик' }, { v: 'reviewer', label: 'Проверяющий' }], S.role, 'Роль')}`
    : '';
}

function renderBusy(b = S.busy) {
  const el = $('#busy');
  if (!b) { el.hidden = true; el.innerHTML = ''; return; }
  el.hidden = false;
  const p = b.total ? (b.done / b.total) * 100 : 0;
  el.innerHTML = `<span class="spinner" aria-hidden="true"></span><span class="busy__text">${esc(b.label)} · <b class="num">${b.done}/${b.total}</b></span><span class="progress" aria-hidden="true"><span style="width:${p}%"></span></span>`;
}

function route({ keepScroll = false } = {}) {
  if (!loaded) return;
  current = parseHash();
  const y = scrollY;
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  refresh();
  renderNav(); renderTools();
  document.getElementById('app').classList.remove('shell--rail-open');
  $('#rail-toggle').setAttribute('aria-expanded', 'false');
  // fresh node per route so listeners a view attached to it never leak into the next view
  const old = $('#view'); const view = old.cloneNode(false); old.replaceWith(view);
  view.className = `view view--${current.page}`;
  cleanup = ROUTES[current.page].render(view, current.arg, current.query) || null;
  if (keepScroll) scrollTo(0, y);
}

async function enterApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  if (!loaded) {
    $('#view').innerHTML = '<div class="loading" aria-busy="true"><span class="skel" style="width:36%"></span><div class="skel-row"><span class="skel"></span><span class="skel"></span><span class="skel"></span><span class="skel"></span></div><span class="skel skel--tall"></span></div>';
    try { await load(); } catch (e) { $('#view').innerHTML = `<div class="empty"><h2>Не удалось загрузить данные</h2><p>${esc(e.message)}</p></div>`; return; }
    loaded = true;
  }
  if (!location.hash || location.hash === '#') history.replaceState(null, '', '#/overview');
  route();
}

function showLogin(reason = '') {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  closeDrawer(false);
  $('#app').hidden = true; $('#login').hidden = false;
  $('#login-err').textContent = reason;
  $('#login-pass').value = '';
  setTimeout(() => $('#login-pass').focus(), 30);
  // The "freedom" hint is only true while ADMIN_PASSCODE is unset on the server; never reveal a custom passcode.
  fetch('/api/health', { cache: 'no-store' }).then((r) => r.json()).then((h) => {
    const hint = $('#login-hint');
    if (hint && h.admin_passcode_set) hint.textContent = 'Код доступа выдаёт команда';
  }).catch(() => {});
}

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const pass = $('#login-pass').value.trim();
  const btn = $('#login-btn');
  if (!pass) { $('#login-err').textContent = 'Введите код доступа'; $('#login-pass').setAttribute('aria-invalid', 'true'); return; }
  btn.disabled = true; btn.textContent = 'Проверяем…';
  try {
    const r = await auth.login(pass);
    if (!r.ok) { $('#login-err').textContent = r.error; $('#login-pass').setAttribute('aria-invalid', 'true'); $('#login-pass').select(); return; }
    $('#login-pass').removeAttribute('aria-invalid'); $('#login-err').textContent = '';
    enterApp();
  } catch { $('#login-err').textContent = 'Сервер недоступен, попробуйте ещё раз'; }
  finally { btn.disabled = false; btn.textContent = 'Войти'; }
});

$$('[data-logout]').forEach((b) => b.addEventListener('click', () => auth.logout()));
addEventListener('cqa:logout', (e) => showLogin(e.detail?.reason || ''));
addEventListener('hashchange', () => {
  if ($('#app').hidden) return;
  closeDrawer(false);
  route(); scrollTo(0, 0); $('#view').focus({ preventScroll: true });
});
$('#rail-toggle').addEventListener('click', () => {
  const open = document.getElementById('app').classList.toggle('shell--rail-open');
  $('#rail-toggle').setAttribute('aria-expanded', String(open));
  $('#rail-toggle').setAttribute('aria-label', open ? 'Свернуть меню' : 'Развернуть меню');
});
$('#top-tools').addEventListener('click', (e) => {
  const b = e.target.closest('#role-switch button'); if (!b || b.getAttribute('aria-pressed') === 'true') return;
  setRole(b.dataset.v);
  toast(S.role === 'reviewer' ? 'Роль: проверяющий. Можно принимать решения по апелляциям' : 'Роль: оценщик. Можно подавать апелляции');
});

// state changes from this tab re-render the current view; the busy pill updates on its own
on('change', () => { if (loaded && !$('#app').hidden) route({ keepScroll: true }); });
on('role', () => { if (loaded && !$('#app').hidden) route({ keepScroll: true }); });
on('busy', (b) => renderBusy(b));
// another tab (e.g. /prototype) wrote the shared state
addEventListener('storage', (e) => {
  if (e.key !== LS_KEY || !loaded || $('#app').hidden || document.getElementById('drawer')) return;
  if (document.activeElement?.matches?.('input, textarea, select')) { refresh(); renderNav(); return; }
  route({ keepScroll: true });
});
live.subscribe(() => { if (loaded && !$('#app').hidden) renderNav(); });

(async () => { if (await auth.validate()) enterApp(); else { auth.setToken(''); showLogin(''); } })();
