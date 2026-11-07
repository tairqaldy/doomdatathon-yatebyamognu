// UI helpers for the admin console: escaping, number formats, icons, toast, drawer, hand-made SVG charts.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
/** Up to `d` decimals, Russian separators (92,31 · 100). */
export const fmt = (x, d = 2) => (x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('ru-RU', { maximumFractionDigits: d }));
/** Exactly `d` decimals. */
export const fix = (x, d = 1) => (x == null || !Number.isFinite(Number(x)) ? '—' : Number(x).toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));
/** Signed delta with a real minus sign, like the "−7,69" deductions: +16,67 · −20. */
export const signed = (x, d = 2, f = fmt) => (x > 0 ? '+' : x < 0 ? '−' : '') + f(Math.abs(x), d);
export const plural =(n, [one, few, many]) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
export const LANG = { RU: 'Русский', KZ: 'Қазақша', EN: 'English' };
export const CHAN = { chat: 'Чат', call: 'Звонок' };
export const TIER_LABEL = { high: '85 и выше', mid: '60–84', low: 'ниже 60' };
export const tierVar = (t) => ({ high: 'var(--good)', mid: 'var(--mid)', low: 'var(--bad)' }[t] || 'var(--ink-4)');
export const clock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = t % 60; return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
export const timeOf = (iso) => { try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export const dateTime = (iso) => { try { return new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };
export const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
export const uid = () => Math.random().toString(36).slice(2, 9);

const P = {
  overview: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/>',
  dialogs: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  appeals: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  checklist: '<path d="M9 6h11M9 12h11M9 18h11"/><path d="m3.5 6 1.2 1.2L7 5M3.5 12l1.2 1.2L7 11M3.5 18l1.2 1.2L7 17"/>',
  live: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  analyst: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  logout: '<path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/>',
  back: '<path d="m15 18-6-6 6-6"/>', next: '<path d="m9 18 6-6-6-6"/>',
  send: '<path d="M4 12l16-8-6 16-2-7z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  check: '<path d="m5 12 5 5L20 7"/>', x: '<path d="M18 6 6 18M6 6l12 12"/>', dash: '<path d="M6 12h12"/>',
  alert: '<path d="M12 9v4m0 4h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', up: '<path d="m18 15-6-6-6 6"/>', down: '<path d="m6 9 6 6 6-6"/>',
  trash: '<path d="M3 6h18M8 6V4h8v2m-9 0 1 14h8l1-14"/>',
  swap: '<path d="M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7"/>',
  refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
  outcome: '<path d="M4 12h16M14 6l6 6-6 6"/>',
  chat: '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.4 1.8.7 2.7a2 2 0 0 1-.5 2.1L8 9.8a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.7.7a2 2 0 0 1 1.7 2z"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  panel: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16"/>',
  quote: '<path d="M7 7h4v4c0 3-2 5-4 6M15 7h4v4c0 3-2 5-4 6"/>',
};
const FILLED = {
  play: '<path d="M8 5v14l11-7z"/>',
  pause: '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>',
};
export const icon = (name, cls = 'ic') => FILLED[name]
  ? `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}" fill="currentColor" stroke="none">${FILLED[name]}</svg>`
  : `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${P[name] || ''}</svg>`;

/* ---------- toast ---------- */
export function toast(msg, kind = 'ok') {
  document.querySelectorAll('.toast').forEach((t) => t.remove());
  const el = document.createElement('div');
  el.className = `toast toast--${kind}`; el.setAttribute('role', 'status');
  el.innerHTML = `${icon(kind === 'ok' ? 'check' : 'alert')}<span>${esc(msg)}</span>`;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 4200);
}

/* ---------- drawer (side sheet on desktop, bottom sheet on phone) ---------- */
let lastFocus = null;
export function drawer(title, body, foot, { wide = false } = {}) {
  closeDrawer(false);
  lastFocus = document.activeElement;
  const wrap = document.createElement('div'); wrap.id = 'drawer'; wrap.className = 'l';
  wrap.innerHTML = `<div class="scrim" data-close></div><aside class="drawer ${wide ? 'drawer--wide' : ''}" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
    <header class="drawer__head"><h2 id="drawer-title">${esc(title)}</h2><button class="icon-btn" type="button" data-close aria-label="Закрыть">${icon('x')}</button></header>
    <div class="drawer__body">${body}</div>${foot ? `<footer class="drawer__foot">${foot}</footer>` : ''}</aside>`;
  document.body.appendChild(wrap);
  wrap.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', () => closeDrawer()));
  document.addEventListener('keydown', escClose);
  setTimeout(() => (wrap.querySelector('textarea, select, input') || wrap.querySelector('.drawer__head .icon-btn'))?.focus(), 60);
  return wrap;
}
function escClose(e) { if (e.key === 'Escape') closeDrawer(); }
export function closeDrawer(restore = true) {
  const d = document.getElementById('drawer'); if (!d) return;
  d.remove(); document.removeEventListener('keydown', escClose);
  if (restore && lastFocus?.isConnected) lastFocus.focus({ preventScroll: true });
}

/* ---------- charts: measured-width SVG, re-rendered on resize so text stays at real pixel size ---------- */
let cid = 0;
const nid = (p) => `${p}-${++cid}`;
/** Mount a chart: render(width) → svg string. Re-renders when the container width changes. */
export function mountChart(el, render) {
  if (!el) return;
  let w = 0;
  const draw = () => { const nw = Math.round(el.clientWidth); if (!nw || nw === w) return; w = nw; el.innerHTML = render(nw); };
  draw();
  if (typeof ResizeObserver !== 'undefined') {
    const ro = new ResizeObserver(() => { if (!el.isConnected) { ro.disconnect(); return; } draw(); });
    ro.observe(el);
  }
}
const trunc = (s, n) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Horizontal bars with the label above each bar and the value at the end of it.
 * rows: [{ label, value, valueText, sub, color, href, group }] (group rows are section headers).
 */
export function hbarsSVG(width, rows, { title, desc, max }) {
  const tid = nid('t'), did = nid('d');
  const m = max ?? Math.max(1e-9, ...rows.filter((r) => !r.group).map((r) => r.value || 0));
  const valW = 64, barH = 12, labelH = 20, gap = 14, groupH = 26;
  let y = 4; const parts = [];
  const maxChars = Math.max(18, Math.floor((width - valW) / 7.4));
  for (const r of rows) {
    if (r.group) { parts.push(`<text x="0" y="${y + 15}" class="ch-group">${esc(r.group)}</text>`); y += groupH; continue; }
    const bw = Math.max(r.value > 0 ? 3 : 0, ((width - valW) * (r.value || 0)) / m);
    const label = trunc(r.label, maxChars);
    const inner = `<text x="0" y="${y + 13}" class="ch-label">${esc(label)}${r.sub ? `<tspan class="ch-sub" dx="8">${esc(r.sub)}</tspan>` : ''}</text>
      <rect x="0" y="${y + labelH}" width="${width - valW}" height="${barH}" rx="${barH / 2}" class="ch-track"/>
      <rect x="0" y="${y + labelH}" width="${bw}" height="${barH}" rx="${barH / 2}" fill="${r.color || 'var(--ink-3)'}"/>
      <text x="${bw + 8}" y="${y + labelH + barH - 1.5}" class="ch-val">${esc(r.valueText ?? fmt(r.value, 1))}</text>
      <title>${esc(`${r.label}: ${r.valueText ?? fmt(r.value, 1)}${r.sub ? ` (${r.sub})` : ''}`)}</title>`;
    parts.push(r.href ? `<a href="${esc(r.href)}" class="ch-link" aria-label="${esc(`${r.label}: ${r.valueText ?? fmt(r.value, 1)}. Открыть диалоги`)}"><rect x="-4" y="${y - 2}" width="${width + 8}" height="${labelH + barH + 8}" rx="8" class="ch-hit"/>${inner}</a>` : `<g>${inner}</g>`);
    y += labelH + barH + gap;
  }
  return `<svg class="chart" width="${width}" height="${y}" viewBox="0 0 ${width} ${y}" role="img" aria-labelledby="${tid} ${did}">
    <title id="${tid}">${esc(title)}</title><desc id="${did}">${esc(desc || '')}</desc>${parts.join('')}</svg>`;
}

/** Histogram of totals in 10-point bins; each bar is stacked by tier so colours match the score rings. */
export function histogramSVG(width, bins, { title, desc, hrefFor }) {
  const tid = nid('t'), did = nid('d');
  const H = 220, pad = { l: 28, r: 4, t: 22, b: 28 };
  const max = Math.max(1, ...bins.map((b) => b.n));
  const iw = width - pad.l - pad.r, bw = iw / bins.length, gapX = Math.min(8, bw * 0.22);
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const step = max <= 5 ? 1 : max <= 12 ? 2 : max <= 30 ? 5 : 10;
  const ticks = []; for (let v = 0; v <= max; v += step) ticks.push(v);
  const col = { low: 'var(--bad)', mid: 'var(--mid)', high: 'var(--good)' };
  return `<svg class="chart" width="${width}" height="${H}" viewBox="0 0 ${width} ${H}" role="img" aria-labelledby="${tid} ${did}">
    <title id="${tid}">${esc(title)}</title><desc id="${did}">${esc(desc || '')}</desc>
    ${ticks.map((v) => `<line x1="${pad.l}" x2="${width - pad.r}" y1="${y(v)}" y2="${y(v)}" class="ch-grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" class="ch-tick">${v}</text>`).join('')}
    ${bins.map((b, i) => {
      const x = pad.l + i * bw + gapX / 2, w = bw - gapX; let acc = 0;
      const segs = ['low', 'mid', 'high'].filter((k) => b[k]).map((k) => { const y0 = y(acc + b[k]), h = y(acc) - y0; acc += b[k]; return `<rect x="${x}" y="${y0}" width="${w}" height="${h}" fill="${col[k]}"/>`; }).join('');
      const label = `${b.from}–${b.to}: ${b.n} ${plural(b.n, ['диалог', 'диалога', 'диалогов'])}`;
      const body = `<rect x="${pad.l + i * bw}" y="${pad.t - 18}" width="${bw}" height="${H - pad.t - pad.b + 18}" class="ch-hit"/>${segs}
        ${b.n ? `<text x="${x + w / 2}" y="${y(b.n) - 6}" text-anchor="middle" class="ch-val">${b.n}</text>` : ''}
        <text x="${pad.l + i * bw}" y="${H - 9}" text-anchor="middle" class="ch-tick">${b.from}</text>${i === bins.length - 1 ? `<text x="${width - pad.r - 6}" y="${H - 9}" text-anchor="end" class="ch-tick">100</text>` : ''}
        <title>${esc(label)}</title>`;
      return b.n && hrefFor ? `<a href="${esc(hrefFor(b))}" class="ch-link" aria-label="${esc(`${label}. Открыть диалоги`)}">${body}</a>` : `<g>${body}</g>`;
    }).join('')}
    <line x1="${pad.l}" x2="${width - pad.r}" y1="${H - pad.b}" y2="${H - pad.b}" class="ch-axis"/>
  </svg>`;
}

/** Score ring (SVG). */
export function ring(total, t, size = 112, stroke = 8) {
  const r = size / 2 - stroke / 2 - 1, c = 2 * Math.PI * r, v = total == null ? 0 : Math.max(0, Math.min(1, total / 100));
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Итог ${total == null ? 'не рассчитан' : `${fmt(total, 2)} из 100`}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--line)" stroke-width="${stroke}"/>
    <circle class="ring__arc" cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${tierVar(t)}" stroke-width="${stroke}" stroke-linecap="round" stroke-dasharray="${c * v} ${c}" data-c="${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
  </svg>`;
}

/** Page header (title + one-line subtitle) in the top bar. */
export function setHead(title, sub = '') {
  const t = document.getElementById('page-title'), s = document.getElementById('page-sub');
  if (t) t.textContent = title;
  if (s) { s.textContent = sub; s.hidden = !sub; }
  document.title = `${title} · Freedom CQA`;
}
/** Small segmented control: options [{ v, label }]. */
export const seg = (id, options, value, label) => `<div class="seg" role="group" aria-label="${esc(label)}" id="${id}">${options.map((o) => `<button type="button" data-v="${esc(o.v)}" aria-pressed="${String(o.v) === String(value)}">${esc(o.label)}</button>`).join('')}</div>`;
