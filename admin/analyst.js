// AI-аналитик: the admin asks about aggregated QA data (POST /api/insights). History lives in sessionStorage.
// States: empty (what it sees + example questions) → pending (skeleton + timer) → answer (lead, numbers, actions) / error.
import { $, esc, fmt, icon, setHead, reduced } from './ui.js';
import { compute, statsForAI } from './store.js';
import { api } from './auth.js';

const KEY = 'cqa-admin-analyst';
const SUGGESTED = [
  'Где мы теряем больше всего баллов и что исправить первым?',
  'Чем отличаются оценки по языкам и каналам?',
  'Какие формулировки операторов чаще всего снижают оценку?',
  'Что поменять в боте, чтобы реже передавать оператору?',
];
const load = () => { try { const h = JSON.parse(sessionStorage.getItem(KEY) || '[]'); return Array.isArray(h) ? h.filter((x) => x && x.q) : []; } catch { return []; } };
const save = (h) => { try { sessionStorage.setItem(KEY, JSON.stringify(h.filter((x) => !x.pending).slice(-20))); } catch {} };
const list = (a) => (Array.isArray(a) ? a.filter((x) => x != null && x !== '') : []);
const chips = (qs, label) => `<div class="chips" aria-label="${esc(label)}">${qs.map((q) => `<button class="chip-btn" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
let busy = false;

function answerHTML(item, i) {
  const q = `<header class="qa__head"><span class="qa__ic" aria-hidden="true">${icon('chat')}</span><p class="qa__q" id="qa-q-${i}">${esc(item.q)}</p></header>`;
  if (item.pending) return `<article class="qa card" aria-busy="true" aria-labelledby="qa-q-${i}">${q}
    <div class="qa__a"><span class="qa__wait"><span class="spinner" aria-hidden="true"></span>Аналитик изучает сводные данные · <span class="num" data-wait="${item.at}">0</span> с</span><span class="skel" style="width:92%"></span><span class="skel" style="width:78%"></span><span class="skel" style="width:46%"></span></div></article>`;
  if (item.error) return `<article class="qa card qa--error" aria-labelledby="qa-q-${i}">${q}<div class="qa__a"><div class="banner banner--bad">${icon('alert')}<div><b>Аналитик не ответил</b><p>${esc(item.error)}</p></div></div><button class="btn btn--s" type="button" data-ask="${esc(item.q)}">${icon('refresh')}Повторить</button></div></article>`;
  const r = item.res || {};
  const actions = list(r.actions).filter((a) => typeof a === 'object');
  return `<article class="qa card" aria-labelledby="qa-q-${i}">${q}
    <div class="qa__a">
      <p class="qa__answer">${esc(r.answer || 'Ответ пустой.')}</p>
      ${list(r.findings).length ? `<section><h3 class="kicker">Цифры</h3><ul class="findings">${list(r.findings).map((f) => `<li>${esc(f)}</li>`).join('')}</ul></section>` : ''}
      ${actions.length ? `<section><h3 class="kicker">Что сделать</h3><div class="actions">${actions.map((a, k) => `<div class="action"><span class="action__n num">${k + 1}</span><div><b>${esc(a.title)}</b><p>${esc(a.detail)}</p>${a.impact ? `<p class="action__fx">${esc(a.impact)}</p>` : ''}</div></div>`).join('')}</div></section>` : ''}
      ${list(r.risks).length ? `<details class="qa__risks"><summary>Ограничения данных · ${list(r.risks).length}</summary><ul class="risks">${list(r.risks).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></details>` : ''}
      ${list(r.follow_up_questions).length ? `<section><h3 class="kicker">Спросить дальше</h3>${chips(list(r.follow_up_questions), 'Следующие вопросы')}</section>` : ''}
      <p class="qa__meta">${esc(String(r.model || '').replace('openai:', ''))} · ${fmt((item.ms || r.latency_ms || 0) / 1000, 1)} с${r.cached ? ' · из кэша' : r.usage?.cost ? ` · $${Number(r.usage.cost).toFixed(4)}` : ''} · ${esc(new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</p>
    </div></article>`;
}

export function viewAnalyst(view) {
  setHead('AI-аналитик', 'Вопросы к сводным цифрам оценки. Тексты диалогов не передаются');
  const hist = load();
  view.innerHTML = `
    <div class="analyst">
      <section class="card analyst__intro" id="a-intro">
        <span class="empty__ic" aria-hidden="true">${icon('analyst')}</span>
        <div class="analyst__lead"><h2>Спросите о результатах контроля качества</h2><p class="muted">Аналитик видит только сводные цифры: баллы, потери по критериям, языки, каналы, причины снижения, живые чаты, апелляции.</p></div>
        ${chips(SUGGESTED, 'Примеры вопросов')}
      </section>
      <div class="thread" id="a-thread" aria-live="polite"></div>
      <form class="ask card" id="a-form">
        <label class="sr-only" for="a-q">Вопрос аналитику</label>
        <textarea id="a-q" class="input" rows="2" maxlength="600" placeholder="Например: какие критерии стоит пересмотреть в чек-листе?"></textarea>
        <div class="ask__row">
          <details class="ask__data"><summary>Какие данные получит аналитик</summary><pre id="a-stats"></pre></details>
          <div class="btn-row"><button class="btn btn--s btn--ghost" type="button" id="a-clear" ${hist.length ? '' : 'hidden'}>Очистить</button><button class="btn btn--s btn--primary" type="submit" id="a-send">Спросить ${icon('arrow')}</button></div>
        </div>
      </form>
    </div>`;

  const draw = () => {
    $('#a-thread', view).innerHTML = hist.map(answerHTML).join('');
    $('#a-intro', view).hidden = hist.length > 0;
    $('#a-clear', view).hidden = !hist.length || busy;
    const send = $('#a-send', view); send.disabled = busy; send.setAttribute('aria-busy', String(busy));
  };
  draw();
  $('#a-stats', view).textContent = JSON.stringify(statsForAI(compute()), null, 2);
  const toLast = () => $('#a-thread', view).lastElementChild?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
  const tick = setInterval(() => view.querySelectorAll('[data-wait]').forEach((el) => { el.textContent = String(Math.round((Date.now() - Number(el.dataset.wait)) / 1000)); }), 500);

  const ask = async (q) => {
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true;
    const item = { q, at: Date.now(), pending: true };
    hist.push(item); draw(); toLast();
    const t0 = performance.now();
    try {
      const res = await api('/api/insights', { question: q, stats: statsForAI(compute()) });
      Object.assign(item, { pending: false, res, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if (e.status === 401) { busy = false; hist.pop(); return; }
      Object.assign(item, { pending: false, error: `${e.message}. Попробуйте ещё раз.` });
    }
    busy = false; save(hist);
    if (!view.isConnected) return;
    draw(); toLast();
  };

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ask]'); if (b) { ask(b.dataset.ask); return; }
    if (e.target.closest('#a-clear')) { hist.length = 0; save(hist); draw(); $('#a-q', view).focus(); }
  });
  $('#a-form', view).addEventListener('submit', (e) => { e.preventDefault(); const ta = $('#a-q', view); const q = ta.value; ta.value = ''; ask(q); });
  $('#a-q', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#a-form', view).requestSubmit(); } });
  return () => clearInterval(tick);
}
