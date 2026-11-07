// CI test: scoring engine rules (checklist PDF "Порядок расчёта"). Exit 1 on any failure.
import { readFile } from 'node:fs/promises';
import { selfTest } from '../prototype/scoring.js';
const cl = JSON.parse(await readFile('data/checklists/freedom-chat-v1.json', 'utf8'));
const results = selfTest(cl);
for (const [name, ok] of results) console.log(`${ok ? '✔' : '✖'} ${name}`);
process.exit(results.every(([, ok]) => ok) ? 0 : 1);
