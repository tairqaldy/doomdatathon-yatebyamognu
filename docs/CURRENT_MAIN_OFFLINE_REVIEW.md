# Current main offline review

2026-11-08. Pinned main: `15f1835d2b10d83fb74b36d9a278dcacc05af711`. No merge, checkout, paid inference or production edits.

`node eval/fairness/current-main-check.mjs` loads pinned Git objects and executes pure upstream scoring and prompt-building code with model/cache entry points stubbed to throw. Saved result coverage: 65/65; scoring assertions: 11/11, including full score 100.00 with and without N/A. Local gold files match the pinned upstream gold. The existing accuracy harness evaluates all 152 labels across 19 reviewed gold dialogs.

| Saved eval-v5.3 metric | Result |
|---|---:|
| Strict accuracy | 95.39% |
| Lenient accuracy | 98.68% |
| C08 precision / recall | 100% / 100% (7 TP, 0 FP, 0 FN) |
| Score MAE | 3.28 |
| Strict directional false penalty | 2/105 = 1.90% |
| Strict directional false pass | 5/105 = 4.76% |
| N/A mismatches | 0 |

Directional rates count lower/higher answers on non-flag criteria where neither side is N/A; they ignore lenient alternatives. They measure disagreement with known gold, not independently proven unfairness. The metrics recompute scores from answers. They do not establish that cached/displayed totals or deployed flows are correct. They are not an A/B experiment and cannot establish a fairness improvement.

The older audit validator emits raw findings on 55 dialogs: 93 missing-reference findings, 5 evaluator-diagnostic findings and 5 unexpected-criterion findings. **This does not mean 55 invalid dialogs.** Missing references include N/A cases subject to compatibility classification. All five calls have newer C09 answers outside the eight-criterion checklist used here; these must be assessed with the current voice extension contract, not silently dropped or declared hallucinations. The report retains all findings for owner review.

Generated artifacts:

- `eval/runs/current-main-readiness.json`: pinned source, checks, raw findings and paired prompt hashes for 65 dialogs, with no generations. This population manifest is not a paid run selection.
- `eval/runs/current-main-saved.metrics.json`: established accuracy harness output with durable source provenance.

The user approved a $0.50 total paid comparison cap and volunteered as reviewer. No provider key is available, human decisions remain unsubmitted, and no independent human-reviewed unseen set exists locally. Action forms and audio links are in [HUMAN_REVIEW_ACTIONS.md](HUMAN_REVIEW_ACTIONS.md). Actual spend remains $0. The v5.1 citation findings and proposed LF/CRLF patch remain separate, unintegrated artifacts.
