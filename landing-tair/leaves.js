// Autumn leaves for the landing page (our own code, no dependencies).
// 1) Scrolling UP releases a few leaves from the top edge; they drift and fade out near the bottom.
// 2) A small pile of leaves lies along the bottom of the footer and settles in when the footer scrolls into view.
// Pointer events never reach the leaves, nothing runs under prefers-reduced-motion (the pile is drawn still).

const SHAPES = [
  // almond leaf with a midrib
  'M12 1C6 6 4 12 6 18c1.6 4.4 4.6 5 6 5s4.4-.6 6-5c2-6 0-12-6-17zM12 4v18',
  // rounder birch leaf
  'M12 2C7 4 3 9 4 14c.8 4.4 4.4 8 8 8s7.2-3.6 8-8c1-5-3-10-8-12zM12 5v16M12 11l-4-3M12 15l4-3',
  // ginkgo fan
  'M12 22V13M12 13C8 13 3 11 2 6c3-2 7-3 10-3s7 1 10 3c-1 5-6 7-10 7zM12 13l-1-9M12 13l1-9',
];
const COLORS = ['#e2a33b', '#d48a2c', '#c9692d', '#b8862f', '#02b140', '#3f9b4f', '#164734'];
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (xs) => xs[Math.floor(Math.random() * xs.length)];

function leafSVG(size, color, shape) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24'); svg.setAttribute('width', size); svg.setAttribute('height', size);
  const p = document.createElementNS(ns, 'path');
  p.setAttribute('d', shape); p.setAttribute('fill', color); p.setAttribute('stroke', 'rgba(14,21,28,.18)');
  p.setAttribute('stroke-width', '.6'); p.setAttribute('fill-rule', 'evenodd');
  svg.appendChild(p);
  return svg;
}

// ---------- falling on scroll up ----------
function initFall() {
  const layer = document.createElement('div');
  layer.className = 'leaves'; layer.setAttribute('aria-hidden', 'true');
  document.body.appendChild(layer);
  const small = () => window.innerWidth < 640;
  let alive = 0, lastY = window.scrollY, lastSpawn = 0, budget = 0;

  function drop() {
    if (alive >= (small() ? 6 : 11)) return;
    alive++;
    const size = Math.round(rnd(small() ? 18 : 22, small() ? 28 : 36));
    const leaf = document.createElement('span'); leaf.className = 'leaf';
    const sway = document.createElement('span'); sway.className = 'leaf__sway';
    sway.style.setProperty('--sway', `${rnd(18, 46).toFixed(0)}px`);
    sway.style.animationDuration = `${rnd(1.8, 3.2).toFixed(2)}s`;
    sway.appendChild(leafSVG(size, pick(COLORS), pick(SHAPES)));
    leaf.appendChild(sway); layer.appendChild(leaf);
    const x0 = rnd(0.04, 0.96) * window.innerWidth, drift = rnd(-90, 90), h = window.innerHeight;
    const r0 = rnd(-60, 60), r1 = r0 + rnd(-260, 260), dur = rnd(5200, 9000);
    const anim = leaf.animate([
      { transform: `translate(${x0}px, -40px) rotate(${r0}deg)`, opacity: 0 },
      { opacity: 0.95, offset: 0.08 },
      { opacity: 0.9, offset: 0.75 },
      { transform: `translate(${x0 + drift}px, ${h * 0.92}px) rotate(${r1}deg)`, opacity: 0 },
    ], { duration: dur, easing: 'cubic-bezier(.35,.1,.6,1)', fill: 'forwards' });
    anim.onfinish = anim.oncancel = () => { leaf.remove(); alive--; };
  }

  window.addEventListener('scroll', () => {
    const y = window.scrollY, dy = y - lastY; lastY = y;
    if (reduce.matches || y < 80) return;          // at the very top the hero is enough
    if (dy < -4) budget = Math.min(budget + (-dy) / 140, 4);
    const now = performance.now();
    if (budget >= 1 && now - lastSpawn > 140) { budget -= 1; lastSpawn = now; drop(); }
  }, { passive: true });
}

// ---------- pile along the footer ----------
function initPile() {
  const foot = document.querySelector('.foot');
  if (!foot) return;
  const pile = document.createElement('div');
  pile.className = 'leaf-pile'; pile.setAttribute('aria-hidden', 'true');
  // Clustered like real piles: a few heaps along the edge plus loose leaves in between.
  const narrow = window.innerWidth < 640;
  const n = narrow ? 18 : 40;
  const heaps = narrow ? [0.08, 0.5, 0.92] : [0.04, 0.22, 0.47, 0.71, 0.93];
  for (let i = 0; i < n; i++) {
    const s = document.createElement('span'); s.className = 'leaf-pile__leaf';
    const inHeap = Math.random() < 0.72;
    const x = inHeap ? pick(heaps) + rnd(-0.06, 0.06) : Math.random();
    const size = Math.round(inHeap ? rnd(24, narrow ? 34 : 42) : rnd(18, 30));
    s.style.left = `calc(${(Math.min(0.99, Math.max(0, x)) * 100).toFixed(2)}% - ${size / 2}px)`;
    s.style.bottom = `${(inHeap ? rnd(-10, 18) : rnd(-8, 4)).toFixed(0)}px`;
    s.style.zIndex = String(Math.round(rnd(1, 9)));
    s.style.setProperty('--r', `${rnd(-90, 90).toFixed(0)}deg`);
    s.style.setProperty('--d', `${Math.round(rnd(0, 650))}ms`);
    s.appendChild(leafSVG(size, pick(COLORS), pick(SHAPES)));
    pile.appendChild(s);
  }
  foot.appendChild(pile);
  if (reduce.matches || !('IntersectionObserver' in window)) { pile.classList.add('is-in'); return; }
  const io = new IntersectionObserver((es) => {
    if (es.some((e) => e.isIntersecting)) { pile.classList.add('is-in'); io.disconnect(); }
  }, { threshold: 0.2 });
  io.observe(foot);
}

function init() { initPile(); initFall(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
