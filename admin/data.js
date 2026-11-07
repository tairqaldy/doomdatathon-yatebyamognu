// Data layer for the admin console: loads DEV evaluations + dataset + checklist + metrics, merges evaluated
// live sessions, and computes every aggregate client-side with the deterministic scoring engine.
import { score, tier } from '/prototype/scoring.js';
import * as live from '/shared/live-store.js';

const D = { checklist: null, dataset: null, evals: null, metrics: null };

export async function loadAll() {
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
  const [checklist, dataset, evals, metrics] = await Promise.all([
    get('/data/checklists/freedom-chat-v1.json'),
    get('/data/datasets/DEV.json'),
    get('/data/evaluations/DEV.json'),
    get('/eval/runs/gpt-6-luna-eval-v1.metrics.json').catch(() => null),
  ]);
  Object.assign(D, { checklist, dataset, evals, metrics });
  return D;
}
export const checklist = () => D.checklist;
export const metrics = () => D.metrics;
export const evalMeta = () => D.evals;
export const crits = () => [...D.checklist.criteria].sort((a, b) => a.order - b.order);
export const scoredCrits = () => crits().filter((c) => c.type !== 'flag' && c.weight > 0);
export const critById = (id) => D.checklist.criteria.find((c) => c.id === id);
export const modelLabel = (m) => String(m || '').replace(/^openai:/, '').replace(/^gpt-6-luna$/, 'GPT-6 Luna') || 'AI';

const answersOf = (res) => Object.fromEntries(Object.entries(res?.answers || {}).map(([k, v]) => [k, v?.answer]));
const chan = (c) => (/voice|call/i.test(c || '') ? 'call' : 'chat');

function buildRow({ id, source, language, channel, transcript, res, session }) {
  const sc = score(D.checklist, answersOf(res));
  const losses = sc.criteria.filter((r) => r.points != null && r.effective_weight != null)
    .map((r) => ({ id: r.criterion_id, lost: Math.max(0, r.effective_weight - r.points), reason: res.answers?.[r.criterion_id]?.deduction_reason || '' }))
    .filter((l) => l.lost > 0.001).sort((a, b) => b.lost - a.lost);
  const gross = sc.gross_error;
  const grossReason = gross ? res.answers?.c08?.deduction_reason || res.answers?.c08?.explanation || '' : '';
  const main = gross ? { id: 'c08', reason: grossReason } : losses[0] || null;
  return { id, source, language: (language || 'RU').toUpperCase(), channel: chan(channel), transcript, res, session, sc, total: sc.total, tier: tier(sc.total), gross, losses, main };
}

/** Every evaluated dialog: 65 DEV + live sessions that have an evaluation. */
export function rows() {
  const recs = D.dataset.data.records;
  const out = [];
  for (const r of recs) {
    const res = D.evals.results[r.conversation_id];
    if (!res) continue;
    out.push(buildRow({ id: r.conversation_id, source: 'DEV', language: r.language, channel: r.channel, transcript: r.transcript, res }));
  }
  for (const s of live.all()) {
    if (!s.evaluation?.answers) continue;
    out.push(buildRow({ id: s.id, source: 'live', language: s.language, channel: s.channel, transcript: s.messages, res: s.evaluation, session: s }));
  }
  return out;
}
export const liveRow = (s) => (s?.evaluation?.answers ? buildRow({ id: s.id, source: 'live', language: s.language, channel: s.channel, transcript: s.messages, res: s.evaluation, session: s }) : null);

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
export const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

function readAppeals() {
  try {
    const raw = JSON.parse(localStorage.getItem('cqa-prototype-v2') || 'null');
    const list = Array.isArray(raw?.appeals) ? raw.appeals : [];
    return { total: list.length, open: list.filter((a) => a?.status === 'open').length, changed: list.filter((a) => a?.status === 'changed').length, confirmed: list.filter((a) => a?.status === 'confirmed').length };
  } catch { return { total: 0, open: 0, changed: 0, confirmed: 0 }; }
}

export function liveStats() {
  const ss = live.all();
  const today = new Date().toDateString();
  const csats = ss.map((s) => Number(s.csat)).filter((x) => Number.isFinite(x) && x > 0);
  return {
    count: ss.length,
    today: ss.filter((s) => new Date(s.started_at).toDateString() === today).length,
    handoffs: ss.filter((s) => s.handoff).length,
    handoff_rate: ss.length ? ss.filter((s) => s.handoff).length / ss.length : null,
    waiting: ss.filter((s) => s.status === 'waiting_operator').length,
    csat_avg: mean(csats), csat_n: csats.length,
    evaluated: ss.filter((s) => s.evaluation?.answers).length,
  };
}

/** Group helper → { key: { n, avg } } */
function groupAvg(list, keyFn) {
  const g = {};
  for (const r of list) { const k = keyFn(r); (g[k] ||= []).push(r); }
  return Object.fromEntries(Object.entries(g).map(([k, rs]) => { const t = rs.map((r) => r.total).filter((x) => x != null); return [k, { n: rs.length, avg: r1(mean(t)), gross: rs.filter((r) => r.gross).length }]; }));
}

