# STATUS: live handoff log

Append a new entry at the **top** at the end of each session (format in AGENTS.md §5). Don't edit other people's entries.

## Requests / Plans (fallback when GitHub Issues aren't available)
- **tair/claude (no `gh` on this laptop yet):** plan for branch `d/design-system-and-team-rules` was: rules (issue-first, every-prompt pull-rebase, commits, branching, self-merge), TOOLING registry, enforcement (hook, check.sh, CI, templates), design system from fbroker.kz, clickable prototype. Done and merged, see the log entry below. **Someone with `gh`: please run `scripts/setup-labels.sh` and open issues for the lane tasks in "Next".**

## Log

### 2026-11-07 · lane-c · claude · #3 · branch c/3-gold-reviewed
Done: all 19 gold files human-reviewed (every drafted label accepted) → `status: reviewed`. Mock baseline re-run on reviewed gold (includes the c01 intro fix from d227ded): **61.8% strict / 75.0% lenient**, c01 100%, gross-error recall **0/7**, total MAE 22.74 (`eval/runs/mock-baseline.metrics.json`).
Next: first real number. Run the LLM evaluator on the 19 gold dialogs (cached, ~19 calls) into `eval/runs/<model>.json`, then `node eval/accuracy.ts eval/runs/<model>.json --reviewed-only --verbose`; quote the result in README/pitch.
Contracts touched: none.
How to verify: `node eval/accuracy.ts eval/runs/mock-baseline.json --reviewed-only`

