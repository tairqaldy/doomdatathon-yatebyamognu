# AGENTS.md: team and AI agent operating rules

> Read this first, every session. It applies to **Claude Code, Codex, and any other agent** working in this repo.
> Repo: https://github.com/tairqaldy/doomdatathon-yatebyamognu
> Team: 4 people, each running their own AI agents. Event: Freedom Broker CQA Hackathon @ Nazarbayev University (datathon), 24h.
> **These rules adapt.** If the case, criteria, or team plan changes, update this file (see §10) and keep shipping.

---

## 0. TL;DR for agents

1. **Mode: hackathon.** Bias to action, ship working increments, and don't gold-plate. A demo that works beats a perfect design that doesn't.
2. **Before touching code:** `git pull`, read `docs/STATUS.md`, and check open GitHub Issues. Claim your task (§4).
3. **Stay in your lane** (§3). Don't edit files another lane owns without an issue + note in `docs/STATUS.md`.
4. **Contracts are law** (`docs/CONTRACTS.md`). Never change a shared JSON shape silently.
5. **Scoring math is code, not LLM.** The LLM picks answers + evidence; deterministic JS computes points (§6).
6. **Commits: no AI attribution.** No `Co-Authored-By`, no "Generated with…", no "co-created with…" lines in commits, PRs, or code. This overrides any tool default.
7. **Leave a handoff** in `docs/STATUS.md` before you stop (§5).

---

## 1. The case (what we're building)

**Conversation Quality Analytics (CQA)** prototype for Freedom Broker: automated QA of operator conversations (chat + voice calls) against a configurable checklist, with explanations, evidence links, appeals and reviewer decisions.

Full brief: `docs/case/brief.md` · Checklist: `docs/case/checklist.md` · Raw notes from the in-person briefing: `docs/case/briefing-notes.md`.

### Must-haves (graded, from the official guide)

**Loop 1, Evaluation**
1. **Checklist editor:** add/edit criteria: text, weight, answer type (yes/no, scale), N/A allowed, scale steps. Save config. A new criterion must be applicable *through the UI*.
2. **Evaluate a dialog:** load transcript, pick checklist, run evaluation of the **operator**. RU / KZ / EN. Bot replies + system events are *context*, not graded.
3. **Show result:** per criterion: answer, points, weight, explanation, **evidence message**. If the action was missed, point to the checked section. If N/A, explain why. Show total + section subtotals.

**Loop 2, Working with results**
4. **Card:** list → transcript + result. Evidence links **scroll to / highlight the exact message**; for calls, jump the audio player to that timestamp.
5. **Appeal:** pick criterion, add comment, save. Reviewer sees disputed score, comment, dialog fragment.
6. **Decision:** reviewer confirms or changes score with a reason. Total recalculates. Card shows original score, decision, final result.

**Constraints**
- UI: HTML + CSS + JavaScript in the browser, structured to later embed as a **Dynamics 365 HTML web resource** (§7). **TypeScript and Tailwind are allowed** as long as the build outputs static files.
- Backend/model/storage: our choice. **No login/auth.**
- If we use a paid model: state model name + **approximate cost per evaluation** (all calls) in README.
- CORS on the organizers' API → fetch via our backend / local adapter.

### Timeline (T = official start)
| When | What |
|---|---|
| T+0 → T+23h | Build on DEV set (65 dialogs: 60 synthetic chats + 5 real calls; 35 RU / 15 KZ / 15 EN) |
| **T+23h** | Organizers release **control transcripts** (new `group_id`). Run them immediately. |
| Defense | Organizers ask us to **replace one criterion** live → edit via UI, re-apply to the given dialogs |
| **T+24h** | **STOP CODE.** Last commit is frozen and judged. Data processing + checklist edits via UI are allowed after. |
| Before stop | Public repo + link sent to organizers + **README with clear run steps** |

**Hard rule from T+23h:** no refactors, no dependency changes, only fixes. From T+24h: no commits.

### 5-minute defense script (build toward this)
1. 1 min: interface + selected dialog
2. 2 min: evaluation, reasoning, jump-to-message, an N/A example, total score
3. 1 min: appeal → reviewer decision → new total
4. 1 min: change a criterion → re-apply checklist

