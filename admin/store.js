// Workspace state for the admin console. Ported from prototype/app.js and kept 1:1 compatible with it:
// same localStorage key "cqa-prototype-v2", same shapes for checklists / activeVersion / appeals / role / ai,
// same AI cache key `${conversation_id}|${clHash(checklist)}`. So /prototype and /admin stay in sync.
// All arithmetic goes through prototype/scoring.js (the LLM never computes totals).
import { score, tier, maxStep } from '/prototype/scoring.js';
import { mockEvaluate, mockSummary } from '/prototype/mock-evaluator.js';
import * as live from '/shared/live-store.js';

export { score, tier, maxStep };
export const LS_KEY = 'cqa-prototype-v2';           // chat checklist versions, appeals, role, AI cache (shared with /prototype)
export const CALL_KEY = 'cqa-call-checklists-v1';    // call checklist versions (admin only)
export const KINDS = { chat: { label: 'Чаты', name: 'Чек-лист чатов', file: '/data/checklists/freedom-chat-v1.json' }, call: { label: 'Звонки', name: 'Чек-лист звонков', file: '/data/checklists/freedom-call-v1.json' } };
export const S = {
  convs: [], byId: {}, checklists: [], activeVersion: 1, appeals: [], role: 'qa', ai: {}, call: { checklists: [], activeVersion: 1 },
  mock: {}, lastTotals: {}, api: { ok: false, ai: false, model: null }, metrics: null, pre: null, busy: null, single: {},
};

/* ---------- events: 'change' re-renders the view, 'busy' only updates the progress pill ---------- */
const bus = new EventTarget();
export const on = (type, fn) => { const h = (e) => fn(e.detail); bus.addEventListener(type, h); return () => bus.removeEventListener(type, h); };
export const emit = (type, detail) => bus.dispatchEvent(new CustomEvent(type, { detail }));

