# STATUS: live handoff log

Append a new entry at the **top** at the end of each session (format in AGENTS.md §5). Don't edit other people's entries.

## Requests / Plans (fallback when GitHub Issues aren't available)
- **2026-11-07 · lane-c · N/A/cache compatibility · branch `audit/na-cache-compatibility`:** User requests replacing over-strict source-anchor gating with separate schema/evidence/transcription/publication checks, explicit valid/unsupported/invalid N/A, versioned legacy cache risk and all-65 replay. `gh` unavailable; local plan. Touch `eval/fairness/validation.mjs`, `evaluator-candidate.mjs`, regression tests/new compatibility runner and `eval/runs/transcript-compat-*`, handoff docs. Preserve strict historical outputs, dataset/gold/cache and production/UI. No paid inference, deploy, commit/push/PR/merge. Audio decisions and independent human labels remain pending rather than invented.
- **2026-11-07 · lane-c · validation hardening · branch `audit/transcript-validation`:** User requested P0 false-introduction fixes, fail-closed missing-probe/schema/evidence validation, cache revalidation and expanded regression coverage. `gh` unavailable; local plan, no publishing authorized. Touch only `eval/transcript_guard.py`, `eval/fairness/*`, new `eval/runs/transcript-validation-*`, and handoff docs. Preserve historical reports, original dataset, gold, production evaluator/UI/scoring. Run adversarial tests and all-65 saved-result audit without inference; provide an unfilled audio review queue, not invented human labels. Inspect newer main voice-checklist work before recommending integration. No paid calls, commit, push, PR or merge.
- **2026-11-07 · lane-c · transcript fairness · branch `audit/transcript-fairness`:** Diagnose ASR-related unfair deductions using local DEV/evaluation exports and read-only admin sessions. `gh` unavailable; local plan only, no commit/push/PR/merge authorized. Touch `eval/transcript_guard.py`, new `eval/fairness/`, `eval/runs/transcript-*`, `docs/TRANSCRIPT_FAIRNESS.md` and append-only team logs. Preserve datasets, gold, UI and running evaluator; provide a tested prompt/integration candidate separately. Run baseline, two offline guard iterations and a held-out synthetic check; distinguish guard tests from fresh LLM accuracy. No paid calls. Open #18 overlaps product/evaluator regeneration; do not edit its production files.
- **2026-11-07 · lane-b · postgres store · branch `b/postgres-store` (no `gh` on this laptop):** Goal: connect optional Postgres so `/support` and `/admin` share live sessions across devices. Plan: zero-dep `lib/postgres.js` (Neon HTTP + TCP), `cqa_kv` JSON table, `GET/PUT/DELETE /api/sessions`, live-store hydrate/poll with localStorage fallback. Files: `lib/postgres.js`, `lib/kv.js`, `api/sessions.js`, `shared/live-store.js`, `.env.example`, CONTRACTS/DECISIONS/TOOLING/AGENTS. Contracts: additive `/api/sessions` + `health.postgres`. Verify: `node scripts/pg-ping.mjs`, `/api/sessions` without URL returns `{postgres:false}`, `/api/health` shows the flag. Needs a human: paste Neon/Vercel `DATABASE_URL` into `.env` and Vercel env.
- **tair/claude (no `gh` on this laptop yet):** plan for branch `d/design-system-and-team-rules` was: rules (issue-first, every-prompt pull-rebase, commits, branching, self-merge), TOOLING registry, enforcement (hook, check.sh, CI, templates), design system from fbroker.kz, clickable prototype. Done and merged, see the log entry below. **Someone with `gh`: please run `scripts/setup-labels.sh` and open issues for the lane tasks in "Next".**

## Log

### 2026-11-07 · lane-c · N/A/cache compatibility · branch audit/na-cache-compatibility
Done: policy transcript-validation-v3 separates schema/verdict/evidence/transcription/provenance/publication. Documented NA no longer requires a direct quote; unsupported NA needs review, prohibited NA stays invalid, bound applicability contradiction requests correction. Replayed all 65 saved results + 65 file-cache hits: 55 valid / 5 warning / 5 needs_review / 0 invalid, publishable 60/65 (v2 4/65). Same answers: no LLM accuracy claim. All 99 NA reasons passed documentation policy, not independent semantic verification.
Tests: Node 80/80, Python pass, guard 18/18 + 19/19 + 10/10, scoring 7/7; runner all exits 0; protected source/gold/cache/strict-report SHA-256 unchanged.
Next: review p1-ru-010 c08 evidence and p1-en-010 full-credit c06 attribution; audio p4-ru-002:2 / p4-ru-005:16 / p4-ru-004:14; approve legacy exceptions, controlled paid comparison and independent human test before integration. Prepared 19-pair A/B manifest only; settings/budget unset, no inference.
Blocked by / Requests: no human audio decisions, unseen labeled set or paid authorization. Candidate remains offline; UI unchanged. Report docs/NA_CACHE_COMPATIBILITY.md, outputs eval/runs/transcript-compat-*.
Contracts touched: none (offline sidecar). No production/data/gold changes, commit/push/PR/merge/deploy.
How to verify: python eval/fairness/run-compatibility.py.

