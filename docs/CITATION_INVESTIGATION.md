# Citation investigation and integration handoff

Updated 2026-11-08. Scope: offline replay of saved **eval-v5.1** samples on `audit/na-cache-compatibility`. This is evidence diagnostics, not a new accuracy measurement or human audio review.

## Findings

| Conversation | Diagnostics | From selected samples | From unselected samples |
|---|---:|---:|---:|
| `p4-ru-005` | 4 | 0 | 4 |
| `p4-ru-004` | 13 | 5 | 8 |
| Total | 17 | 5 | 12 |

The 17 diagnostics concern 10 distinct conversation/message anchors. Replaying the three cached samples through the existing vote/derivation code reproduces the stored final answers exactly. All referenced message indices exist. Aggregation retains diagnostics from unselected samples, which explains the four warnings in `p4-ru-005` despite its selected sample having none of those warnings.

The five selected-sample diagnostics in `p4-ru-004` are C02/message 33, C03/78, C04/111, C05/90 and C08/78. Message 90 is a client message; final C05 evidence also contains an operator message. Client context alone is not sufficient proof of an operator action, but its presence in mixed evidence does not itself establish an attribution error. The complete sample/message table is in [citation-investigation.md](../eval/runs/citation-investigation.md); hashes and provenance are in [citation-investigation.json](../eval/runs/citation-investigation.json).

`normalize()` checks the model's original quote, records a mismatch, then replaces the quote with a transcript prefix. The original mismatching strings are absent from the inspected normalized caches. Therefore the now-valid prefixes do not resolve the original warnings, and the available artifacts cannot establish whether each original quote was a paraphrase, wrong attribution or fabrication. No diagnostics were cleared; no scores, answers or N/A decisions were changed. New reports avoid reproducing potentially identifying transcript text.

## Reproducible cache issue

The source fingerprint hashes raw evaluator bytes. Git's LF version resolves **195/195** existing v5.1 sample files; this Windows CRLF checkout resolves **0/195** with the otherwise identical key inputs. Calling the evaluator here could unnecessarily regenerate paid answers.

[cache-lf-fingerprint.patch](../eval/fairness/cache-lf-fingerprint.patch) normalizes CRLF before source hashing. It is a minimal proposed patch, **not applied to `lib/cache.js`**. Tests exercise the patch in an isolated temporary directory, proving LF/CRLF key equivalence without changing production or cache files. The owner should review namespace compatibility and restart long-running processes after any eventual change because fingerprints are memoized.

## Sync with current main

The requested `git pull --rebase --autostash` completed: this branch is up to date with its upstream. Fetch advanced `origin/main` to `7016f07`; main was not merged into this working branch. Main now defaults to **eval-v5.3**, and includes UI, model comparison and other team changes. Read-only inspection found the same raw-byte hashing in main's `lib/cache.js` and the same quote replacement/mismatch pattern in its evaluator. The v5.1 sample counts, replay and historical accuracy must not be presented as v5.3 validation. Before integration, the owner must rebase or merge in an isolated worktree and rerun the checks against the intended evaluator version and data.

## Verification

Executed offline, with no model inference:

```text
node eval/fairness/citation-audit.mjs
node --test eval/fairness/candidate.test.mjs eval/fairness/validation.test.mjs eval/fairness/compatibility.test.mjs eval/fairness/review-cases.test.mjs eval/fairness/citation-audit.test.mjs
npm test
git apply --check eval/fairness/cache-lf-fingerprint.patch
git diff --check
```

Results: **94/94 Node tests; 9/9 scoring tests**. Patch applicability and whitespace checks pass. These checks establish offline behavior, not deployed end-to-end readiness.

## Outstanding decisions

- A human must listen to `p4-ru-002`, `p4-ru-005` and `p4-ru-004`, recording reviewer identity, timestamp, exact wording and score impact. Previous byte-range checks established audio availability, not what was spoken. C01 stays unchanged pending review.
- QA/security must explicitly accept or reject unsupported legacy `c08=no`. The approval record remains pending. Inspection of merged PR #28's body, comments and reviews found no explicit decision; merge status alone is not approval.
- Controlled baseline/candidate inference has **not run**. Neither provider key nor `.env` was available at the last prerequisite check. A model information URL does not grant account access. Actual spend for this investigation is **$0**. A conservative proposed A/B cap is $0.50; the reported overall OpenAI $20 and ASR $9 pools are not authorization to exhaust either pool. Confirm the run cap and supply credentials through local environment configuration before any paid run.
- The existing v5.1 figures (96.05% strict, 98.68% lenient, C08 recall 7/7, score MAE 3.41) describe a previously saved team run, not a new controlled fairness comparison. The 19 gold conversations are a known development set. An independent human-reviewed RU/KZ/EN set remains required.
- Do not deploy the candidate or mark uncertain results human-confirmed. Preserve original model outputs privately in future controlled runs so quote diagnostics remain investigable; retain provenance and use redacted public artifacts.

Only diagnostics, tests, generated investigation reports and handoff documents were changed. Frontend, backend, production evaluator/cache implementation, source dataset, gold and paid cache entries were not edited. No commit, push, PR, merge or deployment was performed for this continuation.
