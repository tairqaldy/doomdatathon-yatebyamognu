// Validates a results.json against the organizers' format (docs/case/results-format.md, JSON 1.0). Issue #22.
//   node eval/validate-results.mjs results/prod/results.json --dataset data/datasets/<GROUP>.json --expect 10
// Exit code 0 = valid, 1 = invalid. final_score is recomputed independently from the values with the official
// weights (half-up, 2 decimals), so this does not trust our own scoring code.
import { readFileSync } from 'node:fs';

export const CODES = ['contact', 'discovery', 'identification', 'consultation', 'empathy', 'dialogue', 'closure', 'critical'];
const WEIGHTS = { contact: 10, discovery: 15, identification: 20, consultation: 20, empathy: 15, dialogue: 15, closure: 5 };
const SCALE_MAX = { consultation: 20, dialogue: 10 };
const ALLOWED = {
  contact: [true, false],
  discovery: [true, false, null],
  identification: [true, false, null],
  consultation: [0, 5, 10, 15, 20, null],
  empathy: [true, false],
  dialogue: [0, 4, 7, 10],
  closure: [true, false, null],
  critical: [true, false],
};
const MODES = ['local', 'external_api', 'hybrid'];
const round2 = (x) => Math.round(x * 100 + 1e-7) / 100; // half-up for non-negative totals (50.625 → 50.63)

/** Official total from the 8 values: N/A dropped, weights redistributed, critical carries no points. */
export function officialScore(byCode) {
  let got = 0, applicable = 0;
  for (const [code, w] of Object.entries(WEIGHTS)) {
    const v = byCode[code];
    if (v === null || v === undefined) continue;
    applicable += w;
    got += typeof v === 'number' ? (w * v) / SCALE_MAX[code] : v === true ? w : 0;
  }
  return applicable > 0 ? round2((got / applicable) * 100) : null;
}

