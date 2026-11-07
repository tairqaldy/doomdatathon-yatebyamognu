# STATUS: live handoff log

Append a new entry at the **top** at the end of each session (format in AGENTS.md §5). Don't edit other people's entries.

## Requests / Plans (fallback when GitHub Issues aren't available)
- **2026-11-07 · lane-b · postgres store · branch `b/postgres-store` (no `gh` on this laptop):** Goal: connect optional Postgres so `/support` and `/admin` share live sessions across devices. Plan: zero-dep `lib/postgres.js` (Neon HTTP + TCP), `cqa_kv` JSON table, `GET/PUT/DELETE /api/sessions`, live-store hydrate/poll with localStorage fallback. Files: `lib/postgres.js`, `lib/kv.js`, `api/sessions.js`, `shared/live-store.js`, `.env.example`, CONTRACTS/DECISIONS/TOOLING/AGENTS. Contracts: additive `/api/sessions` + `health.postgres`. Verify: `node scripts/pg-ping.mjs`, `/api/sessions` without URL returns `{postgres:false}`, `/api/health` shows the flag. Needs a human: paste Neon/Vercel `DATABASE_URL` into `.env` and Vercel env.
 - **2026-11-07 · final integration QA · audit/integration-readiness:** User requests local-only QA, minimal scoring patch artifact and docs/INTEGRATION_READINESS.md; no commit/push/PR/merge or paid inference. Base audit c760733, fetched main 2e90055; published audit ref matches local HEAD. Inspect PR #9 and scoring branch; add only eval/integration/*, eval/runs/integration-* and shared handoff/tooling entries. Test existing API handlers with cached results and blocked networking/provider doubles; compare scoring before/after an in-memory application of a proposed patch. Do not edit app/server/prototype/lib/api/data/gold. gh absent: public GitHub REST read succeeds, plan stays local per user restriction.
 - **2026-11-07 · evaluator readiness · audit/evaluator-readiness (local only):** Goal: inspect actual LLM path and reproduce c08 failures without paid calls. Plan: add seven fixed c08 cases, offline regression tests for mock and LLM normalization/retry boundaries, fresh mock metrics and `eval/EVALUATOR_READINESS.md`. Files: new `eval/readiness/*`, `eval/runs/readiness-*`, report, append-only STATUS/TOOLING. Contracts: none. Verify: Node test runner, existing accuracy harness, protected-file hashes. Existing audit edits remain untouched. `git pull` fetched `origin/main` c30a86a but cannot rebase without upstream; explicit rebase would mix remote gold review metadata into the user's preserved local gold, so inspection uses remote diffs instead. Evaluator implementation matches origin/main. gh absent; no issue publication, commit, push or PR under user restrictions.
- **tair/claude (no `gh` on this laptop yet):** plan for branch `d/design-system-and-team-rules` was: rules (issue-first, every-prompt pull-rebase, commits, branching, self-merge), TOOLING registry, enforcement (hook, check.sh, CI, templates), design system from fbroker.kz, clickable prototype. Done and merged, see the log entry below. **Someone with `gh`: please run `scripts/setup-labels.sh` and open issues for the lane tasks in "Next".**

## Log

