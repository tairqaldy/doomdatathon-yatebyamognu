# Organizer Q&A (Telegram "Data Challenge'26": Q&A Freedom Broker, Q&A Organizers)

Collected by Nazar Akanov on 2026-11-07 ~18:30 (T+6.5h). Only questions the organizers answered. **FB** = Freedom Broker (Максим, Nikolay Borovinskiy, Alexey, Alexsis); **Орг** = DataSci organizers. `#N` = message id in the group (`https://t.me/c/4473389149/<topic>/<N>`, topic 732 = Freedom Broker, 4 = Organizers). Official PDFs still override this page.

## What decides the top 50 (most important for us)
- **Main criterion:** accuracy of the AI evaluation on **10 previously unseen transcripts (chats only)** vs Ground Truth, **compared per criterion answer** (#2292, #2978). Also: functionality and unique features, UI and process convenience, the system really analyses new dialogs (no replayed prepared results), diversity of architectures (local LLMs and cloud).
- No public formula or leaderboard (#2334, #3004). Exact match with experts isn't required, experts disagree too; they look at closeness and reasonableness. Handle N/A, gross errors, incomplete data and disputed statements sensibly. **If information is missing, don't invent facts.** For calls, account for spoken language; perfect ASR is not expected (#2981).
- No reference labels for DEV will be given (#2966). Control set comes through the same API (#2383); dialogs are small (#3083).

## Results to commit (deadline Sun 12:00 = stop code)
- Format and rules: `CQA_Student_Guide_Appendix_Results.pdf` (pinned in Announcements, #3042). **We still need this PDF in the repo.**
- Files: `results/dev/results.json` (DEV set) and `results/prod/results.json` (control set). **1 hour** to process the 10 control chats and push before stop code (#3042). Public GitHub repo per team (#2342, #3050).
- Calls: `contact` for calls without a recorded greeting: use the transcript or adapt (#3075); calls matter more for the UI than for accuracy.

## Checklist rulings
| Topic | Ruling |
|---|---|
| Criteria | Mandatory: `CQA_Chat_Quality_Checklist.pdf` (#2251, #2289) |
| C2 need identification, client gave all details, operator answered without clarifying | **N/A** (#2814) |
| C7 closing, only "Пожалуйста. Хорошего вечера!" | "Re-read the checklist": literal reading = summary **or** offer of help **and** goodbye (#2814, #3024) |
| Account data shared before identification: C3 "Нет" only, or also C8 | **Our choice** (#2814) |
| When is identification needed | Decide from the request (protected action / personal data) (#3074); omnichannel system, being in the app doesn't mean verified (#3082) |
| C1 on calls when the greeting isn't in the recording | **N/A** (#2978) |
| C4 correctness | Freedom has a knowledge base (not given); the system is an indicator of off-script moments for appeals and script rework (#2978) |
| Rounding | **Half-up to 2 decimals**, 50.625 → 50.63 (#2978) |
| Replacing a criterion on the control set | Our design; **re-evaluate: yes** (#2978) |
| C8 gross error and the total | **Never zeroes the total**: a dialog can get 100 and `critical_flag: true` at the same time. Kept apart on purpose so the experts can check per-criterion scoring and gross-error detection separately (2026-11-08) |
| 3-minute first reply | It's an SLA (#3088), out of scope for scoring per checklist |
| Calls | Same logic, adapted to speech. C6 for calls: logic, clarity, no inappropriate expressions, correct wording, pause management (+ tempo/diction if audio). C4: answered questions, no wrong info, explained actions. **A flexible system that creates and applies different checklists, including for calls** (#2343) |

## Calls and audio
Transcribing is optional (#2354). Audio exists so the reviewer can listen; audio still has to be handled in the UI (#2815, #2825, #2826). Intonation/volume only as a stretch (#2838).

## Stack and defense
- HTML/CSS/JS front, TS + Tailwind allowed (#2251, #2303). Any model (#2719). Anything goes **except hard-coding results** (#2177). The API link may be committed (#2716).
- Deploy not required; live clickable UI is what matters (#2729, #2968). They read the README, they don't run it (#2980).
- **Live demo asks** (#2991): show all dialogs with gross errors and explain why; show an operator sending a result to appeal; change the checklist (add a criterion, edit one, change a weight); show one dialog's evaluation with justification. Later they may use the product themselves.
- **No video needed** (#3084). Look: a corporate product for executives, QA and staff; no cartoonish or game-like design (#3011). The interface mock-up is an example, not a standard (#3015).
- Pitching from ~12:30 for selected teams; Russian or Kazakh allowed (#2829, #1050).
- Hackathon: Sat 12:00 → **Sun 12:00** (#312). Prizes 500k / 300k / 200k ₸ (#436).

## Still unanswered
`null` for `contact` on calls without a greeting (#3060); C7 with a goodbye only (not answered on substance); whether the "[Имя скрыто]" mask counts as introducing oneself.

## Sunday 2026-11-08 morning (forwarded by Nazar at 09:30–09:34)
- **Submission form:** https://forms.gle/Nz34xz4yK4XurwAt7 (all solutions are submitted there).
- **Defense: 8–10 minutes including questions.** Show the **whole cycle**: checklist setup → getting the dialogs → evaluation → results → appeal → manual re-evaluation.
- **Teams around the top 10** will be asked to **run a couple of transcripts in front of the jury**, to check that our own system does the evaluating (not replayed results). We need a way to paste or load a transcript and evaluate it live (issue #30).
