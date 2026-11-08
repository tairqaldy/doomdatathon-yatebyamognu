// AI-аналитик: a chat over aggregated QA data (POST /api/insights). History lives in sessionStorage.
// Question bubbles on the right, answer cards on the left (Вывод · Что делать · Риски), input bar pinned at the bottom.
import { $, esc, fmt, icon, setHead, reduced, toast } from './ui.js';
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
const chips = (qs, cls = '') => `<div class="chips ${cls}">${qs.map((q) => `<button class="chip-btn" type="button" data-ask="${esc(q)}">${esc(q)}</button>`).join('')}</div>`;
let busy = false;

/** Plain text of an answer for the copy button. */
function plain(r) {
  const acts = list(r.actions).filter((a) => typeof a === 'object');
  return [r.answer, ...list(r.findings).map((f) => `• ${f}`),
    acts.length ? `\nЧто делать:\n${acts.map((a, k) => `${k + 1}. ${a.title}: ${a.detail}${a.impact ? ` (${a.impact})` : ''}`).join('\n')}` : '',
    list(r.risks).length ? `\nРиски:\n${list(r.risks).map((x) => `• ${x}`).join('\n')}` : ''].filter(Boolean).join('\n');
}

function itemHTML(item, i) {
  const q = `<div class="ai-q"><p class="ai-q__bubble">${esc(item.q)}</p></div>`;
  const who = `<span class="ai-a__who"><span class="ai-a__ic" aria-hidden="true">${icon('analyst')}</span>AI-аналитик</span>`;
  if (item.pending) return `${q}<article class="ai-a" aria-busy="true"><header class="ai-a__head">${who}</header><p class="ai-typing" role="status"><span class="sr-only">Аналитик печатает</span><i></i><i></i><i></i><span class="ai-typing__t num" data-wait="${item.at}">0 с</span></p></article>`;
  if (item.error) return `${q}<article class="ai-a ai-a--error"><header class="ai-a__head">${who}</header><p class="ai-a__err">${esc(item.error)}</p><button class="btn btn--s" type="button" data-ask="${esc(item.q)}">${icon('refresh')}Повторить</button></article>`;
  const r = item.res || {};
  const acts = list(r.actions).filter((a) => typeof a === 'object');
  return `${q}<article class="ai-a" aria-label="Ответ на вопрос: ${esc(item.q)}">
    <header class="ai-a__head">${who}<button class="icon-btn ai-a__copy" type="button" data-copy="${i}" aria-label="Скопировать ответ" title="Скопировать">${icon('copy')}</button></header>
    <section class="ai-sec"><h3 class="ai-sec__t">Вывод</h3><p class="ai-a__lead">${esc(r.answer || 'Ответ пустой.')}</p>${list(r.findings).length ? `<ul class="ai-facts">${list(r.findings).map((f) => `<li>${esc(f)}</li>`).join('')}</ul>` : ''}</section>
    ${acts.length ? `<section class="ai-sec"><h3 class="ai-sec__t">Что делать</h3><ol class="ai-acts">${acts.map((a) => `<li><b>${esc(a.title)}</b><span>${esc(a.detail)}</span>${a.impact ? `<span class="ai-acts__fx">${esc(a.impact)}</span>` : ''}</li>`).join('')}</ol></section>` : ''}
    ${list(r.risks).length ? `<section class="ai-sec"><h3 class="ai-sec__t">Риски</h3><ul class="ai-risks">${list(r.risks).map((x) => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
    ${list(r.follow_up_questions).length ? chips(list(r.follow_up_questions), 'ai-follow') : ''}
    <p class="ai-a__meta">${esc(String(r.model || '').replace('openai:', ''))} · ${fmt((item.ms || r.latency_ms || 0) / 1000, 1)} с${r.cached ? ' · из кэша' : r.usage?.cost ? ` · $${Number(r.usage.cost).toFixed(4)}` : ''} · ${esc(new Date(item.at).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }))}</p>
  </article>`;
}

export function viewAnalyst(view) {
  setHead('AI-аналитик', 'Вопросы к сводным цифрам оценки');
  const hist = load();
  view.innerHTML = `
    <div class="ai-chat">
      <div class="ai-log" id="a-log" aria-live="polite"></div>
      <form class="ai-bar" id="a-form">
        <div id="a-chips"></div>
        <div class="ai-bar__row">
          <label class="sr-only" for="a-q">Вопрос аналитику</label>
          <textarea id="a-q" class="input ai-bar__input" rows="1" maxlength="600" placeholder="Спросите о результатах оценки…"></textarea>
          <button class="ai-send" type="submit" id="a-send" aria-label="Отправить">${icon('send')}</button>
        </div>
        <div class="ai-bar__foot">
          <details class="ai-data"><summary>Видит только сводные цифры, тексты диалогов не передаются</summary><pre id="a-stats"></pre></details>
          <button class="link ai-new" type="button" id="a-new" hidden>${icon('plus')}Новый диалог</button>
        </div>
      </form>
    </div>`;

  const draw = () => {
    $('#a-log', view).innerHTML = hist.length ? hist.map(itemHTML).join('')
      : `<div class="ai-empty"><span class="empty__ic" aria-hidden="true">${icon('analyst')}</span><h2>Спросите о результатах контроля качества</h2><p class="muted">Где теряем баллы, чем отличаются языки и каналы, что поменять в скриптах или боте.</p></div>`;
    $('#a-chips', view).innerHTML = hist.length ? '' : chips(SUGGESTED, 'ai-bar__chips');
    $('#a-new', view).hidden = !hist.length || busy;
    const send = $('#a-send', view); send.disabled = busy; send.setAttribute('aria-busy', String(busy));
  };
  draw();
  $('#a-stats', view).textContent = JSON.stringify(statsForAI(compute()), null, 2);
  const toEnd = () => { const last = $('#a-log', view).lastElementChild; last?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }); };
  const tick = setInterval(() => view.querySelectorAll('[data-wait]').forEach((el) => { el.textContent = `${Math.round((Date.now() - Number(el.dataset.wait)) / 1000)} с`; }), 500);
  const grow = (ta) => { ta.style.height = 'auto'; ta.style.height = `${Math.min(160, ta.scrollHeight + 2)}px`; };

  const ask = async (q) => {
    q = String(q || '').trim(); if (!q || busy) return;
    busy = true;
    const item = { q, at: Date.now(), pending: true };
    hist.push(item); draw(); toEnd();
    const t0 = performance.now();
    try {
      const res = await api('/api/insights', { question: q, stats: statsForAI(compute()) });
      Object.assign(item, { pending: false, res, ms: Math.round(performance.now() - t0) });
    } catch (e) {
      if (e.status === 401) { busy = false; hist.pop(); return; }
      Object.assign(item, { pending: false, error: `Аналитик не ответил: ${e.message}. Попробуйте ещё раз.` });
    }
    busy = false; save(hist);
    if (!view.isConnected) return;
    draw(); toEnd();
  };

  view.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-ask]'); if (b) { ask(b.dataset.ask); return; }
    const c = e.target.closest('[data-copy]');
    if (c) { const it = hist[Number(c.dataset.copy)]; try { await navigator.clipboard.writeText(plain(it?.res || {})); toast('Ответ скопирован'); } catch { toast('Не удалось скопировать', 'warn'); } return; }
    if (e.target.closest('#a-new')) { hist.length = 0; save(hist); draw(); $('#a-q', view).focus(); }
  });
  $('#a-form', view).addEventListener('submit', (e) => { e.preventDefault(); const ta = $('#a-q', view); const q = ta.value; ta.value = ''; grow(ta); ask(q); });
  $('#a-q', view).addEventListener('input', (e) => grow(e.target));
  $('#a-q', view).addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); $('#a-form', view).requestSubmit(); } });
  if (hist.length) requestAnimationFrame(() => { const last = $('#a-log', view).lastElementChild; last?.scrollIntoView({ block: 'end' }); });
  return () => clearInterval(tick);
}