/* ---------- hashing (identical to the prototype) ---------- */
const strHash = (s) => { let h = 2166136261; for (const ch of s) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); };
export { strHash };
export const clHash = (cl) => strHash(JSON.stringify(cl.criteria.map(({ id, title, description, type, weight, na_allowed, na_condition, scale }) => [id, title, description, type, weight, na_allowed, na_condition, scale])));
const aiKey = (convId, cl) => `${convId}|${clHash(cl)}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Versions + active version per checklist kind ('chat' lives in the shared prototype key, 'call' in its own key). */
export const versionsOf = (kind) => (kind === 'call' ? S.call.checklists : S.checklists);
export const activeVersionOf = (kind) => (kind === 'call' ? S.call.activeVersion : S.activeVersion);
export function setActiveVersion(kind, v) { if (kind === 'call') S.call.activeVersion = v; else S.activeVersion = v; persist(); }
export function addVersion(kind, cl) { versionsOf(kind).push(cl); setActiveVersion(kind, cl.version); }
export const checklistOf = (kind) => versionsOf(kind).find((c) => c.version === activeVersionOf(kind)) || versionsOf(kind).at(-1);
export const checklist = () => checklistOf('chat');
export const kindOf = (conv) => (isCall(conv) ? 'call' : 'chat');
export const checklistFor = (conv) => checklistOf(kindOf(conv));
export const kindOfChecklist = (cl) => (cl?.id === 'freedom-call' || cl?.channel === 'voice call' ? 'call' : 'chat');
export const checklistLabel = (cl) => `${KINDS[kindOfChecklist(cl)].name} v${cl.version}`;
export const sortedCrits = (cl = checklist()) => [...cl.criteria].sort((a, b) => a.order - b.order);
export const aiReady = () => S.api.ok && S.api.ai;
export const modelLabel = (m) => { const s = String(m || '').replace(/^openai:/, '').split('/').pop(); return s === 'gpt-6-luna' ? 'GPT-6 Luna' : s === 'mock' ? 'Без AI' : s || 'AI'; };

/* ---------- persistence ---------- */
export function persist() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ checklists: S.checklists, activeVersion: S.activeVersion, appeals: S.appeals, role: S.role, ai: S.ai })); }
  catch (e) { console.warn('CQA: не удалось сохранить состояние', e); }
  try { localStorage.setItem(CALL_KEY, JSON.stringify({ checklists: S.call.checklists, activeVersion: S.call.activeVersion })); } catch {}
}
const restore = () => { try { return JSON.parse(localStorage.getItem(LS_KEY) || 'null'); } catch { return null; } };
const restoreCall = () => { try { return JSON.parse(localStorage.getItem(CALL_KEY) || 'null'); } catch { return null; } };
/** Precomputed DEV results (data/evaluations/DEV.json) are valid for the base checklists only: every dialog under the
 *  base chat checklist (exactly as /prototype does), and calls also under the base call checklist (same criteria ids
 *  and weights, so the same answers score identically; "Оценить заново" re-runs them with the call checklist). */
function mergePre() {
  const pre = S.pre; if (!pre?.results || !S.checklists.length) return;
  const k = clHash(S.checklists[0]); const kc = S.call.checklists.length ? clHash(S.call.checklists[0]) : null;
  for (const [id, r] of Object.entries(pre.results)) {
    const v = () => ({ answers: r.answers, summary: r.summary, model: r.model || pre.model, usage: r.usage });
    if (!S.ai[`${id}|${k}`]) S.ai[`${id}|${k}`] = v();
    if (kc && isCall(S.byId[id]) && !S.ai[`${id}|${kc}`]) S.ai[`${id}|${kc}`] = v();
  }
}
/** Re-read the shared state (another tab, e.g. /prototype, may have written it). */
export function refresh() {
  const sc = restoreCall();
  if (sc?.checklists?.length) { S.call.checklists = sc.checklists; S.call.activeVersion = sc.activeVersion || S.call.activeVersion; }
  const saved = restore(); if (!saved) return;
  if (saved.checklists?.length) S.checklists = saved.checklists;
  S.activeVersion = saved.activeVersion || S.activeVersion;
  S.appeals = Array.isArray(saved.appeals) ? saved.appeals : [];
  S.role = saved.role || S.role;
  S.ai = { ...S.ai, ...(saved.ai || {}) };
  mergePre();
}

async function apiHealth() {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' }); if (!r.ok) throw 0; const j = await r.json();
    S.api = { ok: true, ai: !!(j.openrouter || j.openai), model: j.models?.eval || null, passcodeSet: !!j.admin_passcode_set };
  } catch { S.api = { ok: false, ai: false, model: null }; }
}
async function loadMetrics() {
  for (const u of ['/eval/runs/gpt-6-luna-eval-v5.1.metrics.json', '/eval/runs/gpt-6-luna-eval-v4.metrics.json', '/eval/runs/gpt-6-luna-eval-v1.metrics.json']) {
    try { const r = await fetch(u, { cache: 'no-store' }); if (r.ok) return await r.json(); } catch {}
  }
  return null;
}

export async function load() {
  const get = (u) => fetch(u, { cache: 'no-store' }).then((r) => { if (!r.ok) throw new Error(`${u}: ${r.status}`); return r.json(); });
  const [ds, cl, callCl, pre, metrics] = await Promise.all([
    get('/data/datasets/DEV.json'), get(KINDS.chat.file), get(KINDS.call.file).catch(() => null),
    get('/data/evaluations/DEV.json').catch(() => null), loadMetrics(), apiHealth(),
  ]);
  S.convs = ds.data.records; S.byId = Object.fromEntries(S.convs.map((c) => [c.conversation_id, c]));
  S.pre = pre; S.metrics = metrics;
  const saved = restore();
  S.checklists = saved?.checklists?.length ? saved.checklists : [{ ...cl, version: 1, updated_at: new Date().toISOString() }];
  S.activeVersion = saved?.activeVersion || 1; S.appeals = saved?.appeals || []; S.role = saved?.role || 'qa'; S.ai = saved?.ai || {};
  const sc = restoreCall();
  const callBase = callCl || { ...structuredClone(cl), id: 'freedom-call', name: 'Чек-лист качества звонков (Freedom Broker)', channel: 'voice call' };
  S.call = sc?.checklists?.length ? { checklists: sc.checklists, activeVersion: sc.activeVersion || 1 } : { checklists: [{ ...callBase, version: 1, updated_at: new Date().toISOString() }], activeVersion: 1 };
  mergePre();
}

/* ---------- time helpers (chat = MM:SS, call = ISO 8601) ---------- */
export function offsetSec(conv, i) {
  const ts = conv.transcript[i]?.timestamp || '';
  if (/^\d{1,2}:\d{2}$/.test(ts)) { const [m, s] = ts.split(':').map(Number); return m * 60 + s; }
  const t0 = Date.parse(conv.transcript[0]?.timestamp), t = Date.parse(ts);
  return Number.isFinite(t - t0) ? Math.max(0, (t - t0) / 1000) : 0;
}
export const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
export const duration = (conv) => offsetSec(conv, conv.transcript.length - 1) + 8;
export const isCall = (conv) => /voice|call/i.test(conv?.channel || '');
export const SPK = { client: 'Клиент', operator: 'Оператор', bot: 'Бот', system: 'Система' };

/* ---------- evaluation model (AI result if present for this checklist hash, else the offline evaluator) ---------- */
function mockFor(convId, cl) {
  const k = aiKey(convId, cl);
  if (!S.mock[k]) S.mock[k] = { answers: mockEvaluate(S.byId[convId], cl), summary: mockSummary(S.byId[convId]), model: 'mock' };
  return S.mock[k];
}
export function evaluation(convId) {
  const conv = S.byId[convId]; const cl = checklistFor(conv);
  const ai = S.ai[aiKey(convId, cl)];
  const src = ai ? 'ai' : 'mock'; const base = ai || mockFor(convId, cl);
  const aiAnswers = Object.fromEntries(cl.criteria.map((c) => [c.id, base.answers[c.id]?.answer]));
  const appeals = S.appeals.filter((a) => a.conversation_id === convId && a.checklist_hash === clHash(cl));
  const finalAnswers = { ...aiAnswers };
  for (const a of appeals) if (a.status === 'changed') finalAnswers[a.criterion_id] = a.decision.new_answer;
  const isBaseHash = clHash(cl) === clHash(versionsOf(kindOf(conv))[0]);
  const evaluatedAt = base.evaluated_at || (src === 'ai' && isBaseHash ? S.pre?.generated_at : null);
  return { cl, kind: kindOf(conv), conv, src, model: base.model, base, answers: base.answers, summary: base.summary, aiScore: score(cl, aiAnswers), finalScore: score(cl, finalAnswers), finalAnswers, appeals, evaluatedAt, live: false };
}
/** A closed live session that has an evaluation (scored with the active checklist). */
export function liveEvaluation(s) {
  const cl = checklist(); const conv = live.toConversation(s);
  const answers = s.evaluation.answers || {};
  const a = Object.fromEntries(cl.criteria.map((c) => [c.id, answers[c.id]?.answer]));
  const sc = score(cl, a);
  return { cl, kind: 'chat', conv, src: 'ai', model: s.evaluation.model, base: s.evaluation, answers, summary: s.evaluation.summary, aiScore: sc, finalScore: sc, finalAnswers: a, appeals: [], evaluatedAt: s.evaluated_at || s.closed_at, live: true };
}

/** Deductions = criteria where the final answer doesn't give full points (+ gross flags). */
export function deductions(E) {
  return sortedCrits(E.cl).flatMap((c) => {
    const row = E.finalScore.criteria.find((r) => r.criterion_id === c.id); const a = E.finalAnswers[c.id];
    if (c.type === 'flag') return a === 'yes' ? [{ c, lost: null, gross: true }] : [];
    if (a == null || a === 'na' || row?.points == null) return [];
    const lost = +(row.effective_weight - row.points).toFixed(2);
    return lost > 0.001 ? [{ c, lost, gross: false }] : [];
  });
}
export const reasonOf = (E, c) => (c ? E.answers[c.id]?.deduction_reason || E.answers[c.id]?.explanation || '' : '');
export function evidenceIdx(E, c) {
  const e = E.answers[c.id]?.evidence?.find((x) => x.kind === 'message' || x.kind === 'range');
  return e ? (e.kind === 'message' ? e.turn_index : e.range[0]) : null;
}
export const answerText = (c, a) => (a == null ? '—' : a === 'na' ? 'N/A' : a === 'yes' ? (c.type === 'flag' ? 'Да (нарушение)' : 'Да') : a === 'no' ? 'Нет' : `${a} из ${maxStep(c)}`);

/* ---------- AI calls ---------- */
export async function aiEvaluate(convId, { force = false, cl = checklistFor(S.byId[convId]), save = true } = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60000);
  const t0 = performance.now();
  let r;
  try {
    r = await fetch('/api/evaluate', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: convId, checklist: { id: cl.id, version: cl.version, criteria: cl.criteria, sections: cl.sections }, force }), signal: controller.signal });
  } finally { clearTimeout(timeout); }
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.answers) throw Object.assign(new Error(j.error || `API ${r.status}`), { status: r.status });
  S.ai[aiKey(convId, cl)] = { answers: j.answers, summary: j.summary, model: j.model, usage: j.usage, latency_ms: j.latency_ms, cached: j.cached, problems: j.problems,
    evaluated_at: new Date().toISOString(), wall_ms: Math.round(performance.now() - t0) };
  if (save) persist();
  return j;
}

/** Re-evaluate every DEV dialog of one kind with its active checklist. mode: 'ai' (/api/evaluate) or 'mock' (offline evaluator). */
export async function reevaluateAll(mode, label, kind = 'chat') {
  if (S.busy) return null;
  const cl = checklistOf(kind); const ids = S.convs.filter((c) => kindOf(c) === kind).map((c) => c.conversation_id);
  S.busy = { label, mode, kind, done: 0, total: ids.length, failed: 0, cost: 0, startedAt: Date.now(), version: cl.version };
  emit('busy', S.busy);
  if (mode === 'ai') {
    const queue = [...ids]; let sinceSave = 0;
    await Promise.all(Array.from({ length: 5 }, async () => {
      while (queue.length) {
        const id = queue.shift();
        try { const j = await aiEvaluate(id, { cl, save: false }); S.busy.cost += j.cached ? 0 : Number(j.usage?.cost) || 0; } catch { S.busy.failed++; }
        S.busy.done++; if (++sinceSave >= 5) { sinceSave = 0; persist(); }
        emit('busy', S.busy);
      }
    }));
    persist();
  } else {
    for (const id of ids) { delete S.mock[aiKey(id, cl)]; mockFor(id, cl); S.busy.done++; emit('busy', S.busy); await wait(18); }
  }
  const res = { ...S.busy, ms: Date.now() - S.busy.startedAt };
  S.busy = null; emit('busy', null); emit('change');
  return res;
}

/** Same questions for the evaluator: same criteria ids and the same text, type, N/A rule and scale.
 *  Only weights, order or sections differ, so the AI answers stay valid and only the arithmetic changes. */
const QUESTION = (c) => JSON.stringify([c.title, c.description || '', c.type, !!c.na_allowed, c.na_allowed ? c.na_condition || '' : '', c.scale || null]);
export function sameQuestions(a, b) {
  if (a.criteria.length !== b.criteria.length) return false;
  const m = new Map(a.criteria.map((c) => [c.id, QUESTION(c)]));
  return b.criteria.every((c) => m.get(c.id) === QUESTION(c));
}
/** Reuse the AI answers of `fromCl` for `toCl` (weights/order changed only). Returns how many dialogs got them. */
export function carryAnswers(kind, fromCl, toCl) {
  const a = clHash(fromCl), b = clHash(toCl); let n = 0;
  for (const c of S.convs) {
    if (kindOf(c) !== kind) continue;
    const src = S.ai[`${c.conversation_id}|${a}`];
    if (src && !S.ai[`${c.conversation_id}|${b}`]) { S.ai[`${c.conversation_id}|${b}`] = { ...src, carried_from: fromCl.version }; n++; }
  }
  persist(); emit('change');
  return n;
}

/* ---------- rows + aggregates ---------- */
function rowFrom(id, source, E) {
  const dd = deductions(E);
  const main = dd.find((d) => d.gross) || [...dd].sort((a, b) => b.lost - a.lost)[0] || null;
  const total = E.finalScore.total;
  return { id, source, E, conv: E.conv, language: String(E.conv.language || 'RU').toUpperCase(), channel: isCall(E.conv) ? 'call' : 'chat', total, tier: tier(total), gross: E.finalScore.gross_error, dd, main };
}
/** Every evaluated dialog: DEV set + closed live sessions that have an evaluation. */
export function rows() {
  const out = S.convs.map((c) => rowFrom(c.conversation_id, 'DEV', evaluation(c.conversation_id)));
  for (const s of live.all()) if (s.evaluation?.answers) out.push(rowFrom(s.id, 'live', liveEvaluation(s)));
  return out;
}
export const hrefFor = (r) => (r.source === 'live' ? `#/live/${encodeURIComponent(r.id)}` : `#/dialog/${encodeURIComponent(r.id)}`);
/** The gross-error flag that fired in this dialog: { c, answer } (explanation + evidence come from the AI answer). */
export function grossOf(E) {
  const c = sortedCrits(E.cl).find((x) => x.type === 'flag' && E.finalAnswers[x.id] === 'yes');
  return c ? { c, a: E.answers[c.id] || {} } : null;
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

export function liveStats() {
  const ss = live.all(); const today = new Date().toDateString();
  const csats = ss.map((s) => Number(s.csat)).filter((x) => Number.isFinite(x) && x > 0);
  return { count: ss.length, today: ss.filter((s) => new Date(s.started_at).toDateString() === today).length,
    handoffs: ss.filter((s) => s.handoff).length, handoff_rate: ss.length ? ss.filter((s) => s.handoff).length / ss.length : null,
    waiting: ss.filter((s) => s.status === 'waiting_operator').length, csat_avg: mean(csats), csat_n: csats.length };
}
export function appealStats() {
  const l = S.appeals;
  return { total: l.length, open: l.filter((a) => a.status === 'open').length, changed: l.filter((a) => a.status === 'changed').length, confirmed: l.filter((a) => a.status === 'confirmed').length };
}

export function compute(list = rows()) {
  const totals = list.map((r) => r.total).filter((x) => x != null);
  const group = (keyFn) => { const g = {}; for (const r of list) (g[keyFn(r)] ||= []).push(r); return Object.fromEntries(Object.entries(g).map(([k, rs]) => [k, { n: rs.length, avg: r1(mean(rs.map((r) => r.total).filter((x) => x != null))), gross: rs.filter((r) => r.gross).length }])); };
  // criteria are grouped by id across the chat and call checklists (titles from the chat checklist when both have it)
  const L = new Map();
  for (const r of list) for (const c of sortedCrits(r.E.cl)) {
    if (c.type === 'flag' || !(c.weight > 0)) continue;
    const g = L.get(c.id) || { c, lost: 0, hit: 0, applicable: 0, n: 0 };
    if (r.E.kind === 'chat' && g.c !== c && kindOfChecklist(g.c) === 'call') g.c = c;
    g.n++; const a = r.E.finalAnswers[c.id];
    if (a != null && a !== 'na') { g.applicable++; const d = r.dd.find((x) => x.c.id === c.id); if (d) { g.lost += d.lost; g.hit++; } }
    L.set(c.id, g);
  }
  const loss = [...L.values()].map((g) => ({ c: g.c, avg_lost: g.n ? g.lost / g.n : 0, dialogs: g.hit, applicable: g.applicable, na: g.n - g.applicable }))
    .sort((a, b) => b.avg_lost - a.avg_lost);
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i * 10 + 10, n: 0, low: 0, mid: 0, high: 0 }));
  for (const r of list) { if (r.total == null) continue; const b = bins[Math.min(9, Math.floor(r.total / 10))]; b.n++; b[r.tier]++; }
  // deduction reasons grouped by criterion; the AI writes free text, so identical texts are counted together
  const groups = new Map();
  for (const r of list) for (const d of r.dd) {
    const g = groups.get(d.c.id) || { c: d.c, gross: d.gross, dialogs: 0, lost: 0, items: new Map(), ids: [] };
    const text = (reasonOf(r.E, d.c) || (d.gross ? 'Грубая ошибка' : 'Без пояснения')).trim();
    g.dialogs++; g.lost += d.lost || 0; g.ids.push(r.id);
    const key = text.toLowerCase().replace(/[.!…\s]+$/, '');
    const it = g.items.get(key) || { text, count: 0, ids: [], rows: [] }; it.count++; it.ids.push(r.id); it.rows.push(r); g.items.set(key, it);
    groups.set(d.c.id, g);
  }
  const reasonGroups = [...groups.values()].map((g) => ({ ...g, items: [...g.items.values()].sort((a, b) => b.count - a.count) }))
    .sort((a, b) => (b.gross ? 1 : 0) - (a.gross ? 1 : 0) || b.lost - a.lost);
  return {
    n: list.length, n_dev: list.filter((r) => r.source === 'DEV').length, n_live: list.filter((r) => r.source === 'live').length,
    chats: list.filter((r) => r.channel === 'chat').length, calls: list.filter((r) => r.channel === 'call').length,
    ai: list.filter((r) => r.E.src === 'ai').length,
    avg: r1(mean(totals)), median: r1(median(totals)), gross: list.filter((r) => r.gross).length,
    byLang: group((r) => r.language), byChannel: group((r) => r.channel), loss, bins, reasonGroups,
  };
}

