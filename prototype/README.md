# prototype/: clickable CQA prototype (no build)

The whole defense flow on real DEV data, using the shared design system in `design/`.

```bash
python3 -m http.server 8080        # from the repo root
# open http://localhost:8080/prototype/
```
(or the `prototype` entry in `.claude/launch.json`). Data is fetched from `../data/`, so it must be served over http, not opened as a file.

## What you can click (= the 5-minute defense script)
| Step | Where |
|---|---|
| Interface + choose a dialog, KPIs, "where points are lost" chart, filters | **Диалоги** |
| Score ring, sections, per-criterion answer / points / effective weight / explanation | dialog card |
| Evidence chip → scrolls to + flashes the message; for calls also seeks the audio player | dialog card |
| N/A with the reason; missed action → "проверенный участок" range | dialog card |
| Appeal: pick criterion, comment, see fragment → saved | **Оспорить** |
| Reviewer: switch role (bottom-left) → **Проверить** → confirm or change + reason → live preview of new total → saved; card shows original → appeal → decision → final with delta | dialog card / **Апелляции** |
| Replace a criterion: edit title/type/weight/N/A/scale, add/remove/reorder → **Сохранить vN и применить** → all dialogs re-scored | **Чек-лист** |
| Tokens + components gallery | **Дизайн-система** |

State (checklist versions, appeals, role) is kept in `localStorage`. Reset: `CQA.reset()` in the console.

## Files
- `scoring.js`: **the real scoring rules** (pure, no DOM). Lane C ports it to `app/src/scoring.ts`. `selfTest()` runs 7 rule checks on load (console table).
- `mock-evaluator.js`: **MOCK** keyword heuristics in place of the LLM. Same output shape as CONTRACTS §3. Replaced criteria get a clearly labeled placeholder answer. Never ship this.
- `app.js`: router + views (dialogs, card, appeal/review drawers, checklist editor, gallery).
- `prototype.css`: layout glue only. Reusable styles go into `design/components.css`.

## Rules
- Lane A owns this folder. The real TS app copies patterns from here; don't fork the design system.
- When you change a CSS/JS file, bump the `?v=` query in `index.html` (and the imports in `app.js`) so teammates don't see a cached version.
