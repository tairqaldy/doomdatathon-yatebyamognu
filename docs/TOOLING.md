# TOOLING: everything we use, and how

**Rule (AGENTS.md §4.2):** log every tool, CLI, library, MCP server, skill, sub-agent, AI model, prompt strategy, development approach, research source and external doc **before or in the same commit** as you start relying on it. A teammate's agent on another laptop must be able to reproduce your setup from this file alone.

Status: `active` (in use) · `trial` (being evaluated) · `candidate` (proposed, not installed) · `dropped` (with reason).

## 1. Dev environment and CLIs
| Name | What for | Lane / who | Install / use | Cost / limits | Status |
|---|---|---|---|---|---|
| git + Xcode Command Line Tools (macOS) | Version control | all | `xcode-select --install` | free | active |
| GitHub CLI `gh` | Issues, PRs, labels from the terminal; required for the issue-first rule | all | `brew install gh` / `winget install GitHub.cli`, then `gh auth login` | free | active (not yet installed on tair's Mac) |
| Node.js LTS + npm | TS + Tailwind build for `app/` | A, C | nodejs.org LTS installer | free | candidate (decide version in DECISIONS) |
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
| graphify (`/graphify`) | builds a knowledge graph of the repo so agents read a summary instead of re-reading files (fewer tokens) | all | Reported install: `uv tool install graphifyy` then `graphify install`. **Before installing:** confirm the canonical repo (safishamsi/graphify vs Graphify-Labs/graphify, many forks) and package name. Its Claude install **edits CLAUDE.md and adds a PreToolUse hook**, so check it doesn't overwrite our `CLAUDE.md` → `AGENTS.md` pointer. Graph is a snapshot, so re-run after big merges. Add `graphify-out/` to `.gitignore` or commit it deliberately (decide in DECISIONS). | candidate (needs a go from the team) |

## 4. AI models (evaluation, ASR, TTS)
Log: model id, provider, why, temperature, prompt version, **cost per evaluation (all calls)**, latency p50/p95. README must state model + cost per evaluation (organizer requirement).
| Model | Used for | Lane | Cost / eval | Latency | Status |
|---|---|---|---|---|---|
| _TBD by Lane C_ | criterion answers + evidence (RU/KZ/EN) | C | | | |
| Whisper / ElevenLabs / Speechmatics-class ASR | optional voice: diction/intonation, WER/CER vs given transcripts | C | | target ≤500 ms if live | candidate |

## 5. Libraries and frameworks
| Name | Version | What for | Lane | Status |
|---|---|---|---|---|
| TypeScript | _pin_ | app source | A, C | candidate |
| Tailwind CSS | _pin_ (v3 → `design/tailwind.preset.js`, v4 → `design/theme.css`) | styling via our tokens | A | candidate |
| Inter (Google Fonts) | variable | fallback font for CoFo Sans (Freedom's licensed font), full Cyrillic + Kazakh | A, D | active in prototype |

## 6. Approaches and development strategies
| Approach | Why | Where documented |
|---|---|---|
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
| https://fbroker.kz (HTML + `/_nuxt/*.css`, 2026-11-07) | colors, type, radii, shadows, motion, breakpoints, component patterns | `docs/research/design-system.md` |
| Organizers' dataset API (signed URL in `.env`) | DEV dataset | `data/datasets/DEV.json`, `data/README.md` |
