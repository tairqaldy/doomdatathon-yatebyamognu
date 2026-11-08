// Диалоги: every evaluated dialog with search and simple filters. "Грубые ошибки" switches to a list that shows,
// for every dialog with a gross-error flag, the AI explanation and the evidence line.
import { $, esc, fmt, fix, plural, icon, LANG, CHAN, TIER_LABEL, tierVar, setHead, seg } from './ui.js';
import { rows, hrefFor, reasonOf, grossOf, checklistOf, isCall, offsetSec, mmss, sortRows } from './store.js';
import * as live from '/shared/live-store.js';

const KEY = 'cqa-admin-dialog-filters-v2';
const EMPTY = { q: '', lang: '', channel: '', band: '', crit: '', range: '', gross: '', sort: 'order' };
const loadF = () => { try { return { ...EMPTY, ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch { return { ...EMPTY }; } };
// The gross-error list is a mode reached by link (#/dialogs?gross=1), not a sticky filter: it lives in the URL only,
// so opening «Диалоги» from the menu shows every dialog again.
const saveF = (f) => { try { sessionStorage.setItem(KEY, JSON.stringify({ ...f, gross: '' })); } catch {} };
const SORTS = { order: 'По порядку', 'order-desc': 'В обратном порядке', low: 'Балл ↑ (сначала низкие)', high: 'Балл ↓ (сначала высокие)', lang: 'По языку', channel: 'По каналу' };
/** Sort button for a column header: asc/desc sort keys (desc optional); returns the button and its aria-sort state.
 *  A second click flips the direction, or goes back to the original order when the column has one direction. */
const sortBtn = (label, asc, desc, cur) => {
  const dir = cur === asc ? 'ascending' : desc && cur === desc ? 'descending' : 'none';
  const next = dir === 'ascending' ? (desc || 'order') : dir === 'descending' ? asc : asc === 'low' ? 'high' : asc;
  return { dir, html: `<button type="button" class="th-sort ${dir !== 'none' ? 'is-on' : ''}" data-sort="${next}">${esc(label)}<span class="th-sort__ic" aria-hidden="true">${dir === 'ascending' ? '↑' : dir === 'descending' ? '↓' : '↕'}</span></button>` };
};
const thSort = (btns, cls = '') => {
  const dir = btns.find((b) => b.dir !== 'none')?.dir || 'none';
  return `<th scope="col" class="${cls}" aria-sort="${dir}">${btns.map((b) => b.html).join('<span class="th-sort__sep" aria-hidden="true">·</span>')}</th>`;
};

const chanCell = (r) => `<span class="chan">${icon(r.channel === 'call' ? 'phone' : 'chat')}${CHAN[r.channel]}</span>`;
// exactly 2 decimals so the right-aligned column lines up (92,31 · 70,00 · 57,50), as totals are rounded in results.json
const scorePill = (r) => (r.total == null
  ? '<span class="score-pill" style="--c:var(--ink-4)" title="Итог не рассчитан: нет применимых критериев с весом">—</span>'
  : `<span class="score-pill" style="--c:${tierVar(r.tier)}">${fix(r.total, 2)}</span>`);
const evLine = (E, a) => {
  const e = (a.evidence || []).find((x) => x.kind === 'message' || x.kind === 'range');
  if (!e) return null;
  const i = e.kind === 'message' ? e.turn_index : e.range[0];
  const m = E.conv.transcript[i]; if (!m) return null;
  return { i, time: isCall(E.conv) ? mmss(offsetSec(E.conv, i)) : m.timestamp, text: e.quote || m.text, speaker: m.speaker };
};

export function viewDialogs(view, _arg, query) {
  const fromQuery = [...query.keys()].length > 0;
  const f = fromQuery ? { ...EMPTY, ...Object.fromEntries([...query.entries()].filter(([k]) => k in EMPTY)) } : loadF();
  if (fromQuery) saveF(f);
  const cl = checklistOf('chat'); const cc = checklistOf('call');
  const critTitle = (id) => cl.criteria.find((c) => c.id === id)?.title || cc.criteria.find((c) => c.id === id)?.title || id;

  const filtered = () => {
    const q = f.q.trim().toLowerCase();
    const [rf, rt] = f.range ? f.range.split('-').map(Number) : [null, null];
    let list = rows().filter((r) => (!f.lang || r.language === f.lang) && (!f.channel || r.channel === f.channel)
      && (!f.band || r.tier === f.band) && (!f.gross || r.gross)
      && (!f.crit || r.dd.some((d) => d.c.id === f.crit))
      && (rf == null || (r.total != null && r.total >= rf && (rt >= 100 ? r.total <= 100 : r.total < rt)))
      && (!q || r.id.toLowerCase().includes(q) || (r.E.summary?.reason || '').toLowerCase().includes(q)
        || r.dd.some((d) => reasonOf(r.E, d.c).toLowerCase().includes(q)) || r.conv.transcript.some((m) => String(m.text).toLowerCase().includes(q))));
    return sortRows(list, SORTS[f.sort] ? f.sort : 'order');
  };

  const syncUrl = () => {
    const p = new URLSearchParams(Object.entries(f).filter(([k, v]) => v && !(k === 'sort' && v === 'order')));
    history.replaceState(null, '', `#/dialogs${p.toString() ? `?${p}` : ''}`);
    saveF(f);
  };

  const all = rows();
  const grossCount = all.filter((r) => r.gross).length;
  view.innerHTML = `
    <form class="toolbar" role="search" aria-label="Фильтры диалогов" onsubmit="return false">
      <label class="search">${icon('search')}<span class="sr-only">Поиск</span><input class="input" id="f-q" type="search" placeholder="ID, причина, текст реплики" value="${esc(f.q)}" autocomplete="off"></label>
      ${seg('f-lang', [{ v: '', label: 'Все языки' }, ...Object.keys(LANG).map((k) => ({ v: k, label: k }))], f.lang, 'Язык')}
      ${seg('f-channel', [{ v: '', label: 'Все каналы' }, { v: 'chat', label: 'Чаты' }, { v: 'call', label: 'Звонки' }], f.channel, 'Канал')}
      <label class="select"><span class="sr-only">Балл</span><select id="f-band"><option value="">Любой балл</option>${Object.entries(TIER_LABEL).map(([k, v]) => `<option value="${k}" ${f.band === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
      <button type="button" class="chip-toggle chip-toggle--bad" id="f-gross" aria-pressed="${!!f.gross}">${icon('alert')}Грубые ошибки <b class="num">${grossCount}</b></button>
      <label class="select select--sort"><span class="sr-only">Порядок</span><select id="f-sort">${Object.entries(SORTS).map(([k, v]) => `<option value="${k}" ${f.sort === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
    </form>
    <div class="filter-line"><span class="count" id="d-count" aria-live="polite"></span><span id="d-active"></span><a class="btn btn--s filter-line__add" href="#/import">${icon('upload')}Загрузить диалог</a></div>
    <div id="d-body"></div>`;

  const draw = () => {
    const list = filtered();
    const n = list.length;
    setHead('Диалоги', f.gross ? 'Диалоги с грубыми ошибками: причина и реплика-доказательство' : `${all.length} ${plural(all.length, ['диалог', 'диалога', 'диалогов'])} · чек-листы: чаты v${cl.version}, звонки v${cc.version}`);
    $('#d-count', view).textContent = `${n} ${plural(n, ['диалог', 'диалога', 'диалогов'])}`;
    const act = [];
    if (f.crit) act.push(`<button type="button" class="chip-x" data-clear="crit">Снижение: ${esc(critTitle(f.crit))} ${icon('x')}</button>`);
    if (f.range) act.push(`<button type="button" class="chip-x" data-clear="range">Баллы ${esc(f.range.replace('-', '–'))} ${icon('x')}</button>`);
    if (Object.entries(f).some(([k, v]) => v && k !== 'sort')) act.push('<button type="button" class="link" data-clear="all">Сбросить фильтры</button>');
    $('#d-active', view).innerHTML = act.join('');
    $('#d-body', view).innerHTML = !n ? '<div class="empty empty--s"><p>Ничего не найдено. Измените фильтры.</p></div>' : f.gross ? grossList(list) : table(list);
  };

  const table = (list) => `<div class="table-wrap"><table class="table">
    <caption class="sr-only">Оценённые диалоги</caption>
    <thead><tr>${thSort([sortBtn('Диалог', 'order', 'order-desc', f.sort), sortBtn('Язык', 'lang', null, f.sort)])}${thSort([sortBtn('Канал', 'channel', null, f.sort)])}<th scope="col">Главная причина снижения</th><th scope="col">Статус</th>${thSort([sortBtn('Итог', 'low', 'high', f.sort)], 'num-col')}</tr></thead>
    <tbody>${list.map((r) => {
      const d = r.main; const open = r.E.appeals.some((a) => a.status === 'open'); const decided = r.E.appeals.some((a) => a.status !== 'open');
      return `<tr data-href="${hrefFor(r)}">
        <td class="td-id"><a class="mono" href="${hrefFor(r)}">${esc(r.id)}</a><span class="lang">${esc(r.language)}</span><span class="td-sub">${esc(r.E.summary?.reason || '')}</span></td>
        <td class="td-chan">${chanCell(r)}</td>
        <td class="td-reason">${d ? `<b>${esc(d.c.title)}</b>${d.gross ? '' : ` <span class="loss num">−${fmt(d.lost, 2)}</span>`}<span class="td-sub">${esc(reasonOf(r.E, d.c))}</span>` : '<span class="muted">Без снижений</span>'}</td>
        <td class="td-status">${r.gross ? '<span class="l-chip l-chip--bad">Грубая ошибка</span>' : ''}${open ? '<span class="l-chip l-chip--warn">Апелляция</span>' : ''}${decided ? '<span class="l-chip l-chip--info">Пересмотрено</span>' : ''}${r.source === 'live' ? '<span class="l-chip">Живой чат</span>' : ''}${r.source === 'import' ? '<span class="l-chip l-chip--info">Загружен</span>' : ''}${r.E.src !== 'ai' ? '<span class="l-chip">Без AI</span>' : r.E.base.partial ? '<span class="l-chip" title="Новые критерии чек-листа AI ещё не оценил, остальные ответы перенесены">Не все критерии</span>' : ''}</td>
        <td class="num-col">${scorePill(r)}</td></tr>`;
    }).join('')}</tbody></table></div>`;

  const grossList = (list) => `<ol class="gross-list">${list.map((r) => {
    const g = grossOf(r.E); const a = g?.a || {}; const ev = evLine(r.E, a);
    const href = `${hrefFor(r)}${ev && r.source !== 'live' ? `?m=${ev.i}` : ''}`;
    return `<li class="card gross">
      <header class="gross__head">
        <a class="mono gross__id" href="${hrefFor(r)}">${esc(r.id)}</a><span class="lang">${esc(r.language)}</span>${chanCell(r)}
        <span class="gross__crit">${esc(g?.c.title || 'Грубая ошибка')}</span>
        <span class="gross__score">${scorePill(r)}</span>
      </header>
      <div class="gross__why"><span class="kicker">Почему</span><p>${esc(a.deduction_reason || a.explanation || 'AI не дал пояснения')}</p></div>
      ${ev ? `<a class="evidence" href="${href}"><span class="evidence__meta mono">#${ev.i} · ${esc(ev.time)} · ${esc({ operator: 'Оператор', client: 'Клиент', bot: 'Бот', system: 'Система' }[ev.speaker] || ev.speaker)}</span><q>${esc(ev.text)}</q></a>` : '<p class="muted small">Реплика не указана.</p>'}
      <div class="gross__foot"><a class="btn btn--s" href="${href}">Открыть анализ ${icon('arrow')}</a></div>
    </li>`; }).join('')}</ol>`;

  draw();

  const tb = view.querySelector('.toolbar');
  tb.addEventListener('input', (e) => { if (e.target.id === 'f-q') { f.q = e.target.value; syncUrl(); draw(); } });
  tb.addEventListener('change', (e) => {
    // the search box already filters on 'input'; its 'change' fires on blur, i.e. on the mousedown of the click the
    // user is making on a result, and a redraw there swallows that click
    if (e.target.id === 'f-q') return;
    if (e.target.id === 'f-band') f.band = e.target.value;
    if (e.target.id === 'f-sort') f.sort = e.target.value;
    syncUrl(); draw();
  });
  tb.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const group = b.closest('.seg');
    if (group) { const k = group.id === 'f-lang' ? 'lang' : 'channel'; f[k] = b.dataset.v; group.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); }
    if (b.id === 'f-gross') { f.gross = f.gross ? '' : '1'; b.setAttribute('aria-pressed', String(!!f.gross)); }
    syncUrl(); draw();
  });
  $('#d-active', view).addEventListener('click', (e) => {
    const b = e.target.closest('[data-clear]'); if (!b) return;
    if (b.dataset.clear === 'all') { saveF({ ...EMPTY }); location.hash = '#/dialogs?sort=order'; return; }
    f[b.dataset.clear] = ''; syncUrl(); draw();
  });
  $('#d-body', view).addEventListener('click', (e) => {
    const sb = e.target.closest('[data-sort]');
    if (sb) {
      f.sort = sb.dataset.sort; const sel = $('#f-sort', view); if (sel) sel.value = f.sort;
      syncUrl(); draw(); view.querySelector(".th-sort.is-on")?.focus(); return;
    }
    if (e.target.closest('a, button')) return;
    const tr = e.target.closest('tr[data-href]'); if (tr) location.hash = tr.dataset.href;
  });
  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(draw, 300); });
  return () => { off(); clearTimeout(t); };
}