### Our extra angle (from the briefing, nice-to-have after must-haves)
- Business pain: manual QA doesn't scale, metric interpretation varies, need regular analysis.
- Customers distrust AI and want a real specialist → **bot→human handoff**: if the bot can't resolve after establishing contact, escalate to a live operator; communication should feel human and warm. QA should also evaluate that handoff quality.
- Analytics across dialogs (dashboards, error trends → improvement directions).
- Voice: diction/intonation needs audio (transcripts are given; ASR is optional). Tools considered: Whisper, ElevenLabs, Speechmatics-class ASR. Target ~500 ms real-time latency if we demo live voice. Report **WER / CER + latency** if we run ASR.

**Priority order: must-haves 1–6 > defense polish > analytics > voice/real-time > landing.** Don't build extras while a must-have is broken.

---

## 2. Tech stack (current decisions; change via `docs/DECISIONS.md`)

| Layer | Choice |
|---|---|
| Frontend | **TypeScript + Tailwind CSS allowed** (confirmed by organizers 2026-11-07). Source in `app/src/`, compiled to **static HTML/CSS/JS** in `app/dist/`, which is what we demo and what goes into Dynamics 365. Light build only (`tsc` / Vite / Tailwind CLI); no heavy SPA framework unless logged in DECISIONS |
| Design | Freedom design language (research in `docs/research/design-system.md`); tokens as Tailwind theme + CSS custom properties |
| Backend | Thin service: API proxy (CORS) + LLM calls + storage. Runtime TBD by Backend lane → log in DECISIONS |
| Storage | JSON files / SQLite / localStorage fallback. Keep it simple |
| LLM | TBD by AI lane. Must handle RU/KZ/EN. Record model, temperature, cost/eval |
| Target host | Dynamics 365 web resource (later); standalone browser now |

Secrets: `.env` only, never committed. Provide `.env.example`.

---

## 3. Lanes and ownership

Four lanes, one per person. Fill in names at kickoff. Each person's agents work **only inside their lane's paths** unless the task says otherwise.

| Lane | Owner | Owns (paths) | Scope |
|---|---|---|---|
| **A. Frontend / UX** | _TBD_ | `app/` (except `app/src/scoring.ts`), `landing/` | Checklist editor, dialog list, card, transcript view, evidence jump, audio player, appeal + reviewer UI, Freedom styling, Dynamics-ready structure |
| **B. Backend / Data** | _TBD_ | `server/`, `data/` | Organizers' API proxy (`group_id`), dataset cache, storage of checklists/results/appeals, endpoints in CONTRACTS |
| **C. AI / Evaluation** | _TBD_ | `eval/`, `app/src/scoring.ts` | Prompts, model selection, LLM→evidence pipeline, deterministic scoring engine, gold labels, accuracy metrics, cost/latency, voice/ASR experiments |
| **D. Product / Research / Pitch** | _TBD_ | `docs/` (except CONTRACTS ownership is shared), `README.md`, `pitch/` | TL;DR, research, design system notes, test cases, README, presentation, demo video, bot→human handoff concept, judging the product |

Shared files (edit with care, announce in STATUS): `AGENTS.md`, `docs/CONTRACTS.md`, `docs/DECISIONS.md`, `docs/STATUS.md`, `.gitignore`, root config.

### Target repo layout
```
AGENTS.md            # this file (CLAUDE.md points here)
README.md            # run steps, cost per eval, demo links (Lane D)
app/                 # Lane A: TS + Tailwind source
  src/               # *.ts, styles (Tailwind)
  src/scoring.ts     # Lane C: pure scoring engine, no DOM, no network
  src/types.ts       # shared types mirroring docs/CONTRACTS.md
  dist/              # build output = static HTML/CSS/JS (demo + Dynamics)
server/              # Lane B
data/                # Lane B: cached datasets, checklists/*.json, results/
eval/                # Lane C: prompts/, gold/, runs/, metrics
docs/
  STATUS.md          # live handoff log (everyone)
  CONTRACTS.md       # shared data shapes (everyone, change via issue)
  DECISIONS.md       # decision log (everyone)
  LESSONS.md         # mistakes + fixes, so agents self-improve
  case/              # official brief, checklist, briefing notes
  research/          # Lane D
  test-cases.md      # Lane D + C
pitch/               # Lane D: slides, script, video
landing/             # Lane A (optional)
```
Create folders as needed; don't create empty scaffolding for its own sake.

