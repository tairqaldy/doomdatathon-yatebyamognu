# How to submit results (CQA_Student_Guide_Appendix_Results.pdf, "Формат JSON 1.0")

> Source: organizers' appendix PDF (3 pages), transcribed 2026-11-07. Official text overrides our notes. Our exporter: `eval/export-results.mjs`, validator: `eval/validate-results.mjs`, one-command control run: `eval/control-run.mjs` (see bottom).

## 10 control chats · 1 hour
23 hours after the start we get the control set. Before stop code (24 h after the start) all 10 chats must be processed and the results pushed to Git.

## 01 Folders in the repo root
```
results/
  dev/
    results.json     # DEV results: 60 chats and 5 calls
  prod/
    results.json     # the 10 control chats (access announced one hour before stop code)
```

## 02 What must reach Git
- **Get the set:** use the organizers' API and keep the original `conversation_id`.
- **Evaluate:** export the system's results for all eight checklist criteria.
- **Check the JSON:** one record per dialog, no gaps, no duplicate IDs.
- **Commit and push:** both files must be in the public repository (link sent to the organizers in advance) before stop code.
- The hour covers fetching, evaluating, checking and pushing. A local file or a commit without push is not enough.

## JSON shape (one object per file; `results` = every dialog of the set)
```json
{
  "schema_version": "1.0",
  "team_name": "Название команды",
  "model": {"mode": "local", "name": "Название модели"},
  "results": [
    {
      "conversation_id": "demo-001",
      "status": "ok",
      "criteria": [
        {"criterion_id": "contact", "value": true, "rationale": "Оператор поздоровался и представился.", "evidence_turns": [4]},
        {"criterion_id": "discovery", "value": null, "rationale": "Клиент сразу ясно изложил вопрос.", "evidence_turns": [1]},
        {"criterion_id": "identification", "value": null, "rationale": "Общий вопрос не требует идентификации.", "evidence_turns": [1]},
        {"criterion_id": "consultation", "value": 15, "rationale": "Основной вопрос решён, упущена деталь.", "evidence_turns": [5, 6]},
        {"criterion_id": "empathy", "value": true, "rationale": "Вежливо признал неудобство клиента.", "evidence_turns": [4, 5]},
        {"criterion_id": "dialogue", "value": 7, "rationale": "Есть повтор, но ход диалога понятен.", "evidence_turns": [5, 6]},
        {"criterion_id": "closure", "value": true, "rationale": "Предложил дальнейшую помощь и попрощался.", "evidence_turns": [8]},
        {"criterion_id": "critical", "value": false, "rationale": "Грубых нарушений в репликах нет.", "evidence_turns": [4, 5, 6, 8]}
      ],
      "score": {"final_score": 85.38, "critical_flag": false}
    }
  ]
}
```
The example is invented. Replace `demo-001` with the original ID. The control file has the same structure; the set is defined by the folder (dev / prod). **Do not rename fields, criterion codes or value types.**

## Filling rules (use the current checklist, grade the operator)
| criterion_id · criterion | value | weight |
|---|---|---|
| contact · Установление контакта | true / false | 10 |
| discovery · Выявление потребности | true / false / null | 15 |
| identification · Идентификация | true / false / null | 20 |
| consultation · Корректность и полнота | 0, 5, 10, 15, 20 / null | 20 |
| empathy · Эмпатия | true / false | 15 |
| dialogue · Ведение, скорость, грамотность | 0, 4, 7, 10 | 15 |
| closure · Завершение | true / false / null | 5 |
| critical · Грубые ошибки | true / false | – |

- **value:** true = «Да», false = «Нет», null = N/A. A number is the criterion's scale step before weighting (dialogue = 7 means 7 of 10 at weight 15). `status = "ok"` needs all 8 criteria, each exactly once.
- **rationale and evidence_turns:** short justification plus the supporting turn numbers. **Numbering starts at 1 over the original transcript array, including client, bot and system events.** Don't renumber only the operator's turns.
- **final_score:** 0–100, rounded to two decimals. For N/A, drop the criterion and redistribute its weight proportionally. N/A is not zero and not a processing error.
- **critical_flag:** equals the value of `critical`. true = a gross violation was found. Reported separately; it does not zero the total.
- **model:** the model actually used in `name`; `mode` = `local`, `external_api` or `hybrid`. Several models → list their names in `name`.

### If a dialog could not be evaluated
Keep its ID, `status = "error"`, empty `criteria`, `score = null`, reason in `error`. Don't hide it and don't replace the error with a zero score.
```json
{"conversation_id": "demo-002", "status": "error", "criteria": [], "score": null, "error": "Не удалось получить ответ модели."}
```

### Before push
UTF-8 JSON, no comments, no trailing commas. IDs exactly as in the API. **prod: exactly 10 records, errors included.** Results in the repository before stop code.

## Our pipeline (lane C, #22)
```bash
# DEV file (re-uses cached answers; no new model calls unless something is missing)
node eval/control-run.mjs --group DEV --out results/dev/results.json --expect 65
# Control set at T+23h: fetch → evaluate → retry failures → export → validate → commit + push
node eval/control-run.mjs --group <CONTROL_GROUP_ID> --out results/prod/results.json --expect 10 --push
# Check any file on its own
node eval/validate-results.mjs results/prod/results.json --dataset data/datasets/<CONTROL_GROUP_ID>.json --expect 10
```
Mapping from our checklist ids: c01 contact · c02 discovery · c03 identification · c04 consultation · c05 empathy · c06 dialogue · c07 closure · c08 critical. Our turn indices are 0-based, so the exporter adds 1.
