// Smoother scrolling on the landing page (our own code, no dependencies).
// - Mouse wheels move the page in coarse 100 px steps; here each step glides to its target instead of jumping.
// - Trackpads and touch screens already scroll smoothly with momentum, so they are left alone.
// - Anchor links (#demo, #how, …) glide via CSS scroll-behavior (landing.css).
// Off under prefers-reduced-motion, for keyboard/scrollbar input, ctrl/⌘ + wheel (zoom) and inside
// anything that scrolls on its own.

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
const fine = window.matchMedia('(pointer: fine)');

function canScrollInside(el, dy) {
  for (let n = el instanceof Element ? el : null; n && n !== document.body && n !== document.documentElement; n = n.parentElement) {
    const st = getComputedStyle(n);
    if (/(auto|scroll)/.test(st.overflowY) && n.scrollHeight > n.clientHeight + 1) {
      if ((dy < 0 && n.scrollTop > 0) || (dy > 0 && n.scrollTop + n.clientHeight < n.scrollHeight - 1)) return true;
    }
  }
  return false;
}

// A mouse wheel notch: line-mode deltas, or large whole-number pixel deltas with no sideways part.
const isWheelNotch = (e) => e.deltaMode === 1 || (Math.abs(e.deltaY) >= 50 && Number.isInteger(e.deltaY) && e.deltaX === 0);

function init() {
  if (!fine.matches) return;
  let target = window.scrollY, current = window.scrollY, raf = 0;
  const max = () => document.documentElement.scrollHeight - window.innerHeight;

  function step() {
    const diff = target - current;
    current += diff * 0.14;
    if (Math.abs(diff) < 0.5) current = target;
    window.scrollTo({ top: current, behavior: 'instant' });   // the glide is ours; don't let CSS smooth it twice
    raf = current === target ? 0 : requestAnimationFrame(step);
  }

  window.addEventListener('wheel', (e) => {
    if (reduce.matches || e.ctrlKey || e.metaKey || !isWheelNotch(e) || canScrollInside(e.target, e.deltaY)) return;
    e.preventDefault();
    if (!raf) { current = window.scrollY; target = current; }
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaY;
    target = Math.max(0, Math.min(max(), target + dy * 1.1));
    if (!raf) raf = requestAnimationFrame(step);
  }, { passive: false });

  // Keyboard, scrollbar or an anchor jump moved the page: follow it instead of pulling it back.
  window.addEventListener('scroll', () => {
    if (raf && Math.abs(window.scrollY - current) < 2) return;   // our own glide
    if (raf) { cancelAnimationFrame(raf); raf = 0; }
    current = target = window.scrollY;
  }, { passive: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
