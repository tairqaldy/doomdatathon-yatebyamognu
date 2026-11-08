# DECISIONS

One line per decision. Newest on top. `date · decision · why · who`

- 2026-11-07 · AIM voice on OpenAI: Whisper (`whisper-1`) for the mic, `gpt-4o-mini-tts` voice `sage` for replies, both through `lib/llm.js` + `lib/cache.js`; replies spoken chunk by chunk (first sentence first, all chunks fetched in parallel); fallbacks Nemotron (mic) and browser `speechSynthesis` (replies) without `OPENAI_API_KEY` · human-sounding voice incl. Kazakh, ~1.4 s to first audio cold and instant when cached, one key for eval + voice; `gpt-4o-transcribe` measured faster and can replace Whisper by env · tair/lane-c
- 2026-11-07 · Optional Postgres via `DATABASE_URL` (Neon SQL-over-HTTP on `*.neon.tech`, otherwise TCP/TLS, zero npm deps). Live sessions go to `cqa_kv`; without the URL, `/support` stays on localStorage · two devices / two Vercel isolates cannot share localStorage · lane-b
- 2026-11-07 · Product loop: landing → /support (AIM bot, honest handoff) → auto QA → /admin (passcode) with AI analyst; plan in issue #10 · covers the whole Freedom ask end to end and answers "people don't trust AI" · tair
- 2026-11-07 · Landing imagery generated in-house (gpt-image-2.6), mood board used only as reference · IP violations disqualify · tair
- 2026-11-07 · Admin gate = passcode → HMAC token (demo code shown on the login page); no link from public pages · brief says no login needed, but the admin surface must be distinct · tair
- 2026-11-07 · Live sessions in localStorage + BroadcastChannel (same browser) for the demo; server store later if needed · zero infra, works offline on stage · tair

