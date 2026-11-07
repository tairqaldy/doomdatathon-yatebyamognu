# Our experiments: from mock to eval-v4

**Summary.** On 2026-11-07 we built a 19-dialog gold set, measured a rule-based mock, compared two cheap LLMs, and iterated the prompt four times. The current default, OpenAI GPT-6 Luna with prompt `eval-v4`, agrees with the human labels on **91.4% of criterion answers (strict) and 96.7% (lenient)**, finds **7 of 7 gross errors with 0 false positives**, and costs **$0.00114 per evaluation**. Two prompt versions that scored well on gold were rejected after we read their output on other dialogs. Everything below comes from files in this repo; times are UTC from the run file names.

## 1. The yardstick: gold set and harness

- **Gold set:** 19 DEV dialogs labeled on all 8 criteria, 152 labels: RU 9 (one of them a voice call, `p4-ru-001`), KZ 5, EN 5. Labels carry evidence turn indices and an `also_acceptable` list for borderline cases. Drafted by an agent, then checked label by label by a human reviewer, who accepted every answer ([`eval/gold/README.md`](../../eval/gold/README.md)). Cases cover identification done and violated, confidential disclosure, off-company paid offers, an insult, a missing greeting, repeated questions, lost connections and a noisy call transcript.
- **Harness:** [`eval/accuracy.ts`](../../eval/accuracy.ts) scores any evaluator run: strict agreement (answer equals gold), lenient (answer is gold or an accepted alternative), scale within one step, N/A precision and recall, gross-error recall and false positives, evidence hit rate, invalid references, and total MAE computed with the same scoring engine. A perfect run scores 100% everywhere, which checks the harness itself.
- **Why per criterion:** the organizers pick the top 50 mainly by per-criterion agreement with experts on 10 unseen chats ([organizer-rulings.md](organizer-rulings.md)).
- **Caveat:** we tuned prompts while looking at these 19 dialogs. They are a development set now, not a held-out test. The control set is the real test.

## 2. Independent gold audit

A separate agent re-read all 19 transcripts against the official checklist ([`eval/GOLD_AUDIT_REPORT.md`](../../eval/GOLD_AUDIT_REPORT.md), validator [`eval/audit-gold.mjs`](../../eval/audit-gold.mjs)):

- 84 completeness fixes: 32 empty evidence fields anchored, 50 empty notes written, one wrong event order corrected (`p1-ru-006`), one misleading N/A explanation corrected (`p1-ru-025`). No answer was changed.
- 0 invalid indices among the original 202 references; 321 valid references after the fixes.
- All 7 positive gross-error labels confirmed by the text.
- 54 labels have defensible alternatives. The audit lists which ones need a QA owner's call (escalation as a "correct next step", C7 after a lost connection, disclosure without identification).
- Found a **rounding bug**: the engine rounded each criterion's points before summing, so 5 of 19 totals were off by 0.01 (for example 99.99 instead of 100). See §8.

## 3. Mock baseline

The prototype ships a keyword-based mock evaluator so the UI works without a key ([`prototype/mock-evaluator.js`](../../prototype/mock-evaluator.js)). On reviewed gold ([`eval/runs/mock-baseline.metrics.json`](../../eval/runs/mock-baseline.metrics.json)): **61.8% strict / 75.0% lenient, gross-error recall 0/7, total MAE 22.74**. That was the bar any model had to clear. Later the mock learned to catch private paid offers, insults and unverified disclosure (commit `6579ee6`); we have not re-measured it since.

## 4. Model choice: Claude Haiku 5.5 vs GPT-6 Luna (prompt eval-v1)

Same prompt, same 19 dialogs, temperature 0, strict JSON schema.

| Metric | Mock | Haiku 5.5 | GPT-6 Luna |
|---|---|---|---|
| Strict / lenient agreement | 61.8 / 75.0 | 75.7 / 92.1 | **86.2 / 94.7** |
| Lenient by language RU · EN · KZ | 72.2 · 72.5 · 82.5 | 93.1 · 92.5 · 90.0 | 98.6 · 95.0 · 87.5 |
| N/A recall | 64.3 | 64.3 | 78.6 |
| Gross-error recall | 0/7 | 6/7, 0 FP | 6/7, 0 FP |
| Evidence hit rate · invalid refs | 73.3% · 0 | 95.5% · 0 | 95.5% · 0 |
| Total MAE (points) | 22.74 | 14.06 | **7.83** |
| Cost per evaluation | $0 | $0.00177 | **$0.00112** |
| Latency p50 / p95 | n/a | 13.4 s / 18.0 s | 14.0 s / 22.1 s |

