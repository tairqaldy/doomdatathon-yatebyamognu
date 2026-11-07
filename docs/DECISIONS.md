# DECISIONS

One line per decision. Newest on top. `date · decision · why · who`

- 2026-11-07 · TypeScript + Tailwind allowed for frontend; build must output static files in `app/dist/` · organizers confirmed; keeps Dynamics 365 web-resource path · team
- 2026-11-07 · Scoring arithmetic lives in deterministic `app/src/scoring.ts`, LLM only picks answers + evidence · reproducible totals, matches checklist rules exactly, cheap to re-score after appeals · tair
- 2026-11-07 · Checklist is JSON data (`data/checklists/`), never hard-coded · live "replace one criterion" test at defense · tair
- 2026-11-07 · Coordination via GitHub Issues + `docs/STATUS.md` + `docs/CONTRACTS.md`; no AI attribution in commits · 4 people × multiple agents need one shared brain · tair
