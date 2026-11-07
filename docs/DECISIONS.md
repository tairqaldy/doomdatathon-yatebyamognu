# DECISIONS

One line per decision. Newest on top. `date · decision · why · who`

- 2026-11-07 · Merges into main use `--no-ff` merge commits (no squash); agents self-merge after `scripts/check.sh` + the AGENTS.md §4.4 checklist · keep a rich, readable history and avoid waiting on humans · tair
- 2026-11-07 · Design system = fbroker.kz tokens (Tailwind class names kept) + CQA additions (ink colours, app type scale); Inter stands in for licensed CoFo Sans · brand fit for the jury, AA contrast, no font licensing risk · tair
- 2026-11-07 · Prototype first (no build, `prototype/`), TS app ports from it · demo exists early and UX gets validated before the stack is ready · tair
- 2026-11-07 · Every tool/model/skill/approach is logged in `docs/TOOLING.md` · reproducible setups across 4 laptops · tair

- 2026-11-07 · TypeScript + Tailwind allowed for frontend; build must output static files in `app/dist/` · organizers confirmed; keeps Dynamics 365 web-resource path · team
- 2026-11-07 · Scoring arithmetic lives in deterministic `app/src/scoring.ts`, LLM only picks answers + evidence · reproducible totals, matches checklist rules exactly, cheap to re-score after appeals · tair
- 2026-11-07 · Checklist is JSON data (`data/checklists/`), never hard-coded · live "replace one criterion" test at defense · tair
- 2026-11-07 · Coordination via GitHub Issues + `docs/STATUS.md` + `docs/CONTRACTS.md`; no AI attribution in commits · 4 people × multiple agents need one shared brain · tair
