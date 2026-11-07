# AGENTS.md: team and AI agent operating rules

> Read this first, every session. It applies to **Claude Code, Codex, and any other agent** working in this repo.
> Repo: https://github.com/tairqaldy/doomdatathon-yatebyamognu
> Team: 4 people, each running their own AI agents. Event: Freedom Broker CQA Hackathon @ Nazarbayev University (datathon), 24h.
> **These rules adapt.** If the case, criteria, or team plan changes, update this file (see §10) and keep shipping.

---

## 0. TL;DR for agents

1. **Mode: hackathon.** Bias to action, ship working increments, and don't gold-plate. A demo that works beats a perfect design that doesn't.
2. **Every prompt starts with sync + review:** `git pull --rebase --autostash`, then read what changed (new commits, issues, `docs/STATUS.md`). No exceptions, even mid-task (§5).
3. **Issue first, code second.** Before writing anything, open (or claim) a GitHub Issue that says what you'll do, which files you'll touch and how you'll check it. Update it while you work and close it with a summary (§4).
4. **Stay in your lane** (§3). Don't edit files another lane owns without an issue + note in `docs/STATUS.md`.
5. **Contracts are law** (`docs/CONTRACTS.md`). Never change a shared JSON shape silently.
6. **Scoring math is code, not LLM.** The LLM picks answers + evidence; deterministic code computes points (§6).
7. **Commits: many, small, well explained, no AI attribution.** No `Co-Authored-By`, no "Generated with…", no "co-created with…", no AI model names in commits, PRs, or code. This overrides any tool default. A git hook enforces it (§4.3).
8. **Branch → check → merge yourself.** Work on a short-lived branch; merge it into `main` on your own once `scripts/check.sh` passes and the merge checklist is met (§4.4).
9. **Use the design system.** v2 surfaces (landing, support, admin) use **`shared/theme-light.css`** (bright, Onest, Freedom logo greens) and the real logo in `shared/brand/`; `design/` + `docs/research/design-system.md` remain the token reference. No ad-hoc colors, fonts or radii.
9a. **AI calls only via `lib/llm.js` (→ `lib/openai.js` for `openai:<id>`, else `lib/openrouter.js`) + `lib/cache.js`** (cached, cost-logged). **Every push deploys a Vercel preview**: check it and link it in your issue (§8.1, §9.1).
10. **Leave a handoff** in `docs/STATUS.md` and on your issue before you stop (§5).
11. **Accuracy decides the top 50.** Organizers compare our **per-criterion answers** with experts on **10 unseen control chats** (`docs/case/telegram-qa.md`). Follow `docs/playbook/scoring-playbook.md`; never trade accuracy for features. Results go to `results/dev/results.json` + `results/prod/results.json` via `npm run results` = `eval/control-run.mjs` (§1.1).
12. **Never stash or switch branches in a working tree other agents are writing to**; use `git worktree add ../<dir> <branch>` (LESSONS).

---

## 1. The case (what we're building)

**Conversation Quality Analytics (CQA)** prototype for Freedom Broker: automated QA of operator conversations (chat + voice calls) against a configurable checklist, with explanations, evidence links, appeals and reviewer decisions.

Full brief: `docs/case/brief.md` · Checklist: `docs/case/checklist.md` · Raw notes from the in-person briefing: `docs/case/briefing-notes.md`.

### 1.1 How we are judged and what to submit (organizer Q&A, `docs/case/telegram-qa.md`)
- **Top 50 = mainly per-criterion agreement with expert labels on 10 unseen control chats**, plus functionality, UX, a system that really evaluates new dialogs (no replayed results), architecture diversity. No public formula: don't game it, be sensible; **never invent facts when information is missing**.
- **Submit** `results/dev/results.json` (DEV) and `results/prod/results.json` (control) in the official "Формат JSON 1.0" (`docs/case/results-format.md`, from `CQA_Student_Guide_Appendix_Results.pdf`). Control procedure at **Sun 11:00 → 12:00**, from an up-to-date `main` with keys in `.env`: `npm run results -- --group <CONTROL_ID> --push` (fetch → evaluate → retry → export → validate → commit + push; `--expect 10` is the default for a control group). Check any file with `node eval/validate-results.mjs results/prod/results.json --expect 10`.
- **Rulings:** C2 complete request → N/A · C7 literal (summary or offer of help **and** goodbye) · C1 on calls without recorded greeting → N/A · identification needed for protected actions/personal data (omnichannel; being in the app ≠ verified) · data shown before identification: C3 "Нет" (C8 is our call) · half-up rounding to 2 decimals · replacing a criterion → re-evaluate everything · calls use the same logic adapted to speech.
- **Live demo asks:** list all dialogs with gross errors + why; send a result to appeal; change the checklist (add, edit, change a weight) and re-evaluate; justify one dialog's score. No video required. Corporate look.

