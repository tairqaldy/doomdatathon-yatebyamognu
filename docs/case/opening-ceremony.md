# Opening ceremony notes (2026-11-07, 11:20–11:28, from livestream screenshots)

Captured by tair from the NU DataSci Instagram live. Text read off blurry phone screenshots, so treat exact wording as approximate. Where it conflicts with `brief.md`, the official PDF wins.

## Freedom Broker case slides (presented by Freedom representatives)

### "Что делает речевая аналитика": what speech analytics does
Turns conversation content into a result you can act on, in four steps:
1. **Разговор (conversation):** recording or chat, participants, time of each line.
2. **Понимание (understanding):** reason for contact, operator's actions, outcome of the dialog.
3. **Оценка (evaluation):** criteria check, violations and explanations.
4. **Действие (action):** error review, feedback and **a human's decision**.

→ Our UI should show these four layers. Add a short "understanding" summary per dialog (reason for contact, what the operator did, outcome) above the criteria.

### "Доверие к оценке начинается с объяснения": trust in the score starts with the explanation
Example quote: «Я передам вопрос специалистам» ("I'll pass your question to the specialists"). *The client still doesn't know when to expect an answer.*
The system shows:
- the **criterion and the reason the score was lowered**
- the **exact line and the moment in the recording**
- the **option to dispute the conclusion**

**A human keeps control.**
→ Every deduction needs a plain-language "why points were lost" line, a jump to the line or audio moment, and an "Оспорить" button. The example quote is a classic consultation/closure deduction: the operator promised a handoff without saying when.

### "Рабочее место контроля качества": quality-control workspace (their reference mock-up)
A light UI with a green Freedom accent and a left sidebar ("CQA" with nav items, active item highlighted green). Main area **"Анализ разговора"** (conversation analysis), subtitle with date · language · duration:
- **Waveform timeline per speaker:** separate tracks for **Клиент** and **Оператор**, with a play button and progress bar under them.
- Bottom left, **"Расшифровка"**: the transcript with speaker + timestamps.
- Bottom right, **"Оценка качества"**: a **score ring (85.5)** next to a list of criteria with points (e.g. 18/20…), then **"Причина снижения оценки"** (reason the score was lowered).
- Actions: a green primary button (likely **"Оспорить"** or "Отправить на пересмотр") plus a secondary button.

→ This is the jury's mental model of the product. Our card layout should follow it: header + per-speaker waveform + player on top; transcript left; score ring + criteria + deduction reason right; primary green dispute action.

### "Хакатон: продукт, данные и защита": hackathon product, data and defense
All details, the API and criteria are in the Student Guide.
- **What to build:** a web prototype of CQA: dialog evaluation, explanations and **manual review**. HTML interface, **no login**.
- **What we get:** checklist + DEV: 60 chats, 5 calls. Russian, Kazakh, English. Transcripts, recordings and a temporary API.
- **24 hours:** control transcripts are released after 23 hours (see brief).
- **Defense: 5–10 minutes per team, including jury questions.** The exact time depends on the number of teams. Product demo + jury questions.

## Organizer slides (NU DataSci)
- Partner slide: "DATA CHALLENGE Partner: Freedom Broker". Freedom Broker, part of Freedom Holding, gives access to Kazakhstani and international stock markets, digital investment services and financial analytics. (Shown with the Freedom Bank logo.)
- Venues: **Ballroom Left**, **Ballroom Right**, Atrium between A1–A3 and A2–A4. Schedule line reads roughly "**Sat 12:00 Hackathon starts**" (blurry, **confirm**). If that's right: **T = Sat 2026-11-07 12:00** → control data **Sun 11:00** → **stop code Sun 12:00**.
- **IMPORTANT rules:**
  - Respect participants and organizers.
  - **Plagiarism, IP violations or misconduct = disqualification. Jury decisions are final.**
  - Non-NU participants: no access to academic blocks; use Ballroom Right, Ballroom Left and Orange Hall only (plus a campus-hours rule, unreadable).
- Pitching runs in 3–4 rooms in parallel for ~5 hours (from the stream's chat).

## Consequences for us
1. **IP rule:** only use code and assets we're licensed to use. Don't vendor unlicensed repos into ours (e.g. `theclaymethod/unslop` has **no license**, so use it as a local skill only). Don't ship the CoFo Sans font file. Freedom's logo and brand appear only because this is their case.
2. **Defense may be up to 10 min incl. Q&A.** Keep the demo at 5 min; prepare Q&A answers (cost per evaluation, accuracy, how N/A works, how a criterion is replaced).
3. **The UI should match their workspace mock-up** (waveform tracks, deduction reasons, dispute button).
4. **Confirm the start time** and put it in `docs/STATUS.md`.
