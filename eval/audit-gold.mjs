// Read-only gold checks; writes only explicitly requested audit artifacts.
// Run from repository root: node eval/audit-gold.mjs [--self-run path.json]
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { score, validateAnswer } from '../prototype/scoring.js';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const checklist = read('data/checklists/freedom-chat-v1.json');
const records = read('data/datasets/DEV.json').data.records;
const conversations = new Map(records.map(c => [c.conversation_id, c]));
assert.equal(conversations.size, records.length, 'duplicate source IDs');
const files = fs.readdirSync('eval/gold').filter(f => f.endsWith('.json')).sort();
const errors = [], totals = [], evaluations = [];
let labels = 0, refs = 0;
const check = (ok, message) => { if (!ok) errors.push(message); };
const round = n => Math.round((n + Number.EPSILON) * 100) / 100;
for (const file of files) {
  const g = read(`eval/gold/${file}`), conv = conversations.get(g.conversation_id);
  const at = `${file}: `;
  check(file === `${g.conversation_id}.json`, at + 'filename/ID mismatch');
  check(!!conv, at + 'source missing');
  if (!conv) continue;
  check(g.language === conv.language && g.channel === conv.channel, at + 'source metadata mismatch');
  check(g.checklist_id === checklist.id && g.checklist_version === checklist.version, at + 'checklist mismatch');
  check(['draft', 'reviewed'].includes(g.status), at + 'invalid status');
  check(typeof g.labeled_by === 'string' && Array.isArray(g.tags) && g.tags.every(t => typeof t === 'string'), at + 'invalid provenance/tags');
  check(g.status === 'reviewed' ? typeof g.reviewed_by === 'string' && g.reviewed_by.length > 0 : g.reviewed_by === null, at + 'review provenance mismatch');
  check(JSON.stringify(Object.keys(g.labels).sort()) === JSON.stringify(checklist.criteria.map(c => c.id).sort()), at + 'criterion set mismatch');
  const answers = {};
  let points = 0, weight = 0;
  for (const c of checklist.criteria) {
    const l = g.labels[c.id], loc = at + c.id;
    if (!l) continue;
    labels++;
    check(validateAnswer(c, l.answer) === null, loc + ' invalid answer');
    check(Array.isArray(l.also_acceptable), loc + ' alternatives not array');
    for (const a of l.also_acceptable ?? []) check(validateAnswer(c, a) === null && a !== l.answer, loc + ' invalid/redundant alternative');
    check(typeof l.note === 'string' && l.note.trim().length > 0, loc + ' missing explanation');
    check(Array.isArray(l.evidence) && l.evidence.length > 0, loc + ' missing checked fragment');
    for (const i of l.evidence ?? []) {
      refs++;
      check(Number.isInteger(i) && i >= 0 && i < conv.transcript.length, loc + ` invalid turn ${i}`);
    }
    check(new Set(l.evidence).size === l.evidence.length, loc + ' duplicate refs');
    answers[c.id] = l.answer;
    if (c.type !== 'flag' && l.answer !== 'na' && c.weight > 0) {
      weight += c.weight;
      points += c.type === 'binary' ? (l.answer === 'yes' ? c.weight : 0) : c.weight * l.answer / Math.max(...c.scale.map(s => s.value));
    }
  }
  const official = weight ? round(points / weight * 100) : null;
  const actual = score(checklist, answers);
  const gross = checklist.criteria.some(c => c.type === 'flag' && answers[c.id] === 'yes');
  check(actual.gross_error === gross, at + 'flag mismatch');
  totals.push({ id: g.conversation_id, official, engine: actual.total, gross_error: gross });
  evaluations.push({
    id: `audit-self-${g.conversation_id}`, conversation_id: g.conversation_id,
    checklist_id: checklist.id, checklist_version: checklist.version, created_at: new Date().toISOString(),
    model: { name: 'gold self-consistency fixture', prompt_version: 'audit-v1', latency_ms: 0, cost_usd: 0 },
    criteria: actual.criteria.map(r => ({ criterion_id: r.criterion_id, answer: r.answer, points: r.points,
      effective_weight: r.effective_weight, explanation: g.labels[r.criterion_id].note,
      evidence: g.labels[r.criterion_id].evidence.map(i => ({ kind: 'message', turn_index: i, quote: conv.transcript[i].text })) })),
    sections: actual.sections.map(s => ({ section_id: s.section_id, score: s.score })), total: actual.total, gross_error: gross,
  });
}
console.log(JSON.stringify({ files: files.length, labels, refs, errors, totals,
  rounding_mismatches: totals.filter(t => t.official !== t.engine) }, null, 2));
const out = process.argv.indexOf('--self-run');
if (out !== -1 && !errors.length) {
  assert(process.argv[out + 1], 'missing output path');
  fs.writeFileSync(process.argv[out + 1], JSON.stringify({ meta: { purpose: 'Harness compatibility only; not evaluator accuracy' }, evaluations }, null, 2) + '\n');
}
// Distinguish valid gold structure from the existing engine's arithmetic defects.
process.exitCode = errors.length ? 1 : totals.some(t => t.official !== t.engine) ? 2 : 0;
