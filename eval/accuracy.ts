// Accuracy harness: compares an evaluator run (Evaluation[] per docs/CONTRACTS.md §3) with the gold set.
//
//   node eval/accuracy.ts eval/runs/mock-baseline.json
//   node eval/accuracy.ts <run.json> --gold eval/gold --reviewed-only --json eval/runs/<name>.metrics.json
//
// Metrics (definitions in eval/gold/README.md):
//   strict agreement   model answer == gold answer
//   lenient agreement  model answer ∈ {gold answer} ∪ gold.also_acceptable
//   scale ±1 step      scale answer at most one step away from gold
//   N/A precision / recall, gross-error (flag) recall / precision / false positives
//   evidence hit rate  ≥1 cited turn (or range) overlaps the gold evidence turns
//   invalid refs       cited turn_index outside the transcript, or quote not found in that turn
//   total MAE          mean |total(model answers) − total(gold answers)|, both via the same scoring engine
import { writeFileSync } from "node:fs";
import { loadDataset, loadGold, loadRun, parseArgs, readJson } from "./lib.ts";
import type { Answer, Checklist, Conversation, Criterion, Evidence, GoldFile } from "./lib.ts";
// @ts-ignore: reference engine; switch to app/src/scoring.ts once c/scoring-engine is merged (same score() output)
import { score } from "../prototype/scoring.js";

const args = parseArgs(process.argv.slice(2));
const runPath = args._[0];
if (!runPath) {
  console.error("usage: node eval/accuracy.ts <run.json> [--gold eval/gold] [--dataset data/datasets/DEV.json] [--checklist data/checklists/freedom-chat-v1.json] [--reviewed-only] [--json out.json]");
  process.exit(2);
}
const checklist = readJson<Checklist>(String(args.checklist ?? "data/checklists/freedom-chat-v1.json"));
const conversations = new Map<string, Conversation>(loadDataset(String(args.dataset ?? "data/datasets/DEV.json")).map((c) => [c.conversation_id, c]));
let gold = loadGold(String(args.gold ?? "eval/gold"));
if (args["reviewed-only"]) gold = gold.filter((g) => g.status === "reviewed");
const run = loadRun(runPath);
const byConv = new Map(run.evaluations.map((e) => [e.conversation_id, e]));
const criteria = [...checklist.criteria].sort((a, b) => a.order - b.order);

// ---------- helpers ----------
const same = (a: Answer | undefined, b: Answer | undefined) => a !== undefined && b !== undefined && String(a) === String(b);
const pct = (num: number, den: number) => (den === 0 ? "  –  " : `${((100 * num) / den).toFixed(1).padStart(5)}%`);
const ratio = (num: number, den: number) => (den === 0 ? null : Math.round((10000 * num) / den) / 100);

function stepIndex(c: Criterion, a: Answer): number {
  if (c.type !== "scale" || typeof a !== "number") return -1;
  const steps = [...(c.scale ?? [])].map((s) => s.value).sort((x, y) => x - y);
  return steps.indexOf(a);
}

function evidenceTurns(ev: Evidence[]): number[] {
  const out: number[] = [];
  for (const e of ev ?? []) {
    if (e.kind === "message" && typeof e.turn_index === "number") out.push(e.turn_index);
    if (e.kind === "range" && Array.isArray(e.range)) for (let i = e.range[0]; i <= e.range[1]; i++) out.push(i);
  }
  return out;
}

function invalidRefs(ev: Evidence[], conv: Conversation): number {
  let bad = 0;
  for (const e of ev ?? []) {
    if (e.kind === "message") {
      const t = typeof e.turn_index === "number" ? conv.transcript[e.turn_index] : undefined;
      if (!t) { bad++; continue; }
      if (e.quote) {
        const q = e.quote.replace(/\s+/g, " ").trim().slice(0, 40).toLowerCase();
        if (q && !t.text.replace(/\s+/g, " ").toLowerCase().includes(q)) bad++;
      }
    }
    if (e.kind === "range" && Array.isArray(e.range)) {
      const [a, b] = e.range;
      if (!(Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b < conv.transcript.length)) bad++;
    }
  }
  return bad;
}

