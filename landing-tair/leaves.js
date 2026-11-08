// Autumn leaves for the landing page (our own code, no dependencies).
// 1) A fast upward flick of the page shakes a few leaves loose from the top edge; they drift down and fade.
//    Normal scrolling never drops leaves.
// 2) Heaps of leaves lie in the footer corners and settle in when the footer scrolls into view.
// Leaves are drawn as SVG (maple, oak, birch, ginkgo) with a two-tone gradient, veins and a stem.
// Pointer events never reach them; nothing falls under prefers-reduced-motion (the heaps are drawn still).

const NS = 'http://www.w3.org/2000/svg';
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');

// Seeded random: the footer heaps look the same on every visit (a designed arrangement, not noise).
function rng(seed) { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const live = Math.random;

// Shapes in a 100×100 box, stem pointing down. outline + veins (stroked) + stem (stroked).
const SHAPES = {
  maple: {
    d: 'M50 6l7 15 12-7-2 16 15-3-9 13 12 6-15 6 6 12-16-4 1 15-11-10-11 10 1-15-16 4 6-12-15-6 12-6-9-13 15 3-2-16 12 7z',
    veins: 'M50 74V14M50 52L22 30M50 52l28-22M50 60L24 62M50 60l26 2', stem: 'M50 74q1 12-3 22',
  },
  oak: {
    d: 'M50 6C56 8 58 14 55 19C62 15 70 18 66 26C74 24 80 31 72 37C80 38 82 46 73 50C80 54 78 62 69 61C72 67 66 72 58 68C58 74 55 79 50 82C45 79 42 74 42 68C34 72 28 67 31 61C22 62 20 54 27 50C18 46 20 38 28 37C20 31 26 24 34 26C30 18 38 15 45 19C42 14 44 8 50 6Z',
    veins: 'M50 80V10M50 30l-12-6M50 30l12-6M50 46l-16-6M50 46l16-6M50 62l-12-4M50 62l12-4', stem: 'M50 80q0 9-2 16',
  },
  birch: {
    d: 'M50 6c14 8 26 24 26 42 0 18-12 30-26 32-14-2-26-14-26-32C24 30 36 14 50 6z',
    veins: 'M50 80V12M50 30l-14-8M50 30l14-8M50 44l-18-8M50 44l18-8M50 58l-18-6M50 58l18-6', stem: 'M50 80q2 8 0 16',
  },
  ginkgo: {
    d: 'M50 70C36 66 16 52 10 28c12-8 26-12 40-12s28 4 40 12c-6 24-26 38-40 42z M50 16l-3 18',
    veins: 'M50 70L30 24M50 70L40 20M50 70V18M50 70l10-50M50 70l20-46', stem: 'M50 70q-2 14 1 26',
  },
};
const KINDS = Object.keys(SHAPES);
// Autumn palette as [light, dark] pairs; two Freedom greens so the heap still reads as "ours".
const TONES = [
  ['#f0c14b', '#c98a1e'], ['#e8a33c', '#b8641c'], ['#d9772f', '#9e3f1a'], ['#c95a2a', '#7f2a17'],
  ['#b3402a', '#6e1f16'], ['#d6b04a', '#8c7a23'], ['#9fae4a', '#5d6d24'], ['#3fae5a', '#16603a'],
];
let gid = 0;

function leafSVG(size, kind, tone, { shade = 1 } = {}) {
  const sh = SHAPES[kind]; const id = `lg${gid++}`;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('viewBox', '0 0 100 100'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0.2" y1="0" x2="0.8" y2="1">
      <stop offset="0" stop-color="${tone[0]}"/><stop offset="1" stop-color="${tone[1]}"/></linearGradient></defs>
    <path d="${sh.stem}" fill="none" stroke="${tone[1]}" stroke-width="3" stroke-linecap="round"/>
    <path d="${sh.d}" fill="url(#${id})" stroke="${tone[1]}" stroke-width="1.2" stroke-linejoin="round" opacity="${shade}"/>
    <path d="${sh.veins}" fill="none" stroke="${tone[1]}" stroke-width="1.4" stroke-linecap="round" opacity=".55"/>`;
  return svg;
}

// ---------- falling: only on a fast upward flick ----------
function initFall() {
  const layer = document.createElement('div');
  layer.className = 'leaves'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const small = () => window.innerWidth < 640;
  const FLICK = 2.6;          // px per ms upward (≈ 2600 px/s): a deliberate fast swipe or wheel spin, not reading
  const COOLDOWN = 2600;      // ms between bursts
  let alive = 0, lastY = window.scrollY, lastT = performance.now(), v = 0, lastBurst = -1e9;

  function drop(delay) {
    if (alive >= (small() ? 5 : 9)) return;
    alive++;
    const size = Math.round(18 + live() * (small() ? 12 : 18));
    const leaf = document.createElement('span'); leaf.className = 'leaf';
    const sway = document.createElement('span'); sway.className = 'leaf__sway';
    sway.style.setProperty('--sway', `${(18 + live() * 30).toFixed(0)}px`);
    sway.style.animationDuration = `${(1.8 + live() * 1.4).toFixed(2)}s`;
    sway.appendChild(leafSVG(size, KINDS[Math.floor(live() * KINDS.length)], TONES[Math.floor(live() * TONES.length)]));
    leaf.appendChild(sway); layer.appendChild(leaf);
    const x0 = (0.06 + live() * 0.88) * window.innerWidth, drift = -80 + live() * 160, h = window.innerHeight;
    const r0 = -60 + live() * 120, r1 = r0 + (-240 + live() * 480), dur = 5200 + live() * 3600;
    const anim = leaf.animate([
      { transform: `translate(${x0}px, -48px) rotate(${r0}deg)`, opacity: 0 },
      { opacity: 0.95, offset: 0.08 },
      { opacity: 0.9, offset: 0.75 },
      { transform: `translate(${x0 + drift}px, ${h * 0.92}px) rotate(${r1}deg)`, opacity: 0 },
    ], { duration: dur, delay, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'both' });
    anim.onfinish = anim.oncancel = () => { leaf.remove(); alive--; };
  }

  window.addEventListener('scroll', () => {
    const now = performance.now(), y = window.scrollY, dt = Math.max(1, now - lastT);
    const inst = (y - lastY) / dt;            // px/ms, negative = up
    v = v * 0.5 + inst * 0.5;                 // light smoothing so one odd event doesn't count
    lastY = y; lastT = now;
    if (reduce.matches || y < 120) return;
    if (v < -FLICK && now - lastBurst > COOLDOWN) {
      lastBurst = now;
      const n = small() ? 3 : 3 + Math.floor(live() * 3);
      for (let i = 0; i < n; i++) drop(i * (90 + live() * 160));
    }
  }, { passive: true });
}

// ---------- heaps in the footer corners ----------
function initPile() {
  const foot = document.querySelector('.foot');
  if (!foot) return;
  const pile = document.createElement('div');
  pile.className = 'leaf-pile'; pile.setAttribute('aria-hidden', 'true');
  const narrow = window.innerWidth < 640;
  const r = rng(20261108);
  // Heaps: centre (fraction of width), how many leaves, how wide; a few loose leaves between them.
  const heaps = narrow
    ? [{ x: 0.06, n: 12, w: 0.16 }, { x: 0.95, n: 10, w: 0.14 }, { x: 0.55, n: 3, w: 0.1 }]
    : [{ x: 0.04, n: 22, w: 0.1 }, { x: 0.965, n: 18, w: 0.08 }, { x: 0.62, n: 6, w: 0.05 }, { x: 0.3, n: 2, w: 0.04 }];
  let order = 0;
  for (const hp of heaps) {
    const mound = document.createElement('span'); mound.className = 'leaf-pile__mound';
    mound.style.left = `${(hp.x * 100).toFixed(2)}%`; mound.style.setProperty('--w', `${(hp.w * 100).toFixed(1)}vw`);
    pile.appendChild(mound);
    for (let i = 0; i < hp.n; i++) {
      // gaussian-ish spread: most leaves near the centre, higher in the middle of the heap
      const u = (r() + r() + r()) / 3 - 0.5;
      const x = hp.x + u * hp.w * 2;
      const height = (1 - Math.min(1, Math.abs(u) * 2.2)) * (narrow ? 22 : 34);
      const s = document.createElement('span'); s.className = 'leaf-pile__leaf';
      const size = Math.round((narrow ? 22 : 26) + r() * (narrow ? 14 : 22));
      s.style.left = `calc(${(Math.min(1.02, Math.max(-0.02, x)) * 100).toFixed(2)}% - ${size / 2}px)`;
      s.style.bottom = `${(-size * 0.35 + r() * height).toFixed(0)}px`;
      s.style.zIndex = String(1 + Math.round(r() * 8));
      s.style.setProperty('--r', `${(-100 + r() * 200).toFixed(0)}deg`);
      s.style.setProperty('--d', `${Math.round(order++ * 24 + r() * 120)}ms`);
      s.appendChild(leafSVG(size, KINDS[Math.floor(r() * KINDS.length)], TONES[Math.floor(r() * TONES.length)], { shade: 0.9 + r() * 0.1 }));
      pile.appendChild(s);
    }
  }
  foot.appendChild(pile);
  if (reduce.matches || !('IntersectionObserver' in window)) { pile.classList.add('is-in'); return; }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { pile.classList.add('is-in'); io.disconnect(); }
  }, { threshold: 0.15 });
  io.observe(foot);
}

function init() { initPile(); initFall(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
