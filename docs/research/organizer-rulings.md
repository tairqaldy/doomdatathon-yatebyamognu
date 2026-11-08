# Organizer rulings → where the product implements them

Source: organizer and Freedom Broker answers in Telegram, collected by Nazar Akanov on 2026-11-07 (~T+6.5h): [`docs/case/telegram-qa.md`](../case/telegram-qa.md). `#N` is the message id there. The official PDFs ([brief](../case/brief.md), [checklist](../case/checklist.md)) still override this page.

Status as of this writing: **done** = in code on this branch, **partial** = works with a gap we name, **open** = not built yet. Line numbers point at the current files and may drift.

## How we are judged

| Ruling | Where in our product | Status |
|---|---|---|
| Top-50 selection is decided mainly by **per-criterion agreement with expert labels on 10 unseen control chats** (#2292, #2978). Exact match isn't required; closeness and sensible handling of N/A, gross errors and missing data count. | We measure the same thing on 19 human-reviewed gold dialogs: strict and lenient agreement per criterion and language, N/A recall, gross-error recall, total MAE ([`eval/accuracy.ts`](../../eval/accuracy.ts), [`eval/gold/README.md`](../../eval/gold/README.md)). Latest numbers: [our-experiments.md](our-experiments.md). | done |
| The system must **really analyse new dialogs**, no replayed prepared results; anything goes except hard-coding results (#2177, #2978). | Every dialog goes through the same path: `POST /api/evaluate` → [`lib/evaluator.js`](../../lib/evaluator.js) → model → [`prototype/scoring.js`](../../prototype/scoring.js). `data/evaluations/DEV.json` is only a cache of real model output keyed by model + prompt version + transcript + checklist ([`lib/cache.js`](../../lib/cache.js)). A new transcript or a changed checklist means a new model call. | done |
| **If information is missing, don't invent facts** (#2981). | Evidence guard: cited turn indices must exist, quotes must match the cited line, every scored answer needs a transcript reference, otherwise one bounded repair call and then a loud error ([`lib/evaluator.js`](../../lib/evaluator.js) `normalize()` and `evaluate()`). The support assistant is told not to invent tariffs, numbers, dates or links ([`lib/support-bot.js`](../../lib/support-bot.js), rule 1). | done |
| Results go to **`results/dev/results.json`** (DEV) and **`results/prod/results.json`** (control set), format per `CQA_Student_Guide_Appendix_Results.pdf`; 1 hour to process 10 control chats before stop code (#3042). | Format transcribed in `docs/case/results-format.md`; exporter + validator + one-command control run: `npm run results -- --group <ID> --push` (`eval/control-run.mjs`); `results/dev/results.json` valid 65/65; rehearsal 10 chats in 79 s with the error path. | done |
| **No demo video needed** (#3084). Look: a corporate product for executives, QA and staff, nothing cartoonish (#3011). The mock-up is an example, not a standard (#3015). | Freedom design tokens from fbroker.kz ([design-system.md](design-system.md)); the bright v2 theme on this branch. | done |
| Live demo asks (#2991): show all dialogs with gross errors and why; send a result to appeal; change the checklist (add, edit, re-weight); show one dialog's evaluation with justification. | Gross errors: red badge on each row and a KPI count in `/prototype/` ([`prototype/app.js`](../../prototype/app.js) `viewDialogs`), a red banner with the reason in the card (`viewCard`), and a grouped "gross errors" line in `/admin/` ([`admin/data.js`](../../admin/data.js)). Appeal and decision: `viewCard` → «Оспорить», `viewAppeals`. Checklist: `viewChecklist`. | partial: no one-click "only gross errors" filter in `/prototype/` yet |

## Checklist rulings

| Ruling | Where in our product | Status |
|---|---|---|
| The official `CQA_Chat_Quality_Checklist.pdf` is mandatory (#2251, #2289). | Seeded as data: [`data/checklists/freedom-chat-v1.json`](../../data/checklists/freedom-chat-v1.json). The evaluator renders whatever checklist it gets (`renderChecklist()`, `schemaFor()` in [`lib/evaluator.js`](../../lib/evaluator.js)); nothing is hard-coded per criterion id. | done |
| **C2 need identification:** the client gave everything and the operator answered without clarifying → **N/A** (#2814). | Prompt rule 9 in [`lib/evaluator.js`](../../lib/evaluator.js) (`eval-v4`): a fully clear request is N/A, not "yes" and not "no". Gold labels follow the same reading ([`eval/gold/`](../../eval/gold/)). | done |
| **C7 closing:** "Пожалуйста. Хорошего вечера!" alone → re-read the checklist literally: summary **or** offer of help, **and** a goodbye (#2814, #3024). | Prompt rule 10 (`eval-v4`): a one-word goodbye with no summary and no offer of help is "no"; a short next-step summary plus goodbye is "yes"; a chat cut off by the system or client is N/A. This change moved about 11 non-gold DEV chats from "yes" to "no" ([STATUS, #13](../STATUS.md)). | done |
| Account data shared before identification: C3 "no" only, or also C8? → **our choice** (#2814). | Our choice: both. Account facts (balance, restrictions, operations, request status) before verification = C3 "no" **and** C8 gross error. Steps of the verification procedure itself are not disclosure. Prompt rule 13. | done |
| When identification is needed: decide from the request (protected action or personal data) (#3074); being in the app doesn't mean verified (#3082). | Prompt rule 13 plus the checklist N/A condition for C3 ("the request did not need identification, e.g. a general tariff question"). | done |
| **C1 on calls with no recorded greeting → N/A** (#2978). | The call checklist [`freedom-call-v1.json`](../../data/checklists/freedom-call-v1.json) allows N/A on C1 and the admin uses it for calls. The official results format allows only true/false for `contact`, so the results file exports `false` there (p4-ru-002); the control set is chats only. | done |
| **C4 correctness:** Freedom has a knowledge base we don't get; the system flags off-script moments for appeal and script rework (#2978). | Every deduction shows a plain reason and the line it rests on, so a reviewer can overturn it in one click (appeal → decision). The gold audit notes that product facts can't be proven correct without the knowledge base ([`eval/GOLD_AUDIT_REPORT.md`](../../eval/GOLD_AUDIT_REPORT.md) §4). | done (by design) |
| **Rounding: half-up to 2 decimals**, 50.625 → 50.63 (#2978). | `round2 = Math.round((x + Number.EPSILON) * 100) / 100` rounds halves up for positive totals, and it is applied **once, to the final total** ([`prototype/scoring.js`](../../prototype/scoring.js) lines 31, 54, 67). Self-tests cover 88.82 and the 30.59 regression; `npm test`. | done; a 50.625 test case would make the ruling explicit |
| **Replacing a criterion:** our design; **re-evaluate: yes** (#2978). | Saving the checklist in `/prototype/` creates a new version. The AI result key includes a hash of every criterion's text, type, weight, N/A rule and scale (`clHash()`, [`prototype/app.js`](../../prototype/app.js) line 26), so any change to the checklist means a fresh evaluation of each dialog; a checklist seen before is served from cache. Appeals are tied to the checklist version they were filed against. | done |
| 3-minute first reply is an SLA, out of scope (#3088). | Not scored, as the checklist says. | done |
| **Calls:** same logic adapted to speech; C6 for calls covers logic, clarity, wording, pauses; a **flexible system that creates and applies different checklists, including for calls** (#2343). | Any checklist JSON works with the same evaluator and scoring engine. The editor creates new criteria and versions. A call-specific checklist is not saved in `data/checklists/` yet. | partial |

## Calls and audio

| Ruling | Where in our product | Status |
|---|---|---|
| Transcribing is optional; audio exists so the reviewer can listen and must be handled in the UI (#2354, #2815, #2825). | Call cards play the recording and jump to the evidence timestamp. Organizer audio links are HTML pages with ~1 h mp3 links, so audio is resolved through `/api/audio?id=` ([`lib/audio.js`](../../lib/audio.js)). | done |
| Perfect ASR is not expected (#2981). | We grade on organizer transcripts. Our own Nemotron transcripts are only a side experiment with WER/CER against those transcripts ([our-experiments.md](our-experiments.md)). | done |

## Still unanswered by the organizers
`null` for `contact` on calls without a greeting (#3060); C7 with a goodbye only; whether the "[Имя скрыто]" mask counts as the operator introducing themselves. Until answered, we follow the literal checklist and note the choice in the dialog's explanation.

## What this means for decisions
- Accuracy work targets per-criterion agreement, not total score alone ([DECISIONS](../DECISIONS.md), line 11: GPT-6 Luna chosen on gold agreement and MAE).
- The checklist stays data, so the live "replace a criterion" test needs no code change ([DECISIONS](../DECISIONS.md), line 24).
- Scoring stays in code ([DECISIONS](../DECISIONS.md), line 23), which makes the half-up rounding ruling a one-line guarantee.