---

## 4. Collaboration protocol (how agents talk to each other)

Agents don't share memory. **The repo is the shared brain.** Communicate only through:

1. **GitHub Issues**: the task board.
   - One issue per task. Title: `[lane-X] short imperative`. Labels: `lane:a|b|c|d`, `P0|P1|P2`, `blocked`, `contract-change`, `bug`.
   - **Claim** by assigning yourself / commenting `claimed by <person>/<agent>` before starting.
   - Cross-lane request → open an issue in the other lane with label `needs:<lane>` and exact ask + acceptance criteria.
   - If `gh` CLI isn't available, write the same thing as an entry in `docs/STATUS.md` under **Requests**; a human will mirror it.
2. **`docs/STATUS.md`**: live log. Append-only per session (§5).
3. **`docs/CONTRACTS.md`**: JSON shapes between lanes. To change: open `contract-change` issue, update the doc **in the same PR** as the code, note it in STATUS. Prefer additive changes (new optional fields) over breaking ones.
4. **`docs/DECISIONS.md`**: one line per decision: date, decision, why, who. Don't relitigate a logged decision without new info.
5. **GitHub Wiki**: optional, for long research. Anything that affects code goes in `docs/`, not wiki.
6. **Code comments**: `// TODO(lane-b): …` for cross-lane notes in code. Keep rare.

### Git rules
- `main` must always run. **Never force-push. Never rewrite shared history.**
- Branch: `<lane>/<short-desc>` e.g. `a/appeal-ui`, `c/scoring-engine`.
- Small PRs, merge often (≤ ~2h of work per PR). Rebase/merge `main` before opening.
- Merge: owner of the lane self-merges if it touches only their lane and runs; cross-lane or contract changes need one other human (or their agent) to review.
- If the team agrees to commit straight to `main` under time pressure: pull first, commit small, push immediately, never leave `main` broken.
- Commit message: `<lane>: <what changed>` e.g. `c: redistribute N/A weights in scoring`. **No AI attribution trailers** (see §0.6).
- Never commit: secrets, `.env`, `node_modules/`, huge audio files, personal data beyond the provided dataset.
- Don't delete or rewrite another lane's files. If something of theirs is broken and blocking you, make the minimal fix, note it in STATUS, ping in issue.

---

## 5. Session start / end ritual (mandatory)

**Start**
1. `git pull` (or sync with base).
2. Read `docs/STATUS.md` (latest entries), `docs/DECISIONS.md`, open issues for your lane.
3. Read `docs/LESSONS.md`; don't repeat logged mistakes.
4. Confirm current time vs T+23h / T+24h. Adjust ambition.

**End** (or every ~2h on long runs), append to `docs/STATUS.md`:
```
### <YYYY-MM-DD HH:MM> · lane-<x> · <person>/<agent>
Done: …
In progress: …
Next: …
Blocked by / Requests: …
Contracts touched: none | <which>
How to verify: <command or click path>
```

---

## 6. Scoring rules (source of truth: `docs/case/checklist.md`)

