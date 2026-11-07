# CONTRACTS: shared data shapes (v0 draft)

Owned by everyone. Change only via a `contract-change` issue + note in STATUS (AGENTS.md §4). Prefer **additive** changes. TS mirror: `app/src/types.ts`.

## 1. Dataset (from organizers' API, keep as-is)
`GET <api>?group_id=DEV` → `{ error, isSuccess, data: { dataset_group_id, total_records, records: Conversation[] } }`

```ts
type Speaker = "client" | "operator" | "bot" | "system";
interface Turn { timestamp: string; speaker: Speaker; text: string } // chat "MM:SS", call ISO 8601 w/ TZ. Keep original.
interface Conversation {
  conversation_id: string;            // e.g. "p1-ru-001"
  channel: "agent chat" | "voice call";
  language: "RU" | "KZ" | "EN";
  transcript: Turn[];                 // message index = array index (0-based); this is our evidence anchor
  audio_url: string | null;           // null for chats
}
```

## 2. Checklist (`data/checklists/*.json`)
```ts
interface Checklist {
  id: string; name: string; version: number; updated_at: string;
  sections?: { id: string; title: string }[];
  criteria: Criterion[];
}
interface Criterion {
  id: string;                         // stable, e.g. "c01"
  order: number;
  section_id?: string;
  title: string;
  description: string;                // what "Yes"/top score means (fed to LLM)
  type: "binary" | "scale" | "flag";  // flag = gross error, no points
  weight: number;                     // 0 for flag
  na_allowed: boolean;
  na_condition?: string;              // when N/A is valid (fed to LLM)
  scale?: { value: number; label: string }[]; // for type "scale"; max value = full weight
}
```

## 3. Evaluation result
```ts
type Answer = "yes" | "no" | "na" | number; // number = chosen scale step
interface Evidence {
  kind: "message" | "range" | "na_condition";
  turn_index?: number;                // for "message"
  range?: [number, number];           // for "range" (checked section when action missing)
  quote?: string;                     // original language
}
interface CriterionResult {
  criterion_id: string;
  answer: Answer;
  points: number | null;              // computed by scoring.ts, null if na/flag
  effective_weight: number | null;    // after N/A redistribution
  explanation: string;
  evidence: Evidence[];
}
interface Evaluation {
  id: string; conversation_id: string;
  checklist_id: string; checklist_version: number;
  created_at: string;
  model: { name: string; prompt_version: string; latency_ms: number; cost_usd?: number };
  criteria: CriterionResult[];
  sections?: { section_id: string; score: number | null }[];
  total: number | null;               // 0–100, 2 decimals, null if not calculable
  gross_error: boolean;
}
```

## 4. Appeal and review
```ts
interface Appeal {
  id: string; evaluation_id: string; criterion_id: string;
  comment: string; created_at: string;
  status: "open" | "confirmed" | "changed";
  decision?: { new_answer?: Answer; reason: string; decided_at: string };
}
// Card shows: original Evaluation, Appeal(s) + decision, and a final Evaluation recomputed by scoring.ts.
```

## 5. Backend endpoints (live: `api/*.js`, same in `npm run dev` and on Vercel)
For UI work (Dameli): call these with relative URLs (`/api/...`). All JSON, CORS open (D365 can embed).

| Method | Path | Request | Response |
|---|---|---|---|
| GET | `/api/health` | none | `{ ok, openrouter, openai, organizer_api, shared_cache, models: { eval, transcribe }, prompt_version, commit, branch }` (booleans only, never keys) |
| POST | `/api/evaluate` | `{ conversation_id, group?: "DEV", checklist: Checklist (§2, at least criteria), model?, force?: bool }` | `AIResult` below. `force` bypasses the cache (re-bills) |
| POST | `/api/transcribe` | `{ conversation_id, group?, language? }` | `{ conversation_id, cached, text, segments?, language, duration, latency_ms, usage, model }` (calls only) |
| GET | `/api/audio?id=<conversation_id>&group=DEV` | none | `302` → fresh mp3 (organizer links expire in ~1h). Use directly as `<audio src>` |
| GET | `/api/dataset?group_id=<ID>` | none | organizer payload (§1). Use for the control set at T+23h |

```ts
// POST /api/evaluate response. Points/total are NOT included: compute them in the UI with score(checklist, answers)
// from prototype/scoring.js (→ app/src/scoring.ts) so appeals/overrides recompute instantly.
interface AIResult {
  conversation_id: string;
  cached: boolean; cache_tier: "memory" | "file" | "upstash" | "none"; served_ms: number;
  model: string;                 // e.g. "openai:gpt-6-luna"
  prompt_version: string;        // e.g. "eval-v1"
  summary: { reason: string; operator_actions: string; outcome: string } | null;  // "Понимание" strip
  answers: Record<string /*criterion_id*/, {
    answer: Answer;              // §3: "yes" | "no" | "na" | number (scale step)
    explanation: string;         // RU, 1–2 sentences
    deduction_reason: string;    // "" when full points; otherwise "why points were lost" (shown in «Причина снижения оценки»)
    evidence: Evidence[];        // §3; indices validated against the transcript, quotes = real line text
  }>;
  problems: string[];            // normalisation notes (invalid answers snapped, evidence dropped)
  usage: { prompt_tokens?: number; completion_tokens?: number; cost: number | null };
  latency_ms: number; attempts: number;
}
```

**Precomputed results (instant, no API call):** `GET /data/evaluations/DEV.json` → `{ group, model, prompt_version, checklist_id, checklist_version, generated_at, results: Record<conversation_id, AIResult-without-cache-fields + total + gross_error> }`. They are valid only for the **base checklist** (`data/checklists/freedom-chat-v1.json`). After the checklist changes, call `/api/evaluate` (the prototype keys its cache by a hash of the criteria).

**Not built (UI keeps these client-side for now):** appeals and checklist versions live in `localStorage` (prototype). If shared state is needed for the demo, Lane B adds `GET/POST /api/appeals` with the §4 shape (additive).