### 2026-11-07 · lane-c · validation hardening · branch audit/transcript-validation
Done: guard adversarial 7/18 → 18/18; previous 19/19 + 10/10 preserved. Added provenance-bound probe requirement, metadata/answer/evidence/role validation, no scoring of invalid results, fail-closed cache revalidation and criterion-level preview. Node 45/45; Python 8 tests including 18 subtests; existing scoring 7/7. All 65 DEV results + 65 actual cache files replayed offline. New strict source-anchor policy permits 4/65; 61 pending, mainly condition-only N/A evidence (58 dialogs). This is a policy-compatibility gap, not 61 proven wrong verdicts.
In progress: offline candidate only; production does not import it. Report docs/TRANSCRIPT_VALIDATION.md supersedes readiness claims from the earlier limited sidecar.
Next: owner approval for N/A checked ranges; real audio decisions for p4-ru-002:2 / p4-ru-005:16 / p4-ru-004:14; controlled model comparison and new human holdout before integration. Speech checklist already exists in team/v2-bright-product@4438bbb; did not duplicate it.
Blocked by / Requests: no paid inference authorized, no independent human/audio labels. c08 evidence defect in p1-ru-010 is retained and flagged, not silently fixed.
Contracts touched: none (offline formatting DTO only). No production/data/gold edits; no commit/push/PR/merge.
How to verify: python eval/fairness/run-validation.py; outputs eval/runs/transcript-validation-*.

### 2026-11-07 · lane-c · transcript fairness · branch audit/transcript-fairness
Done: repaired the supplied guard, ran 2 offline iterations (9/19 → 17/19 → 19/19), separate synthetic check 10/10, self-test 16/16, Python tests 7/7, candidate tests 7/7. Replayed existing v1–v4 results without inference; current v4 strict 91.45%, lenient 96.71%, c08 7/7, MAE 6.06 on 19 reviewed gold dialogs. Read-only admin sessions returned postgres:false and no server sessions. Private copies of 65 DEV dialogs and results are gitignored. Report: docs/TRANSCRIPT_FAIRNESS.md.
In progress: production integration remains with #18 owner; candidate is not imported by the app.
Next: audio review p4-ru-002:2, p4-ru-005:16, p4-ru-004:14; voice-checklist N/A agreement; cache revalidation and pending-score display. New human blind test and paid model iterations still required.
Blocked by / Requests: no fresh paid calls authorized; browser-local admin sessions unavailable. Inspected newer main@3197760 in memory: rounding fixed, 11 checks + 19 gold totals passed; did not duplicate production edits.
Contracts touched: none; optional sidecar candidate only. No commit/push/PR/merge.
How to verify: python -m unittest discover -s eval/fairness -p test_guard.py; node --test eval/fairness/candidate.test.mjs; node eval/fairness/replay.mjs; node eval/fairness/verify-upstream.mjs.

### 2026-11-07 19:00 · lane-c · claude · #15 · branch c/15-nav-consent
Done: the `/broker` navigation agent now **explains first and acts only with consent** (user request). AIM answers with a short intro, numbered steps (new `steps[]` field) and «Хотите, я открою нужный экран и заполню поля за вас?» with **Да, помогите / Нет, я сам(а)** buttons (RU/KZ/EN, in the language AIM answered in). Proposed actions wait in `st.pending` (survive reload) and run only after yes, by button or typed «да / давай / иә / yes»; then `done_reply` is shown. «Нет» leaves the page untouched. Any other message drops the offer and goes to AIM. Handoff turns return no actions and hand off immediately. Prompt `nav-v5`; `maxTokens` 700 → 1500 (longer replies were truncating the JSON); checkbox actions read «Снял галочку …» instead of `off`.
Verified locally (browser pane, port 3017): deposit 50 000 ₸ → steps + question, page unchanged → typed «давай» → filled method/currency/amount; bonds → «Нет» → page unchanged; bonds → yes → filled, Buy only pointed to, no order; KZ broker-report question → KZ steps + KZ buttons; withdrawal-blocked → immediate handoff, no navigation.
Contracts touched: CONTRACTS §5 `/api/agent` additive (`steps`, `needs_consent`, `done_reply`).
How to verify: https://freedom-cqa.vercel.app/broker/ → «Спросить AIM» → «Хочу пополнить счёт на 50 000 ₸ переводом из банка» → nothing moves until you press «Да, помогите».

