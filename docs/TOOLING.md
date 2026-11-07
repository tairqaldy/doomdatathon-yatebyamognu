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
| GitHub Actions `check.yml` | runs `scripts/check.sh` on every push/PR | all | `.github/workflows/check.yml` | free (public repo) | active |

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

## 4. AI models (evaluation, ASR, TTS)
Log: model id, provider, why, temperature, prompt version, **cost per evaluation (all calls)**, latency p50/p95. README must state model + cost per evaluation (organizer requirement).
| Model | Used for | Lane | Cost / eval | Latency | Status |
|---|---|---|---|---|---|
| `anthropic/claude-haiku-5.5` via OpenRouter (default, `CQA_EVAL_MODEL`) | criterion answers + explanation + deduction reason + evidence, strict JSON schema, temp 0, prompt `eval-v1` | C | ≈$0.001 est. ($0.10/$0.50 per M tok); measured in `eval/runs/` | measure | active (compare vs `nvidia/nemotron-3.5-lightning`, `qwen/qwen3.7-flash` per Dameli's plan) |
| `nvidia/nemotron-3.5-transcribe` via OpenRouter (`CQA_ASR_MODEL`) | transcribe the 5 call recordings; WER/CER vs organizer transcripts (`npm run asr`) | C | ≈$0.06/audio hour ($0.0000167/s, PrimeIntellect) | measure | active |
| Whisper / ElevenLabs | optional live voice / TTS (500 ms target) | C | | target ≤500 ms if live | candidate |

## 5. Libraries and frameworks
| Name | Version | What for | Lane | Status |
|---|---|---|---|---|
| TypeScript | _pin_ | app source | A, C | candidate |
| Tailwind CSS | _pin_ (v3 → `design/tailwind.preset.js`, v4 → `design/theme.css`) | styling via our tokens | A | candidate |
| Inter (Google Fonts) | variable | fallback font for CoFo Sans (Freedom's licensed font), full Cyrillic + Kazakh | A, D | active in prototype |

## 6. Approaches and development strategies
| Approach | Why | Where documented |
|---|---|---|
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
| Eval scripts run as plain `.ts` on Node ≥ 23.6 (native type stripping), no build or dependencies | zero setup on every laptop | `node eval/accuracy.ts …` |

## 7. Research sources and external docs
| Source | What we took from it | Saved where |
|---|---|---|
| Official CQA student guide (PDF) | task, timeline, data format, defense script | `docs/case/brief.md` |
| Official chat quality checklist (PDF) | 8 criteria, weights, scoring rules | `docs/case/checklist.md`, `data/checklists/freedom-chat-v1.json` |
| Freedom Holding deck (PDF) | company facts for the pitch | `docs/case/freedom-company.md` |
| In-person briefing | business pain, bot→human handoff, trust | `docs/case/briefing-notes.md` |
| Opening ceremony livestream screenshots (Freedom + organizer slides) | 4-step speech analytics model, "trust starts with explanation", reference QA workspace UI, 5–10 min defense, IP rule | `docs/case/opening-ceremony.md` |
| OpenRouter docs: speech-to-text (https://openrouter.ai/docs/guides/overview/multimodal/stt) | `/api/v1/audio/transcriptions` takes base64 `input_audio` | `lib/openrouter.js` |
| Dameli's model research | candidate models, metrics, test plan | `docs/research/models-and-metrics.md` (branch d/product-quality-demo) |
| https://fbroker.kz (HTML + `/_nuxt/*.css`, 2026-11-07) | colors, type, radii, shadows, motion, breakpoints, component patterns | `docs/research/design-system.md` |
| Organizers' dataset API (signed URL in `.env`) | DEV dataset | `data/datasets/DEV.json`, `data/README.md` |
