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

## 5. Backend endpoints (Lane B proposes, fill in)
| Method | Path | Body / returns |
|---|---|---|
| GET | `/api/conversations?group_id=DEV` | proxied + cached dataset |
| GET/PUT | `/api/checklists/:id` | Checklist |
| POST | `/api/evaluate` | `{conversation_id, checklist_id}` → Evaluation |
| POST | `/api/evaluate/batch` | `{group_id, checklist_id}` → job status |
| GET | `/api/evaluations?conversation_id=` | Evaluation[] |
| POST | `/api/appeals` · PATCH `/api/appeals/:id` | Appeal |