Files: [`haiku-5.5-eval-v1.metrics.json`](../../eval/runs/haiku-5.5-eval-v1.metrics.json), [`gpt-6-luna-eval-v1.metrics.json`](../../eval/runs/gpt-6-luna-eval-v1.metrics.json), run summaries `eval/runs/2026-11-07T09-36-59-522Z-DEV.json` and `…T09-48-01-230Z-DEV.json`.

Both models missed the same gross error: confidential disclosure in the Kazakh dialog `p1-kz-015`. Haiku's main weaknesses were under-scoring fully closed requests on C4 and avoiding N/A. We switched the default to GPT-6 Luna through the direct OpenAI API ([DECISIONS](../DECISIONS.md), line 11). Then we ran it on all 65 DEV dialogs: 0 errors, $0.048 total, $0.00105 per fresh call, p50 13.3 s.

**Lenient can hide a miss.** C8 lenient agreement was 100% while recall was 6/7, because the gold file listed "no" as an acceptable alternative for `p1-kz-015`. We report gross-error recall separately for that reason ([`eval/EVALUATOR_READINESS.md`](../../eval/EVALUATOR_READINESS.md) §3).

## 5. Prompt iterations: v2 and v3 rejected, v4 kept

| 19 reviewed gold dialogs | eval-v1 | eval-v2 | eval-v3 | **eval-v4** |
|---|---|---|---|---|
| Strict / lenient | 86.2 / 94.7 | 89.5 / 96.7 | 92.8 / 96.7 | **91.4 / 96.7** |
| N/A recall | 78.6 | 89.3 | 92.9 | **96.4** |
| Gross-error recall | 6/7 | 7/7 | 7/7 | **7/7, 0 FP** |
| Total MAE | 7.83 | 6.97 | 5.98 | **6.06** |
| Status | replaced | rejected | rejected | **default** |

Files: `eval/runs/gpt-6-luna-eval-v{1,2,3,4}.metrics.json`.

- **v2 rejected:** it gave correct hand-offs only 5 points on C4 and lost two dialogs on C7.
- **v3 rejected** even though it had the best strict score and MAE. Reading its output on dialogs outside the gold set, we found it flagged gross errors on two real calls (`p4-ru-003`, `p4-ru-004`) where the operator was only running the identity check. A false gross-error flag on a real operator is worse than one point of agreement.
- **v4 kept:** five general rules written by criterion meaning, not by id, so they still apply if a criterion is replaced ([`lib/evaluator.js`](../../lib/evaluator.js), rules 9–13): N/A for need identification on clear requests; N/A for closing when the system or client ended the chat; a hand-off with a stated next step is a correct consultation; re-asking caused by the operator lowers dialog management; account facts before verification are a disclosure, but verification steps are not. Both calls now come out with no gross error and identification "yes". No criterion fell below v1.

v4 by language (strict / lenient): EN 97.5 / 97.5, KZ 92.5 / 97.5, RU 87.5 / 95.8. Weakest criterion: **C6 dialog management, 57.9% strict / 78.9% lenient**. The model still gives the middle step to clear replies in the off-company-offer dialogs.

