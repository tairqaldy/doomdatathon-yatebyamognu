// «Как пользоваться»: a spotlight tour through the jury's cycle (checklist → dialogs → evaluation → result → appeal → decision).
// Self-contained: dims the page, cuts a hole around the target, shows a small card next to it. Read-only: it never clicks
// or changes data, it only switches hash routes and waits for the target. A missing target skips its step.
const DONE_KEY = 'cqa-tour-done';
const DEMO = 'p1-ru-009';
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch {} } };
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const agree = () => { const v = document.querySelectorAll('.kpis .kpi')[3]?.querySelector('.kpi__value')?.textContent.replace(/\s+/g, ' ').trim(); return v && v !== '—' ? ` (${v.replace(/%$/, ' %')})` : ''; };

const STEPS = [
  { route: '#/overview', target: ['.kpis'], title: 'Обзор: главное сразу',
    text: () => `Средний балл, число диалогов, грубые ошибки и совпадение AI с ручной разметкой${agree()}. Каждая цифра открывает список диалогов.` },
  { route: '#/overview', target: ['.jury'], title: 'Сценарий проверки',
    text: 'Весь цикл в 6 кликов: чек-лист, диалоги, оценка, результаты, апелляция, решение. Каждый шаг открывает нужный экран.' },
  { route: '#/checklist', target: ['.cl-bar'], title: 'Чек-лист',
    text: 'Добавьте или измените пункт, его вес, тип ответа и N/A. Каждое сохранение создаёт версию, после него можно переоценить выбранные диалоги.' },
  { route: '#/import', target: ['.imp-card'], title: 'Загрузка диалогов',
    text: 'Вставьте свой транскрипт или загрузите набор по group_id (FBroker, Swap). AI оценит его вживую, обычно за ≈ 30 с.' },
  { route: `#/dialog/${DEMO}`, target: ['.score-card'], title: 'Итог диалога',
    text: 'Итог из 100 и «Как посчитан итог»: доля каждого критерия по весу, N/A перераспределяется. «Путь оценки» хранит оценку AI, апелляцию и решение.' },
  { route: `#/dialog/${DEMO}`, target: ['.side .banner--bad', '.reasons-card .ded'], title: 'Грубая ошибка и доказательство',
    text: 'Грубая ошибка видна отдельным красным флагом. Нажмите на цитату: расшифровка прокрутится к реплике и подсветит её.' },
  { route: `#/dialog/${DEMO}`, target: ['.ded [data-appeal]', '#appeal-main'], first: true, title: 'Оспорить',
    text: 'Не согласны с пунктом? «Оспорить» создаёт апелляцию с комментарием. Проверяющий увидит спорный балл, комментарий и фрагмент диалога.' },
  { route: `#/dialog/${DEMO}`, target: ['#role-switch'], title: 'Решение проверяющего',
    text: 'Роль «Проверяющий», затем «Принять решение»: подтвердите или измените балл с причиной. Итог пересчитается, исходная оценка сохранится.' },
  { route: '#/analyst', target: ['#a-form'], title: 'AI-аналитик',
    text: 'Вопросы к сводным данным: где теряем баллы, что исправить первым, чем отличаются языки. Тексты диалогов ему не передаются.' },
  { route: '#/overview', target: ['#tour-btn'], title: 'Тур всегда под рукой',
    text: 'Кнопка «Как пользоваться» запускает его снова. Начните со «Сценария проверки» на этой странице.' },
];

let T = null; // { i, root, hole, card, raf, prevFocus, token }

const hashPath = () => (location.hash || '#/overview').split('?')[0];
// first visible match per selector; `first` steps take only the first selector that matched (a fallback list)
const els = (step) => {
  const list = step.target.map((s) => [...document.querySelectorAll(s)].find((el) => el.getClientRects().length)).filter(Boolean);
  return step.first ? list.slice(0, 1) : list;
};
const unionRect = (list) => {
  const rs = list.map((el) => el.getBoundingClientRect());
  const top = Math.min(...rs.map((r) => r.top)), left = Math.min(...rs.map((r) => r.left));
  return { top, left, width: Math.max(...rs.map((r) => r.right)) - left, height: Math.max(...rs.map((r) => r.bottom)) - top };
};
const topOffset = () => (document.querySelector('.top')?.getBoundingClientRect().bottom || 0) + 12;
const mobile = () => innerWidth < 700;