### Product surfaces (production https://freedom-cqa.vercel.app)
| Path | What | Owner |
|---|---|---|
| `/` (= `/landing-tair/`) | Bright landing → CTA to support | tair (A/D) |
| `/support/` | Customer chat: AIM bot → honest handoff → CSAT → auto QA | tair (A) |
| `/broker/` | Mock Freedom Broker client app + AIM navigation agent (consent-first, voice) | Nazar (C) |
| `/admin/` | Light admin: overview, dialogs + analysis card, appeals, checklist editor, live chats, AI analyst (passcode) | tair (A) |
| `/prototype/` | Original analyst workspace (kept in sync via localStorage `cqa-prototype-v2`) | Dameli (A) |
| `/preview-hub/` | Team tool: every surface on phone/tablet/laptop, build + AI status | tair |

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

**From the opening ceremony** (`docs/case/opening-ceremony.md`): defense is **5–10 min per team including jury questions**; **plagiarism / IP violations = disqualification** (only use code and assets we're allowed to use, never vendor unlicensed repos); start was announced as ~Sat 12:00 (confirm). Freedom's slides show their expected UI: per-speaker timeline, transcript, score ring, "reason the score was lowered", dispute button. Build to that.

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
| Backend | **Vercel serverless functions** in `api/` (plain Node ESM, zero deps), shared code in `lib/`. Same code runs locally via `npm run dev` |
| Storage | Committed JSON (`data/`), AI cache files (`eval/cache/`), browser localStorage for appeals/checklist versions; optional Upstash Redis; optional Postgres (`DATABASE_URL`) for live sessions (`cqa_kv`) |
| LLM | Eval: **OpenAI `gpt-6-luna` via the direct OpenAI API** (`openai:gpt-6-luna`, `OPENAI_API_KEY`; falls back to OpenRouter `openai/gpt-6-luna` if that key is missing). Any OpenRouter id works via `CQA_EVAL_MODEL`. ASR: OpenRouter `nvidia/nemotron-3.5-transcribe`. All routed by `lib/llm.js`. Model, prompt version, cost and latency logged in `eval/runs/` |
| Hosting / CI/CD | **Vercel Git integration**: every push to any branch = preview URL, `main` = production. GitHub Actions runs `scripts/check.sh` |
| Target host | Dynamics 365 web resource (later); standalone browser now |

Secrets: `.env` only, never committed. Provide `.env.example`.

---

## 3. Lanes and ownership

Four lanes, one per person. Fill in names at kickoff. Each person's agents work **only inside their lane's paths** unless the task says otherwise.

| Lane | Owner | Owns (paths) | Scope |
|---|---|---|---|
| **A. Frontend / UX** | Dameli Kalikhanova (prototype UX), tair (landing/support/admin) | `app/` (except `app/src/scoring.ts`), `landing/` | Checklist editor, dialog list, card, transcript view, evidence jump, audio player, appeal + reviewer UI, Freedom styling, Dynamics-ready structure |
| **B. Backend / Data** | Amina Aktayeva (omodotori: Postgres/KV, audits), tair | `server/`, `data/` | Organizers' API proxy (`group_id`), dataset cache, storage of checklists/results/appeals, endpoints in CONTRACTS |
| **C. AI / Evaluation** | Nazar Akanov (Akanov-Kanta: evaluator, gold set, AIM agent) | `eval/`, `app/src/scoring.ts` | Prompts, model selection, LLM→evidence pipeline, deterministic scoring engine, gold labels, accuracy metrics, cost/latency, voice/ASR experiments |
| **D. Product / Research / Pitch** | Tair Kaldybayev + all | `docs/` (except CONTRACTS ownership is shared), `README.md`, `pitch/` | TL;DR, research, design system notes, test cases, README, presentation, demo video, bot→human handoff concept, judging the product |

`design/` (tokens, components, motion, Tailwind preset) is co-owned by **A + D**: additive changes only, announce in the issue. `prototype/` is the clickable reference prototype (Lane A); the real app copies its patterns.

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
design/              # A+D: tokens.css, components.css, motion.css, tailwind.preset.js, theme.css
prototype/           # A: clickable no-build prototype of the full CQA flow
scripts/             # check.sh (pre-merge), setup-labels.sh
.githooks/           # commit-msg hook (no AI attribution)
.github/             # issue/PR templates, CI workflow
docs/
  TOOLING.md         # registry of every tool/skill/agent/model/approach we use (everyone)
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

Agents on different laptops don't share memory. **The repo + GitHub Issues are the shared brain.** If it isn't in an issue, a commit, or `docs/`, it didn't happen.

### 4.0 One-time setup per laptop
```bash
git clone https://github.com/tairqaldy/doomdatathon-yatebyamognu.git && cd doomdatathon-yatebyamognu
git config core.hooksPath .githooks        # enables the no-AI-attribution commit hook
gh auth login                               # GitHub CLI: needed for issues/PRs (brew install gh / winget install GitHub.cli)
cp .env.example .env                        # then paste real values from the team chat
```
Set `git config user.name` / `user.email` to **your own** name. Commits are authored by humans.

### 4.1 Issue-first workflow (mandatory)
**Before writing code or docs**, every agent:
1. Searches open issues (`gh issue list`) for an existing one. If found, comments `claimed by <person>/<agent>`; otherwise creates one:
   ```bash
   gh issue create --title "[lane-x] <short imperative>" --label "lane:x,P1" --body-file <plan.md>
   ```
   Body = template in `.github/ISSUE_TEMPLATE/task.md`: **Goal · Plan (steps) · Files I'll touch · Contracts affected · How I'll verify · Branch name**.
2. Works on the branch named in the issue.
3. **Comments on the issue at each milestone** (what's done, what's next, blockers). Short, factual, with commit SHAs.
4. Closes it via the merge (`Closes #N` in the merge/PR body) with a final comment: what changed, how to use it, known gaps.

Cross-lane request → new issue labeled `needs:lane-y` with the exact ask + acceptance criteria. The other lane's agent must reply in the issue before starting.

No `gh` available? Write the same plan as an entry under **Requests / Plans** in `docs/STATUS.md`, commit it first, and ask a human to mirror it to Issues. The rule still applies: plan is pushed **before** the work.

Labels: `lane:a|b|c|d`, `P0|P1|P2`, `blocked`, `needs:lane-x`, `contract-change`, `bug`, `design`, `research`. Create them once with `scripts/setup-labels.sh`.

### 4.2 Other shared channels
- **`docs/TOOLING.md`**: **log everything you use**: every tool, CLI, library, MCP server, skill, sub-agent, AI model, prompt strategy, dev approach, research source and external doc. Add a row **before or in the same commit** as you start relying on it (name, what for, who, how to install/use, cost/limits, status). Also mention it in your issue. If a teammate's agent can't reproduce your setup from TOOLING.md, it's not logged well enough.
- **`docs/STATUS.md`**: live handoff log. Append-only per session (§5).
- **`docs/CONTRACTS.md`**: JSON shapes between lanes. To change: `contract-change` issue, update the doc **in the same commit** as the code, note in STATUS. Prefer additive changes.
- **`docs/DECISIONS.md`**: one line per decision. Don't relitigate without new info.
- **`docs/LESSONS.md`**: mistakes → rules. Read every session.
- **GitHub Wiki**: optional for long research. Anything that affects code lives in `docs/`.
- Code comments `// TODO(lane-b): …` only for small cross-lane notes.

### 4.3 Commits: many, small, explained
We want a **rich, readable history**: lots of small commits, each one meaningful. Commit every time one logical step works (a component, a fix, a doc section). Never batch a whole feature into one commit, and never make empty/junk commits.

Format:
```
<type>(<lane>): <what changed, imperative, ≤72 chars>

Why: <the reason / problem>
What: <key changes, bullet list if several>
How verified: <command run, screen checked, test name>
Refs #<issue>
```
`type` ∈ `feat | fix | docs | design | refactor | test | data | chore | perf`. `lane` ∈ `a | b | c | d | team`.
Example: `feat(c): redistribute N/A weights in scoring engine`.

**Forbidden in commits, PRs, issues and code:** `Co-Authored-By:` lines, "Generated with/by …", "co-created with …", or naming an AI model/tool as an author. The commit author is the human whose laptop it is. `.githooks/commit-msg` rejects these; don't bypass it (`--no-verify` is banned).

### 4.4 Branch strategy and self-merge
- **`main`** = always runnable and demoable. Protected by habit: no direct commits except tiny docs/STATUS fixes. Never force-push `main`, never rewrite shared history.
- **Work branches**: `<lane>/<issue#>-<slug>`, e.g. `a/12-appeal-ui`, `c/7-scoring-engine`. Short-lived (≤ ~2h). One issue per branch.
- Keep your branch fresh: `git pull --rebase origin main` before every prompt and before merging. Rebase **your own unpushed** commits only. Once a branch is shared, merge `main` into it instead.
- **Agents decide on their own when to merge**, but only after this checklist passes:
  1. Branch rebased on the latest `origin/main`, no conflicts.
  2. `scripts/check.sh` passes locally (JSON valid, no secrets, no AI attribution, build/tests if present).
  3. The 5-minute demo flow (§1) still works for the parts you touched (open it and click through).
  4. Contracts/docs updated in the same branch if shapes changed. Issue has a final comment.
  5. Touched another lane's files or a contract? Then the owning lane must 👍 in the issue/PR first, or 30 min passed with no objection and it's announced in STATUS.
- How to merge (keep the commit history, **no squash**):
  ```bash
  git switch main && git pull --rebase && git merge --no-ff <branch> -m "merge(<lane>): <summary> (Closes #N)" && scripts/check.sh && git push
  ```
  or open a PR (`gh pr create --fill`) and merge with **"Create a merge commit"** once CI is green. Delete the branch after.
- If `main` breaks after your merge: fix forward within 15 min or `git revert -m 1 <merge-sha>`, and say so in STATUS + the issue.
- From **T+23h**: only fixes merge. At **T+24h**: tag `stop-code` on `main`, no more commits.

### 4.5 Don't break each other's code
- Don't delete or rewrite another lane's files. If something of theirs blocks you, make the minimal fix on your branch, explain it in the issue, and ping the owner.
- Shared components (`design/`, `app/src/scoring.ts`, `app/src/types.ts`) change additively. Add a variant instead of changing an existing one.
- Never commit: secrets, `.env`, `node_modules/`, big audio files.

---

## 5. Every-prompt ritual (mandatory, every agent, every laptop)

**At the start of EVERY prompt** (not just every session):
```bash
git pull --rebase --autostash            # on your work branch also: git pull --rebase origin main
git log --oneline -15 --graph --all      # what landed since last time?
gh issue list --limit 20                 # who is doing what? anything assigned/needs your lane?
```
Then skim `docs/STATUS.md` (newest entries), `docs/DECISIONS.md`, `docs/LESSONS.md`. If someone else changed files you're about to touch, read their diff (`git log -p -3 -- <path>`) before editing. Confirm the current time vs T+23h / T+24h and adjust ambition.

If the pull hits conflicts: resolve them keeping **both** sides' intent, re-run `scripts/check.sh`, and note it in your issue. Never resolve by deleting the other person's work.

**At the end** (or every ~2h on long runs): push your commits, comment on your issue, and append to `docs/STATUS.md`:
```
### <YYYY-MM-DD HH:MM> · lane-<x> · <person>/<agent> · #<issue>
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

### 8.1 AI call rules (all lanes)
- Call chat models **only** through `lib/llm.js` (it routes `openai:<id>` to `lib/openai.js`, everything else to `lib/openrouter.js`; transcription uses `lib/openrouter.js` `transcribe()`) and **always** behind `lib/cache.js` (`cached(ns, keyParts, fn)`). The key must include model + prompt version + full input. A repeated request must never cost money twice.
- Bump `PROMPT_VERSION` in `lib/evaluator.js` whenever the prompt or schema changes. **Cache keys also include a fingerprint of the logic file** (`LOGIC` in `lib/cache.js`: eval → `lib/evaluator.js`, chat → `lib/support-bot.js`, insights → `lib/insights.js`, nav → `lib/nav-agent.js`), so any edit there regenerates answers automatically; unchanged logic + same input = free. New AI feature → add its file to `LOGIC`.
- Shared cache/store: **one Upstash Redis** (Vercel → Storage → "Upstash for Redis", injects `KV_REST_API_*`) serves the AI cache **and** cross-device live chats (`lib/kv.js`); Postgres (`DATABASE_URL`) is optional and preferred for sessions if set; Cloudflare Workers KV is an alternative cache backend (`CF_*`). `/api/health` shows `shared_cache`, `sessions_store` and `logic` fingerprints.
- **Commit `eval/cache/`** after paid runs so teammates, CI and Vercel reuse answers. Never commit keys; keys live in `.env` / Vercel env.
- Budget: the team's OpenRouter credit is small (~$9.5). Prefer cached runs, `--limit`, and cheap models; log every paid run's cost (`eval/runs/`).
- Calls: organizer `audio_url` is an HTML page whose mp3 link expires after ~1h. Use `/api/audio?id=` or `lib/audio.js`, never the raw URL.

---

## 9. Self-improvement and judging loop

Every agent acts as a **judge** for the product, not just a coder:
- After finishing a task, run the defense script (§1) mentally or for real. Anything that breaks the 5-minute flow → file a `P0` issue.
- When you hit a bug or bad assumption, add one line to `docs/LESSONS.md`: *what happened → rule to avoid it*.
- Lane D runs a judge pass every ~4h: score the product against the must-have list and the criteria (when published), and log gaps as issues.
- Prefer fixing over adding. Prefer the jury's checklist over our ideas.
- Judging criteria from the organizers will arrive later → put them in `docs/case/judging.md` and re-prioritize.

---

## 9.1 Deploys, previews and agent tools
- **Push early, push often.** Vercel builds every pushed branch into its own preview URL and `main` into production (https://freedom-cqa.vercel.app). Previews are **public** (no Vercel login). Stable URL per branch: `https://freedom-cqa-git-<branch-with-slashes-as-dashes>-tairqaldy-projects.vercel.app`, e.g. `a/8-card-evaluation-ux` → `freedom-cqa-git-a-8-card-evaluation-ux-tairqaldy-projects.vercel.app`. After pushing, open your preview, click through what you changed, and paste the URL into your issue.
- `npm run dev` = exact local mirror of Vercel (static + `/api`). `npm test` = scoring rules. `scripts/check.sh` before every merge.
- **graphify** (context map of the repo): run `graphify update .` after pulling big changes, then read `graphify-out/GRAPH_REPORT.md` before exploring unfamiliar code (`graphify explain "<symbol>"`). The output is gitignored, so each laptop builds its own. Install: `uv tool install --python 3.12 graphifyy && graphify install --platform claude` (or `codex`).
- **unslop** (de-AI writing): use it on README, pitch and slide text before publishing (`/unslop cleanup`). Installed as a local skill only (`~/dev/unslop`, symlinked into `~/.claude/skills`); **do not copy it into this repo** (no LICENSE file, IP rule).

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
- Don't use a tool, model, skill or library without logging it in `docs/TOOLING.md`.
- Don't write code before your plan is pushed to an issue (or STATUS fallback).
- Don't invent UI styles; use `design/` tokens and components.
- Don't start "nice-to-haves" while any must-have (1–6) is broken.
- Don't make large refactors after T+20h.
