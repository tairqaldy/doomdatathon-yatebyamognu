# STATUS: live handoff log

Append a new entry at the **top** at the end of each session (format in AGENTS.md §5). Don't edit other people's entries.

## Requests (cross-lane asks when GitHub Issues aren't available)
- _none yet_

## Log

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