// ---------- accumulate ----------
type Cell = { n: number; strict: number; lenient: number; scaleN: number; within1: number };
const blank = (): Cell => ({ n: 0, strict: 0, lenient: 0, scaleN: 0, within1: 0 });
const perCrit = new Map<string, Cell>(criteria.map((c) => [c.id, blank()]));
const perLang = new Map<string, Cell>();
let naGold = 0, naModel = 0, naBoth = 0;
let flagTP = 0, flagFN = 0, flagFP = 0, flagN = 0;
let evN = 0, evHit = 0, refsTotal = 0, refsBad = 0;
const totalDiffs: number[] = [];
let totalNullMismatch = 0;
const missing: string[] = [];
const disagreements: { conversation_id: string; criterion_id: string; gold: Answer; model: Answer | undefined; note: string }[] = [];

for (const g of gold) {
  const ev = byConv.get(g.conversation_id);
  const conv = conversations.get(g.conversation_id);
  if (!ev || !conv) { missing.push(g.conversation_id); continue; }
  const lang = perLang.get(g.language) ?? blank();
  perLang.set(g.language, lang);
  const modelAnswers: Record<string, Answer> = {};
  const goldAnswers: Record<string, Answer> = {};

  for (const c of criteria) {
    const gl = g.labels[c.id];
    if (!gl) continue;
    const r = ev.criteria.find((x) => x.criterion_id === c.id);
    const m = r?.answer;
    goldAnswers[c.id] = gl.answer;
    if (m !== undefined) modelAnswers[c.id] = m;

    const isStrict = same(m, gl.answer);
    const isLenient = isStrict || gl.also_acceptable.some((a) => same(m, a));
    for (const cell of [perCrit.get(c.id)!, lang]) {
      cell.n++;
      if (isStrict) cell.strict++;
      if (isLenient) cell.lenient++;
      if (c.type === "scale" && typeof gl.answer === "number") {
        cell.scaleN++;
        const gi = stepIndex(c, gl.answer), mi = m === undefined ? -1 : stepIndex(c, m);
        if (gi >= 0 && mi >= 0 && Math.abs(gi - mi) <= 1) cell.within1++;
      }
    }
    if (!isLenient) disagreements.push({ conversation_id: g.conversation_id, criterion_id: c.id, gold: gl.answer, model: m, note: gl.note });

    if (c.na_allowed) {
      if (gl.answer === "na") naGold++;
      if (m === "na") naModel++;
      if (gl.answer === "na" && m === "na") naBoth++;
    }
    if (c.type === "flag") {
      flagN++;
      if (gl.answer === "yes" && m === "yes") flagTP++;
      else if (gl.answer === "yes") flagFN++;
      else if (m === "yes") flagFP++;
    }
    if (r) {
      refsTotal += (r.evidence ?? []).filter((e) => e.kind !== "na_condition").length;
      refsBad += invalidRefs(r.evidence ?? [], conv);
      // Evidence is checked where both sides cite something: applicable non-flag answers, and agreed gross errors.
      const checkable = c.type === "flag"
        ? gl.answer === "yes" && m === "yes"
        : m !== "na" && gl.answer !== "na" && gl.evidence.length > 0;
      if (checkable) {
        evN++;
        const cited = new Set(evidenceTurns(r.evidence ?? []));
        if (gl.evidence.some((i) => cited.has(i))) evHit++;
      }
    }
  }

  const gt = score(checklist, goldAnswers).total as number | null;
  const mt = score(checklist, modelAnswers).total as number | null;
  if (gt === null || mt === null) { if (gt !== mt) totalNullMismatch++; }
  else totalDiffs.push(Math.abs(gt - mt));
}

// ---------- report ----------
const scored = gold.length - missing.length;
const drafts = gold.filter((g) => g.status !== "reviewed").length;
const all = [...perCrit.values()].reduce((a, c) => ({ n: a.n + c.n, strict: a.strict + c.strict, lenient: a.lenient + c.lenient, scaleN: a.scaleN + c.scaleN, within1: a.within1 + c.within1 }), blank());
const mae = totalDiffs.length ? totalDiffs.reduce((a, b) => a + b, 0) / totalDiffs.length : null;

