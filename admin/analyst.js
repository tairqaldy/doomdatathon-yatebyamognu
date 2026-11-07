// AI-аналитик: the admin asks about aggregated QA data (POST /api/insights). History lives in sessionStorage.
import { $, esc, fmt, icon, setHead } from './ui.js';
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
let busy = false;

function answerHTML(item, i) {
  if (item.pending) return `<article class="qa card" aria-busy="true"><p class="qa__q">${esc(item.q)}</p>
    <div class="qa__a"><span class="kicker">Аналитик изучает данные</span><span class="skel" style="width:92%"></span><span class="skel" style="width:78%"></span><span class="skel" style="width:46%"></span></div></article>`;
  if (item.error) return `<article class="qa card"><p class="qa__q">${esc(item.q)}</p><div class="qa__a"><p class="field__err" role="alert">${esc(item.error)}</p><button class="btn btn--s" type="button" data-ask="${esc(item.q)}">Повторить</button></div></article>`;
  const r = item.res || {};
  const actions = list(r.actions).filter((a) => typeof a === 'object');
  return `<article class="qa card" aria-labelledby="qa-q-${i}">
    <p class="qa__q" id="qa-q-${i}">${esc(item.q)}</p>
    <div class="qa__a">
      <p class="qa__answer">${esc(r.answer || 'Ответ пустой.')}</p>
      ${list(r.findings).length ? `<section><h3 class="kicker">Наблюдения</h3><ol class="findings">${list(r.findings).map((f) => `<li>${esc(f)}</li>`).join('')}</ol></section>` : ''}
      ${actions.length ? `<section><h3 class="kicker">Что сделать</h3><div class="actions">${actions.map((a, k) => `<div class="action"><span class="action__n num">${k + 1}</span><div><b>${esc(a.title)}</b><p>${esc(a.detail)}</p>${a.impact ? `<p class="muted small">Эффект: ${esc(a.impact)}</p>` : ''}</div></div>`).join('')}</div></section>` : ''}
      ${list(r.risks).length ? `<section><h3 class="kicker">Ограничения данных</h3><ul class="risks">${list(r.risks).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      ${list(r.follow_up_questions).length ? `<section><h3 class="kicker">Спросить дальше</h3><div class="chips">${list(r.follow_up_questions).map((q) => `<button class="chip-btn" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div></section>` : ''}
      <p class="qa__meta mono">${esc(String(r.model || '').replace('openai:', ''))} · ${fmt((item.ms || r.latency_ms || 0) / 1000, 1)} с${r.usage?.cost ? ` · $${Number(r.usage.cost).toFixed(4)}` : ''} · ${esc(new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</p>
    </div></article>`;
}

export function viewAnalyst(view) {
  setHead('AI-аналитик', 'Вопросы к сводным данным оценки. Тексты диалогов не передаются');
  const hist = load();
  view.innerHTML = `
    <div class="analyst">
      <section class="card analyst__intro">
        <p>Аналитик видит только сводные цифры: средние баллы, потери по критериям, языки, каналы, частые причины снижения, живые чаты и апелляции.</p>
        <div class="chips" aria-label="Примеры вопросов">${SUGGESTED.map((q) => `<button class="chip-btn" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>
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
    $('#a-clear', view).hidden = !hist.length;
    $('#a-send', view).disabled = busy;
  };
  draw();
  $('#a-stats', view).textContent = JSON.stringify(statsForAI(compute()), null, 2);

  const ask = async (q) => {
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true;
    const item = { q, at: Date.now(), pending: true };
    hist.push(item); draw();
    $('#a-thread', view).lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const t0 = performance.now();
    try {
      const res = await api('/api/insights', { question: q, stats: statsForAI(compute()) });
      Object.assign(item, { pending: false, res, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if (e.status === 401) { busy = false; hist.pop(); return; }
      Object.assign(item, { pending: false, error: `Аналитик не ответил: ${e.message}` });
    }
    busy = false; save(hist);
    if (!view.isConnected) return;
    draw();
    $('#a-thread', view).lastElementChild?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  view.addEventListener('click', (e) => {
    const b = e.target.closest('[data-ask]'); if (b) { ask(b.dataset.ask); return; }
    if (e.target.closest('#a-clear')) { hist.length = 0; save(hist); draw(); }
  });
  $('#a-form', view).addEventListener('submit', (e) => { e.preventDefault(); const ta = $('#a-q', view); const q = ta.value; ta.value = ''; ask(q); });
  $('#a-q', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#a-form', view).requestSubmit(); } });
}