- 2026-11-07 · Eval default = OpenAI `gpt-6-luna` via the **direct OpenAI API** (`openai:gpt-6-luna`, `lib/openai.js` through `lib/llm.js`); ASR stays OpenRouter `nvidia/nemotron-3.5-transcribe`; without `OPENAI_API_KEY` the same model runs via OpenRouter `openai/gpt-6-luna` · team chose the OpenAI API; on the 19 reviewed gold dialogs Luna scored 86.2% strict / 94.7% lenient vs Haiku 5.5 75.7% / 92.1%, total MAE 7.83 vs 14.06, $0.00112 vs $0.00177 per eval (#7) · lane-c
- 2026-11-07 · Vercel (not Cloudflare) for CI/CD: Git integration gives a preview URL per branch + prod from main, zero-dep Node functions for the AI proxy · fastest path, MCP access for checks · tair
- 2026-11-07 · OpenRouter for all models; eval default claude-haiku-5.5, ASR nemotron-3.5-transcribe; everything cached and cost-logged · one key, cheap, ~$9.5 budget · tair
- 2026-11-07 · Prototype UI rebuilt to Freedom's "QA workspace" slide layout (speaker timeline, understanding strip, deduction reasons, dispute button) · that's the jury's mental model · tair
- 2026-11-07 · graphify-out/ gitignored; each laptop runs `graphify update .` · avoid merge conflicts on a generated snapshot · tair

- 2026-11-07 · Merges into main use `--no-ff` merge commits (no squash); agents self-merge after `scripts/check.sh` + the AGENTS.md §4.4 checklist · keep a rich, readable history and avoid waiting on humans · tair
- 2026-11-07 · Design system = fbroker.kz tokens (Tailwind class names kept) + CQA additions (ink colours, app type scale); Inter stands in for licensed CoFo Sans · brand fit for the jury, AA contrast, no font licensing risk · tair
- 2026-11-07 · Prototype first (no build, `prototype/`), TS app ports from it · demo exists early and UX gets validated before the stack is ready · tair
- 2026-11-07 · Every tool/model/skill/approach is logged in `docs/TOOLING.md` · reproducible setups across 4 laptops · tair

- 2026-11-07 · TypeScript + Tailwind allowed for frontend; build must output static files in `app/dist/` · organizers confirmed; keeps Dynamics 365 web-resource path · team
- 2026-11-07 · Scoring arithmetic lives in deterministic `app/src/scoring.ts`, LLM only picks answers + evidence · reproducible totals, matches checklist rules exactly, cheap to re-score after appeals · tair
- 2026-11-07 · Checklist is JSON data (`data/checklists/`), never hard-coded · live "replace one criterion" test at defense · tair
- 2026-11-07 · Coordination via GitHub Issues + `docs/STATUS.md` + `docs/CONTRACTS.md`; no AI attribution in commits · 4 people × multiple agents need one shared brain · tair
- 2026-11-07 · Tone of voice on calls = criterion c09 in the call checklist (`input: "audio"`, scale 10/7/4/0, weight 10), judged by Gemini 3.8 Flash from the recording; kept out of the official results file · intonation is not in the transcript; gpt-audio-mini failed an "what is said at 03:00" check, Gemini passed · lane C (#23)
- 2026-11-07 · One results pipeline: `npm run results` = `eval/control-run.mjs` (official "Формат JSON 1.0", validator, error records); the provisional `scripts/results.mjs` was removed · two exporters at control time is a risk · tair (with Nazar's #22)
- 2026-11-07 · Evaluator eval-v5.1 → eval-v5.3 adopted by a rule fixed in advance: held-out gold and blind-labeler consensus must not drop, gross errors 7/7 with 0 false positives; eval-v5.2 rejected by the same rule · accuracy on 10 unseen chats decides the top 50; avoid fitting our own gold · tair
- 2026-11-07 · Blind double labeling (two independent AI labelers, checklist + rulings only) as an out-of-sample check next to our 19-dialog gold · our gold is our own reading · tair
- 2026-11-07 · C7 closing read literally (summary or offer of help AND goodbye; «Пожалуйста. Хорошего дня!» = no) after the organizers' "re-read the checklist" · flip `closingAnswer()` in lib/evaluator.js if they rule otherwise · team
- 2026-11-07 · Disclosure of account data before identification = C3 "no" AND C8 "yes" (organizers: our choice, #2814; the checklist lists confidential disclosure under gross errors) · team
- 2026-11-07 · Weight-only checklist changes recompute totals from the same AI answers; any change to criterion text/type/N/A/scale re-evaluates · answers don't depend on weights; instant demo, no wasted calls · tair
- 2026-11-07 · Live evaluation: `api/evaluate.js` maxDuration 300 s (Fluid compute), vote over samples done within 240 s; admin waits up to 280 s · 3 votes take 30–60 s on chats, up to ~2.5 min on calls · tair
- 2026-11-07 · Upstash Redis connected on Vercel for the AI cache and cross-device live chats · phone (support) + laptop (admin) at the defense · tair
- 2026-11-07 · Demo video recorded from the real product by `scripts/demo/record.mjs` (DevTools Protocol + AVFoundation, no dependencies) · reproducible after UI changes · tair
- 2026-11-07 · Phone demo runs on real phones as an **Expo Go WebView wrapper** (`mobile/`) around `/phone/`, not a React Native rewrite · one codebase for web + phone, deploys update the app with no rebuild, React Native stays isolated from the static app (AGENTS §11) · lane A
- 2026-11-08 · Landing motion: leaves fall only on a fast upward flick (> ~2600 px/s); smooth scrolling only for mouse wheels and anchors, trackpads/touch stay native · seasonal touch without distracting readers; no scroll-jacking on devices that already scroll smoothly · tair
- 2026-11-08 · Operator ↔ operator transcripts handled by pre-processing (`lib/roles.js`), not a prompt change: operator → colleague turns become system context for the evaluator, no-client dialogs skip the model with «оценка не применяется» · `lib/evaluator.js` frozen before stop-code; single-operator transcripts stay byte-identical, so DEV/SWAP/FBroker cache keys and results do not change · lane B