const lines: string[] = [];
lines.push(`Run: ${runPath}  (${run.evaluations.length} evaluations${run.meta.evaluator ? `, evaluator=${run.meta.evaluator}` : ""})`);
lines.push(`Gold: ${scored}/${gold.length} dialogs scored · ${drafts} still draft${drafts ? " (not human-reviewed yet: treat numbers as provisional)" : ""}`);
if (missing.length) lines.push(`Missing from run: ${missing.join(", ")}`);
lines.push("");
lines.push("criterion                                       n  strict  lenient  scale±1");
for (const c of criteria) {
  const x = perCrit.get(c.id)!;
  const name = `${c.id} ${c.title}`.slice(0, 44).padEnd(44);
  lines.push(`${name} ${String(x.n).padStart(3)}  ${pct(x.strict, x.n)}  ${pct(x.lenient, x.n)}   ${c.type === "scale" ? pct(x.within1, x.scaleN) : "  –  "}`);
}
lines.push(`${"ALL".padEnd(44)} ${String(all.n).padStart(3)}  ${pct(all.strict, all.n)}  ${pct(all.lenient, all.n)}   ${pct(all.within1, all.scaleN)}`);
lines.push("");
lines.push("language   n  strict  lenient");
for (const [l, x] of [...perLang.entries()].sort()) lines.push(`${l.padEnd(8)} ${String(x.n).padStart(3)}  ${pct(x.strict, x.n)}  ${pct(x.lenient, x.n)}`);
lines.push("");
lines.push(`N/A        precision ${pct(naBoth, naModel)} (${naBoth}/${naModel})  recall ${pct(naBoth, naGold)} (${naBoth}/${naGold})`);
lines.push(`Gross err  recall ${pct(flagTP, flagTP + flagFN)} (${flagTP}/${flagTP + flagFN})  precision ${pct(flagTP, flagTP + flagFP)}  false positives ${flagFP}/${flagN}`);
lines.push(`Evidence   hit rate ${pct(evHit, evN)} (${evHit}/${evN})  invalid refs ${refsBad}/${refsTotal}`);
lines.push(`Total      MAE ${mae === null ? "–" : mae.toFixed(2)} points over ${totalDiffs.length} dialogs${totalNullMismatch ? ` · ${totalNullMismatch} null/not-null mismatches` : ""}`);
if (args.verbose) {
  lines.push("");
  lines.push("Disagreements (lenient):");
  for (const d of disagreements) lines.push(`  ${d.conversation_id} ${d.criterion_id}: gold=${d.gold} model=${d.model ?? "∅"}  · ${d.note}`);
}
console.log(lines.join("\n"));

if (args.json) {
  const perCriterion = Object.fromEntries(criteria.map((c) => {
    const x = perCrit.get(c.id)!;
    return [c.id, { n: x.n, strict: ratio(x.strict, x.n), lenient: ratio(x.lenient, x.n), scale_within_1: c.type === "scale" ? ratio(x.within1, x.scaleN) : null }];
  }));
  const perLanguage = Object.fromEntries([...perLang.entries()].map(([l, x]) => [l, { n: x.n, strict: ratio(x.strict, x.n), lenient: ratio(x.lenient, x.n) }]));
  const summary = {
    run: runPath, meta: run.meta, gold_dialogs: gold.length, scored_dialogs: scored, draft_gold: drafts, missing,
    overall: { n: all.n, strict: ratio(all.strict, all.n), lenient: ratio(all.lenient, all.n), scale_within_1: ratio(all.within1, all.scaleN) },
    per_criterion: perCriterion, per_language: perLanguage,
    na: { precision: ratio(naBoth, naModel), recall: ratio(naBoth, naGold), gold: naGold, model: naModel },
    gross_error: { tp: flagTP, fn: flagFN, fp: flagFP, recall: ratio(flagTP, flagTP + flagFN), precision: ratio(flagTP, flagTP + flagFP) },
    evidence: { hit_rate: ratio(evHit, evN), checked: evN, invalid_refs: refsBad, refs: refsTotal },
    total: { mae: mae === null ? null : Math.round(mae * 100) / 100, dialogs: totalDiffs.length, null_mismatch: totalNullMismatch },
    disagreements,
  };
  writeFileSync(String(args.json), JSON.stringify(summary, null, 2) + "\n");
  console.log(`\nmetrics → ${args.json}`);
}
