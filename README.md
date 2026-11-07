# Freedom CQA: Conversation Quality Analytics

Prototype for the Freedom Broker case at the NU datathon: automatic, explainable quality checks of operator chats and calls (RU / KZ / EN) against a configurable checklist, with evidence links, appeals and reviewer decisions.

**Live:** deployed on Vercel from `main`; every branch gets its own preview URL (see the Deployments tab or the PR comment).

## Run locally (2 minutes)

```bash
git clone https://github.com/tairqaldy/doomdatathon-yatebyamognu.git && cd doomdatathon-yatebyamognu
cp .env.example .env          # add OPENROUTER_API_KEY (+ CQA_API_URL from the team chat)
npm run dev                   # Node ≥ 20, no dependencies → http://localhost:3000/prototype/
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
| Job | Model (OpenRouter) | Cost |
|---|---|---|
| Evaluate a dialog | `anthropic/claude-haiku-5.5` (default, `CQA_EVAL_MODEL`) | ≈ $0.001 per evaluation (~5k input + ~1k output tokens at $0.10/$0.50 per M). Measured numbers: `eval/runs/` |
| Transcribe a call | `nvidia/nemotron-3.5-transcribe` | ≈ $0.06 per audio hour |

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
