#!/usr/bin/env node
// README charts: recomputes evaluator accuracy from committed files and writes small SVG charts to docs/media/charts/.
//
//   node scripts/readme-charts.mjs
//
// Inputs (all committed, nothing is fetched and no model is called):
//   eval/gold/*.json                 19 human-reviewed gold dialogs (status "reviewed")
//   docs/playbook/split.md           frozen tuning / held-out split (the HELD= line)
//   eval/blind/blind-24.json         two blind labelers on 24 non-gold DEV chats
//   eval/runs/*.evaluations.json     evaluator outputs (one file per run, listed in RUNS below)
//   eval/runs/<run>-DEV.json         run summaries with cost and latency
// Agreement is computed the same way as eval/accuracy.ts (strict: answer == gold answer; lenient: answer is gold or one of
// gold.also_acceptable) and eval/blind/compare.py (consensus = both labelers gave the same answer). The numbers printed to
// stdout are the ones quoted in README.md.
import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const P = (rel) => join(ROOT, rel);
const readJson = (rel) => JSON.parse(readFileSync(P(rel), 'utf8'));
const OUT = 'docs/media/charts';

// ---------- inputs ----------
const RUNS = {
  mock: 'eval/runs/mock-baseline.json',
  haiku: 'eval/runs/2026-11-07T09-36-59-522Z-DEV-anthropic_claude-haiku-5.5.evaluations.json',
  v1: 'eval/runs/2026-11-07T09-48-01-230Z-DEV-openai_gpt-6-luna.evaluations.json',
  v2: 'eval/runs/2026-11-07T13-06-35-972Z-DEV-openai_gpt-6-luna.evaluations.json',
  v3: 'eval/runs/2026-11-07T13-08-56-812Z-DEV-openai_gpt-6-luna.evaluations.json',
  // Full-DEV eval-v4 run; its 19 gold answers are the cached answers of the shipped 13:13 run ("v4a" in the v5 report).
  v4: 'eval/runs/2026-11-07T13-16-16-814Z-DEV-openai_gpt-6-luna.evaluations.json',
  v51: 'eval/runs/2026-11-07T15-00-49-475Z-v51-dev-DEV-openai_gpt-6-luna.evaluations.json',
};
const SUMMARY = {
  v4: 'eval/runs/2026-11-07T13-16-16-814Z-DEV.json',
  v51: 'eval/runs/2026-11-07T15-00-49-475Z-v51-dev-DEV.json',
};
const CRITS = ['c01', 'c02', 'c03', 'c04', 'c05', 'c06', 'c07', 'c08'];
const checklist = readJson('data/checklists/freedom-chat-v1.json');
const SHORT = { c01: 'Установление контакта', c02: 'Выявление потребности', c03: 'Идентификация', c04: 'Консультация', c05: 'Эмпатия', c06: 'Управление диалогом', c07: 'Завершение', c08: 'Грубые ошибки' };
const critLabel = (id) => `C${Number(id.slice(1))} ${SHORT[id] ?? checklist.criteria.find((c) => c.id === id)?.title ?? id}`;

const gold = readdirSync(P('eval/gold')).filter((f) => f.endsWith('.json')).sort()
  .map((f) => readJson(`eval/gold/${f}`)).filter((g) => g.status === 'reviewed');