### 2026-11-07 21:00 · lane-a · claude · #21 · branch a/21-phone-demo
Done: **`/phone/`**, AIM inside a copy of the official Freedom Broker iOS app (from `docs/research/freedom-app.md`). On a laptop it shows an iPhone frame, scaled to fit; ≤500 px wide the app fills the screen. All 6 tabs plus Пополнение, Вывод, Обмен, Отчеты и документы, Настройки (language RU/KZ/EN), the Поддержка sheet, the ticket form, Контакты and FAQ. Mock data only.
AIM entry points: the first row of the Поддержка sheet («AIM · ответ сразу»), the chat icon on Котировки/Идеи, the round launcher above the tab bar, and FAQ items (they ask AIM). AIM is the unchanged `broker/agent.js`, mounted inside the phone through `window.AIM_HOST` and re-themed dark through scoped overrides in `phone/phone.css`.
Small cross-lane changes (announced in #21): `broker/agent.js` gets an optional `host.compact()` (minimise while acting inside the frame; default unchanged); `lib/nav-agent.js` `sanitizeActions` also accepts an exact target **label** when the model returns «Сумма» instead of `dep-amount` (it was silently dropping prefills).
Verified: desktop frame + 375 px mobile; real AIM run «пополнить через Kaspi 50 000» → opens Пополнение, fills Kaspi / KZT / 50 000, protected button left to the client; KZ switch; console clean; `npm test`, `scripts/check.sh`.
Note: another session was working uncommitted on `c/23-call-tone` in the main checkout, so this branch was built in a separate worktree. Their uncommitted changes make one scoring test fail there (not on main).
Contracts touched: none (AIM host adapter: one optional field).
How to verify: `npm run dev` → http://localhost:3000/phone/ ; Меню → Поддержка → «AIM · ответ сразу».

### 2026-11-07 20:55 · lane-c · claude · #22 · branch c/22-results-export
Done: the graded deliverable. Appendix «Как сдать результаты» transcribed to `docs/case/results-format.md`. `eval/export-results.mjs` maps our c01–c08 to the official codes (contact, discovery, identification, consultation, empathy, dialogue, closure, critical), yes/no/na → true/false/null, **evidence turns +1 (format is 1-based)**, totals half-up via `prototype/scoring.js`, failed dialogs → `status: "error"` with the reason; N/A without cited turns points at the client's request or the system end event. `eval/validate-results.mjs` checks every rule and recomputes final_score from the values with the official weights (a corrupted copy: all 9 planted errors caught). `eval/control-run.mjs` = one command: fetch + save set → evaluate (concurrency 8, cached) → retry failures once → export → validate → `--push`. **`results/dev/results.json` committed: 65/65 ok, valid.**
Rehearsal on DEV with a live fetch: identical data, export + validation in ~1 s (cached); fresh 10 chats ≈ 1 min.
**CQA_API_URL:** real link now in this laptop's `.env` and verified (65 DEV dialogs). The URL may include or omit `&group_id=…` (it is replaced). If it's missing or a placeholder, the run falls back to our Vercel proxy `/api/dataset`.
Control-set runbook (from an up-to-date `main`):
```bash
node eval/control-run.mjs --group <CONTROL_GROUP_ID> --out results/prod/results.json --expect 10 --push
```
Contracts touched: none (new output files only). Team name in the file: `YaTebyaMognu` (override with `--team` or `CQA_TEAM_NAME`); model: `OpenAI gpt-6-luna (OpenAI API)`, mode `external_api`.
How to verify: `node eval/validate-results.mjs results/dev/results.json --dataset data/datasets/DEV.json --expect 65`

### 2026-11-07 20:40 · lane-d · claude · #20 · branch d/20-freedom-app-research
Done: captured the live **Freedom Broker iOS app v32.23.17** through iPhone Mirroring (28 frames, all 6 tabs, read-only) and wrote `docs/research/freedom-app.md`: app shell, 6-tab nav, palette (mostly Tailwind defaults on navy `#171D2D`, accent blue-500), type scale, components, screen inventory, where AIM goes (chat icon + Меню → Поддержка), phone-demo plan. **The app is dark navy + blue, not the light green fbroker.kz look**, so the phone demo must use this file, not `design-system.md`.
Raw frames stay out of git (real client name, account numbers, balances).
Second capture added Поддержка: bottom sheet (Написать в поддержку · FAQ · Контакты · Оцените приложение) and the ticket form. **Support today is an async ticket form, with no instant answers**, so AIM goes at the top of that sheet and hands off to the ticket form pre-filled (bot → human).
Next: lane-A phone-frame demo page with mock data (Expo Go wrapper optional). Not captured: instrument page, what the Котировки chat icon opens.
Contracts touched: none.
How to verify: read `docs/research/freedom-app.md`; method in its §0 and TOOLING §6.

### 2026-11-07 20:20 · lane-c · claude · #19 · branch c/19-nav-direct
Done: AIM now **acts right away when the client explicitly asks** («открой за меня», «перекинь меня на вывод», "take me to the tariffs page", «Тарифтерді ашып беріңізші»), even after an earlier «нет». Prompt `nav-v6` returns `direct`; the server also checks the last client message against an act-phrase pattern (`ACT_RE`) so it doesn't depend on the model alone. Widget: while a yes/no offer is open, act words count as yes and win over a leading «нет»; `direct` responses run without a question. Plain «нет» still declines; normal questions still get steps + the question.
Verified locally: the reported chat (offer → «Нет» → «нет, открой за меня» → opened «Пополнение»), act words during an open offer, plain «нет», direct first message (RU), EN and KZ direct requests, normal question still asks.
Planned (not done): Redis cache for frequent AIM questions via the shared `lib/cache.js` tier (#18); the `nav` key is the whole conversation + page context today, so first-turn questions need a narrower key to get hits.
Contracts touched: CONTRACTS §5 `/api/agent` adds `direct` (additive).

### 2026-11-07 19:55 · lane-c · claude · #17 · branch c/17-widget-isolation
Done: the AIM widget is now **self-contained**, so it survives the switch to a Freedom-designed demo page. Own stylesheet `broker/agent.css` (scoped under `#aim-widget`, `all: initial` root + element reset, its own Freedom colour values, optional `--aim-*` theming), loaded by `agent.js` itself and hidden until loaded. Mounted on `<body>` outside `#cqa-root`, with its own toast. All page knowledge moved into `broker/agent-host.js` (or `window.AIM_HOST`); generic defaults (language from `<html lang>`, DOM scan of `<main>`, wrapped-label detection) work on any page. Widget rules removed from `broker/broker.css`; no other app changes.
Verified: /broker flow (ask → steps → yes → fields filled + highlight) unchanged; hostile page CSS (global button/p/li/textarea/body/`.br button` rules) → 0 computed-style differences across 11 widget parts; bare test page without the broker app → widget in English, scan finds Amount / Pay [protected] / Help and skips the widget itself; 375 px: no overflow, no overlap.
To embed on a new page: include `/broker/agent.js` (and `/shared/live-store.js` stays available for handoff); write an adapter only if you want typed screens/targets.
Contracts touched: CONTRACTS §5 note on embedding (no shape change).

### 2026-11-07 19:25 · lane-c · claude · #16 · branch c/16-widget-polish
Done: AIM widget polish on /broker. The «Спросить AIM» launcher had dark text on a dark pill because `.br button { color: inherit }` out-ranked `.ag-fab`; the reset is now `:where(.br)` so component colours apply, and the launcher was restyled (white text, halo dot, 52 px). Overflow audit with a stress conversation at 1024 / 800 / 375 px: system lines with long words stuck out of the panel → wrapping and min-width fixes; floating panel kept down to 601 px (D365 iframe), bottom sheet only on phones (dvh, safe area, 16 px input); shorter placeholders; no idle scrollbar in the input; round controls stay round on keyboard focus.
Contracts touched: none.
How verify: https://freedom-cqa.vercel.app/broker/ at desktop, ~800 px and phone width; open «Спросить AIM».

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
### 2026-11-07 · lane-c · audit publication · audit/evaluator-readiness
Authorization: user explicitly requested push and pull; this supersedes the earlier local-only restrictions for publishing this branch. No main merge or PR requested.
Done: committed gold audit and evaluator diagnostics separately, pulled/rebased onto origin/main 2e90055 without conflicts. Preserved the team's reviewed/reviewed_by metadata on all 19 gold files and retained audit evidence/notes; answers and alternatives match upstream. Reports now distinguish historical audit snapshots from the newer evaluator integrated by the team.
Verification: 131 tracked JSON files parse via Node; gold validator reports zero structural errors and five existing rounding discrepancies. Mock suite 13/20 pass (seven known misses), contract suite 11/19 pass (eight known defects). Full check.sh still fails its Python-based JSON step because python3 is unavailable; results are not described as a green gate. No application/source-data edits relative to upstream, no paid calls.
Next: push audit/evaluator-readiness and verify upstream tracking/clean working tree. Evaluator owners can consume the diagnostics; known red tests remain explicit.

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
### 2026-11-07 · lane-a · product/design · #8 · branch a/8-card-evaluation-ux
Done: moved deduction reasons and evidence ahead of the full criteria list, prioritized the evaluation panel at narrow widths, and added single-evaluation progress, timeout and retry feedback.
In progress: preview and a real model response have not been verified.
Next: check the deployed preview and an actual evaluation before merging.
Blocked by / Requests: Vercel team access is unavailable for deployment inspection.
Contracts touched: none.
How to verify: open a conversation, follow an evidence link and appeal; start evaluation and check waiting/error states.

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

### 2026-11-07 · lane-c · independent gold audit · audit/gold-dataset-review
Goal: independently check all 19 gold dialogs against DEV and the official checklist.
Plan: read every transcript and label; correct definite errors; record ambiguities; add isolated validator and report; run existing scoring/accuracy checks.
Files: eval/gold/*.json, eval/audit-gold.mjs, eval/GOLD_AUDIT_REPORT.md, docs/STATUS.md, docs/TOOLING.md.
Contracts affected: none. Verification: JSON/shape/reference checks, independent total calculation, accuracy harness and npm test.
Publication: local only per explicit user instruction; no commits, push, PR or main merge. gh unavailable; issue/PR state cannot be confirmed. Existing lane-c drafts (#3) are the requested audit scope. Human review requirement remains in force.

### 2026-11-07 14:35 +05:00 · lane-c · independent gold audit · local branch audit/gold-dataset-review
Done: all 19 source conversations and 152 gold labels audited; 32 empty evidence fields anchored, 50 empty notes filled, 2 misleading notes corrected. All answers/alternatives preserved; all files remain draft pending human review. Report: eval/GOLD_AUDIT_REPORT.md (per-file changes, all 54 alternatives, source indices, totals).
In progress: none within authorized audit scope.
Next: human QA resolves ambiguous labels; scoring owner fixes total rounding (5 discrepancies of 0.01, including 99.99 instead of 100 for p1-ru-025); evaluator owner investigates mock gross-error recall 0/7.
Blocked by / Requests: gh absent, live Issues/PR unavailable; Python unavailable makes scripts/check.sh fail JSON step. No commits/push/PR/merge permitted by user, all changes remain local. Official T still unconfirmed in STATUS.
Contracts touched: none. No app/prototype/backend/source-data changes.
How to verify: node eval/audit-gold.mjs (0 structural errors, exit 2 for existing engine rounding); node eval/accuracy.ts eval/runs/gold-audit-self.json (compatibility only); npm test (7/7). Node parses all 26 tracked JSON; fresh mock metrics in eval/runs/gold-audit-mock.metrics.json. Full check.sh FAILED due to Python, not reported as passing.

### 2026-11-07 · lane-c · evaluator readiness · audit/evaluator-readiness · local only
Milestone: remote refs advanced during inspection. Frozen main snapshot 8feeb26 now includes #6's saved Haiku 5.5 eval-v1 run and 19 cache entries. Rescored the saved run without inference: strict 75.66%, lenient 92.11%, c08 recall 6/7 (85.71%), FP 0, total MAE 14.06. All 19 cache/export answers and evidence match; 182 message/range refs valid. Missing case is p1-kz-015: c03 recognizes unverified disclosure, c08 says no and cites only turn 13, omitting disclosure in 9. Local gold and all production/source inputs remain unchanged. origin/c/7-openai-direct b43b67d is active; not modified or executed. No prompt tuning or paid calls.

### 2026-11-07 · lane-c · evaluator readiness handoff · audit/evaluator-readiness
Done: eval/EVALUATOR_READINESS.md, seven fixed c08 cases, isolated c08 and LLM contract suites, offline runners and six readiness JSON artifacts. Mock c08 suite: 13/20 pass, 7 failures; saved LLM c08: 19/20 pass, p1-kz-015 fails; contract suite: 11/19 pass, 8 failures (empty evidence, quote diagnostics, N/A evidence, duplicates, invalid-evidence retry, invalid-JSON retry, partial success, retry-cost aggregation). Existing scoring tests: 7/7. All 19 saved LLM caches match exports; actual inference calls/cost in this task: 0/$0.
In progress: none within diagnostic-only scope.
Next: evaluator owner fixes validation/retry/cost, resolves the KZ c03/c08 inconsistency, then checks active provider-router branch. Treat the inspected gold as a development/regression benchmark after any tuning; freeze a separate holdout for independent accuracy. Do not substitute c08 lenient=100% for critical recall=6/7.
Blocked by / Requests: live provider configuration, direct OpenAI branch behavior, fresh inference, UI/Vercel and unseen data are untested. New paid calls require user authorization. No commits/push/PR allowed. Local gold remains draft while remote metadata says reviewed; answers/alternatives match exactly, preserved without merging.
Contracts touched: none. Gold, production code, source data and earlier audit artifacts unchanged in this task.
How to verify: node eval/readiness/run-offline.mjs; node eval/readiness/review-saved-run.mjs 8feeb262cccacd0541ddb5fcec6379cd15fa33b9 eval/runs/2026-11-07T09-36-59-522Z-DEV-anthropic_claude-haiku-5.5.evaluations.json. Both exit 1 because regressions remain; detailed logs and summaries under eval/runs/readiness-*. Full scripts/check.sh not rerun (known missing Python from preceding audit); no green overall gate claimed.

### 2026-11-07 20:10 +05:00 · team · tair/claude · #18 · v2 merged to main
Done: `team/v2-bright-product` merged into main (`--no-ff`) and pushed → production https://freedom-cqa.vercel.app. Includes: bright landing at `/` (hub moved to `/preview-hub/`, now also links `/phone/`), light admin with the analyst workspace, light `/support/`, results exporter (`npm run results`), logic-fingerprinted cache with Upstash Redis / Cloudflare KV, Redis option for live sessions, evaluator accuracy guards (eval-v4), offline evaluator no longer guesses on new criteria, blind double-labeled check set `eval/blind/`.
In progress: eval-v5.x (facts-first prompt, deterministic C7/C3→C8, self-consistency) is still being measured on tair's laptop and is NOT on main; production evaluates with eval-v4. On the blind set v5 matches the labelers' consensus on 94.6% vs v4 91.9%; C2/C4/C6 rule fixes are being tested on the held-out gold split before adoption. Voice (Whisper STT + OpenAI TTS for the AIM agent) is a separate branch in progress.
Next for Nazar / Amina: pull main (`git pull --rebase`) before pushing your updates; branch from the new main and merge with `--no-ff` after `scripts/check.sh`. Don't edit `lib/evaluator.js` until eval-v5 lands (tell tair first), it would change every eval cache key.
Blocked by / Requests: `gh` is logged out on tair's laptop (issue comments pending). CQA_Student_Guide_Appendix_Results.pdf still needed to finalise `results/format.json`.
Contracts touched: none (results/format.json is provisional).
How to verify: open `/`, `/support/`, `/admin/` (demo code on the login page), `/preview-hub/`, `/api/health` on production.

### 2026-11-07 20:25 +05:00 · team · tair/claude · #18 #22 · one results pipeline
Done: correction to the entry above. Nazar's official exporter (#22: `eval/control-run.mjs`, `eval/export-results.mjs`, `eval/validate-results.mjs`, format in `docs/case/results-format.md`) is THE pipeline. `npm run results` now runs it; my provisional `scripts/results.mjs` + `results/format.json` are removed so nobody exports the wrong shape at control time. AGENTS.md §1.1, README, TOOLING and research pages point to `npm run results -- --group <CONTROL_ID> --push`.
How to verify: `node eval/validate-results.mjs results/dev/results.json --dataset data/datasets/DEV.json --expect 65` → valid, 65 ok.

### 2026-11-07 20:40 +05:00 · lane-c · #23 · c/23-call-tone
Done: tone of voice on calls. New c09 «Тон и подача речи» in `data/checklists/freedom-call-v1.json` (`input: "audio"`, weight 10); `lib/tone.js` sends the mp3 + operator turns to Gemini 3.8 Flash, voice metrics (words/min, long silences) are plain arithmetic. DEV: p4-ru-001 → 4/10, other calls 10/10, ≈ $0.013 per call. Admin call card shows it with metrics; the audio jump now starts at the phrase start (call timestamps mark where a phrase ends). Chat checklist and `results/dev/results.json` are unchanged: the exporter drops audio criteria.
In progress: none.
Next: at T+23h, after `npm run results -- --group <ID>`, run `node scripts/tone-run.mjs --group <ID>` so control-set calls get c09 in the card (it never touches results.json).
Blocked by / Requests: lane B: on main, 0 of 65 committed DEV text answers match the current `lib/evaluator.js` fingerprint (lib/cache.js), so a DEV re-run pays again; my branch leaves evaluator.js unchanged. Browsers that already saved a call checklist in localStorage don't see c09 until it is reset.
Contracts touched: additive `criterion.input`, `answer.audio_metrics`, `audio_model`, `usage.audio` (CONTRACTS §2–3).
How to verify: /admin → Диалоги → p4-ru-001 → «09 Тон и подача речи»; `npm test` (12/12); `node eval/export-results.mjs` → 65 ok, unchanged.
