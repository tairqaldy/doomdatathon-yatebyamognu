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
  input?: "audio";                    // additive (#23): judged from the call recording by lib/tone.js, not from the
                                      // transcript; N/A when there is no recording. Absent = text. Not exported to
                                      // the official results file (eval/export-results.mjs keeps the 8 official criteria)
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

**Additive, eval-v5.1 (2026-11-07).** The raw AI result (`lib/evaluator.js` `evaluate()` → `data/evaluations/<group>.json` `results[id]`) also carries, all optional for readers:
- `answers[criterion_id].agreement`: share of self-consistency samples that voted for the chosen answer (0–1); low values go to a human first.
- `facts`: dialog facts the model filled before answering (requests, first operator turn, verification turn, disclosure / insult / off-company turns, client re-asks with cause, ending type, goodbye / summary / offer turns).
- `samples`: how many samples were voted over; `derived`: answers set by the deterministic rules (C7 closing, C3→C8 disclosure) for unchanged built-in criteria.
- `evaluate(conv, checklist, { model, promptVersion, samples, deadlineMs })`; env `CQA_EVAL_SAMPLES` (default 3 for the default eval model), `CQA_EVAL_DEADLINE_MS` (Vercel votes over samples finished within it, default 45 s).

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
| GET | `/api/health` | none | `{ ok, openrouter, openai, organizer_api, shared_cache, postgres, models: { eval, transcribe }, prompt_version, voice: { asr, asr_formats, tts, voice }, commit, branch }` (booleans only, never keys; `voice.tts` null = browser speechSynthesis) |
| POST | `/api/evaluate` | `{ conversation_id, group?: "DEV", checklist: Checklist (§2, at least criteria), model?, force?: bool }` | `AIResult` below. `force` bypasses the cache (re-bills) |
| POST | `/api/transcribe` | `{ conversation_id, group?, language? }` | `{ conversation_id, cached, text, segments?, language, duration, latency_ms, usage, model }` (calls only) |
| GET | `/api/audio?id=<conversation_id>&group=DEV` | none | `302` → fresh mp3 (organizer links expire in ~1h). Use directly as `<audio src>` |
| GET | `/api/dataset?group_id=<ID>` | none | organizer payload (§1). Use for the control set at T+23h |
| POST | `/api/chat` | `{ messages: [{speaker: "client"\|"bot"\|"operator"\|"system", text}] }` | `{ reply, handoff, handoff_reason, topic, language, cached, model, latency_ms, usage, grounded_on }`, the customer-facing AIM bot (`lib/support-bot.js`, prompt `bot-v1`) |
| POST | `/api/insights` | `Authorization: Bearer <admin token>`, `{ question, stats }` | `{ answer, findings[], actions[{title, detail, impact}], risks[], follow_up_questions[], cached, model, latency_ms }` (`lib/insights.js`) |
| POST · GET | `/api/admin-login` | `{ passcode }` · GET with Bearer | `{ token, expires_in }` · `200 {ok:true}` / `401` (`lib/auth.js`, `ADMIN_PASSCODE`, demo `freedom`) |
| POST | `/api/agent` | `{ messages: [{speaker, text}], language: "RU"\|"KZ"\|"EN", page: { screen, catalog: [{ id, title, summary?, targets: [{ id, label, kind: "field"\|"button"\|"section", protected?, options? }] }], dom: [{ id, tag, type, label, value?, protected? }], text } }` | `{ reply, steps: string[], needs_consent, direct, done_reply, language, handoff, handoff_reason (RU), actions: NavAction[], raw_actions, cached, model, latency_ms, usage, prompt_version }`, the `/broker` navigation agent (`lib/nav-agent.js`, prompt `nav-v6`). Actions are validated server-side against `page`. **Consent first (#15):** when `needs_consent` the page shows `reply` + numbered `steps` + a yes/no question and runs `actions` only after the client says yes, then shows `done_reply`. Handoff turns return no actions. **`direct` (#19):** the client explicitly asked AIM to do it («открой за меня», "take me there", «ашып беріңіз»), so the page runs `actions` at once and shows `done_reply`; `needs_consent` is then false |
| POST | `/api/agent-voice` | `{ audio: base64, format: "wav"\|"webm"\|"mp4"\|"m4a"\|"ogg"\|"mp3", language }` (≤ ~2 MB) | `{ text, language, cached, latency_ms, server_ms, model }`: push-to-talk for AIM (`/support`, `/broker`, `/phone`). OpenAI Whisper when `OPENAI_API_KEY` is set (any listed format), else Nemotron 3.5 Transcribe (send 16 kHz WAV; see `GET /api/speak` `asr_formats`). Cached in the gitignored `asr` namespace; `text` is PII-masked and empty for silence |
| GET | `/api/speak` | none | `{ asr, asr_formats: string[], tts: string\|null, voice, max_chars, version }`: which engines serve AIM's voice; `tts: null` → use the browser's speechSynthesis |
| POST | `/api/speak` | `{ text (≤ 600 chars, send one chunk at a time), language?: "RU"\|"KZ"\|"EN", ui?: true }` | `{ audio: base64 mp3, mime, format, chars, cached, tier, latency_ms, server_ms, model, voice, cost_usd }`, or **501** `{ code: "tts_unavailable" }` without `OPENAI_API_KEY`. Cached by model + voice + tone + text: `tts` (gitignored) or `tts-ui` (committed, fixed UI phrases ≤ 240 chars). Client: `shared/voice.js` |
| GET · PUT · DELETE | `/api/sessions` | GET list / GET `?id=` / PUT `{id,…}` / DELETE `?id=` | `{ postgres: bool, sessions?: LiveSession[], session?: LiveSession }`. `postgres: false` and empty list when `DATABASE_URL` is unset (UI keeps localStorage) |

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
    audio_metrics?: {            // additive (#23), input: "audio" criteria only; arithmetic on transcript timestamps
      op_turns: number; op_words: number; op_wpm_median: number | null; measured_turns: number;
      long_waits: { turn_index: number; at: string /*mm:ss*/; wait_s: number }[];
    };
  }>;
  audio_model?: string;          // additive (#23), e.g. "google/gemini-3.8-flash", when audio criteria were judged
  audio_prompt_version?: string; // e.g. "tone-v4"
  // usage.audio = the tone call's own usage + cached flag; usage.cost counts fresh spend only
  problems: string[];            // normalisation notes (invalid answers snapped, evidence dropped)
  usage: { prompt_tokens?: number; completion_tokens?: number; cost: number | null };
  latency_ms: number; attempts: number;
}
```

**Precomputed results (instant, no API call):** `GET /data/evaluations/DEV.json` → `{ group, model, prompt_version, checklist_id, checklist_version, generated_at, results: Record<conversation_id, AIResult-without-cache-fields + total + gross_error> }`. They are valid only for the **base checklist** (`data/checklists/freedom-chat-v1.json`). After the checklist changes, call `/api/evaluate` (the prototype keys its cache by a hash of the criteria).

**Live support sessions** (`/support` ⇄ `/admin` operator console): `LiveSession` in `shared/live-store.js`. Same-browser demo: `localStorage cqa-live-v1` + `BroadcastChannel cqa-live`. Shared demo: set `DATABASE_URL` → `PUT/GET /api/sessions` (`cqa_kv`, ns `live_session`); the store hydrates and polls every 2s. Additive field: `updated_at`.
Additive fields in use (set by `/support` and `/admin`): on bot messages `latency_ms`, `cached`, `model`; on the session `topic`, `closed_at`, `csat` (1–5), `csat_comment`, `csat_skipped`, `queue_notified`, `evaluation_status` (`pending`/`done`/`error`), `evaluation_error`, `evaluated_at`; `handoff` is `{ at, reason, summary? }`.

```ts
// /api/agent actions (after server-side validation). The page runs them in order.
type NavAction =
  | { type: "open_screen"; screen: string }
  | { type: "highlight"; screen: string; target: string }               // also what a protected target or a prefill on a non-field becomes
  | { type: "prefill"; screen: string; target: string; value: string }  // only fields; never protected targets
  | { type: "click"; element_id: string }                               // DOM fallback, never protected / submit elements
  | { type: "input"; element_id: string; value: string }
  | { type: "highlight_element"; element_id: string };                  // a click on a protected element is downgraded to this
