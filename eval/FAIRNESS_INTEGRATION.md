# Fairness integration result

Working branch: `audit/na-cache-compatibility`. Reviewed current main and existing audit history; production evaluator is v5.3. No commit, push, merge, deployment or paid call in this task.

## Implementation

- `CQA_TRANSCRIPT_FAIRNESS=1` enables validation after text/audio evaluation, including cache hits. Default off. `lib/evaluator.js` and `lib/cache.js` are unchanged: validation does not invalidate generation cache keys.
- `/api/validate-evaluation` revalidates saved results without calling a model. The same validation function drives the offline replay. No source verdict, transcript, evidence or paid cache is rewritten.
- Call checklist C09 is recognized; its cited messages must exist and include operator evidence. Missing audio model provenance requires review. Changing the checklist still invalidates old validation assumptions; unknown criteria are not silently dropped.
- Human audio observations remain recorded, uncertain and provisional for all three C01 cases. The current **call checklist already permits C01 N/A for a missing beginning**; observations were recorded against the chat checklist, so application to the call checklist requires a separate QA decision. No automatic N/A/Yes is applied. Legacy C08 exception remains unapproved and blocks confirmation when needed.
- Admin card shows a preliminary AI score, validation status, criterion warnings, existing AI verdict/explanation/evidence, and an empty human-confirmed score. Failure to validate leaves the score provisional. Disabled flag retains the existing flow. New dialogs without a source-bound probe require review; no runtime Python dependency or new greeting heuristic was introduced.
- Local Windows dev-server dynamic imports now use file URLs; previously API requests failed with `ERR_UNSUPPORTED_ESM_URL_SCHEME`.

## Current saved DEV replay

| Status | Count |
|---|---:|
| valid | 57 |
| warning | 1 |
| needs_review | 7 |
| invalid | 0 |

Source: `eval/runs/fairness-final-replay.json`, all 65 saved v5.3 evaluations. **0 score/verdict/transcript/evidence changes, 0 critical regressions; all 8 saved DEV C08 flags preserved.** Publication readiness is not independent score correctness or human verification.

Review cases: `p1-kz-003`, `p1-kz-007`, `p4-ru-003`, `p4-ru-002`, `p4-ru-001`, `p4-ru-005`, `p4-ru-004`. Warning-only: `p1-ru-009` (C06 context reference).

There are 11 evidence findings: five aggregate evaluator-diagnostic findings, three operator-speaker mismatches (C05 in `p1-kz-007`, `p4-ru-005`, `p4-ru-004`), and three legacy C06 context warnings. Mixed evidence is accepted when operator evidence exists; client-only proof is not upgraded. No invalid current message indices/normalized quotes were found in the replay, but this does not clear original quote diagnostics.

Current quote diagnostics are **3 in p4-ru-005** (sample 1, C02/57, C04/43, C04/66; selected) and **9 in p4-ru-004** (sample 2 C03/78; sample 3 C02/33, C03/70, C03/78, C04/89, C04/111, C05/90, C06/95, C08/78; unselected). `eval/runs/fairness-current-citations.json` reproduces the saved text answers from existing samples. The normalized caches discarded original offending strings, so exact quote repair is not possible from these artifacts. Earlier 4/13 figures describe v5.1, not current v5.3. Across all 65 results, 17 quote diagnostics remain visible.

Stored DEV totals use the official eight text criteria; the call display additionally includes C09. Five call totals therefore differ by scope, not because validation changed arithmetic. The replay records both scopes explicitly.

## Tests actually executed

- `npm test`: **12/12**.
- `node --test 'eval/fairness/*.test.mjs'`: **113/113**.
- Python `eval/transcript_guard.py --self-test`: **16/16** using the installed Python executable (Windows alias is unavailable).
- Python `-I eval/fairness/test_guard.py`: **8/8** unittest methods, including adversarial subtests.
- Local HTTP: `/api/health` reports enabled; saved `p4-ru-002` validation returns HTTP 200, nine criteria, `needs_review`, confirmed total null. Server external fetch was disabled during this smoke check.
- Syntax checks and `git diff --check` pass. Browser CDP timed out, so a full rendered UI walkthrough/screenshot is **not claimed**; rendering functions and API integration have automated tests.

## Cache and controlled comparison

195/195 current text samples resolve with canonical Git LF fingerprint `7b97e37ca1c1`; Windows raw-CRLF fingerprint resolves 0/195. The minimal LF-normalization patch remains an un-applied review artifact. Validation uses saved results directly and never repairs this by regenerating. Before any paid evaluation on Windows, resolve this known generation-cache issue explicitly.

`eval/runs/fairness-final-v51-plan.json` freezes v5.1 baseline/candidate message/schema hashes on the known 19 gold dialogs, three samples per arm (114 initial generations; bounded repair maximum 228, transport retries separate), with the previously authorized **$0.50** cap. Effective provider settings remain unfilled; no inference execution was performed. Current saved v5.3 results are not a controlled v5.1 baseline. This development set is not an independent unseen test.

## Remaining blockers

Authorized final C01 decisions; separate QA/security decision for legacy C08; handling the remaining evidence findings without fabricating lost quotes; runtime source-bound probes for new transcripts; LF/CRLF cache fix review; independent human-reviewed RU/KZ/EN data and a properly budgeted controlled model run; rendered browser verification and owner review before enabling the flag. Production deployment remains prohibited.

Changed implementation: `lib/fairness.js`, `api/{evaluate,health,validate-evaluation}.js`, `admin/{card,store,fairness}.js`, fairness candidate/human-review/policy/comparison scripts, new replay/current-citation/integration tests and their run artifacts, `scripts/dev-server.mjs`, `.env.example`, `vercel.json`, and additive contract/team logs. Official checklists, DEV/gold datasets, transcripts and paid caches are unchanged.
