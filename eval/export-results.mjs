// Converts our evaluator output into the organizers' results.json (docs/case/results-format.md, JSON 1.0). Issue #22.
//   node eval/export-results.mjs --group DEV --out results/dev/results.json
//   node eval/export-results.mjs --group <CONTROL_ID> --out results/prod/results.json
// Reads data/evaluations/<GROUP>.json (written by scripts/eval-run.mjs), data/datasets/<GROUP>.json and the checklist.
// Totals come from prototype/scoring.js (half-up). Dialogs without a complete evaluation become status "error"
// with the reason: never hidden, never replaced by a zero score.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { score } from '../prototype/scoring.js';
import { validate, CODES } from './validate-results.mjs';

// Our checklist ids → official criterion codes (same order as the official checklist).
export const CODE_OF = { c01: 'contact', c02: 'discovery', c03: 'identification', c04: 'consultation', c05: 'empathy', c06: 'dialogue', c07: 'closure', c08: 'critical' };
const MAX_TURNS_PER_CRITERION = 30;

const toValue = (a) => (a === 'yes' ? true : a === 'no' ? false : a === 'na' ? null : typeof a === 'number' ? a : Number.isFinite(Number(a)) ? Number(a) : undefined);

/** 0-based evidence (message / range) → sorted unique 1-based turn numbers within the transcript. */
export function evidenceTurns(evidence, turnCount) {
  const out = new Set();
  for (const e of evidence || []) {
    if (e.kind === 'message' && Number.isInteger(e.turn_index)) out.add(e.turn_index + 1);
    if (e.kind === 'range' && Array.isArray(e.range)) for (let i = e.range[0]; i <= e.range[1] && out.size < MAX_TURNS_PER_CRITERION; i++) out.add(i + 1);
  }
  return [...out].filter((t) => t >= 1 && t <= turnCount).sort((a, b) => a - b).slice(0, MAX_TURNS_PER_CRITERION);
}

/** When the model cited no transcript turn, point at the turn that shows the reason (as in the official example). */
function fallbackTurns(code, value, conv) {
  const t = conv.transcript;
  const idx = (pred) => t.map((m, i) => (pred(m) ? i + 1 : 0)).filter(Boolean);
  const firstClient = idx((m) => m.speaker === 'client').slice(0, 1);
  const lastSystem = idx((m) => m.speaker === 'system').slice(-1);
  const operator = idx((m) => m.speaker === 'operator');
  if (code === 'critical' && value === false) return operator.slice(0, MAX_TURNS_PER_CRITERION); // checked: every operator turn
  if (value === null && (code === 'closure' || code === 'consultation')) return lastSystem.length ? lastSystem : [t.length];
  if (value === null) return firstClient; // N/A because of what the client asked
  return [];
}

function modelName(results) {
  const names = [...new Set(Object.values(results).map((r) => r.model).filter(Boolean))].map((m) =>
    m.startsWith('openai:') ? `OpenAI ${m.slice(7)} (OpenAI API)` : m.startsWith('openrouter:') ? `${m.slice(11)} (OpenRouter)` : `${m} (OpenRouter)`);
  return names.join(', ') || 'unknown';
}

export function buildResults({ dataset, evaluations, checklist, teamName }) {
  const results = evaluations.results || {};
  const crit = [...checklist.criteria].sort((a, b) => a.order - b.order);
  const out = dataset.map((conv) => {
    const id = conv.conversation_id;
    const r = results[id];
    const fail = (error) => ({ conversation_id: id, status: 'error', criteria: [], score: null, error });
    if (!r || !r.answers) return fail('Не удалось получить ответ модели.');
    const criteria = [];
    const answers = {};
    for (const c of crit) {
      const code = CODE_OF[c.id];
      if (!code) return fail(`Критерий ${c.id} отсутствует в официальном формате.`);
      const a = r.answers[c.id];
      if (!a) return fail(`Модель не вернула ответ по критерию ${code}.`);
      const value = toValue(a.answer);
      if (value === undefined) return fail(`Недопустимый ответ модели по критерию ${code}.`);
      answers[c.id] = a.answer;
      const rationale = String(a.explanation || a.deduction_reason || '').trim() || 'Обоснование не получено от модели.';
      const turns = evidenceTurns(a.evidence, conv.transcript.length);
      criteria.push({ criterion_id: code, value, rationale, evidence_turns: turns.length ? turns : fallbackTurns(code, value, conv) });
    }
    if (criteria.length !== CODES.length) return fail('Оценка неполная: нужны все 8 критериев.');
    const s = score(checklist, answers);
    return { conversation_id: id, status: 'ok', criteria, score: { final_score: s.total, critical_flag: Boolean(s.gross_error) } };
  });
  return {
    schema_version: '1.0',
    team_name: teamName,
    model: { mode: 'external_api', name: modelName(results) },
    results: out,
  };
}

// ---------- CLI ----------
if (import.meta.url === `file://${process.argv[1]}`) {
  const argv = process.argv.slice(2);
  const opt = (k, d) => { const i = argv.indexOf(`--${k}`); return i >= 0 ? argv[i + 1] : d; };
  const group = opt('group', 'DEV');
  const outPath = opt('out', group === 'DEV' ? 'results/dev/results.json' : 'results/prod/results.json');
  const raw = JSON.parse(readFileSync(opt('dataset', `data/datasets/${group}.json`), 'utf8'));
  const dataset = Array.isArray(raw) ? raw : raw.data.records;
  const evaluations = JSON.parse(readFileSync(opt('evaluations', `data/evaluations/${group}.json`), 'utf8'));
  const checklist = JSON.parse(readFileSync(opt('checklist', 'data/checklists/freedom-chat-v1.json'), 'utf8'));
  const doc = buildResults({ dataset, evaluations, checklist, teamName: opt('team', process.env.CQA_TEAM_NAME || 'YaTebyaMognu') });
  const check = validate(doc, { dataset, expect: opt('expect') != null ? Number(opt('expect')) : null });
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(doc, null, 2) + '\n', 'utf8');
  const errs = doc.results.filter((r) => r.status === 'error');
  console.log(`wrote ${outPath}: ${doc.results.length} records (${doc.results.length - errs.length} ok, ${errs.length} error) · model: ${doc.model.name}`);
  errs.forEach((e) => console.log(`  error ${e.conversation_id}: ${e.error}`));
  if (!check.ok) { console.error(`✖ format check failed (${check.errors.length}):`); check.errors.slice(0, 20).forEach((e) => console.error(`  - ${e}`)); process.exit(1); }
  console.log('✔ format check passed');
}