function waitFor(step, token, ms = 6000) {
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = () => {
      if (!T || T.token !== token) return res(null);
      const list = els(step);
      if (list.length) return res(list);
      if (performance.now() - t0 > ms) return res(null);
      setTimeout(tick, 80);
    };
    tick();
  });
}

function scrollToTarget(list) {
  const r = unionRect(list);
  const off = topOffset();
  const bottomPad = mobile() ? (T.card.offsetHeight || 200) + 24 : 24;
  const room = innerHeight - off - bottomPad;
  const y = r.height <= room ? scrollY + r.top - off - (room - r.height) / 2 : scrollY + r.top - off;
  if (Math.abs(r.top - off) < 4 && r.bottom < innerHeight - bottomPad) return;
  scrollTo({ top: Math.max(0, y), behavior: reduced() ? 'auto' : 'smooth' });
}

function place() {
  if (!T) return;
  const step = STEPS[T.i];
  const list = T.list?.every((el) => el.isConnected) ? T.list : (T.list = els(step));
  if (!list.length) return;
  const pad = 8, r = unionRect(list);
  const box = { top: r.top - pad, left: r.left - pad, width: r.width + pad * 2, height: r.height + pad * 2 };
  const key = `${Math.round(box.top)}|${Math.round(box.left)}|${Math.round(box.width)}|${Math.round(box.height)}|${innerWidth}|${innerHeight}`;
  if (key === T.key) return;
  T.key = key;
  Object.assign(T.hole.style, { top: `${box.top}px`, left: `${box.left}px`, width: `${box.width}px`, height: `${box.height}px` });
  const c = T.card, cw = c.offsetWidth, ch = c.offsetHeight, gap = 14, m = 16;
  if (mobile()) { c.style.top = ''; c.style.left = ''; c.classList.add('tour-card--dock'); return; }
  c.classList.remove('tour-card--dock');
  const clampX = (x) => Math.min(Math.max(m, x), innerWidth - cw - m);
  const clampY = (y) => Math.min(Math.max(m, y), innerHeight - ch - m);
  let top, left;
  if (box.top + box.height + gap + ch < innerHeight - m) { top = box.top + box.height + gap; left = clampX(box.left); }
  else if (box.top - gap - ch > m) { top = box.top - gap - ch; left = clampX(box.left); }
  else if (box.left + box.width + gap + cw < innerWidth - m) { left = box.left + box.width + gap; top = clampY(box.top); }
  else if (box.left - gap - cw > m) { left = box.left - gap - cw; top = clampY(box.top); }
  else { left = innerWidth - cw - m; top = innerHeight - ch - m; }
  c.style.top = `${top}px`; c.style.left = `${left}px`;
}

function loop() { if (!T) return; place(); T.raf = requestAnimationFrame(loop); }

async function go(i, dir = 1) {
  if (!T) return;
  if (i < 0) i = 0;
  if (i >= STEPS.length) { close(true); return; }
  const token = (T.token || 0) + 1; T.token = token;
  const step = STEPS[i];
  T.card.classList.add('is-moving');
  if (hashPath() !== step.route) location.hash = step.route;
  const list = await waitFor(step, token);
  if (!T || T.token !== token) return;
  if (!list) { go(i + dir, dir); return; } // target missing: skip in the same direction
  T.i = i; T.list = list; T.key = '';
  const text = typeof step.text === 'function' ? step.text() : step.text;
  T.card.querySelector('.tour-card__n').textContent = `Шаг ${i + 1} из ${STEPS.length}`;
  T.card.querySelector('.tour-card__t').textContent = step.title;
  T.card.querySelector('.tour-card__p').textContent = text;
  T.card.querySelector('[data-tour="prev"]').disabled = i === 0;
  T.card.querySelector('[data-tour="next"]').textContent = i === STEPS.length - 1 ? 'Готово' : 'Далее';
  T.card.querySelector('.tour-card__bar i').style.width = `${((i + 1) / STEPS.length) * 100}%`;
  T.root.classList.add('is-on');
  scrollToTarget(list);
  setTimeout(() => {
    if (!T || T.token !== token) return;
    T.key = ''; place();
    T.card.classList.remove('is-moving');
    T.card.querySelector('[data-tour="next"]').focus({ preventScroll: true });
  }, reduced() ? 0 : 280);
}