export function validate(doc, { dataset = null, expect = null } = {}) {
  const errors = [];
  const err = (m) => errors.push(m);
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) return { ok: false, errors: ['top level must be one JSON object'], stats: {} };
  if (doc.schema_version !== '1.0') err(`schema_version must be "1.0" (got ${JSON.stringify(doc.schema_version)})`);
  if (typeof doc.team_name !== 'string' || !doc.team_name.trim()) err('team_name must be a non-empty string');
  if (!doc.model || !MODES.includes(doc.model.mode)) err(`model.mode must be one of ${MODES.join(', ')}`);
  if (!doc.model || typeof doc.model.name !== 'string' || !doc.model.name.trim()) err('model.name must be a non-empty string');
  if (!Array.isArray(doc.results)) { err('results must be an array'); return { ok: false, errors, stats: {} }; }

  const turns = new Map((dataset || []).map((c) => [c.conversation_id, c.transcript.length]));
  const seen = new Set();
  let okN = 0, errorN = 0;
  doc.results.forEach((r, i) => {
    const where = `results[${i}]${r?.conversation_id ? ` (${r.conversation_id})` : ''}`;
    if (!r || typeof r !== 'object') return err(`${where}: must be an object`);
    if (typeof r.conversation_id !== 'string' || !r.conversation_id) err(`${where}: conversation_id must be a non-empty string`);
    if (seen.has(r.conversation_id)) err(`${where}: duplicate conversation_id`);
    seen.add(r.conversation_id);
    if (dataset && !turns.has(r.conversation_id)) err(`${where}: conversation_id not in the dataset`);

    if (r.status === 'error') {
      errorN++;
      if (!Array.isArray(r.criteria) || r.criteria.length) err(`${where}: error records need criteria: []`);
      if (r.score !== null) err(`${where}: error records need score: null`);
      if (typeof r.error !== 'string' || !r.error.trim()) err(`${where}: error records need a non-empty error text`);
      return;
    }
    if (r.status !== 'ok') return err(`${where}: status must be "ok" or "error"`);
    okN++;
    if (!Array.isArray(r.criteria) || r.criteria.length !== 8) err(`${where}: needs exactly 8 criteria (got ${r.criteria?.length})`);
    const byCode = {};
    for (const c of r.criteria || []) {
      const code = c?.criterion_id;
      if (!CODES.includes(code)) { err(`${where}: unknown criterion_id ${JSON.stringify(code)}`); continue; }
      if (code in byCode) err(`${where}: ${code} appears more than once`);
      byCode[code] = c.value;
      if (!ALLOWED[code].some((a) => a === c.value)) err(`${where}: ${code} value ${JSON.stringify(c.value)} not allowed (${ALLOWED[code].map((a) => JSON.stringify(a)).join(' / ')})`);
      if (typeof c.rationale !== 'string' || !c.rationale.trim()) err(`${where}: ${code} needs a rationale`);
      if (!Array.isArray(c.evidence_turns)) err(`${where}: ${code} evidence_turns must be an array`);
      else for (const t of c.evidence_turns) {
        if (!Number.isInteger(t) || t < 1) err(`${where}: ${code} evidence turn ${JSON.stringify(t)} must be an integer ≥ 1 (1-based)`);
        else if (turns.has(r.conversation_id) && t > turns.get(r.conversation_id)) err(`${where}: ${code} evidence turn ${t} beyond transcript length ${turns.get(r.conversation_id)}`);
      }
    }
    for (const code of CODES) if (!(code in byCode)) err(`${where}: missing ${code}`);
    const s = r.score;
    if (!s || typeof s !== 'object') { err(`${where}: score must be an object`); return; }
    if (typeof s.critical_flag !== 'boolean') err(`${where}: score.critical_flag must be boolean`);
    else if ('critical' in byCode && s.critical_flag !== byCode.critical) err(`${where}: critical_flag must equal the critical value`);
    const expected = officialScore(byCode);
    if (s.final_score === null) { if (expected !== null) err(`${where}: final_score is null but should be ${expected}`); }
    else if (typeof s.final_score !== 'number' || s.final_score < 0 || s.final_score > 100) err(`${where}: final_score must be a number 0–100`);
    else if (Math.abs(s.final_score * 100 - Math.round(s.final_score * 100)) > 1e-6) err(`${where}: final_score must have at most 2 decimals`);
    else if (expected !== null && Math.abs(s.final_score - expected) > 0.0051) err(`${where}: final_score ${s.final_score} ≠ ${expected} recomputed from the values`);
  });

  if (dataset) {
    const missing = [...turns.keys()].filter((id) => !seen.has(id));
    if (missing.length) err(`missing ${missing.length} dataset dialog(s): ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? '…' : ''}`);
  }
  if (expect != null && doc.results.length !== expect) err(`expected exactly ${expect} records, got ${doc.results.length}`);
  return { ok: errors.length === 0, errors, stats: { records: doc.results.length, ok: okN, error: errorN } };
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (k) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : undefined; };
  const file = argv.find((a, i) => !a.startsWith('--') && !['--dataset', '--expect'].includes(argv[i - 1]));
  if (!file) { console.error('usage: node eval/validate-results.mjs <results.json> [--dataset data/datasets/<GROUP>.json] [--expect N]'); process.exit(2); }
  let doc;
  try {
    const text = readFileSync(file, 'utf8');
    if (text.charCodeAt(0) === 0xfeff) throw new Error('file starts with a BOM; save as plain UTF-8');
    doc = JSON.parse(text);
  } catch (e) { console.error(`✖ ${file}: not valid JSON (${e.message})`); process.exit(1); }
  let dataset = null;
  if (opt('dataset')) { const raw = JSON.parse(readFileSync(opt('dataset'), 'utf8')); dataset = Array.isArray(raw) ? raw : raw.data.records; }
  const res = validate(doc, { dataset, expect: opt('expect') != null ? Number(opt('expect')) : null });
  if (res.ok) console.log(`✔ ${file}: valid (${res.stats.records} records: ${res.stats.ok} ok, ${res.stats.error} error)`);
  else { console.error(`✖ ${file}: ${res.errors.length} problem(s)`); res.errors.slice(0, 40).forEach((e) => console.error(`  - ${e}`)); if (res.errors.length > 40) console.error(`  … ${res.errors.length - 40} more`); process.exit(1); }
}
