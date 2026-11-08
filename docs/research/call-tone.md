# Tone of voice on calls (c09): why we score it and how far to trust it

Written 2026-11-08 for the defense. The criterion is c09 «Тон и подача речи» in [`data/checklists/freedom-call-v1.json`](../../data/checklists/freedom-call-v1.json), judged from the call recording by [`lib/tone.js`](../../lib/tone.js) (Gemini 3.8 Flash, prompt `tone-v4`). Decision: [DECISIONS 2026-11-07](../DECISIONS.md), work: #23.

**Short answer:** scoring tone is legitimate when it is an extra criterion for calls and we say clearly what it can't do. The organizers point to it themselves, it is kept out of the official results, and every deduction cites a turn that can be appealed. We **cannot** claim accuracy for it: there are no expert labels for tone.

## 1. Why tone is scored at all

| Basis | Source |
|---|---|
| The brief says diction and intonation are a valid object of evaluation and need audio: «Для оценки дикции и интонации нужен звук». | [`docs/case/brief.md`](../case/brief.md) (FAQ) |
| For calls, C6 covers pause management, plus tempo and diction when audio is used. The organizers want a system that creates and applies different checklists, including for calls (#2343). | [`telegram-qa.md`](../case/telegram-qa.md) |
| Intonation and volume are allowed as a stretch goal (#2838). Audio exists so the reviewer can listen to it (#2815). | same |
| The transcript doesn't show it. «Да, понимаю» reads the same whether it was said warmly or with irritation. | — |
| From the briefing: the handoff to a live operator should feel human, with good communication. Tone is part of that. | [`briefing-notes.md`](../case/briefing-notes.md) |
| Contact-center scorecards usually have a soft-skills block (tone, courtesy, pace, hold etiquette) that human QA scores by listening. Common practice; we have no separate source for it, so don't cite it as a statistic. | [qa-and-speech-analytics.md](qa-and-speech-analytics.md) (scorecards) |

DEV example: **p4-ru-001** got 4/10. The operator answers in single words («Да.», «Нет, не делаем.»), and the client remarks on it during the call. Text criteria can't see this.

## 2. What c09 measures and what it doesn't

- **Measures:** observable behaviour in the operator's speech: raised voice, interrupting, sharp or dismissive replies, long silence without «минуту, проверю», speech too fast or unclear for the client to follow (the client asks again).
- **Doesn't measure:** what was said (other criteria cover that); the client's or bot's voice; accent, line noise or ASR errors (the prompt forbids deducting for them).
- **Norm = top score.** A flat, calm business tone gets 10/10. Points come off only for a specific moment the model **hears** and ties to an operator turn. No moment, no deduction (prompt rule 5).
- **Scale:** 10 normal · 7 a specific audible lapse (dry, rushed, unexplained silence), client not hurt · 4 audible irritation or coldness, or the client asks again because of tempo or diction · 0 rude, raised voice, interrupting, dismissive. N/A when there is no recording or the operator can't be heard.
- **Code, not the model:** words per minute and long silences are plain arithmetic over turn timestamps (`voiceMetrics` in `lib/tone.js`). The model doesn't compute points; `scoring.ts` does, like every other criterion.

## 3. Safeguards

| Risk | What we do |
|---|---|
| Changes the official score | The exporter drops `input: "audio"` criteria, so `results.json` has exactly the 8 official criteria (`eval/export-results.mjs`). |
| Unexplainable verdict | Every non-top answer cites 1–3 operator turns with a quote; clicking evidence jumps the audio player to that phrase. |
| Model hallucination | `openai:gpt-audio-mini` was tried and **rejected**: it gave every call 7, then every call 10 after a wording change, and invented phrases at a known timestamp. Gemini passed the "what is said at 03:00" check ([TOOLING](../TOOLING.md)). |
| The model is wrong about a person | The operator can appeal c09 like any criterion; the reviewer's decision replaces the answer and the total is recomputed. |
| Repeat cost | Cached by model + prompt + transcript + criterion: ≈ $0.013 per call once, free afterwards. |
| Don't want it | It is checklist data: set weight 0 or delete it in the checklist editor, no code change. |

## 4. Known limits (say these before the jury does)

1. **No accuracy number.** There are no expert labels for tone. The DEV set has 5 calls, all in Russian. Results: 4 calls 10/10, p4-ru-001 4/10. That only shows the model **discriminates** (unlike gpt-audio-mini), not that it agrees with experts.
2. **Run-to-run variance.** p4-ru-001 got 7 on one run and 4 on another (slightly different inputs, same prompt, `eval/cache/tone/`). Unlike the text evaluator, c09 uses one sample with no 3-way vote.
3. **Not tested on KZ or EN calls**, or across voices, accents or genders. Tone judgements are where demographic bias is most likely.
4. **Card total ≠ official total on calls.** c09 has weight 10 out of 95, so a call card's total differs from the 8-criterion total in `results.json`. Example from `npm test`: (26 + 4) / (85 + 10) → 31.58.
5. **Long silences in p4-ru-002** (31, 66, 55 s) still got 10/10. The model's explanation says the operator warned before the wait and thanked the client afterwards (turns 14, 59). This is plausible, but nobody on the team has listened to check it.

## 5. Ethics: this is not emotion recognition

The EU AI Act bans AI that infers the emotions of people at work (Art. 5(1)(f), in force since 2025-02-02). Recital 18 excludes simply detecting readily apparent expressions or behaviour, unless it is used to infer emotions. Kazakhstan isn't bound by it, but the jury may ask. Our position:

- c09 grades **communication behaviour that a listener can point to** (a raised voice, an interruption, 60 s of silence without explanation). It doesn't grade the operator's inner state, mood or personality. Human QA does the same thing when listening to a call.
- The result is advice to a reviewer, not an automatic sanction. An appeal and a human decision are built in.
- Gap: some explanations still name a state («безучастно», «усталость», the latter repeating the client's remark). Next prompt version (`tone-v5`, after the hackathon, measured first) should describe only behaviour: «отвечает односложно, без уточняющих вопросов».

## 6. Answers for the defense (RU)

**«Зачем вы оцениваете тон?»**
> Тон есть только в звуке, в тексте его нет, и в брифе так и написано: для дикции и интонации нужен звук. Мы добавили его отдельным критерием в чек-лист звонков. В официальный файл результатов он не попадает, там строго 8 критериев.

**«Это вообще корректно? Модель угадывает эмоции?»**
> Нет. Эмоции мы не определяем. Балл снижается только за конкретный слышимый момент: повысил голос, перебил, молчал минуту без «минуту, проверю». Каждое снижение ссылается на реплику, и по клику запись открывается на этом месте. Темп и паузы считает код, баллы считает формула. Оператор может оспорить, решение принимает человек.

**«Насколько это точно?»**
> Экспертной разметки по тону нет, поэтому процент мы не называем. Проверили, что модель различает звонки: из 5 DEV-звонков снижен один, и там клиент сам говорит о холодном тоне оператора. Аудиомодель OpenAI мы отклонили: она ставила всем одинаковый балл и выдумывала фразы.

**«А если бизнесу это не нужно?»**
> Это просто строка в чек-листе. В редакторе можно поставить вес 0 или удалить её без изменения кода.

## 7. To make it stronger (after the control run)

- The team listens to the 5 DEV calls and labels c09 by hand: gives a first agreement number (e.g. "5 of 5").
- Give c09 the same 3-sample majority vote as the text evaluator (fixes the 4 ↔ 7 variance).
- `tone-v5`: behaviour-only wording in explanations (§5).
- Add KZ and EN calls before claiming the criterion works across languages.
