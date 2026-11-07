// Freedom CQA landing: scroll film.
// One passive scroll listener + requestAnimationFrame. For every [data-range="a b c d"] inside a
// [data-stage] we write --r (reveal a→b), --o (out c→d) and --k (life a→d) from the stage's scroll
// progress; landing.css turns those into transform / opacity / clip-path. No libraries.

const root = document.documentElement;
const reduce = matchMedia('(prefers-reduced-motion: reduce)');
root.classList.add('js');
if (!reduce.matches) root.classList.add('motion');

/* ── split headlines into words for the fade-up ── */
function splitWords(el) {
  let i = 0;
  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.TEXT_NODE) {
        const parts = child.textContent.split(/(\s+)/);
        const frag = document.createDocumentFragment();
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(document.createTextNode(' ')); continue; }
          const w = document.createElement('span');
          w.className = 'w';
          w.style.setProperty('--i', i++);
          w.textContent = part;
          frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === Node.ELEMENT_NODE && child.tagName !== 'BR') {
        walk(child);
      }
    }
  };
  walk(el);
}
document.querySelectorAll('[data-words]').forEach(splitWords);

/* ── reveal-on-enter for plain flow blocks (and every copy block when motion is off) ── */
const io = new IntersectionObserver((entries) => {
  for (const e of entries) if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
}, { rootMargin: '0px 0px -12% 0px', threshold: 0.15 });
document.querySelectorAll('[data-rise]').forEach((el) => io.observe(el));
if (!root.classList.contains('motion')) document.querySelectorAll('.copy').forEach((el) => io.observe(el));

/* ── scroll-driven stages ── */
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const ramp = (p, a, b) => (b <= a ? (p >= a ? 1 : 0) : clamp01((p - a) / (b - a)));

const stages = [...document.querySelectorAll('[data-stage]')].map((el) => ({
  el, top: 0, len: 1,
  items: [...el.querySelectorAll('[data-range]')].map((node) => ({
    node, range: node.dataset.range.trim().split(/\s+/).map(Number),
    isCopy: node.classList.contains('copy'), r: -1, o: -1, k: -1, inState: null,
  })),
}));

let vh = innerHeight;
function measure() {
  vh = innerHeight;
  const y = scrollY;
  for (const s of stages) {
    const rect = s.el.getBoundingClientRect();
    s.top = rect.top + y;
    s.len = Math.max(1, rect.height - vh);
  }
}

const q = (v) => Math.round(v * 1000) / 1000;
function update() {
  ticking = false;
  const y = scrollY;
  for (const s of stages) {
    // skip stages far from the viewport, but still settle them once at their ends
    const p = clamp01((y - s.top) / s.len);
    for (const it of s.items) {
      const [a, b, c, d] = it.range;
      const r = q(ramp(p, a, b)), o = q(ramp(p, c, d)), k = q(ramp(p, a, d));
      const st = it.node.style;
      if (r !== it.r) { st.setProperty('--r', r); it.r = r; }
      if (o !== it.o) { st.setProperty('--o', o); it.o = o; }
      if (k !== it.k) { st.setProperty('--k', k); it.k = k; }
      if (it.isCopy) {
        const on = r > 0.5 && o < 0.5;
        if (on !== it.inState) { it.node.classList.toggle('is-in', on); it.inState = on; }
      }
    }
  }
}

let ticking = false;
const request = () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } };

function startMotion() {
  measure(); // forces a style pass first, so the hero words still fade in
  update();
  addEventListener('scroll', request, { passive: true });
  addEventListener('resize', () => { measure(); request(); });
  addEventListener('load', () => { measure(); request(); });
  if ('ResizeObserver' in window) new ResizeObserver(() => { measure(); request(); }).observe(document.body);
}

function stopMotion() {
  removeEventListener('scroll', request);
  for (const s of stages) for (const it of s.items) {
    it.node.style.removeProperty('--r'); it.node.style.removeProperty('--o'); it.node.style.removeProperty('--k');
    if (it.isCopy) it.node.classList.add('is-in');
  }
}

if (root.classList.contains('motion')) startMotion();
reduce.addEventListener?.('change', (e) => {
  if (e.matches) { root.classList.remove('motion'); stopMotion(); }
  else { root.classList.add('motion'); startMotion(); }
});

/* ── demo placeholder: the play button only explains that the video is on its way ──
   When the real <video>/<iframe> replaces the poster (see comment in index.html), this does nothing. */
function initDemo() {
  const btn = document.querySelector('.demo__play');
  const note = document.getElementById('demo-note');
  if (!btn || !note) return;
  btn.addEventListener('click', () => {
    note.textContent = 'Видео готовим. Совсем скоро оно появится здесь.';
    note.classList.add('is-flash');
    setTimeout(() => note.classList.remove('is-flash'), 1600);
  });
}
initDemo();