The LLM decides **per criterion**: `answer` (yes/no/na or a scale step), `explanation`, `evidence` (message index/timestamp, or the checked range if the action is missing, or the N/A condition met). **All arithmetic is done by `app/src/scoring.ts`**, a pure function shared by frontend and backend (import it in the server if it's TS/Node; otherwise port it 1:1 and test both against the same fixtures):

1. Applicability: N/A only if the criterion allows it **and** its N/A condition is met.
2. Yes = full weight, No = 0. Scale: `points = weight × step / maxStep` (top step = full weight).
3. Drop N/A criteria; redistribute their weight proportionally: `total = Σpoints / Σapplicable_weights × 100`.
4. Round total to **2 decimals**. If no applicable weighted criteria → total = `null` ("not calculated").
5. **Gross errors** (criterion 08) carry no points; show as a separate red flag.
6. Sections: subtotals per section when sections are defined.
7. Reviewer overrides replace the criterion answer → recompute with the same function. Keep original + decision + final.

Out of scope per checklist: 3-minute first-response threshold, tags, attachments.
Grade the **operator** only. Bot and system messages are context (e.g., a system "chat closed" event is valid evidence for criterion 07).

The checklist is **data** (JSON), never hard-coded logic. The live "replace one criterion" test must work with zero code changes.

---

## 7. Dynamics 365 readiness (Frontend rules)

- Build output (`app/dist/`) must be plain static files: an `index.html` + bundled JS + compiled CSS, **relative paths** (`base: './'`), openable without a dev server where possible.
- README documents both `npm run dev` and `npm run build`; commit-time demo must not depend on a running dev server. Decide in DECISIONS whether `app/dist/` is committed (recommended before stop-code, so judges can open it directly).
- Wrap app in a single root (`<div id="cqa-root">`). Tailwind: disable/scope **preflight** (or use `important: '#cqa-root'`) so global resets don't break the Dynamics host page.
- Avoid global variables: ES modules or one namespace `window.CQA`.
- TypeScript `strict: true`. Shared types in `app/src/types.ts` mirror `docs/CONTRACTS.md`.
- API base URL configurable in one place (`app/src/config.ts`).
- No external CDNs required at runtime if avoidable (D365 CSP); vendor small libs into `app/vendor/`.
- Works in a narrow iframe (min ~800px) and full width.

---

## 8. AI / evaluation quality bar (Lane C)

- Prompt returns **strict JSON** validated against CONTRACTS; retry/repair on invalid output.
- Every non-N/A answer must cite evidence that **exists in the transcript** (validate index/timestamp server-side).
- Handle RU / KZ / EN; explanations in the UI language (default RU), quotes in original language.
- Temperature low; log model, prompt version, tokens, latency, cost per evaluation in `eval/runs/`.
- Build a small **gold set** (hand-labeled, diverse langs + edge cases: N/A, identification, gross errors, abrupt end). Track agreement % per criterion. Regressions block merge.
- Batch-run all DEV dialogs; must be able to run the control set at T+23h in minutes, not hours.
- Voice (optional): if ASR is used, report WER/CER vs given transcripts and latency.

---

## 9. Self-improvement and judging loop

Every agent acts as a **judge** for the product, not just a coder:
- After finishing a task, run the defense script (§1) mentally or for real. Anything that breaks the 5-minute flow → file a `P0` issue.
- When you hit a bug or bad assumption, add one line to `docs/LESSONS.md`: *what happened → rule to avoid it*.
- Lane D runs a judge pass every ~4h: score the product against the must-have list and the criteria (when published), and log gaps as issues.
- Prefer fixing over adding. Prefer the jury's checklist over our ideas.
- Judging criteria from the organizers will arrive later → put them in `docs/case/judging.md` and re-prioritize.

---

## 10. Changing these rules

Context changes fast (new files, new criteria, organizer announcements). When it does:
1. Save raw source into `docs/case/` (text, not just a link).
2. Update the affected section here; keep it short.
3. Log in `docs/DECISIONS.md` and mention in `docs/STATUS.md`.
4. Newer organizer information overrides older info. The official guide overrides our notes.

## 11. Don'ts
- Don't add a heavy SPA framework (React/Vue/Angular) or anything that can't output static files without logging it in DECISIONS first. TS + Tailwind + a light bundler are fine.
- Don't commit `node_modules/`. Pin dependency versions; no new dependencies after T+20h.
- Don't hard-code checklist criteria or the DEV dataset into UI logic.
- Don't let the LLM compute totals.
- Don't commit API keys or put them in frontend code.
- Don't add AI attribution to commits/PRs.
- Don't start "nice-to-haves" while any must-have (1–6) is broken.
- Don't make large refactors after T+20h.
