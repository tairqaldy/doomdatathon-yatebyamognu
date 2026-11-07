// Shared helpers for eval scripts: file loading and light types.
// Shapes follow docs/CONTRACTS.md §1–3. Gold file format: eval/gold/README.md.
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export type Answer = "yes" | "no" | "na" | number;

export interface Turn { timestamp: string; speaker: "client" | "operator" | "bot" | "system"; text: string }
export interface Conversation {
  conversation_id: string;
  channel: string;
  language: "RU" | "KZ" | "EN";
  transcript: Turn[];
  audio_url: string | null;
}

export interface Criterion {
  id: string; order: number; section_id?: string; title: string; description: string;
  type: "binary" | "scale" | "flag"; weight: number; na_allowed: boolean; na_condition?: string;
  scale?: { value: number; label: string }[];
}
export interface Checklist {
  id: string; name: string; version: number; updated_at: string;
  sections?: { id: string; title: string }[];
  criteria: Criterion[];
}

export interface Evidence { kind: "message" | "range" | "na_condition"; turn_index?: number; range?: [number, number]; quote?: string }
export interface CriterionResult {
  criterion_id: string; answer: Answer; points: number | null; effective_weight: number | null;
  explanation: string; evidence: Evidence[];
}
export interface Evaluation {
  id: string; conversation_id: string; checklist_id: string; checklist_version: number; created_at: string;
  model: { name: string; prompt_version: string; latency_ms: number; cost_usd?: number };
  criteria: CriterionResult[];
  sections?: { section_id: string; score: number | null }[];
  total: number | null;
  gross_error: boolean;
}

export interface GoldLabel { answer: Answer; evidence: number[]; also_acceptable: Answer[]; note: string }
export interface GoldFile {
  conversation_id: string; language: string; channel: string;
  checklist_id: string; checklist_version: number;
  status: "draft" | "reviewed"; labeled_by: string; reviewed_by: string | null;
  tags: string[];
  labels: Record<string, GoldLabel>;
}

export const readJson = <T>(path: string): T => JSON.parse(readFileSync(path, "utf8")) as T;

/** Records from a saved organizer response (data/datasets/*.json) or a bare Conversation[]. */
export function loadDataset(path: string): Conversation[] {
  const raw = readJson<any>(path);
  return Array.isArray(raw) ? raw : raw.data.records;
}

export function loadGold(dir: string): GoldFile[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => readJson<GoldFile>(join(dir, f)));
}

/** A run file is either Evaluation[] or { meta, evaluations: Evaluation[] }. */
export function loadRun(path: string): { meta: Record<string, unknown>; evaluations: Evaluation[] } {
  const raw = readJson<any>(path);
  if (Array.isArray(raw)) return { meta: {}, evaluations: raw };
  return { meta: raw.meta ?? {}, evaluations: raw.evaluations ?? [] };
}

/** Parse "--key value" and "--flag" style CLI args; positional args land in _. */
export function parseArgs(argv: string[]): { _: string[]; [k: string]: string | boolean | string[] } {
  const out: { _: string[]; [k: string]: string | boolean | string[] } = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next !== undefined && !next.startsWith("--")) { out[key] = next; i++; } else out[key] = true;
    } else out._.push(a);
  }
  return out;
}
