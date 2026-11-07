// Freedom CQA landing, v2. Vanilla JS, no dependencies.
// 1. reveal-on-enter for [data-reveal]
// 2. living-photo loops: [data-loop] runs only while on screen (CSS animations + SMIL water filters)
// 3. scroll parallax fallback for browsers without CSS animation-timeline (one rAF per scroll frame)
// 4. header border after the first scroll
// 5. evidence highlight in the real-chat card
// 6. demo placeholder button

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.add('js');
const syncMotion = () => root.classList.toggle('motion', !reduce.matches);
syncMotion();
const motionOn = () => root.classList.contains('motion');

/* 1 · reveal */
const revealIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (!e.isIntersecting) continue;
    e.target.classList.add('is-in');
    revealIO.unobserve(e.target);
  }
}, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
document.querySelectorAll('[data-reveal]').forEach((el) => revealIO.observe(el));

/* 2 · loops: play only on screen */
document.querySelectorAll('svg[data-fx-svg]').forEach((svg) => svg.pauseAnimations?.());
const onScreen = new Set();
function applyLoop(el) {
  const on = motionOn() && onScreen.has(el);
  el.classList.toggle('is-playing', on);
  const svg = el.dataset.fx && document.getElementById(el.dataset.fx);
  if (svg) (on ? svg.unpauseAnimations : svg.pauseAnimations).call(svg);
}
const loopIO = new IntersectionObserver((entries) => {
  for (const e of entries) {
    if (e.isIntersecting) onScreen.add(e.target); else onScreen.delete(e.target);
    applyLoop(e.target);
  }
}, { rootMargin: '60px 0px' });
const loops = [...document.querySelectorAll('[data-loop]')];
loops.forEach((el) => loopIO.observe(el));

/* 3 · parallax fallback (CSS handles it where animation-timeline is supported) */
const cssTimeline = window.CSS?.supports?.('animation-timeline: view()');
let resetParallax = () => {};
if (!cssTimeline) {
  const items = [...document.querySelectorAll('[data-par]')].map((el) => ({
    el,
    scope: el.closest('[data-par-scope]') || el.parentElement,
    amp: parseFloat(getComputedStyle(el).getPropertyValue('--par')) || 40,
    top: 0, h: 0, last: NaN,
  }));
  let vh = innerHeight;
  let raf = 0;
  const measure = () => {
    vh = innerHeight;
    const y = scrollY;
    for (const it of items) {
      const r = it.scope.getBoundingClientRect();
      it.top = r.top + y;
      it.h = r.height;
    }
  };
  const update = () => {
    raf = 0;
    if (!motionOn()) return;
    const y = scrollY;
    for (const it of items) {
      // same mapping as the CSS range "cover 0% → cover 100%"
      const p = (y + vh - it.top) / (vh + it.h);
      if (p < -0.05 || p > 1.05) continue;
      const v = Math.round((Math.min(1, Math.max(0, p)) * 2 - 1) * it.amp * 10) / 10;
      if (v === it.last) continue;
      it.last = v;
      it.el.style.transform = `translate3d(0, ${v}px, 0)`;
    }
  };
  const request = () => { if (!raf) raf = requestAnimationFrame(update); };
  measure();
  update();
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { measure(); request(); });
  addEventListener('load', () => { measure(); request(); });
  resetParallax = () => { for (const it of items) { it.el.style.transform = ''; it.last = NaN; } };
}

reduce.addEventListener?.('change', () => {
  syncMotion();
  loops.forEach(applyLoop);
  if (!motionOn()) {
    resetParallax();
    document.querySelectorAll('[data-reveal]').forEach((el) => el.classList.add('is-in'));
  }
});

/* 4 · header border once the page has scrolled */
const bar = document.querySelector('.bar');
const sentinel = document.getElementById('top');
if (bar && sentinel) {
  new IntersectionObserver(([e]) => bar.classList.toggle('is-scrolled', !e.isIntersecting)).observe(sentinel);
}

/* 5 · evidence: a verdict highlights the transcript lines it cites */
const verdicts = [...document.querySelectorAll('.verdict[data-ref]')];
function highlight(btn) {
  document.querySelectorAll('.line.is-hl').forEach((l) => l.classList.remove('is-hl'));
  if (!btn) return;
  for (const id of btn.dataset.ref.split(/\s+/)) document.getElementById(id)?.classList.add('is-hl');
}
const pressed = () => verdicts.find((b) => b.getAttribute('aria-pressed') === 'true');
for (const btn of verdicts) {
  btn.addEventListener('click', () => {
    verdicts.forEach((b) => b.setAttribute('aria-pressed', String(b === btn)));
    highlight(btn);
  });
  btn.addEventListener('mouseenter', () => highlight(btn));
  btn.addEventListener('mouseleave', () => highlight(pressed()));
}
highlight(pressed());

/* 6 · demo placeholder: the play button only says the video is on its way.
   Once a real <video>/<iframe> replaces it (see the comment in index.html), this does nothing. */
function initDemo() {
  const btn = document.querySelector('.demo__play');
  const note = document.getElementById('demo-note');
  if (!btn || !note) return;
  btn.addEventListener('click', () => {
    note.textContent = 'Видео появится здесь в ближайшее время. Пока можно открыть поддержку и написать AIM самим.';
    note.classList.add('is-flash');
    setTimeout(() => note.classList.remove('is-flash'), 1800);
  });
}
initDemo();
