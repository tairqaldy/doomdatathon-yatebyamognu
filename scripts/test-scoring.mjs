// CI test: scoring engine rules (checklist PDF "Порядок расчёта"). Exit 1 on any failure.
import { readFile } from 'node:fs/promises';
import { selfTest, score } from '../prototype/scoring.js';
const cl = JSON.parse(await readFile('data/checklists/freedom-chat-v1.json', 'utf8'));
// selfTest encodes the official PDF examples, which cover the 8 official criteria only.
const official = { ...cl, criteria: cl.criteria.filter((c) => c.input !== 'audio') };
const results = selfTest(official);
// Audio criteria of the call checklist (c09 tone of voice, #23): N/A leaves the total unchanged; a step counts like any scale.
const callCl = JSON.parse(await readFile('data/checklists/freedom-call-v1.json', 'utf8'));
const audio = callCl.criteria.filter((c) => c.input === 'audio');
results.push(['chat checklist has no audio criteria', !cl.criteria.some((c) => c.input === 'audio')]);
if (audio.length) {
  const callText = { ...callCl, criteria: callCl.criteria.filter((c) => c.input !== 'audio') };
  const chat = { c01: 'yes', c02: 'na', c03: 'no', c04: 5, c05: 'no', c06: 4, c07: 'yes', c08: 'no' };
  const withNa = { ...chat, ...Object.fromEntries(audio.map((c) => [c.id, 'na'])) };
  results.push(['audio criterion N/A keeps the call total (30.59)', score(callCl, withNa).total === score(callText, chat).total && score(callCl, withNa).total === 30.59]);
  const c09 = audio.find((c) => c.id === 'c09');
  if (c09) results.push(['tone 4/10 on a call: (26 + 4) / (85 + 10) → 31.58', score(callCl, { ...chat, c09: 4 }).total === 31.58]);
}
for (const [name, ok] of results) console.log(`${ok ? '✔' : '✖'} ${name}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
