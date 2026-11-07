# STATUS: live handoff log

Append a new entry at the **top** at the end of each session (format in AGENTS.md §5). Don't edit other people's entries.

## Requests / Plans (fallback when GitHub Issues aren't available)
- **tair/claude (no `gh` on this laptop yet):** plan for branch `d/design-system-and-team-rules` was: rules (issue-first, every-prompt pull-rebase, commits, branching, self-merge), TOOLING registry, enforcement (hook, check.sh, CI, templates), design system from fbroker.kz, clickable prototype. Done and merged, see the log entry below. **Someone with `gh`: please run `scripts/setup-labels.sh` and open issues for the lane tasks in "Next".**

## Log

### 2026-11-07 15:10 · lane-c/b/d · tair/claude · branch c/full-dev-eval-hub
Done:
- Verified Akanov's OpenAI + OpenRouter router (#7) end to end with real keys (both valid; OpenRouter $14.97 left of $15). No duplicate implementation.
- **GPT-6 Luna on all 65 DEV dialogs**: 0 errors, $0.048 total, $0.00105/eval, p50 13.3 s. `data/evaluations/DEV.json` now 65/65, so the live app shows real AI for every dialog. Gold accuracy unchanged: 86.2 % strict, gross 6/7, 0 FP, evidence 95.5 %
- **Nemotron ASR** on the 5 calls: WER 35.5 % / CER 24.4 % vs organizer transcripts, $0.04. Raw transcripts contain unmasked first names → gitignored (LESSONS), metrics only committed
- **Preview hub at `/`** (`index.html`): build/branch/commit, AI status, live accuracy metrics, every surface (landing slot, dashboard, chat/call analysis, reviewer, admin/checklist, design system, API) and phone / tablet(D365) / laptop frames
- **CONTRACTS §5** rewritten to the real API + `AIResult` shape for the UI lane
**Dameli (UI/UX):** build on `CONTRACTS §5`: the card needs `answers[*].deduction_reason`, `evidence`, `summary`; compute points with `prototype/scoring.js`. Your `a/8-card-evaluation-ux` is 5 ahead / 7 behind main: merge `main` into it (prototype files didn't change since, so there should be no conflicts) and check it on its Vercel preview URL. Landing goes in `landing/index.html`; the hub tile turns on automatically.
**Needs tair (agents can't enter keys):** Vercel → freedom-cqa → Settings → Environment Variables: add `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CQA_API_URL` (all environments), then Redeploy. Until then live "Оценить AI" calls fail; precomputed results still show.
Contracts touched: CONTRACTS §5 documented (matches existing code, no shape change).
How to verify: https://freedom-cqa.vercel.app → metrics + device frames; `node eval/accuracy.ts eval/runs/2026-11-07T09-57-56-694Z-DEV-openai_gpt-6-luna.evaluations.json`.

### 2026-11-07 · lane-c · claude · #7 · branch c/7-openai-direct
Done: evaluation now runs on **OpenAI `gpt-6-luna` through the direct OpenAI API** (team decision). `lib/openai.js` (no-deps client, strict JSON schema, cost from token usage) + `lib/llm.js` router (`openai:<id>` → OpenAI, else OpenRouter); `lib/evaluator.js` imports from the router; default `MODELS.eval = openai:gpt-6-luna`. If `OPENAI_API_KEY` is missing, the same model runs via OpenRouter `openai/gpt-6-luna`, so deploys keep working. ASR unchanged (OpenRouter Nemotron).
| 19 reviewed gold dialogs | Haiku 5.5 | **GPT-6 Luna** |
|---|---|---|
| strict / lenient | 75.7% / 92.1% | **86.2% / 94.7%** |
| RU · EN · KZ lenient | 93.1 · 92.5 · 90.0 | 98.6 · 95.0 · **87.5** |
| N/A recall | 64.3% | 78.6% |
| gross-error recall | 6/7 | 6/7 (both miss p1-kz-015) |
| total MAE | 14.06 | **7.83** |
| cost / eval | $0.00177 | **$0.00112** |
Remaining weak spots (prompt v2): c06 rated 10 on the disclosure dialogs where the client had to re-ask; KZ c04 on p1-kz-013/015; the KZ confidential-disclosure gross error in p1-kz-015.
Requests: **tair (Vercel access): add `OPENAI_API_KEY` to Vercel → freedom-cqa → Environment Variables** (until then prod uses the OpenRouter fallback, same model). Lane D: README model line = "OpenAI GPT-6 Luna, ≈$0.0011 per evaluation".
Contracts touched: none. Shared files: AGENTS.md §0/§2/§8.1 (AI-call rule now names `lib/llm.js`), one additive line in `api/health.js` (lane-b).
How to verify: `node eval/accuracy.ts eval/runs/2026-11-07T09-48-01-230Z-DEV-openai_gpt-6-luna.evaluations.json --reviewed-only` · `curl <preview>/api/health` shows `openai`

### 2026-11-07 · lane-d · product/pitch · #4 · branch d/navigation-references
Done: saved Gradient ASCII reference and pinned source locally, plus a proposed Freedom neon-green direction using existing tokens.
In progress: none; no implementation or landing page built.
Next: consult the reference if the team chooses to use it; check reduced motion, WebGL fallback and contrast.
Blocked by / Requests: automated repository checks not run due to network-restricted local checkout.
Contracts touched: none.
How to verify: read docs/research/navigation-references.md and inspect upstream links.

### 2026-11-07 · lane-d · product/pitch · #4 · branch d/navigation-references
Done: saved Gooey Nav and Card Nav links and pinned upstream sources in docs/research/navigation-references.md. Retrieved source and license locally; no landing implementation or dependencies added.
In progress: none.
Next: team can consult the references if needed.
Blocked by / Requests: local GitHub access is network-restricted; automated repo checks have not been run.
Contracts touched: none.
How to verify: open the pinned source links and upstream license in the reference document.

### 2026-11-07 · lane-c · claude · #6 · branch c/6-llm-accuracy
Done: first real accuracy run. `anthropic/claude-haiku-5.5`, prompt `eval-v1`, 19 reviewed gold dialogs, 19 calls, **$0.034 total = $0.00177 per evaluation**, p50 13.4 s / p95 18.0 s, 0 errors. Cache committed (`eval/cache/`) so re-runs are free.
| Metric | Mock | Haiku 5.5 |
|---|---|---|
| strict / lenient agreement | 61.8% / 75.0% | **75.7% / 92.1%** |
| gross-error recall | 0/7 | **6/7**, 0 false positives |
| evidence hit rate · invalid refs | 73.3% · 0 | **95.5%** · 0/182 |
| total MAE | 22.74 | 14.06 |
Weak spots, for prompt v2: (1) c04 under-scored: 15 instead of 20 in 5 dialogs where the request was fully closed; (2) avoids N/A: c02 "no" on clear requests (6×), c07 "no" after a lost connection (3×), c03 "no" on p1-ru-018; (3) missed the KZ confidential-disclosure gross error in p1-kz-015. These drive most of the total MAE.
Next: prompt v2 targeting the three points (bump `PROMPT_VERSION`), re-run the same 19 and compare; then batch all 65 DEV. Lane D: README cost line can use the measured $0.00177/eval.
Contracts touched: none.
How to verify: `node eval/accuracy.ts eval/runs/2026-11-07T09-36-59-522Z-DEV-anthropic_claude-haiku-5.5.evaluations.json --reviewed-only --verbose`

### 2026-11-07 13:15 · lane-d · product/pitch
Done: researched text, transcription and voice model candidates, 500 ms latency and evaluation metrics in docs/research/models-and-metrics.md.
In progress: model comparison is research only; no benchmarks run.
Next: compare available models on human-labeled examples; prioritize required product flows.
Blocked by / Requests: confirm official start time and judging criteria.
Contracts touched: none.
How to verify: review the source links and proposed test plan in the research document.

### 2026-11-07 13:10 · lane-d · product/pitch
Done: drafted a product acceptance checklist and five-minute demo script from the official brief (issue #1).
In progress: features and demo are not yet verified.
Next: test working increments, choose representative conversations and rehearse; update when judging criteria arrive.
Blocked by / Requests: official start time and judging criteria still need confirmation.
Contracts touched: none.
How to verify: read docs/product-acceptance.md and pitch/demo-script.md against docs/case/brief.md.

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