```
**AIM widget embedding (#17):** the widget is self-contained: `<script type="module" src="/broker/agent.js">` loads `broker/agent.css` itself and mounts `#aim-widget` on `<body>`. Page knowledge lives in one adapter, `broker/agent-host.js` (or `window.AIM_HOST` set before the script): `getLang, onLang, currentScreen, catalog, go, findTarget, contentRoot, apiBase, checklistUrl`; all optional, defaults work on any page via the DOM scan. Optional theming on the host: `--aim-accent`, `--aim-accent-ink`, `--aim-dark`, `--aim-font`, `--aim-z`.

`/broker` handoff reuses `LiveSession` (additive fields): session `source: "broker-agent"`, messages may carry `actions: string[]` (what AIM did on screen). Pre-handoff messages keep their real `at` / `timestamp`.

**Not built (UI keeps these client-side for now):** appeals and checklist versions live in `localStorage` (prototype). If shared state is needed for the demo, Lane B adds `GET/POST /api/appeals` with the §4 shape (additive).

### Optional transcript fairness validation (flagged integration)

`CQA_TRANSCRIPT_FAIRNESS=1` enables an additive `fairness` sidecar on `/api/evaluate`; default is off. Existing answers, evidence, totals, usage and cache entries retain their original shapes and values. The sidecar is computed **after** generation/cache retrieval and is not included in generation keys.

`POST /api/validate-evaluation { conversation, checklist, result }` revalidates a supplied saved result without invoking a model or writing caches. Disabled: `{ enabled:false }`; enabled: `{ enabled:true, fairness }`. This validates the supplied input; it does not authenticate its origin or approve its correctness. Call results must use the call checklist, including C09, and retain `audio_model` provenance.

`fairness` contains `validation_version`, `status: valid|warning|needs_review|invalid`, `findings[]` (`reason`, `criterion_id`, `dimension`, `severity`), `criteria[]` (original answer/evidence/explanation plus validation state), `provisional_total`, `confirmed_total`, `publishable`, `gross_error`, `input_sha256`, and `verification: automated_validation_not_human_score_approval`. `confirmed_total` is null for blocked results. For nonblocked results it means automated validation passed, **not human QA approval**; the UI keeps the human-confirmed total empty unless a separate authorized decision exists. A positive gross flag stays visible even when the result is blocked. C08=no without source evidence has no approved legacy exception in this integration.

Human audio observations are transcript-bound; applying them to a different checklist retains observations but adds a pending checklist-decision finding. They cannot change an answer, assign N/A or approve C08. Missing/stale transcript probes block confirmation for new/edited inputs rather than launching Python or paid inference at runtime. The current runtime can consume the existing source-bound DEV probes; runtime probe generation for new dialogs remains a separate integration task.