All 65 DEV dialogs on v4: 44 fresh calls, $0.050, **$0.00114 per evaluation**, p50 14.9 s, p95 25.8 s, 0 errors (`eval/runs/2026-11-07T13-16-16-814Z-DEV.json`). Outside the gold set, 58 of 368 answers (15.8%) changed against v1 and the mean total moved by −0.93 points; gross-error flags did not change. Paid prompt work on this branch cost $0.17 in total ([STATUS, #13](../STATUS.md)).

## 6. Evidence guards and bounded repair

The evaluator never trusts the model's references ([`lib/evaluator.js`](../../lib/evaluator.js) `normalize()`):
- turn indices must exist in the transcript; ranges are clamped and ordered;
- the quoted text must appear in the cited line, and the UI always shows the real line, not the model's quote;
- N/A evidence is accepted only for an N/A answer on a criterion that allows N/A;
- every scored or flagged answer needs at least one transcript reference;
- duplicate or invalid answers are recorded as problems.

Any problem triggers **one** repair call (at most 2 model calls per dialog). Cost and latency are summed across attempts. If criteria are still missing, the API returns an error instead of a partial result (commit `247fc7e`, merged in #18). The readiness audit before this change listed 8 contract defects of exactly these kinds ([`eval/EVALUATOR_READINESS.md`](../../eval/EVALUATOR_READINESS.md)). We have not re-run its offline suite for this page: `node eval/readiness/run-offline.mjs`.

Note: the eval-v4 cost and latency figures above were measured before the repair change. A repaired dialog costs up to two calls.

## 7. Caching and cost control

Every model call goes through [`lib/cache.js`](../../lib/cache.js): memory → `eval/cache/` files (committed) → optional Upstash Redis → committed files bundled with the Vercel functions. The key is model + prompt version + conversation id + full transcript + checklist criteria. A repeated request costs $0 and returns in milliseconds; the run files show cached rows at 17–19 ms. Bumping `PROMPT_VERSION` invalidates the cache on purpose. The team budget was about $9.5 of OpenRouter credit plus an OpenAI key ([AGENTS.md](../../AGENTS.md) §8.1).

## 8. Rounding fix

The checklist says to round the total, not each line. The engine used to round each criterion's points first, which produced 99.99 instead of 100 for `p1-ru-025` and 30.58 instead of 30.59 in a test case. Fixed in commit `d95424c`: unrounded points are summed and only the total is rounded ([`prototype/scoring.js`](../../prototype/scoring.js), with a regression self-test; `npm test`). The organizers later confirmed half-up rounding to 2 decimals ([organizer-rulings.md](organizer-rulings.md)).

## 9. Speech recognition (side experiment)

`npm run asr` transcribed the 5 real calls with NVIDIA Nemotron 3.5 Transcribe on OpenRouter ([`eval/runs/2026-11-07T09-59-34-660Z-asr.json`](../../eval/runs/2026-11-07T09-59-34-660Z-asr.json)):

| Call | WER | CER | Latency |
|---|---|---|---|
| p4-ru-001 | 18.3% | 9.8% | 9.9 s |
| p4-ru-005 | 29.8% | 18.2% | 16.7 s |
| p4-ru-002 | 41.0% | 31.0% | 17.6 s |
| p4-ru-004 | 44.2% | 33.2% | 12.6 s |
| p4-ru-003 | 44.3% | 30.0% | 16.2 s |
| **Mean** | **35.5%** | **24.4%** | **14.6 s** |

Total cost $0.041 for all 5 calls.

**Caveat, read before quoting:** the reference is the organizer transcript, which is itself machine output and includes IVR prompts. These numbers measure agreement between two ASR systems, not accuracy. Five Russian calls are far too few for any claim about Kazakh or English. Nemotron's raw output contained first names that the organizer transcripts mask, so raw ASR text is never committed, only metrics ([LESSONS](../LESSONS.md)). We grade calls on the organizer transcripts.

## 10. eval-v5.x (Saturday evening)

| Version | What changed | Held-out gold (56) | All gold (152) | Blind consensus (185) | Decision |
|---|---|---|---|---|---|
| eval-v4 | rules for N/A, hand-offs, disclosure | 92.9% | 91.4% | 170 | replaced |
| eval-v5.1 | facts first, playbook procedures per criterion, deterministic C7 and C3→C8, 3 samples + majority vote | 94.6% | 96.1% | 179 | replaced |
| eval-v5.2 | rules taken from the blind labels | −2 vs v5.1 | 90.8% | 181 | rejected: held-out dropped |
| **eval-v5.3** | C2 "need" facts (a clarifying question can't be N/A), C4 cap at 15 while a follow-up is open, C5 irritation cues | **96.4%** | 95.4% | **180** | **adopted** |

Rule fixed in advance: held-out and blind must not drop, gross errors stay 7/7 with 0 false positives. The blind set is two independent AI labelers who saw only the checklist and rulings ([`eval/blind/`](../../eval/blind/)). Reports: [v5](../../eval/runs/2026-11-07T15-15-00Z-v5-report.md), [v5.3](../../eval/runs/2026-11-07T16-05-00Z-v53-report.md). Cost ≈ $0.006 per chat (3 calls), chats p50 ≈ 30 s.

## 11. Open issues

- C6 dialog management is now 78.9% strict (94.7% lenient) on gold and the noisiest criterion: two draws differ on 3 of 10 C6 answers.
- The gold set is small (5 KZ, 5 EN dialogs) and was used for tuning. Per-language differences of a few points are within noise.
- C7 is read literally («Пожалуйста. Хорошего дня!» = no). If the experts read it leniently we lose C7 on many chats; `closingAnswer()` flips it.
- Results export: `npm run results -- --group <ID> --push` (`eval/control-run.mjs`, official JSON 1.0, validated).
