// Small UI helpers: escaping, formatting, icons, hand-made SVG charts.
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => [...el.querySelectorAll(s)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const fmt = (x, d = 1) => (x == null || !Number.isFinite(x) ? '—' : x.toLocaleString('ru-RU', { minimumFractionDigits: d, maximumFractionDigits: d }));
export const pct = (x, d = 0) => (x == null ? '—' : `${fmt(x * 100, d)}%`);
/** Russian plural: plural(5, ['оценка','оценки','оценок']) */
export const plural = (n, [one, few, many]) => { const a = Math.abs(n) % 100, b = a % 10; return a > 10 && a < 20 ? many : b === 1 ? one : b >= 2 && b <= 4 ? few : many; };
export const LANG = { RU: 'Русский', KZ: 'Қазақша', EN: 'English' };
export const CHAN = { chat: 'Чат', call: 'Звонок' };
export const tierColor = (t) => ({ high: 'var(--g-mint)', mid: 'var(--g-amber)', low: 'var(--g-error)', none: 'var(--g-fog)' }[t] || 'var(--g-fog)');
export const clock = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); const h = Math.floor(t / 3600); const m = Math.floor((t % 3600) / 60); const s = t % 60; return `${h ? `${h}:` : ''}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`; };
export const timeOf = (iso) => { try { return new Date(iso).toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

const P = {
  overview: '<path d="M4 13h6V4H4zM14 20h6v-9h-6zM4 20h6v-3H4zM14 7h6V4h-6z"/>',
  live: '<path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4z"/><path d="M8 9h8M8 12h5"/>',
  dialogs: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  analyst: '<path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z"/><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z"/>',
  workspace: '<path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4"/>',
  back: '<path d="M15 18l-6-6 6-6"/>',
  send: '<path d="M4 12l16-8-6 16-2-7z"/>',
  search: '<circle cx="11" cy="11" r="6"/><path d="M20 20l-4.5-4.5"/>',
  flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
};
export const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true" class="ic">${P[name] || ''}</svg>`;

let uid = 0;
const nextId = (p) => `${p}-${++uid}`;

/** Score histogram (10 bins). */
export function histogram(bins, { title, desc }) {
  const W = 560, H = 200, pad = { l: 28, r: 8, t: 14, b: 28 };
  const max = Math.max(1, ...bins.map((b) => b.n));
  const bw = (W - pad.l - pad.r) / bins.length;
  const y = (v) => pad.t + (H - pad.t - pad.b) * (1 - v / max);
  const tid = nextId('t'), did = nextId('d');
  const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-labelledby="${tid} ${did}" preserveAspectRatio="xMidYMid meet">
    <title id="${tid}">${esc(title)}</title><desc id="${did}">${esc(desc)}</desc>
    ${ticks.map((v) => `<line x1="${pad.l}" x2="${W - pad.r}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="${pad.l - 8}" y="${y(v) + 4}" text-anchor="end" class="tick">${v}</text>`).join('')}
    ${bins.map((b, i) => { const x = pad.l + i * bw + 3, h = H - pad.b - y(b.n); const col = b.from >= 80 ? 'var(--g-mint)' : b.from >= 60 ? 'var(--g-amber)' : 'var(--g-error)';
      return `<g><title>${b.from}–${b.to}: ${b.n} диал.</title><rect x="${x}" y="${y(b.n)}" width="${bw - 6}" height="${Math.max(0, h)}" rx="4" fill="${col}" opacity="${b.n ? 0.85 : 0.15}"/>
      ${b.n ? `<text x="${x + (bw - 6) / 2}" y="${y(b.n) - 5}" text-anchor="middle" class="val">${b.n}</text>` : ''}
      <text x="${x + (bw - 6) / 2}" y="${H - 10}" text-anchor="middle" class="tick">${b.from}</text></g>`; }).join('')}
  </svg>`;
}

/** Horizontal bars: items [{label, value, sub, max}] (value 0–100). */
export function hbars(items, { title, max = 100, suffix = '', color = 'var(--g-cloud)', fmtv = (v) => fmt(v, 1) }) {
  return `<ul class="hbars" aria-label="${esc(title)}">${items.map((it) => `
    <li class="hbar">
      <span class="hbar__label">${esc(it.label)}${it.sub ? `<span class="g-label">${esc(it.sub)}</span>` : ''}</span>
      <span class="hbar__track" aria-hidden="true"><span class="hbar__fill" style="width:${Math.max(0, Math.min(100, ((it.value ?? 0) / max) * 100))}%;background:${it.color || color}"></span></span>
      <span class="hbar__val">${it.value == null ? '—' : fmtv(it.value)}${suffix}</span>
    </li>`).join('')}</ul>`;
}

/** Heat-map table: rows [{label, cells:[{value(0-100)|null, n}]}], cols [labels]. */
export function heatmap(rows, cols, { title, desc }) {
  const shade = (v) => { if (v == null) return 'transparent'; const t = Math.max(0, Math.min(1, (100 - v) / 60)); // 100% → calm, ≤40% → strong
    return `rgba(255, 107, 107, ${0.06 + t * 0.55})`; };
  return `<div class="table-wrap"><table class="heat" aria-describedby="${esc(desc ? 'heat-desc' : '')}">
    <caption class="sr-only">${esc(title)}</caption>
    <thead><tr><th scope="col" class="g-label">Критерий</th>${cols.map((c) => `<th scope="col" class="g-label">${esc(c)}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><th scope="row">${esc(r.label)}</th>${r.cells.map((c) => `<td style="background:${shade(c.value)}" title="${c.value == null ? 'нет применимых диалогов' : `${fmt(c.value, 0)}% от максимума · ${c.n} диал.`}"><span>${c.value == null ? '—' : fmt(c.value, 0)}</span></td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>${desc ? `<p class="g-muted small" id="heat-desc">${esc(desc)}</p>` : ''}`;
}

/** Score ring. */
export function ring(total, t, size = 76) {
  const r = size / 2 - 5, c = 2 * Math.PI * r, v = total == null ? 0 : total / 100;
  return `<svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="Итог ${total == null ? 'не рассчитан' : `${fmt(total, 2)} из 100`}">
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="var(--g-steel)" stroke-width="3"/>
    <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none" stroke="${tierColor(t)}" stroke-width="3" stroke-linecap="round" stroke-dasharray="${c * v} ${c}" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" class="ring__num">${total == null ? '—' : fmt(total, 0)}</text>
  </svg>`;
}
