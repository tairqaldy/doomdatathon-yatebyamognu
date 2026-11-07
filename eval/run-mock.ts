// Runs the prototype MOCK evaluator (keyword heuristics) and saves an Evaluation[] run file.
// Purpose: a baseline for eval/accuracy.ts, so the harness is proven before the LLM evaluator exists.
//
//   node eval/run-mock.ts                      # gold dialogs only → eval/runs/mock-baseline.json
//   node eval/run-mock.ts --all --out x.json   # all dialogs in the dataset
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { loadDataset, loadGold, parseArgs, readJson } from "./lib.ts";
import type { Checklist, Evaluation, Answer } from "./lib.ts";
// @ts-ignore: plain JS reference modules from the prototype
import { mockEvaluate } from "../prototype/mock-evaluator.js";
// @ts-ignore
import { score } from "../prototype/scoring.js";

const args = parseArgs(process.argv.slice(2));
const datasetPath = String(args.dataset ?? "data/datasets/DEV.json");
const checklistPath = String(args.checklist ?? "data/checklists/freedom-chat-v1.json");
const goldDir = String(args.gold ?? "eval/gold");
const outPath = String(args.out ?? "eval/runs/mock-baseline.json");

const checklist = readJson<Checklist>(checklistPath);
const conversations = loadDataset(datasetPath);
const goldIds = new Set(loadGold(goldDir).map((g) => g.conversation_id));
const targets = args.all ? conversations : conversations.filter((c) => goldIds.has(c.conversation_id));

const evaluations: Evaluation[] = targets.map((conv) => {
  const t0 = performance.now();
  const raw = mockEvaluate(conv, checklist) as Record<string, { answer: Answer; explanation: string; evidence: any[] }>;
  const latency = Math.round(performance.now() - t0);
  const answers = Object.fromEntries(Object.entries(raw).map(([id, r]) => [id, r.answer]));
  const s = score(checklist, answers);
  const rowById = new Map<string, any>(s.criteria.map((r: any) => [r.criterion_id, r]));
  return {
    id: `mock-${conv.conversation_id}`,
    conversation_id: conv.conversation_id,
    checklist_id: checklist.id,
    checklist_version: checklist.version,
    created_at: new Date().toISOString(),
    model: { name: "mock-heuristics (prototype/mock-evaluator.js)", prompt_version: "n/a", latency_ms: latency, cost_usd: 0 },
    criteria: checklist.criteria.map((c) => ({
      criterion_id: c.id,
      answer: raw[c.id].answer,
      points: rowById.get(c.id)?.points ?? null,
      effective_weight: rowById.get(c.id)?.effective_weight ?? null,
      explanation: raw[c.id].explanation,
      evidence: raw[c.id].evidence,
    })),
    sections: s.sections.map((x: any) => ({ section_id: x.section_id, score: x.score })),
    total: s.total,
    gross_error: s.gross_error,
  };
});

mkdirSync(dirname(outPath), { recursive: true });
const meta = { evaluator: "mock", dataset: datasetPath, checklist: `${checklist.id}@v${checklist.version}`, created_at: new Date().toISOString(), count: evaluations.length };
writeFileSync(outPath, JSON.stringify({ meta, evaluations }, null, 2) + "\n");
console.log(`wrote ${evaluations.length} evaluations → ${outPath}`);
