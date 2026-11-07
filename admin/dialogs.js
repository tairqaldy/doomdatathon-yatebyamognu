// Диалоги: every evaluated dialog (DEV + live), filters, search; DEV opens the deep workspace, live opens the console.
import { $, esc, fmt, plural, LANG, CHAN, tierColor, icon } from './ui.js';
import { rows, critById, hrefFor } from './data.js';
import * as live from '/shared/live-store.js';

const KEY = 'cqa-admin-dialog-filters';
const load = () => { try { return { lang: '', channel: '', band: '', q: '', sort: 'total-asc', ...JSON.parse(sessionStorage.getItem(KEY) || '{}') }; } catch { return { lang: '', channel: '', band: '', q: '', sort: 'total-asc' }; } };
const save = (f) => { try { sessionStorage.setItem(KEY, JSON.stringify(f)); } catch {} };
const BANDS = { high: '85 и выше', mid: '60–84', low: 'ниже 60', gross: 'Грубая ошибка' };

export function viewDialogs(view) {
  const f = load();
  view.innerHTML = `
    <section class="panel panel--flush">
      <form class="filters" role="search" aria-label="Фильтры диалогов" onsubmit="return false">
        <label class="search">${icon('search')}<span class="sr-only">Поиск</span><input class="input" id="f-q" type="search" placeholder="ID, причина снижения, текст" value="${esc(f.q)}"></label>
        <label class="select"><span class="g-label">Язык</span><select id="f-lang"><option value="">Все</option>${Object.entries(LANG).map(([k, v]) => `<option value="${k}" ${f.lang === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="select"><span class="g-label">Канал</span><select id="f-channel"><option value="">Все</option>${Object.entries(CHAN).map(([k, v]) => `<option value="${k}" ${f.channel === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="select"><span class="g-label">Балл</span><select id="f-band"><option value="">Любой</option>${Object.entries(BANDS).map(([k, v]) => `<option value="${k}" ${f.band === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
        <label class="select"><span class="g-label">Порядок</span><select id="f-sort">
          <option value="total-asc" ${f.sort === 'total-asc' ? 'selected' : ''}>Сначала низкие</option>
          <option value="total-desc" ${f.sort === 'total-desc' ? 'selected' : ''}>Сначала высокие</option>
          <option value="id" ${f.sort === 'id' ? 'selected' : ''}>По ID</option></select></label>
      </form>
      <div class="count g-label" id="d-count" aria-live="polite"></div>
      <div class="table-wrap"><table class="table" id="d-table">
        <caption class="sr-only">Оценённые диалоги</caption>
        <thead><tr><th scope="col">ID</th><th scope="col">Язык</th><th scope="col">Канал</th><th scope="col" class="num">Итог</th><th scope="col">Главная причина снижения</th><th scope="col">Источник</th></tr></thead>
        <tbody id="d-body"></tbody>
      </table></div>
    </section>`;

  const draw = () => {
    const q = f.q.trim().toLowerCase();
    let list = rows().filter((r) => (!f.lang || r.language === f.lang) && (!f.channel || r.channel === f.channel)
      && (!f.band || (f.band === 'gross' ? r.gross : r.tier === f.band))
      && (!q || r.id.toLowerCase().includes(q) || r.losses.some((l) => l.reason.toLowerCase().includes(q)) || (r.main?.reason || '').toLowerCase().includes(q)
        || (r.res.summary?.reason || '').toLowerCase().includes(q) || (r.transcript || []).some((m) => String(m.text).toLowerCase().includes(q))));
    const tv = (r) => (r.total == null ? -1 : r.total);
    list.sort(f.sort === 'id' ? (a, b) => a.id.localeCompare(b.id) : f.sort === 'total-desc' ? (a, b) => tv(b) - tv(a) : (a, b) => tv(a) - tv(b));
    $('#d-count', view).textContent = `${list.length} ${plural(list.length, ['диалог', 'диалога', 'диалогов'])}`;
    $('#d-body', view).innerHTML = list.length ? list.map((r) => `
      <tr data-href="${hrefFor(r.id, r.source)}">
        <td><a class="mono" href="${hrefFor(r.id, r.source)}">${esc(r.id)}</a></td>
        <td><span class="chip">${esc(r.language)}</span></td>
        <td>${esc(CHAN[r.channel])}</td>
        <td class="num"><span class="score" style="--c:${tierColor(r.tier)}">${r.total == null ? '—' : fmt(r.total, 2)}</span>${r.gross ? '<span class="gross" title="Грубая ошибка">' + icon('flag') + '<span class="sr-only">грубая ошибка</span></span>' : ''}</td>
        <td class="reason">${r.main ? `<span class="g-label">${esc(critById(r.main.id)?.title || r.main.id)}</span>${esc(r.main.reason || '—')}` : '<span class="g-muted">Без снижений</span>'}</td>
        <td><span class="chip ${r.source === 'live' ? 'chip--live' : ''}">${r.source === 'live' ? 'живой' : 'DEV'}</span></td>
      </tr>`).join('') : '<tr><td colspan="6" class="empty-row">Ничего не найдено. Измените фильтры.</td></tr>';
  };
  draw();

  const onChange = () => { f.q = $('#f-q', view).value; f.lang = $('#f-lang', view).value; f.channel = $('#f-channel', view).value; f.band = $('#f-band', view).value; f.sort = $('#f-sort', view).value; save(f); draw(); };
  view.querySelector('.filters').addEventListener('input', onChange);
  view.querySelector('.filters').addEventListener('change', onChange);
  $('#d-body', view).addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    const tr = e.target.closest('tr[data-href]'); if (tr) location.href = tr.dataset.href;
  });
  const off = live.subscribe(() => draw());
  return off;
}