/** Compact payload for POST /api/insights (aggregates only, no transcripts). */
export function statsForAI(st = compute()) {
  const m = S.metrics; const cl = checklistOf('chat'); const cc = checklistOf('call'); const ls = liveStats();
  const top = [];
  for (const g of st.reasonGroups) for (const it of g.items) top.push({ criterion: `${g.c.id} ${g.c.title}`, reason: it.text, count: it.count, example_ids: it.ids.slice(0, 2) });
  top.sort((a, b) => b.count - a.count);
  return {
    checklist: `${cl.name} v${cl.version}; ${cc.name} v${cc.version} (звонки)`,
    model: modelLabel(S.pre?.model || S.api.model),
    dialogs: { total: st.n, dev: st.n_dev, live_evaluated: st.n_live, evaluated_by_ai: st.ai },
    score: { avg: st.avg, median: st.median, distribution: st.bins.map((b) => ({ range: `${b.from}-${b.to}`, n: b.n })) },
    by_language: st.byLang, by_channel: st.byChannel, gross_errors: st.gross,
    loss_per_criterion: st.loss.map((l) => ({ id: l.c.id, title: l.c.title, weight: l.c.weight, avg_points_lost: r2(l.avg_lost), dialogs_with_loss: l.dialogs, na: l.na })),
    top_deduction_reasons: top.slice(0, 12),
    live_sessions: { count: ls.count, today: ls.today, handoff_rate: r2(ls.handoff_rate), csat_avg: r2(ls.csat_avg), csat_n: ls.csat_n, waiting_now: ls.waiting },
    appeals: appealStats(),
    ai_vs_human: m ? { strict_agreement_pct: m.overall?.strict, lenient_pct: m.overall?.lenient, gold_dialogs: m.gold_dialogs, prompt_version: m.meta?.prompt_version } : null,
  };
}

/* ---------- appeals + decisions (same records as the prototype) ---------- */
export function addAppeal(convId, criterionId, comment) {
  refresh(); const cl = checklistFor(S.byId[convId]);
  const a = { id: Math.random().toString(36).slice(2, 9), conversation_id: convId, criterion_id: criterionId, checklist_id: cl.id, checklist_version: cl.version, checklist_hash: clHash(cl), comment, created_at: new Date().toISOString(), status: 'open' };
  S.appeals.push(a); persist(); emit('change'); return a;
}
export function decideAppeal(appealId, { change, answer, reason }) {
  refresh(); const ap = S.appeals.find((a) => a.id === appealId); if (!ap) return null;
  const E = evaluation(ap.conversation_id); const orig = E.answers[ap.criterion_id]?.answer;
  const isChange = change && answer !== orig;
  ap.status = isChange ? 'changed' : 'confirmed';
  ap.decision = { new_answer: isChange ? answer : orig, reason, decided_at: new Date().toISOString() };
  persist(); emit('change'); return ap;
}
export function setRole(role) { refresh(); S.role = role; persist(); emit('role'); }