### 2026-11-07 18:40 · lane-c · claude · #14 · branch c/14-broker-agent
Done: **client navigation agent on a mock Freedom Broker app**, our own BariWeb-style experience written from scratch.
- `/broker/`: demo client app (portfolio with trading vs D account, quotes with bond search + "Использовать маржу", deposit by card / Kaspi / bank details, withdraw, tariffs, documents incl. 1042-S, profile), RU/KZ/EN, design tokens, phone layout. Each screen declares agent targets; money / order / request buttons are `protected`.
- `POST /api/agent` (`lib/nav-agent.js`, prompt `nav-v1`, `openai:gpt-6-luna`): reply + typed actions (`open_screen`, `highlight`, `prefill`) with a DOM-scan fallback (`click`, `input`). Server keeps only actions on declared targets; protected targets can only be highlighted; IIN / card numbers masked.
- Widget `broker/agent.js`: runs actions with visible highlights + an action log, minimises on phones while acting, **handoff** → `LiveSession` (`source: "broker-agent"`, real timestamps, RU brief) → `/admin/#/live` → operator replies show live → QA evaluation on close.
- **Voice**: push-to-talk → 16 kHz WAV in the browser → `POST /api/agent-voice` (Nemotron) → text; replies via browser `speechSynthesis`.
Verified in the browser pane: RU deposit request filled method/currency/amount and highlighted bank details; bonds + margin off + qty 10, Buy only highlighted; DOM fallback click; KZ withdrawal question → handoff → admin accept, reply, close → evaluation done; WAV + transcription; 375 px layout.
Known gaps: Kazakh push-to-talk was poor on a synthetic macOS voice (test with a real speaker); `eval/cache/nav/` is gitignored, so every agent turn is a fresh call (~4–8 s); the hub at `/` has no `/broker` tile yet (lane A/D, one link).
Contracts touched: CONTRACTS §5 additive (`/api/agent`, `/api/agent-voice`, `NavAction`, LiveSession `source` + message `actions`).
How to verify: `npm run dev` → http://localhost:3000/broker/ → "Спросить AIM" → «Хочу пополнить счёт на 50 000 ₸ переводом из банка»; then «почему заблокирован вывод?» and open http://localhost:3000/admin/#/live (local passcode `freedom`).

### 2026-11-07 18:20 · lane-c · claude · #13 · branch c/13-prompt-v2
Done: evaluator prompt **eval-v4** (default model `openai:gpt-6-luna`). Five general rules added to the SYSTEM prompt in `lib/evaluator.js` (by criterion meaning, not id, so a replaced criterion still works): N/A for need-identification on clear requests; N/A for closing when the system/client ended the chat; a hand-off counts as a correct next step when the client is told what happens next, gross violations don't lower the consultation, client left before asking → consultation N/A; re-asking caused by the operator → "client has to re-ask" step, bot→operator queue time ignored; account facts before verification = disclosure (gross error + identification "no"), but steps of the verification procedure itself are not.
| 19 reviewed gold dialogs | eval-v1 | v2 (rejected) | v3 (rejected) | **eval-v4** |
|---|---|---|---|---|
| strict / lenient | 86.2 / 94.7 | 89.5 / 96.7 | 92.8 / 96.7 | **91.4 / 96.7** |
| N/A recall | 78.6 | 89.3 | 92.9 | **96.4** |
| gross-error recall | 6/7 | 7/7 | 7/7 | **7/7**, 0 FP |
| total MAE | 7.83 | 6.97 | 5.98 | **6.06** |
v2 rejected: scored correct hand-offs as 5 and lost 2 dialogs on c07. v3 rejected after spot-checking non-gold dialogs: it raised gross-error flags on two real calls (p4-ru-003/004) where the operator was only running the verification procedure. v4 fixes that (both calls: no gross error, identification yes) and no criterion is below v1.
All 65 DEV re-run on v4: $0.050 for 44 fresh calls, **$0.00114/eval**, p50 14.9 s, 0 errors; `data/evaluations/DEV.json` = eval-v4. Outside the gold set 58/368 answers (15.8%) changed vs v1, mean total −0.93; main moves c02 yes→na (15), c07 yes→no (11) and no→yes (5); gross-error flags unchanged (only p1-ru-023).
Judgment call for a human: c07 now reads the checklist literally, so "Пожалуйста. Хорошего дня!" with no summary and no offer of help = "no" (≈11 non-gold chats lose 5 points). Revert that rule if the team reads it differently.
Known gap: c06 still 57.9% strict; the model gives 4 to clear replies in the off-company-offer dialogs (p1-en-013, p1-ru-022) and 10 in p1-kz-015.
Paid runs this branch: v2 $0.021, v3 $0.022 + $0.053, v4 $0.027 + $0.050 = **$0.17**. All answers cached in `eval/cache/`.
Contracts touched: none (schema unchanged).
How to verify: `node eval/accuracy.ts eval/runs/2026-11-07T13-13-37-546Z-DEV-openai_gpt-6-luna.evaluations.json --reviewed-only --verbose`