/** All aggregates used by the overview + the compact stats sent to the AI analyst. */
export function compute(list = rows()) {
  const totals = list.map((r) => r.total).filter((x) => x != null);
  const cs = scoredCrits();
  const loss = cs.map((c) => {
    let lost = 0, applicable = 0, na = 0, full = 0;
    for (const r of list) {
      const row = r.sc.criteria.find((x) => x.criterion_id === c.id);
      if (!row || row.points == null) { na++; continue; }
      applicable++; const l = Math.max(0, row.effective_weight - row.points); lost += l; if (l < 0.001) full++;
    }
    return { id: c.id, title: c.title, weight: c.weight, avg_lost: list.length ? lost / list.length : 0, applicable, na_rate: list.length ? na / list.length : 0, full_rate: applicable ? full / applicable : null };
  });
  const langs = ['RU', 'KZ', 'EN'];
  const heat = cs.map((c) => ({ id: c.id, title: c.title, cells: langs.map((L) => {
    let got = 0, max = 0, n = 0;
    for (const r of list) { if (r.language !== L) continue; const row = r.sc.criteria.find((x) => x.criterion_id === c.id); if (!row || row.points == null) continue; got += row.points; max += row.effective_weight; n++; }
    return { lang: L, n, pct: max > 0 ? (got / max) * 100 : null };
  }) }));
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, n: 0, ids: [] }));
  for (const r of list) { if (r.total == null) continue; const i = Math.min(9, Math.floor(r.total / 10)); bins[i].n++; bins[i].ids.push(r.id); }

  // Deduction reasons grouped by criterion (texts are free-form, so identical ones are counted together).
  const reasons = {};
  for (const r of list) for (const l of r.losses) {
    if (!l.reason) continue;
    const g = (reasons[l.id] ||= { id: l.id, title: critById(l.id)?.title || l.id, dialogs: 0, lost: 0, items: new Map() });
    g.dialogs++; g.lost += l.lost;
    const key = l.reason.trim().toLowerCase().replace(/[.!…\s]+$/, '');
    const it = g.items.get(key) || { text: l.reason.trim(), count: 0, ids: [], lost: 0 };
    it.count++; it.ids.push(r.id); it.lost += l.lost; g.items.set(key, it);
  }
  for (const r of list) if (r.gross) {
    const g = (reasons.c08 ||= { id: 'c08', title: critById('c08')?.title || 'Грубые ошибки', dialogs: 0, lost: 0, items: new Map(), gross: true });
    const t = (r.res.answers?.c08?.deduction_reason || r.res.answers?.c08?.explanation || 'Грубая ошибка').trim();
    g.dialogs++; const key = t.toLowerCase(); const it = g.items.get(key) || { text: t, count: 0, ids: [], lost: 0 }; it.count++; it.ids.push(r.id); g.items.set(key, it);
  }
  const reasonGroups = Object.values(reasons).map((g) => ({ ...g, items: [...g.items.values()].sort((a, b) => b.count - a.count || b.lost - a.lost) }))
    .sort((a, b) => (b.gross ? 1 : 0) - (a.gross ? 1 : 0) || b.lost - a.lost);

  const costs = list.filter((r) => r.source === 'DEV').map((r) => Number(r.res.usage?.cost)).filter((x) => Number.isFinite(x) && x > 0);
  return {
    n: list.length, n_dev: list.filter((r) => r.source === 'DEV').length, n_live: list.filter((r) => r.source === 'live').length,
    avg: r1(mean(totals)), median: r1(median(totals)), gross: list.filter((r) => r.gross).length,
    byLang: groupAvg(list, (r) => r.language), byChannel: groupAvg(list, (r) => r.channel),
    loss, heat, bins, reasonGroups,
    cost: median(costs) ?? 0.00105,
    live: liveStats(), appeals: readAppeals(),
  };
}

/** Compact payload for POST /api/insights (aggregates only, no transcripts). */
export function statsForAI(st = compute()) {
  const m = metrics();
  const top = [];
  for (const g of st.reasonGroups) for (const it of g.items) top.push({ criterion: `${g.id} ${g.title}`, reason: it.text, count: it.count, example_ids: it.ids.slice(0, 2), lost: r1(it.lost) });
  top.sort((a, b) => b.count - a.count || (b.lost || 0) - (a.lost || 0));
  return {
    checklist: `${checklist().name} v${checklist().version}`,
    model: modelLabel(D.evals.model),
    dialogs: { total: st.n, dev: st.n_dev, live_evaluated: st.n_live },
    score: { avg: st.avg, median: st.median, distribution: st.bins.map((b) => ({ range: `${b.from}-${b.to}`, n: b.n })) },
    by_language: st.byLang, by_channel: st.byChannel,
    gross_errors: st.gross,
    loss_per_criterion: st.loss.map((l) => ({ id: l.id, title: l.title, weight: l.weight, avg_points_lost: r2(l.avg_lost), na_rate: r2(l.na_rate), full_score_rate: r2(l.full_rate) })),
    criterion_by_language_pct: Object.fromEntries(st.heat.map((h) => [h.id, Object.fromEntries(h.cells.map((c) => [c.lang, r1(c.pct)]))])),
    top_deduction_reasons: top.slice(0, 12),
    live_sessions: { count: st.live.count, today: st.live.today, handoff_rate: r2(st.live.handoff_rate), csat_avg: r2(st.live.csat_avg), csat_n: st.live.csat_n, waiting_now: st.live.waiting },
    appeals: st.appeals,
    ai_vs_human: m ? { strict_agreement_pct: m.overall?.strict, lenient_pct: m.overall?.lenient, total_mae: m.total?.mae, gross_recall_pct: m.gross_error?.recall, evidence_hit_pct: m.evidence?.hit_rate, gold_dialogs: m.gold_dialogs } : null,
  };
}

/** Where a dialog opens: DEV → deep analyst workspace, live → live console. */
export const hrefFor = (id, source) => (source === 'live' || String(id).startsWith('live-') ? `#/live/${encodeURIComponent(id)}` : `/prototype/#/dialog/${encodeURIComponent(id)}`);
export { maxStep as maxStepOf } from '/prototype/scoring.js';
