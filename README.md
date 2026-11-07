# Freedom CQA: Conversation Quality Analytics

Prototype for the Freedom Broker case at the NU datathon: automatic, explainable quality checks of operator chats and calls (RU / KZ / EN) against a configurable checklist, with evidence links, appeals and reviewer decisions.

**Live:** https://freedom-cqa.vercel.app: the **preview hub** (build, AI status, measured accuracy, every surface on phone / tablet / laptop). The app is at [`/prototype/`](https://freedom-cqa.vercel.app/prototype/). Every push to `main` redeploys automatically; every other branch gets its own preview URL.

## Run locally (2 minutes)

```bash
git clone https://github.com/tairqaldy/doomdatathon-yatebyamognu.git && cd doomdatathon-yatebyamognu
cp .env.example .env          # add OPENROUTER_API_KEY (+ CQA_API_URL from the team chat)
npm run dev                   # Node ≥ 20, no dependencies → http://localhost:3000 (hub) · /prototype/ (app)
```
Without a key the app runs on the built-in MOCK evaluator (clearly labelled). Without Node: `python3 -m http.server 8080` → http://localhost:8080/prototype/ (static only, MOCK, no call audio).

## What it does (defense flow)
1. **Dialogs**: average score by language, where points are lost, filters, every dialog with its main deduction.
2. **Conversation analysis** (layout from Freedom's own "QA workspace" slide): per-speaker timeline with numbered deduction markers, call audio, a "reason · operator actions · outcome" summary, transcript, score ring, criteria with points, **reasons the score was lowered** with one-click jump to the exact line or audio moment.
3. **N/A** shown with the condition that made it N/A; weights redistributed to keep a 100-point max.
4. **Appeal → reviewer decision** (confirm or change + reason) → total recalculated; the card keeps original, decision and final.
5. **Checklist editor**: change, add or replace a criterion, save as a new version → all dialogs re-evaluated.

## How scoring works
The LLM only decides each criterion's answer, explanation, deduction reason and evidence (validated against the transcript). Points and totals come from a deterministic engine ([prototype/scoring.js](prototype/scoring.js)) that implements the checklist rules: yes = full weight, scale proportional, N/A weight redistributed, 2-decimal rounding, gross errors flagged separately. Tests: `npm test`.

## AI, cost and caching
| Job | Model | Measured |
|---|---|---|
| Evaluate a dialog | **`openai:gpt-6-luna`** (default, direct OpenAI; falls back to OpenRouter's `openai/gpt-6-luna` without `OPENAI_API_KEY`). Any OpenRouter id works via `CQA_EVAL_MODEL` | **$0.00105 per evaluation**, p50 13.3 s, 0 errors on all 65 DEV dialogs. Gold set (19 reviewed dialogs): **86.2 % strict agreement**, 94.7 % lenient, gross-error recall 6/7 with 0 false positives, evidence hit rate 95.5 %, total MAE 7.8 points. Haiku 5.5 for comparison: 75.7 % strict |
| Transcribe a call | `nvidia/nemotron-3.5-transcribe` (OpenRouter) | $0.04 for all 5 calls, 10–18 s each; WER 35.5 % / CER 24.4 % vs organizer transcripts (themselves ASR incl. IVR prompts, so this is agreement, not accuracy) |

Every model call is cached (memory → `eval/cache/` files → optional Upstash), keyed by model + prompt version + input. A repeated request is instant and free; committed cache files let teammates and Vercel reuse paid answers.

```bash
npm run eval -- --group DEV            # evaluate all dialogs → data/evaluations/DEV.json (app loads it instantly) + eval/runs/<ts>.json (cost, p50/p95 latency)
npm run eval -- --group <CONTROL_ID>   # control set at T+23h (needs CQA_API_URL)
npm run asr                            # Nemotron transcripts of the 5 calls + WER/CER vs organizer transcripts
```

## API (Vercel functions in `api/`, same code runs in `npm run dev`)
`GET /api/health` · `POST /api/evaluate {conversation_id, checklist}` · `POST /api/transcribe {conversation_id}` · `GET /api/audio?id=` (fresh mp3 link, since organizer links expire after ~1h) · `GET /api/dataset?group_id=`

## Repo map
`prototype/` UI (no build, Dynamics 365-friendly) · `design/` design system from fbroker.kz · `lib/` AI client, cache, evaluator · `api/` serverless routes · `scripts/` dev server, eval, ASR, tests · `data/` datasets, checklist, cached evaluations · `docs/` case, research, team logs · **Team and agent rules: [AGENTS.md](AGENTS.md)**
