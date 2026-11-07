# TOOLING: everything we use, and how

**Rule (AGENTS.md §4.2):** log every tool, CLI, library, MCP server, skill, sub-agent, AI model, prompt strategy, development approach, research source and external doc **before or in the same commit** as you start relying on it. A teammate's agent on another laptop must be able to reproduce your setup from this file alone.

Status: `active` (in use) · `trial` (being evaluated) · `candidate` (proposed, not installed) · `dropped` (with reason).

## 1. Dev environment and CLIs
| Name | What for | Lane / who | Install / use | Cost / limits | Status |
|---|---|---|---|---|---|
| git + Xcode Command Line Tools (macOS) | Version control | all | `xcode-select --install` | free | active |
| GitHub CLI `gh` | Issues, PRs, labels from the terminal; required for the issue-first rule | all | `brew install gh` / `winget install GitHub.cli` (tair: v2.103.3 in `~/.local/bin`), then `gh auth login` | free | active (tair still needs `gh auth login`) |
| Node.js 22 LTS + npm | `npm run dev` (static + /api mirror of Vercel), eval/ASR scripts, tests; later TS build | all | nodejs.org (tair: v22.23.4 tarball in `~/.local/node`) | free | active |
| uv (Astral) | installs Python 3.12 + graphify without touching system Python | all | `curl -LsSf https://astral.sh/uv/install.sh \| sh` | free | active |
| Vercel (Git integration) | CI/CD: preview URL per branch push, production from `main`, serverless `api/` | all | linked to this GitHub repo; env vars in Vercel → Settings | free hobby tier | active |
| Python 3 | data scripts, JSON checks in `scripts/check.sh` | B, C | ships with Xcode CLT on macOS | free | active |
| `python3 -m http.server` | serve `prototype/` and `data/` locally (fetch needs http, not file://) | A | `python3 -m http.server 8080` from repo root, or the `prototype` entry in `.claude/launch.json` | free | active |
| Claude desktop built-in browser | click-testing the prototype, screenshots, console checks | A, D | opens via `.claude/launch.json` | free | active |
| curl + Python (`re`) | reverse-engineering fbroker.kz CSS into tokens | D | see `docs/research/design-system.md` §0 | free | active |
| macOS PDFKit via `osascript -l JavaScript` | extracting text from the organizers' PDFs without extra installs | D | used once, outputs in `docs/case/` | free | active |
| `.githooks/commit-msg` | blocks AI attribution in commits | all | `git config core.hooksPath .githooks` | free | active |
| `scripts/check.sh` | pre-merge gate (JSON valid, no secrets, no AI attribution, build/test if present) | all | `scripts/check.sh` | free | active |
| Upstash Redis (REST) | shared AI cache across instances + cross-device live chats (`lib/cache.js`, `lib/kv.js`) | B | Vercel → Storage → "Upstash for Redis" (injects `KV_REST_API_*`) or `UPSTASH_REDIS_REST_*` | free tier | candidate (waiting for tair to connect) |
| Cloudflare Workers KV (REST) | alternative shared AI cache backend | B | `CF_ACCOUNT_ID`, `CF_KV_NAMESPACE_ID`, `CF_API_TOKEN` (Workers KV Storage: Edit) | free tier | supported, not configured |
| `npm run results` (= `eval/control-run.mjs`) | fetch → evaluate → export → validate → push `results/dev|prod/results.json` in the official JSON 1.0 | C | `npm run results -- --group <ID> --push` | per-eval cost | active (official format, #22) |
| GitHub Actions `check.yml` | runs `scripts/check.sh` on every push/PR | all | `.github/workflows/check.yml` | free (public repo) | active |
| Demo video recorder `scripts/demo/record.mjs` + `encode.swift` | captioned, silent screen recording of the real product → `landing-tair/assets/demo.mp4` + `demo-poster.jpg` + README stills `docs/media/*.jpg`, one command | D (tair) | `node scripts/demo/record.mjs` (Node 22, Google Chrome, `/usr/bin/swift`; starts `scripts/dev-server.mjs` on :3201 if nothing answers; needs `.env` for AI). Headless Chrome driven over the DevTools Protocol with Node's built-in `WebSocket` (no Puppeteer, no npm deps); a cursor + caption bar are injected into every page; frames come from `Page.startScreencast` on a clock that stops during long AI waits ("в видео ускорено"); `encode.swift` writes H.264 24 fps with AVFoundation `AVAssetWriter` (no ffmpeg), bitrate sized to stay under 12 MB. Caption copy lives in the `C` object at the top of `record.mjs`; `--from <scene>` / `--snaps <dir>` / `--no-encode` for debugging | free; ≈ $0.01 of AI per run (2 AIM replies, 1 evaluation, 1 analyst answer; repeats mostly cached); encoder is macOS-only | active |

## 2. AI agents and assistants
| Name | What for | Who | Notes | Status |
|---|---|---|---|---|
| Claude Code | coding agent (reads `CLAUDE.md` → `AGENTS.md`) | team | Model choice per person; log here if you switch | active |
| OpenAI Codex | coding agent (reads `AGENTS.md`) | team | | active |
| Sub-agents (Claude `Agent`, Codex tasks) | parallel research / review | team | Log any custom agent definitions you add under `.claude/agents/` here | active |

## 3. MCP servers / skills / plugins
| Name | What for | Who | Install | Status |
|---|---|---|---|---|
| Figma MCP | push prototype screens to Figma if needed | D | connected in tair's Claude app | candidate |
| Paper MCP | design canvas the team asked for | D | **not connected yet**: add it in the Claude app's connectors, then log the setup here | candidate |
| graphify 0.9.103 (`graphifyy` on PyPI, canonical repo Graphify-Labs/graphify, Apache-2.0) | knowledge graph of the repo so agents read `graphify-out/GRAPH_REPORT.md` instead of re-reading files | all | `uv tool install --python 3.12 graphifyy && graphify install --platform claude` (and `codex`); build: `graphify update .` (code only, no LLM). User-level skill; project CLAUDE.md untouched. `graphify-out/` gitignored | active |
| unslop 2.3.0 (theclaymethod/unslop) | de-AI pass on README / pitch / slide copy (`/unslop cleanup`) | D | `git clone https://github.com/theclaymethod/unslop ~/dev/unslop && ln -s ~/dev/unslop ~/.claude/skills/unslop` (also `~/.codex/skills`). SKILL.md says MIT but repo has no LICENSE → **local use only, never vendored** (IP rule) | active |
| REA (`rea-agents` MCP) native-UI capture | screenshot of one exact app window (iPhone Mirroring) for app research | D | REA MCP in the Claude app; `open_binary` on `/System/Applications/iPhone Mirroring.app`, then `observe_native_ui` with pid + window id. Needs Screen Recording for the bundled `claude` binary (see `docs/research/freedom-app.md` §0). Can't tap inside the mirrored phone (video surface, no AX elements) | active |

## 4. AI models (evaluation, ASR, TTS)
Log: model id, provider, why, temperature, prompt version, **cost per evaluation (all calls)**, latency p50/p95. README must state model + cost per evaluation (organizer requirement).
| Model | Used for | Lane | Cost / eval | Latency | Status |
|---|---|---|---|---|---|
| **`openai:gpt-6-luna` via direct OpenAI API** (default, `CQA_EVAL_MODEL`; key `OPENAI_API_KEY`; `lib/openai.js` + `lib/llm.js`) | criterion answers + explanation + deduction reason + evidence, strict JSON schema, temp 0, prompt **`eval-v4`** (v1 → v4 in #13) | C | **measured $0.00112/eval** (18 fresh calls, $0.020, 2026-11-07); $0.10/$0.50 per M tok, cost computed locally from token usage | **p50 14.0 s · p95 22.1 s** (concurrency 4) | active; gold accuracy **91.4% strict / 96.7% lenient**, gross-error recall 7/7, N/A recall 96.4%, total MAE 6.06 (`eval/runs/gpt-6-luna-eval-v4.metrics.json`; eval-v1 was 86.2 / 94.7, 6/7, MAE 7.83); all 65 DEV $0.00114/eval |
| `anthropic/claude-haiku-5.5` via OpenRouter (previous default) | criterion answers + explanation + deduction reason + evidence, strict JSON schema, temp 0, prompt `eval-v1` | C | **measured $0.00177/eval** (19 dialogs, $0.034 total, one call each, 2026-11-07); rates $0.10/$0.50 per M tok | **p50 13.4 s · p95 18.0 s** (concurrency 4) | alternative; gold accuracy 75.7% strict / 92.1% lenient (`eval/runs/haiku-5.5-eval-v1.metrics.json`) (compare vs `nvidia/nemotron-3.5-lightning`, `qwen/qwen3.7-flash` per Dameli's plan) |
| `google/gemini-3.8-flash` via OpenRouter (`CQA_TONE_MODEL`) | c09 tone of voice on calls: listens to the call mp3 + operator turns and timings, strict JSON schema, prompt `tone-v4` (`lib/tone.js`, `node scripts/tone-run.mjs`) | C | **measured ≈ $0.013/call** (5 DEV calls, $0.066) | 10–20 s per call | active (#23); quoted a known stretch of p4-ru-002 word for word |
| `openai:gpt-audio-mini` (direct OpenAI, `lib/openai.js` chatAudioJSON) | tried for c09 tone | C | $0.044/call measured | ~15 s | **rejected (#23)**: all calls 7, then all 10 after a wording change; invented phrases and a client's name at a known timestamp; no JSON mode |
| `nvidia/nemotron-3.5-transcribe` via OpenRouter (`CQA_ASR_MODEL`) | transcribe the 5 call recordings; WER/CER vs organizer transcripts (`npm run asr`) | C | ≈$0.06/audio hour ($0.0000167/s, PrimeIntellect) | measure | active |
| OpenAI `gpt-image-2.6-sunburst` (quality medium, 1536×1024 / 1024×1536, webp) | original surreal film imagery for landing/support (`scripts/gen-images.mjs`), replaces third-party mood-board photos (IP rule) | D | ~1.1k image tokens per image; 8 images | 15–23 s each | active |
| `openai:gpt-6-luna` as chat model (`CQA_CHAT_MODEL`) | AIM support bot `/api/chat`, grounded on DEV operator answers | B/C | ~$0.001/turn est. | ~2 s | active |
| `openai:gpt-6-luna` as nav-agent model (`MODELS.chat`) | `/broker` AIM navigation agent `/api/agent`: reply + typed actions (open_screen / highlight / prefill) + DOM fallback, strict JSON, temp 0.2, prompt `nav-v1` | C | ~$0.001–0.002/turn est. (page catalog ≈ 2–3k tokens) | 4–8 s per turn measured locally | active (#14) |
| **OpenAI `whisper-1`** (direct API, `CQA_OPENAI_ASR_MODEL`; `lib/openai.js` `transcribe()` via `lib/llm.js`) | AIM push-to-talk in `/support`, `/broker`, `/phone` (`/api/agent-voice`); takes the browser's webm/mp4 as is, language hint RU/KZ/EN, cached in gitignored `asr` | C | $0.006/audio min (≈$0.0005 per 5 s question) | **p50 1197 · p95 2515 ms** cold over HTTP, 3 · 5 ms cached (`eval/runs/voice-bench-http-*`) | active; CER on 12 synthetic clips 0.064 (RU 0.012 · KZ 0.11 · EN 0.069) |
| OpenAI `gpt-4o-transcribe` / `gpt-4o-mini-transcribe` / `gpt-transcribe` | measured alternatives to Whisper (`node scripts/voice-bench.mjs --models`) | C | $0.006 / $0.003 / unpriced per min | 844·1166 / 861·2350 / 1317·2209 ms (p50·p95) | candidates: `gpt-4o-transcribe` is faster at the same price (CER 0.056); mini is weak on KZ (CER 0.29) |
| **OpenAI `gpt-4o-mini-tts`, voice `sage`** (`CQA_TTS_MODEL`, `CQA_TTS_VOICE`; `lib/openai.js` `speak()`) | AIM spoken replies (`/api/speak`), calm-tone instruction, mp3; replies chunked by sentence on the client (`shared/voice.js`), cached in gitignored `tts`, greetings' first chunk committed in `tts-ui` | C | ≈$0.015 per spoken min (≈$0.0015 per 100-char reply, estimated from characters) | **p50 1374 · p95 1750 ms** cold per chunk over HTTP, 3 · 4 ms cached | active; beat `tts-1` (p50 1383 vs 1973 ms direct) |
| `nvidia/nemotron-3.5-transcribe` for push-to-talk (`/api/agent-voice`) | fallback when `OPENAI_API_KEY` is missing (or Whisper fails on WAV); client re-encodes to 16 kHz mono WAV | C | ≈$0.06/audio hour | ~1.4–2 s per short clip | fallback (#14); KZ poor on a synthetic clip |
| Browser `speechSynthesis` (Web Speech API) | fallback for spoken replies when the server has no voice (`/api/speak` → 501) or a TTS call fails; silent when the browser has no voice for the language | C | free, on device | instant | fallback (#14) |
| Whisper / ElevenLabs | optional live voice / TTS (500 ms target) | C | | target ≤500 ms if live | candidate |

## 5. Libraries and frameworks
| Name | Version | What for | Lane | Status |
|---|---|---|---|---|
| TypeScript | _pin_ | app source | A, C | candidate |
| Tailwind CSS | _pin_ (v3 → `design/tailwind.preset.js`, v4 → `design/theme.css`) | styling via our tokens | A | candidate |
| Inter (Google Fonts) | variable | fallback font for CoFo Sans (Freedom's licensed font), full Cyrillic + Kazakh | A, D | active in prototype |
| Postgres (`DATABASE_URL` / `POSTGRES_URL`) | n/a (no npm driver) | shared live sessions in table `cqa_kv`; Neon/Vercel Postgres via SQL-over-HTTP, other hosts via TCP/TLS in `lib/postgres.js` | B | active (optional) |

## 6. Approaches and development strategies
Integration QA (2026-11-07): Node built-ins (`node:test`, assert, fs, crypto, child_process), read-only GitHub REST via PowerShell Invoke-RestMethod (public PR/issue inventory), isolated provider fetch doubles and actual cached API-handler tests. Scoring fix is a `.patch` artifact tested in memory; application and backend files stay untouched. No dependencies or paid calls. Reproduce via `node eval/integration/run.mjs`; details and limitations in `docs/INTEGRATION_READINESS.md`.

Readiness diagnostics (2026-11-07): Node v24.18.0 built-in `node:test` / `assert`, offline `fetch` test doubles, `crypto` SHA-256 input snapshots and existing accuracy harness. Run `node --test eval/readiness/*.test.mjs`; c08 suite defaults to mock or reads `CQA_READINESS_RUN` as a saved Evaluation[] file. No network calls, dependencies, prompt tuning or paid inference. Test doubles verify plumbing only, never model accuracy. See `eval/EVALUATOR_READINESS.md`.

Saved-run replay: `node eval/readiness/review-saved-run.mjs <immutable-ref> <evaluations.json>` reads git objects, verifies dataset/checklist and cache/export consistency, then invokes the existing accuracy harness and c08 regressions. Source used: main snapshot 8feeb26, Haiku eval-v1 run from issue #6. No new model request; metadata records source hash and distinguishes historical provider cost from $0 replay cost. `node eval/readiness/run-offline.mjs` writes only `eval/runs/readiness-*` and checks protected-file hashes. Both commands currently return 1 for known regressions; diagnostic `.log` outputs are gitignored, JSON summaries are retained.

| Approach | Why | Where documented |
|---|---|---|
| Optional Postgres for live sessions (`lib/postgres.js` + `lib/kv.js` + `/api/sessions`); localStorage remains the offline cache | Vercel isolates and two demo devices cannot share `localStorage` | `DATABASE_URL`, `node scripts/pg-ping.mjs` |
| Cache every model call (memory → `eval/cache/` files → optional Upstash), key = model + prompt version + input; commit the cache | repeated requests instant and free; teammates/CI/Vercel reuse paid answers; protects the ~$9.5 budget | `lib/cache.js`, AGENTS.md §8.1 |
| LLM evidence validated against the transcript (indices in range, quotes replaced by real text) | model can't invent evidence | `lib/evaluator.js` `normalize()` |
| Precomputed AI results committed (`data/evaluations/<group>.json`) | instant demo, works even if the API is down at defense | `scripts/eval-run.mjs` |
| Audio via server redirect (`/api/audio`) | organizer `audio_url` is an HTML page with a 1h SAS mp3 link | `lib/audio.js` |
| Issue-first, small explained commits, branch → check → self-merge (`--no-ff`) | 4 laptops × many agents stay in sync; readable history | AGENTS.md §4 |
| Pull-rebase + review at the start of every prompt | nobody works on stale code | AGENTS.md §5 |
| LLM picks answers + evidence, deterministic code computes the score | reproducible totals, exact checklist rules, cheap re-score after appeals | AGENTS.md §6, DECISIONS |
| Checklist as JSON data | live "replace one criterion" test with zero code change | `data/checklists/` |
| Design tokens reverse-engineered from fbroker.kz (site is Nuxt + Tailwind, so its utility names map 1:1) | consistent Freedom look, Tailwind-ready | `docs/research/design-system.md` |
| Clickable no-build prototype first, then the TS app copies its patterns | fast UX validation; demo exists even if the build breaks | `prototype/` |
| Gold set + accuracy harness: hand-checked labels per criterion, every evaluator run scored against them (strict / lenient agreement, N/A, gross-error recall, evidence hit rate, total MAE) | measured accuracy instead of claims; catches prompt regressions; mock baseline proves the harness before the LLM exists | `eval/gold/README.md`, `eval/accuracy.ts` |
| Official results export: `eval/export-results.mjs` → `results/<dev|prod>/results.json` (JSON 1.0), `eval/validate-results.mjs` (every appendix rule, independent final_score recompute), `eval/control-run.mjs` (fetch → evaluate → retry → export → validate → push) | the graded deliverable; control set must be pushed within 1 hour at T+23h; validator stops a malformed file before it reaches Git | `docs/case/results-format.md`, #22 |
| Client navigation agent = **typed app actions first, DOM scan as fallback**: the page declares screens + named targets (`broker/app.js SCREENS`), the model returns actions, the server keeps only actions on declared targets, protected targets (money, orders, requests) can only be highlighted. Concept inspired by the team's own BariWeb project; code written from scratch for this repo | reliable on our app, still works on elements nobody declared, never moves money | `lib/nav-agent.js`, `broker/agent.js`, CONTRACTS §5 |
| Eval scripts run as plain `.ts` on Node ≥ 23.6 (native type stripping), no build or dependencies | zero setup on every laptop | `node eval/accuracy.ts …` |
| Blind double labeling (out-of-sample check): two independent labelers read only the checklist PDF text + organizer rulings (no playbook, no model output) and label 24 non-gold DEV chats; their consensus (96.4% agreement) checks the evaluator outside the gold set it was tuned on | our 19-dialog gold was written by us, so tuning on it can fit our own reading instead of the experts'; consensus misses show rule problems, labeler splits show genuinely ambiguous cases | `eval/blind/blind-24.json`, `python3 -I eval/blind/compare.py eval/blind/blind-24.json v5=<run>.evaluations.json` |
| Independent gold audit, runtime shape/reference validation and separate unrounded arithmetic | Review all 19 DEV gold dialogs without changing application code; Node v24.18.0, PowerShell and Git Bash, no new dependencies or paid calls | `node eval/audit-gold.mjs`; `eval/GOLD_AUDIT_REPORT.md`; `eval/runs/gold-audit-*`. Exit 1: gold errors; exit 2: existing scoring mismatch; exit 0: both pass. GitHub API read via web failed; gh/Python unavailable locally. |

Phone-app research (2026-11-07, #20): macOS iPhone Mirroring + `screencapture -l <windowId> -o -x` (2x Retina) in a 1.5 s loop that keeps changed frames only (md5), while the account owner taps through the app. Colors and edges read with small CoreGraphics Swift scripts (dominant color + far-from-background "ink" per region, run-length edges along a line). Raw frames stay out of git (real client data). Method and results: `docs/research/freedom-app.md`.

## 7. Research sources and external docs
N/A/cache compatibility (2026-11-07): existing Node built-ins and Python regression runner only. Versioned findings separate schema, evidence, transcription, applicability and publication; replay reads all existing cache files without rewriting or model calls. No new dependencies. Reproduce the compatibility tests and `eval/fairness/run-compatibility.py`.

Transcript validation hardening (2026-11-07): existing Python unittest and Node node:test/crypto/fs only; provenance-bound transcript probes, strict saved-result validation and offline cache replay. No dependencies or paid inference. Reproduce `python -m unittest discover -s eval/fairness -p test_guard.py` and `node --test eval/fairness/*.test.mjs`; all-65 audit `node eval/fairness/audit-validation.mjs`.

Transcript fairness audit (2026-11-07): Python 3.14 standard library (`unittest`, `difflib`, `unicodedata`, `datetime`) runs `eval/transcript_guard.py` and offline regression fixtures. Node built-ins replay saved evaluator results through the existing accuracy harness. PowerShell read-only REST checks admin export availability and GitHub issue ownership. No packages installed, no paid inference. Reproduce with `python eval/fairness/run.py` and `node eval/fairness/replay.mjs`.

| Source | What we took from it | Saved where |
|---|---|---|
| Official CQA student guide (PDF) | task, timeline, data format, defense script | `docs/case/brief.md` |
| Official chat quality checklist (PDF) | 8 criteria, weights, scoring rules | `docs/case/checklist.md`, `data/checklists/freedom-chat-v1.json` |
| Freedom Holding deck (PDF) | company facts for the pitch | `docs/case/freedom-company.md` |
| Live Freedom Broker iOS app v32.23.17 (via iPhone Mirroring) | screens, nav, palette, type, components for the phone demo | `docs/research/freedom-app.md` (no raw screenshots: personal data) |
| In-person briefing | business pain, bot→human handoff, trust | `docs/case/briefing-notes.md` |
| Refero style "Origin Financial" (https://styles.refero.design/style/c60f05ff-2420-4a24-92db-80c4b6a74683) | midnight-gallery direction: near-black canvas, whisper serif display, mono labels, white primary | `shared/theme.css` |
| Tair's Pinterest mood board (sky, meadow, bird, horse, sea) | mood only; NOT used as assets (third-party, IP rule); re-created as original generated images | `landing-tair/assets/` |
| Opening ceremony livestream screenshots (Freedom + organizer slides) | 4-step speech analytics model, "trust starts with explanation", reference QA workspace UI, 5–10 min defense, IP rule | `docs/case/opening-ceremony.md` |
| OpenRouter docs: speech-to-text (https://openrouter.ai/docs/guides/overview/multimodal/stt) | `/api/v1/audio/transcriptions` takes base64 `input_audio` | `lib/openrouter.js` |
| Dameli's model research | candidate models, metrics, test plan | `docs/research/models-and-metrics.md` (branch d/product-quality-demo) |
| Web research 2026-11-07 (papers, regulators, vendor docs: Zheng 2023 LLM-as-judge, KazMMLU, CFPB chatbot spotlight, Gartner 2024 survey, Freedom FY2026 release, OpenAI/OpenRouter model pages) | judging reliability, Kazakh support, trust + handoff, costs | `docs/research/` (index: `docs/research/README.md`) |
| Organizer Q&A from Telegram (collected by Nazar) | how we're judged, results files, checklist rulings, demo asks | `docs/case/telegram-qa.md`, `docs/research/organizer-rulings.md` |
| https://fbroker.kz (HTML + `/_nuxt/*.css`, 2026-11-07) | colors, type, radii, shadows, motion, breakpoints, component patterns | `docs/research/design-system.md` |
| Organizers' dataset API (signed URL in `.env`) | DEV dataset | `data/datasets/DEV.json`, `data/README.md` |