function onKey(e) {
  if (!T) return;
  if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(true); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); go(T.i + 1, 1); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopPropagation(); if (T.i > 0) go(T.i - 1, -1); return; }
  if (e.key === 'Tab') { // keep focus inside the card
    const f = [...T.card.querySelectorAll('button:not([disabled])')];
    if (!f.length) return;
    const k = f.indexOf(document.activeElement);
    e.preventDefault();
    f[(k + (e.shiftKey ? -1 : 1) + f.length) % f.length].focus();
  }
}
const onResize = () => { if (T) T.key = ''; };

export function close(done = true) {
  if (!T) return;
  const t = T; T = null;
  cancelAnimationFrame(t.raf); clearInterval(t.iv);
  removeEventListener('keydown', onKey, true);
  removeEventListener('resize', onResize);
  if (done) ls.set(DONE_KEY, '1');
  t.root.classList.remove('is-on');
  setTimeout(() => t.root.remove(), reduced() ? 0 : 220);
  const back = t.prevFocus?.isConnected ? t.prevFocus : document.getElementById('tour-btn');
  back?.focus?.({ preventScroll: true });
}

export function start(from = 0) {
  if (T || document.getElementById('app')?.hidden) return;
  const root = document.createElement('div');
  root.className = 'tour';
  root.innerHTML = `<div class="tour__block"></div><div class="tour__hole" aria-hidden="true"></div>
    <section class="tour-card is-moving" role="dialog" aria-modal="true" aria-labelledby="tour-t" aria-describedby="tour-p">
      <span class="tour-card__bar" aria-hidden="true"><i></i></span>
      <span class="tour-card__n" aria-live="polite"></span>
      <h2 class="tour-card__t" id="tour-t"></h2>
      <p class="tour-card__p" id="tour-p"></p>
      <div class="tour-card__foot">
        <button class="link tour-card__skip" type="button" data-tour="skip">Пропустить</button>
        <span class="tour-card__nav"><button class="btn btn--s" type="button" data-tour="prev">Назад</button><button class="btn btn--s btn--primary" type="button" data-tour="next">Далее</button></span>
      </div>
      <span class="tour-card__keys muted" aria-hidden="true">← → для шагов, Esc закрыть</span>
    </section>`;
  document.body.append(root);
  T = { i: from, root, hole: root.querySelector('.tour__hole'), card: root.querySelector('.tour-card'), prevFocus: document.activeElement, token: 0, key: '' };
  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-tour]'); if (!b || !T) return;
    if (b.dataset.tour === 'next') go(T.i + 1, 1);
    else if (b.dataset.tour === 'prev') go(T.i - 1, -1);
    else close(true);
  });
  addEventListener('keydown', onKey, true);
  addEventListener('resize', onResize);
  requestAnimationFrame(() => root.classList.add('is-on'));
  loop(); T.iv = setInterval(place, 250); // rAF pauses in background tabs; the interval keeps the hole on target
  go(from, 1);
}

/** Adds the «Как пользоваться» button to the top bar (inside #app, so never on the login screen). */
export function mountTourButton() {
  if (document.getElementById('tour-btn')) return;
  const top = document.querySelector('.top'); if (!top) return;
  const b = document.createElement('button');
  b.type = 'button'; b.id = 'tour-btn'; b.className = 'btn btn--s tour-btn';
  b.innerHTML = '<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M9.6 9.3a2.5 2.5 0 0 1 4.8.9c0 1.7-2.4 2.2-2.4 3.6M12 17h.01"/></svg><span class="tour-btn__l">Как пользоваться</span>';
  b.setAttribute('aria-label', 'Как пользоваться: тур по разделам');
  b.addEventListener('click', () => start(0));
  top.insertBefore(b, top.querySelector('.top__logout'));
}

/** First admin visit after login: start once, only from Обзор so a deep link is never hijacked. */
export function autoStart() {
  if (ls.get(DONE_KEY)) return;
  setTimeout(() => { if (!T && !ls.get(DONE_KEY) && hashPath() === '#/overview' && !document.getElementById('app')?.hidden && !document.getElementById('drawer')) start(0); }, 800);
}

addEventListener('cqa:logout', () => close(false));