### 2026-11-07 17:30 · lane-b · postgres store · branch b/postgres-store
Done: optional Postgres client (`lib/postgres.js`, no npm driver): Neon SQL-over-HTTP on `*.neon.tech`, TCP/TLS + SCRAM/MD5 otherwise. Table `cqa_kv` holds live sessions. `GET/PUT/DELETE /api/sessions`; `shared/live-store.js` hydrates and polls when `postgres: true`, otherwise localStorage. `/api/health` has `postgres` boolean. `node scripts/pg-ping.mjs`.
In progress: waiting on a real `DATABASE_URL` (none on this laptop: no `.env`, no local Postgres, no Docker).
Next: paste Neon/Vercel Postgres URL into `.env` and Vercel → freedom-cqa → Environment Variables; `npm run pg:ping`; open `/support` and `/admin` on two devices.
Blocked by / Requests: **tair: `DATABASE_URL`**. Someone with `gh`: open issue `[lane-b] persist live sessions in Postgres`.
Contracts touched: CONTRACTS §5 additive `/api/sessions` + `health.postgres`.
How to verify: `node scripts/pg-ping.mjs` (exits 0 if unset); `GET /api/sessions` → `{postgres:false,sessions:[]}` without the URL.

### 2026-11-07 16:20 · team · tair/claude · #10 · merged 56d069f
**Live now:** https://freedom-cqa.vercel.app/landing-tair/ (landing) · /support/ (customer chat) · /admin/ (passcode: from the team when `ADMIN_PASSCODE` is set in Vercel, else `freedom`) · / (preview hub)
Done (full product loop from #10):
- `/landing-tair/`: surreal story landing, 8 ORIGINAL images (gpt-image-2.6, IP-safe), scroll-film transitions, demo-video placeholder (swap comment in HTML), CTA → /support/, no admin link
- `/support/`: AIM bot via `/api/chat` (grounded on real DEV operator answers, ~2 s), honest handoff card (operator sees chat, < 2 min, queue line after 90 s), live operator messages, CSAT, background QA via `/api/evaluate`
- `/admin/`: login → overview (KPIs, histogram, language/channel, points lost, heat-map, deduction reasons), live operator console, dialogs (DEV + live), AI analyst (`/api/insights`); "Рабочее место" links to /prototype
- APIs `/api/chat`, `/api/insights`, `/api/admin-login`; `shared/theme.css`, `shared/live-store.js`; CONTRACTS §5 updated
**Blocking the live demo (tair, 2 min):** Vercel → freedom-cqa → Settings → Environment Variables: `OPENAI_API_KEY`, `OPENROUTER_API_KEY`, `CQA_API_URL`, optionally `ADMIN_PASSCODE`; then Redeploy. Until then prod chat shows the "call a specialist" fallback and the analyst returns errors.
Next:
- Nazar (#10 list): stream `/api/chat` (time-to-first-token), handoff policy/brief, QA of bot turns, voice
- Dameli: `/prototype` is still light-theme; consider the gallery theme (`shared/theme.css`) so "Рабочее место" matches admin; merge `main` into `a/8-card-evaluation-ux`
- demo video for the landing placeholder (record the 5-min flow)
Contracts touched: CONTRACTS §5 (additive: chat/insights/admin-login, LiveSession fields).
How to verify: open /support/ and /admin/#/live in two windows of the same browser; hand off from the chat, accept and reply from admin, close, rate, then see the evaluation in admin.

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