const held = new Set((readFileSync(P('docs/playbook/split.md'), 'utf8').match(/^HELD=(.+)$/m)?.[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean));
if (gold.length !== 19 || held.size !== 7) throw new Error(`expected 19 reviewed gold dialogs and 7 held-out ids, got ${gold.length} / ${held.size}`);

function loadRun(rel) {
  const raw = readJson(rel);
  const evs = Array.isArray(raw) ? raw : raw.evaluations;
  return new Map(evs.map((e) => [e.conversation_id, Object.fromEntries(e.criteria.map((c) => [c.criterion_id, c.answer]))]));
}
const runs = Object.fromEntries(Object.entries(RUNS).map(([k, rel]) => [k, loadRun(rel)]));

// ---------- agreement with gold (same rules as eval/accuracy.ts) ----------
const same = (a, b) => a !== undefined && b !== undefined && String(a) === String(b);
function vsGold(run, filter = () => true) {
  const cell = () => ({ n: 0, strict: 0, lenient: 0 });
  const per = Object.fromEntries(CRITS.map((c) => [c, cell()]));
  const lang = {}, all = cell();
  let tp = 0, fn = 0, fp = 0;
  for (const g of gold.filter(filter)) {
    const ans = run.get(g.conversation_id);
    if (!ans) throw new Error(`run is missing gold dialog ${g.conversation_id}`);
    for (const c of CRITS) {
      const gl = g.labels[c]; const m = ans[c];
      const s = same(m, gl.answer), l = s || (gl.also_acceptable ?? []).some((a) => same(m, a));
      for (const x of [per[c], (lang[g.language] ??= cell()), all]) { x.n++; x.strict += s; x.lenient += l; }
      if (c === 'c08') { if (gl.answer === 'yes' && m === 'yes') tp++; else if (gl.answer === 'yes') fn++; else if (m === 'yes') fp++; }
    }
  }
  return { per, lang, all, gross: { tp, fn, fp } };
}
const pct = (x) => (x.n ? (100 * x.strict) / x.n : null);
const pctL = (x) => (x.n ? (100 * x.lenient) / x.n : null);

// ---------- agreement with the blind labelers' consensus (same rules as eval/blind/compare.py) ----------
const norm = (a) => {
  if (a === null || a === undefined) return null;
  const s = String(a).trim().toLowerCase();
  if (['n/a', 'na', 'null'].includes(s)) return 'na';
  const f = Number(s);
  return s !== '' && Number.isFinite(f) ? String(f) : s;
};
const blind = readJson('eval/blind/blind-24.json').labelers;
const blindIds = Object.keys(blind.A).filter((id) => blind.B[id]).sort();
let labelersAgree = 0;
for (const id of blindIds) for (const c of CRITS) labelersAgree += norm(blind.A[id][c].a) === norm(blind.B[id][c].a);
function vsBlind(run) {
  let n = 0, hit = 0;
  for (const id of blindIds) {
    const ans = run.get(id);
    if (!ans) throw new Error(`run is missing blind dialog ${id}`);
    for (const c of CRITS) {
      const a = norm(blind.A[id][c].a);
      if (a !== norm(blind.B[id][c].a)) continue;
      n++; hit += norm(ans[c]) === a;
    }
  }
  return { n, strict: hit };
}

// ---------- numbers ----------
const g4 = vsGold(runs.v4), g51 = vsGold(runs.v51);
const h4 = vsGold(runs.v4, (g) => held.has(g.conversation_id)), h51 = vsGold(runs.v51, (g) => held.has(g.conversation_id));
const b4 = vsBlind(runs.v4), b51 = vsBlind(runs.v51);
const history = [
  { key: 'mock', label: 'Keyword mock, no AI', note: 'baseline' },
  { key: 'haiku', label: 'Claude Haiku 5.5 · eval-v1', note: 'model trial, not chosen' },
  { key: 'v1', label: 'GPT-6 Luna · eval-v1', note: 'model chosen' },
  { key: 'v2', label: 'GPT-6 Luna · eval-v2', note: 'rejected: hand-offs scored 5 of 20' },
  { key: 'v3', label: 'GPT-6 Luna · eval-v3', note: 'rejected: false gross errors on 2 real calls' },
  { key: 'v4', label: 'GPT-6 Luna · eval-v4', note: 'previous default' },
  { key: 'v51', label: 'GPT-6 Luna · eval-v5.1', note: 'current default', current: true },
].map((h) => ({ ...h, ...vsGold(runs[h.key]) }));

function latency(rel) {
  const s = readJson(rel);
  const fresh = s.rows.filter((r) => r.cached === false);
  const q = (rows, p) => { const lat = rows.map((r) => r.model_ms).sort((a, b) => a - b); return lat.length ? lat[Math.min(lat.length - 1, Math.floor(p * lat.length))] : null; };
  const chats = fresh.filter((r) => r.id.startsWith('p1-')), calls = fresh.filter((r) => r.id.startsWith('p4-'));
  const avg = (rows) => (rows.length ? +(rows.reduce((a, r) => a + (r.cost || 0), 0) / rows.length).toFixed(5) : null);
  return { costPerEval: s.cost_usd_per_eval, costTotal: s.cost_usd_total, n: s.n, fresh: fresh.length, errors: s.errors, chatCost: avg(chats), callCost: avg(calls),
    p50: s.latency_ms_p50, p95: s.latency_ms_p95, chatP50: q(chats, 0.5), chatP95: q(chats, 0.95), callP50: q(calls, 0.5), callP95: q(calls, 0.95) };
}
const lat51 = latency(SUMMARY.v51), lat4 = latency(SUMMARY.v4);
const grossDev = [...runs.v51.entries()].filter(([, a]) => a.c08 === 'yes').map(([id]) => id).sort();

// ---------- SVG ----------
const C = {
  ink: '#0e151c', ink2: '#3c4650', ink3: '#6b7680', line: '#e6e8e4', lineStrong: '#d4d8d2',
  green: '#02b140', greenInk: '#0a7a33', before: '#868f97', bg: '#ffffff',
};
const FONT = "Onest, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const W = 760, PAD = 28;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const f1 = (v) => (v === 100 ? '100' : v.toFixed(1));
const num = 'font-variant-numeric:tabular-nums';

function frame(h, { title, subtitle, desc, source }, body) {
  const sub = (Array.isArray(subtitle) ? subtitle : [subtitle]).map((line, i) => `<text x="${PAD}" y="${78 + i * 18}" font-size="13" fill="${C.ink2}">${esc(line)}</text>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${h}" viewBox="0 0 ${W} ${h}" role="img" aria-labelledby="title desc" font-family="${esc(FONT)}">
<title id="title">${esc(title)}</title>
<desc id="desc">${esc(desc)}</desc>
<rect x="0.5" y="0.5" width="${W - 1}" height="${h - 1}" rx="16" fill="${C.bg}" stroke="${C.line}"/>
<rect x="${PAD}" y="26" width="28" height="4" rx="2" fill="${C.green}"/>
<text x="${PAD}" y="56" font-size="18" font-weight="600" fill="${C.ink}">${esc(title)}</text>
${sub}
${body}
<text x="${PAD}" y="${h - 18}" font-size="11" fill="${C.ink3}">${esc(source)}</text>
</svg>
`;
}

function legend(y, items) {
  let x = PAD;
  return items.map(({ color, label }) => {
    const out = `<circle cx="${x + 6}" cy="${y - 4}" r="6" fill="${color}"/><text x="${x + 18}" y="${y}" font-size="12.5" fill="${C.ink2}">${esc(label)}</text>`;
    x += 18 + label.length * 6.9 + 26;
    return out;
  }).join('');
}

/** Dumbbell rows: one gray dot (before) and one green dot (after) per row, numbers in a right-hand column. */
function dumbbell({ rows, min, max, ticks, top, rowH, labelW = 230, colW = 118, beforeName, afterName }) {
  const x0 = PAD + labelW, x1 = W - PAD - colW;
  const x = (v) => x0 + ((v - min) / (max - min)) * (x1 - x0);
  const bottom = top + rows.length * rowH;
  let s = '';
  for (const t of ticks) {
    s += `<line x1="${x(t)}" y1="${top - 6}" x2="${x(t)}" y2="${bottom}" stroke="${C.line}" stroke-width="1"/>`;
    s += `<text x="${x(t)}" y="${bottom + 18}" font-size="11.5" fill="${C.ink3}" text-anchor="middle" style="${num}">${t}%</text>`;
  }
  s += `<text x="${W - PAD}" y="${top - 12}" font-size="11.5" fill="${C.ink3}" text-anchor="end">${esc(beforeName)} → ${esc(afterName)}</text>`;
  rows.forEach((r, i) => {
    const cy = top + i * rowH + rowH / 2;
    if (r.sub) {
      s += `<text x="${PAD}" y="${cy - 3}" font-size="13" fill="${C.ink}">${esc(r.label)}</text>`;
      s += `<text x="${PAD}" y="${cy + 13}" font-size="11.5" fill="${C.ink3}">${esc(r.sub)}</text>`;
    } else s += `<text x="${PAD}" y="${cy + 4.5}" font-size="13" fill="${C.ink}">${esc(r.label)}</text>`;
    if (Math.abs(r.a - r.b) > 1e-9) s += `<line x1="${x(r.a)}" y1="${cy}" x2="${x(r.b)}" y2="${cy}" stroke="${C.lineStrong}" stroke-width="2" stroke-linecap="round"/>`;
    s += `<circle cx="${x(r.a)}" cy="${cy}" r="6" fill="${C.before}" stroke="${C.bg}" stroke-width="2"/>`;
    s += `<circle cx="${x(r.b)}" cy="${cy}" r="6" fill="${C.greenInk}" stroke="${C.bg}" stroke-width="2"/>`;
    s += `<text x="${W - PAD}" y="${cy + 4.5}" font-size="13" text-anchor="end" style="${num}"><tspan fill="${C.ink3}">${f1(r.a)} → </tspan><tspan fill="${C.ink}" font-weight="600">${f1(r.b)}</tspan></text>`;
  });
  return { svg: s, bottom: bottom + 18 };
}

function chartPerCriterion() {
  const rows = CRITS.map((c) => ({ label: critLabel(c), a: pct(g4.per[c]), b: pct(g51.per[c]) }));
  const top = 128, rowH = 34;
  const d = dumbbell({ rows, min: 50, max: 100, ticks: [50, 60, 70, 80, 90, 100], top, rowH, beforeName: 'v4', afterName: 'v5.1' });
  const h = d.bottom + 48;
  return frame(h, {
    title: 'Agreement with gold labels, per criterion',
    subtitle: `Strict agreement on all ${g51.all.n / 8} human-reviewed gold dialogs, ${g51.all.n} answers. Overall ${f1(pct(g4.all))}% → ${f1(pct(g51.all))}%.`,
    desc: `Dot plot comparing eval-v4 and eval-v5.1 per checklist criterion. ${rows.map((r) => `${r.label}: ${f1(r.a)}% to ${f1(r.b)}%`).join('; ')}.`,
    source: 'Source: eval/gold, eval/runs (v4 13-16-16, v5.1 15-00-49) · node scripts/readme-charts.mjs',
  }, legend(108, [{ color: C.before, label: 'eval-v4, previous default' }, { color: C.greenInk, label: 'eval-v5.1, current default' }]) + d.svg);
}

function chartOverall() {
  const rows = [
    { label: 'Held-out gold', sub: `${h51.all.n / 8} dialogs, ${h51.all.n} answers, no prompt change made for them`, a: pct(h4.all), b: pct(h51.all) },
    { label: 'All gold', sub: `${g51.all.n / 8} dialogs, ${g51.all.n} answers, prompts tuned while reading them`, a: pct(g4.all), b: pct(g51.all) },
    { label: 'Blind labelers, consensus', sub: `${blindIds.length} other DEV chats, ${b51.n} answers both labelers agree on`, a: (100 * b4.strict) / b4.n, b: (100 * b51.strict) / b51.n },
  ];
  const top = 128, rowH = 52;
  const d = dumbbell({ rows, min: 85, max: 100, ticks: [85, 90, 95, 100], top, rowH, labelW: 300, beforeName: 'v4', afterName: 'v5.1' });
  const h = d.bottom + 48;
  return frame(h, {
    title: 'Overall agreement on three checks',
    subtitle: 'Strict agreement (same answer). The held-out and blind checks guard against fitting our own gold labels.',
    desc: `Dot plot comparing eval-v4 and eval-v5.1. ${rows.map((r) => `${r.label}: ${f1(r.a)}% to ${f1(r.b)}%`).join('; ')}.`,
    source: 'Source: eval/gold, docs/playbook/split.md, eval/blind/blind-24.json, eval/runs · node scripts/readme-charts.mjs',
  }, legend(108, [{ color: C.before, label: 'eval-v4' }, { color: C.greenInk, label: 'eval-v5.1' }]) + d.svg);
}

function chartHistory() {
  const labelW = 262, colW = 92, tipRoom = 54;
  const x0 = PAD + labelW, x1 = W - PAD - colW - tipRoom;
  const x = (v) => x0 + (v / 100) * (x1 - x0);
  const top = 112, rowH = 42, barH = 18;
  const bottom = top + history.length * rowH;
  let s = '';
  for (const t of [0, 25, 50, 75, 100]) {
    s += `<line x1="${x(t)}" y1="${top - 6}" x2="${x(t)}" y2="${bottom}" stroke="${C.line}" stroke-width="1"/>`;
    s += `<text x="${x(t)}" y="${bottom + 18}" font-size="11.5" fill="${C.ink3}" text-anchor="middle" style="${num}">${t}%</text>`;
  }
  s += `<text x="${W - PAD}" y="${top - 12}" font-size="11.5" fill="${C.ink3}" text-anchor="end">Gross errors found</text>`;
  history.forEach((h, i) => {
    const cy = top + i * rowH + rowH / 2;
    const v = pct(h.all), xe = x(v), y = cy - barH / 2, r = 4;
    const fill = h.current ? C.greenInk : C.before;
    s += `<text x="${PAD}" y="${cy - 3}" font-size="13" fill="${C.ink}"${h.current ? ' font-weight="600"' : ''}>${esc(h.label)}</text>`;
    s += `<text x="${PAD}" y="${cy + 13}" font-size="11.5" fill="${C.ink3}">${esc(h.note)}</text>`;
    s += `<path d="M${x0} ${y}H${xe - r}Q${xe} ${y} ${xe} ${y + r}V${y + barH - r}Q${xe} ${y + barH} ${xe - r} ${y + barH}H${x0}Z" fill="${fill}"/>`;
    // white halo so a gridline behind the value label never cuts through the digits
    s += `<text x="${xe + 8}" y="${cy + 4.5}" font-size="13" fill="${C.ink}"${h.current ? ' font-weight="600"' : ''} stroke="${C.bg}" stroke-width="4" stroke-linejoin="round" paint-order="stroke" style="${num}">${f1(v)}%</text>`;
    s += `<text x="${W - PAD}" y="${cy + 4.5}" font-size="13" fill="${C.ink}" text-anchor="end" style="${num}">${h.gross.tp} of ${h.gross.tp + h.gross.fn}</text>`;
  });
  const h = bottom + 18 + 48;
  return frame(h, {
    title: 'How the evaluator got here',
    subtitle: `Strict agreement on the same ${gold.length} gold dialogs, ${g51.all.n} answers, in the order we tried things on 2026-11-07.`,
    desc: `Bar chart of strict agreement per evaluator version. ${history.map((r) => `${r.label}: ${f1(pct(r.all))}%, gross errors ${r.gross.tp} of ${r.gross.tp + r.gross.fn}`).join('; ')}.`,
    source: 'Source: eval/gold, eval/runs/*.evaluations.json · node scripts/readme-charts.mjs',
  }, s);
}

mkdirSync(P(OUT), { recursive: true });
const files = {
  'accuracy-per-criterion.svg': chartPerCriterion(),
  'accuracy-overall.svg': chartOverall(),
  'accuracy-history.svg': chartHistory(),
};
for (const [name, svg] of Object.entries(files)) writeFileSync(P(`${OUT}/${name}`), svg);

// ---------- printed summary (the README numbers) ----------
const line = (label, x) => `${label.padEnd(34)} ${f1(pct(x)).padStart(5)}% strict  ${f1(pctL(x)).padStart(5)}% lenient  (n=${x.n})`;
console.log(`Charts → ${OUT}/ (${Object.keys(files).join(', ')})\n`);
console.log('Per criterion, all gold (v4 → v5.1, strict | v5.1 lenient)');
for (const c of CRITS) console.log(`  ${critLabel(c).padEnd(28)} ${f1(pct(g4.per[c])).padStart(5)} → ${f1(pct(g51.per[c])).padStart(5)}   | ${f1(pctL(g51.per[c]))}`);
console.log('\nOverall');
console.log(line('  held-out v4', h4.all)); console.log(line('  held-out v5.1', h51.all));
console.log(line('  all gold v4', g4.all)); console.log(line('  all gold v5.1', g51.all));
console.log(`  blind consensus v4                 ${b4.strict}/${b4.n} = ${f1((100 * b4.strict) / b4.n)}%`);
console.log(`  blind consensus v5.1               ${b51.strict}/${b51.n} = ${f1((100 * b51.strict) / b51.n)}%`);
console.log(`  labelers agree with each other     ${labelersAgree}/${blindIds.length * 8} = ${f1((100 * labelersAgree) / (blindIds.length * 8))}%`);
console.log('\nv5.1 by language (all gold)');
for (const [l, x] of Object.entries(g51.lang).sort()) console.log(line(`  ${l}`, x));
console.log(`\nGross errors on gold: v4 ${g4.gross.tp}/${g4.gross.tp + g4.gross.fn} found, ${g4.gross.fp} false · v5.1 ${g51.gross.tp}/${g51.gross.tp + g51.gross.fn} found, ${g51.gross.fp} false`);
console.log(`v5.1 flags gross errors in ${grossDev.length} of ${runs.v51.size} DEV dialogs: ${grossDev.join(', ')}`);
console.log('\nHistory (all gold, strict)');
for (const h of history) console.log(`  ${h.label.padEnd(30)} ${f1(pct(h.all)).padStart(5)}%  gross ${h.gross.tp}/${h.gross.tp + h.gross.fn}, ${h.gross.fp} false`);
const sec = (ms) => (ms == null ? '–' : `${(ms / 1000).toFixed(1)} s`);
console.log('\nCost and latency (fresh model calls, model time)');
for (const [k, x] of [['v4', lat4], ['v5.1', lat51]]) {
  console.log(`  ${k.padEnd(5)} $${x.costPerEval}/eval ($${x.costTotal} for ${x.fresh} fresh of ${x.n}, ${x.errors} errors) · chats $${x.chatCost} p50 ${sec(x.chatP50)} p95 ${sec(x.chatP95)} · calls $${x.callCost} p50 ${sec(x.callP50)} p95 ${sec(x.callP95)}`);
}
