# Gold set (hand-labeled reference answers)

What a careful human QA reviewer would answer for each criterion, used by `eval/accuracy.ts` to measure any evaluator (mock today, LLM next). Issue #3.

**Status: all 19 files are `reviewed`** (2026-11-07). Drafted by an agent, then checked label by label by a human reviewer, who accepted every answer as drafted. New files start as `draft` and only count once a human flips them to `reviewed`; use `--reviewed-only` for numbers you quote.

## Coverage (19 DEV dialogs, checklist `freedom-chat` v1)
| Language | Dialogs |
|---|---|
| RU | p1-ru-003, 006, 009, 012, 018, 022, 025, 029 · voice call p4-ru-001 |
| KZ | p1-kz-003, 008, 011, 013, 015 |
| EN | p1-en-006, 009, 013, 014, 015 |

Cases covered (see `tags` in each file): identification done vs violated, confidential disclosure, off-company paid offers, insult, missing greeting/introduction, repeated questions, wrong or partial answers, connection lost, client left, operator closed the chat, multi-question dialogs, a noisy voice transcript.

## File format: `eval/gold/<conversation_id>.json`
```json
{
  "conversation_id": "p1-ru-009", "language": "RU", "channel": "agent chat",
  "checklist_id": "freedom-chat", "checklist_version": 1,
  "status": "draft",                 // → "reviewed" once a human has checked every label
  "labeled_by": "lane-c/claude", "reviewed_by": null,
  "tags": ["identification-violation", "confidential-disclosure"],
  "labels": {
    "c03": {
      "answer": "no",                // "yes" | "no" | "na" | scale step (number)
      "evidence": [11, 12, 13],      // 0-based transcript turn indices that justify it (for a missed action: where it was expected)
      "also_acceptable": [],         // other answers a reasonable reviewer could defend (borderline cases)
      "note": "Disclosed an account restriction before any identity check…"
    }
  }
}
```
All 8 criteria are labeled in every file. Evidence indices are validated against the transcript when the files are generated.

## How to review (≈2 min per dialog)
1. Open the dialog in the prototype (`python3 -m http.server 8080` → http://localhost:8080/prototype/) or print it:
   `python3 -c "import json;r={x['conversation_id']:x for x in json.load(open('data/datasets/DEV.json'))['data']['records']};[print(i,m['speaker'],m['text']) for i,m in enumerate(r['p1-ru-009']['transcript'])]"`
2. For each criterion, check `answer` against `docs/case/checklist.md`. Fix it if you disagree; move a defensible alternative into `also_acceptable`.
3. Set `"status": "reviewed"` and `"reviewed_by": "<lane>/<initials or role>"`. Commit as `data(c): review gold <id>`.
4. Labels that most need a second opinion: c02 on clear requests (`na` vs `yes`), c07 after a lost connection (`na` vs `no`), c08 on account disclosure without identification (p1-ru-009, p1-kz-015, p1-en-014).

## Metrics (`eval/accuracy.ts`)
| Metric | Definition |
|---|---|
| strict agreement | model answer == gold answer |
| lenient agreement | model answer ∈ gold answer ∪ `also_acceptable` |
| scale ±1 step | scale answer at most one step from gold (c04, c06) |
| N/A precision / recall | over criteria that allow N/A |
| gross-error recall / precision / FP | over `flag` criteria (c08) |
| evidence hit rate | at least one cited turn (or range) overlaps the gold evidence turns |
| invalid refs | cited turn index outside the transcript, or quote not found in that turn |
| total MAE | mean absolute difference between totals computed from model answers and from gold answers, same scoring engine |

```bash
node eval/run-mock.ts                                   # baseline run → eval/runs/mock-baseline.json
node eval/accuracy.ts eval/runs/mock-baseline.json      # table; add --verbose for every disagreement
node eval/accuracy.ts <run.json> --reviewed-only --json eval/runs/<name>.metrics.json
```
Any evaluator can be measured as long as it writes `Evaluation[]` (docs/CONTRACTS.md §3), or `{ meta, evaluations }`.