### 2026-11-07 15:00 · lane-a/b/c · tair/claude · merged da2a721
**Live: https://freedom-cqa.vercel.app** (production = `main`; every pushed branch gets its own preview URL in Vercel). Project `freedom-cqa`, team tairqaldy-projects.
Done:
- Real AI path: `lib/` (OpenRouter client + 3-tier cache + evaluator with transcript-validated evidence), `api/` (evaluate, transcribe via Nemotron 3.5, audio proxy, dataset, health), `npm run dev` mirrors Vercel locally
- Organizer `audio_url` is an HTML page with a 1h mp3 link → `/api/audio?id=` resolves it (works in prod)
- Prototype rebuilt to Freedom's QA-workspace slide (speaker tracks + deduction markers + audio, understanding strip, deduction reasons, dispute)
- `scripts/eval-run.mjs` also writes `*.evaluations.json` for **Akanov's** `eval/accuracy.ts`; mock intro fix: c01 68%→100%, overall 57.9%→61.8% on draft gold
- Tools: Node 22, gh, uv, graphify (user skill), unslop (local skill only, IP rule) → docs/TOOLING.md
**Needs a human (keys can't be entered by agents):**
1. tair: put `OPENROUTER_API_KEY` in `.env` AND in Vercel → freedom-cqa → Settings → Environment Variables (also `CQA_API_URL`), then redeploy
2. tair: `gh auth login` so this laptop's agents can open issues
Next (open as issues):
- [lane-c] Akanov: once the key is set, `npm run eval -- --group DEV` then `node eval/accuracy.ts <printed file>`; mock gross-error recall is **0/7**, so check the LLM closes it; compare haiku-5.5 vs nemotron-3.5-lightning vs qwen3.7-flash (Dameli's plan); commit `eval/cache/` + `data/evaluations/DEV.json`
- [lane-c] `npm run asr` → WER/CER + latency for the 5 calls (Nemotron), add to README
- [lane-d] Dameli: rebase `d/product-quality-demo` on main (conflict only in STATUS.md, keep both entries); update demo script to the new card layout; run unslop on README/pitch
- [lane-b] control set at T+23h: `npm run eval -- --group <ID>` (needs CQA_API_URL)
Contracts touched: none (API returns CONTRACTS §3 fields + deduction_reason + summary, additive).
How to verify: open the live URL → any dialog → click a red marker / evidence chip; `npm test`; `scripts/check.sh`.

### 2026-11-07 · lane-c · claude · #3 · branch c/3-gold-set
Done:
- `eval/gold/`: 19 DEV dialogs labeled on all 8 criteria (9 RU incl. 1 voice call, 5 KZ, 5 EN) with evidence turn indices, `also_acceptable` for borderline cases, notes and tags. **All `draft`: a human must review them** (README "How to review").
- `eval/accuracy.ts`: scores any `Evaluation[]` run against gold: strict/lenient agreement per criterion and language, scale ±1, N/A precision/recall, gross-error recall/FP, evidence hit rate, invalid refs, total MAE. Validated with a perfect run (100% everywhere).
- `eval/run-mock.ts` + `eval/runs/mock-baseline.*`: baseline of the prototype mock evaluator: 57.9% strict / 71.1% lenient, **gross-error recall 0/7**, total MAE 21.55. The LLM evaluator has to beat this.
In progress: none.
Next: human review of the 19 gold files (any lane); LLM evaluator owner writes runs to `eval/runs/<name>.json` and runs `node eval/accuracy.ts`; switch the harness import to `app/src/scoring.ts` once `c/scoring-engine` merges.
Blocked by / Requests: mock evaluator misses names like «я Руслан» (c01) and off-company offers (c08); only matters for the prototype demo (lane-a/c).
Contracts touched: none (reads CONTRACTS §2–3).
How to verify: `node eval/run-mock.ts && node eval/accuracy.ts eval/runs/mock-baseline.json --verbose`

### 2026-11-07 · lane-d/a · tair/claude · branch d/design-system-and-team-rules
Done:
- AGENTS.md: pull-rebase + review on every prompt, issue-first, commit format (no AI attribution, hook-enforced), branch strategy + self-merge checklist, TOOLING rule, design-system rule
- docs/TOOLING.md registry; `.githooks/commit-msg`, `scripts/check.sh`, `scripts/setup-labels.sh`, issue/PR templates, CI workflow
- `docs/research/design-system.md` (fbroker.kz reverse-engineered), `design/` tokens + components + motion + Tailwind v3 preset + v4 theme
- `prototype/`: full defense flow clickable on DEV data, real scoring engine (7 self-tests pass), MOCK evaluator
Next (open as issues):
- [lane-c] port `prototype/scoring.js` → `app/src/scoring.ts` + tests; build real LLM evaluator returning CONTRACTS §3; log model + cost in TOOLING
- [lane-a] scaffold `app/` (TS + Tailwind with `design/tailwind.preset.js`), port prototype views
- [lane-b] proxy + storage endpoints (CONTRACTS §5); control-set fetch script for T+23h
- [lane-d] README run steps, pitch outline; decide on graphify (TOOLING §3); connect Paper MCP if wanted
Blocked by / Requests: `gh` not installed on tair's Mac, so issues couldn't be created from here.
Contracts touched: none.
How to verify: `python3 -m http.server 8080` → http://localhost:8080/prototype/ ; `scripts/check.sh`

### 2026-11-07 13:05 · lane-b · tair/claude
Done: fetched DEV dataset → `data/datasets/DEV.json` (65 records, matches brief). API URL moved to `.env` (gitignored, template in `.env.example`); how to re-fetch / fetch control set in `data/README.md`.
Next: Lane B builds the proxy/cache endpoint on top of this; Lane C can start prompts against the local file now.
Contracts touched: none (raw shape = CONTRACTS §1).
How to verify: `python3 -c "import json;print(len(json.load(open('data/datasets/DEV.json'))['data']['records']))"` → 65

### 2026-11-07 · lane-d · tair/claude
Done: AGENTS.md (team + agent rules), CLAUDE.md pointer, case docs extracted to `docs/case/`, draft contracts, checklist seed JSON.
In progress: nothing.
Next: fill lane owners in AGENTS.md §3; record official start time (T) below; open initial P0 issues per lane.
Blocked by / Requests: judging criteria not published yet.
Contracts touched: created `docs/CONTRACTS.md` v0 (draft, open for review by B and C).
How to verify: read AGENTS.md.

---
**Official start time T = _fill in_** → control data at T+23h = _fill in_ · STOP CODE at T+24h = _fill in_
