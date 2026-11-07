// Freedom CQA admin console: login gate, shell, hash router.
import { $, $$, esc, icon } from './ui.js';
import * as auth from './auth.js';
import { loadAll, evalMeta, modelLabel } from './data.js';
import * as live from '/shared/live-store.js';
import { viewOverview } from './overview.js';
import { viewLive } from './live.js';
import { viewDialogs } from './dialogs.js';
import { viewAnalyst } from './analyst.js';

const ROUTES = {
  overview: { title: 'Обзор', crumb: 'Аналитика качества', render: viewOverview },
  live: { title: 'Живые диалоги', crumb: 'Консоль оператора', render: viewLive },
  dialogs: { title: 'Диалоги', crumb: 'Все оценённые разговоры', render: viewDialogs },
  analyst: { title: 'AI-аналитик', crumb: 'Вопросы к данным', render: viewAnalyst },
};
const NAV = [
  { id: 'overview', label: 'Обзор', short: 'Обзор' },
  { id: 'live', label: 'Живые диалоги', short: 'Живые' },
  { id: 'dialogs', label: 'Диалоги', short: 'Диалоги' },
  { id: 'analyst', label: 'AI-аналитик', short: 'Аналитик' },
];

let loaded = false;
let cleanup = null;

function renderNav(active) {
  const waiting = live.all().filter((s) => s.status === 'waiting_operator').length;
  $('#nav').innerHTML = NAV.map((n) => `
    <a class="rail__item" href="#/${n.id}" ${active === n.id ? 'aria-current="page"' : ''} title="${esc(n.label)}">
      ${icon(n.id)}<span class="rail__text"><span class="rail__long">${esc(n.label)}</span><span class="rail__short">${esc(n.short)}</span></span>
      ${n.id === 'live' && waiting ? `<span class="rail__badge" aria-label="${waiting} ждут оператора"><span class="pulse" aria-hidden="true"></span>${waiting}</span>` : ''}
    </a>`).join('') + `
    <a class="rail__item" href="/prototype/#/dialogs" title="Рабочее место: анализ, апелляции, чек-лист">
      ${icon('workspace')}<span class="rail__text"><span class="rail__long">Рабочее место</span><span class="rail__short">Работа</span></span>
    </a>`;
}

async function route() {
  if (!loaded) return;
  const [page = 'overview', ...rest] = location.hash.replace(/^#\/?/, '').split('/');
  const r = ROUTES[page] || ROUTES.overview;
  const id = ROUTES[page] ? page : 'overview';
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  renderNav(id);
  $('#page-title').textContent = r.title;
  $('#crumb').textContent = `Администратор / ${r.crumb}`;
  document.title = `${r.title} · Freedom CQA`;
  const view = $('#view');
  view.innerHTML = '';
  view.className = `view view--${id}`;
  cleanup = r.render(view, decodeURIComponent(rest.join('/'))) || null;
}

async function enterApp() {
  $('#login').hidden = true; $('#app').hidden = false;
  if (!loaded) {
    $('#view').innerHTML = '<div class="loading"><span class="shimmer" style="width:40%"></span><span class="shimmer" style="width:70%"></span><span class="shimmer" style="width:55%"></span></div>';
    try { await loadAll(); } catch (e) { $('#view').innerHTML = `<div class="empty"><h2 class="g-display">Не удалось загрузить данные</h2><p class="g-muted">${esc(e.message)}</p></div>`; return; }
    loaded = true;
    const m = evalMeta();
    $('#source-text').textContent = `${modelLabel(m.model)} · ${Object.keys(m.results).length} диалогов`;
  }
  if (!location.hash) history.replaceState(null, '', '#/overview');
  route();
}

function showLogin(reason = '') {
  if (cleanup) { try { cleanup(); } catch {} cleanup = null; }
  $('#app').hidden = true; $('#login').hidden = false;
  $('#login-err').textContent = reason;
  $('#login-pass').value = '';
  setTimeout(() => $('#login-pass').focus(), 30);
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
addEventListener('hashchange', () => { if (!$('#app').hidden) { route(); $('#view').focus({ preventScroll: true }); scrollTo(0, 0); } });
live.subscribe(() => { if (loaded && !$('#app').hidden) renderNav((location.hash.replace(/^#\/?/, '').split('/')[0]) || 'overview'); });

(async () => { if (await auth.validate()) enterApp(); else { auth.setToken(''); showLogin(''); } })();
