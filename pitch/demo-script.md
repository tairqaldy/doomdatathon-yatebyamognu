# Five-minute demo script

Draft based on the organizer's [brief](../docs/case/brief.md). Timings are targets; replace the placeholders after the product and control data are available. Do not claim a feature, accuracy result or time saving until it has been verified.

## Before presenting

- Select a conversation with clear evidence, a valid N/A example and a meaningful appeal. Record the conversation ID and checklist version privately: **[TBD]**.
- Prepare a replacement criterion and one conversation to evaluate with it: **[TBD]**.
- Test the exact flow, audio if used, and network/model availability. Have a backup conversation and a recovery plan.
- Run the control set as soon as it is released at T+23h. Confirm results are ready before the presentation.
- Rehearse with a timer. Confirm the final committed version and README are available before stop-code.

## 0:00–1:00 · Problem, interface and conversation

**Say:** “Quality reviewers need consistent, explainable ways to assess many conversations. Our prototype helps them inspect an operator's evaluation and review disagreements.”

**Show:** Open the conversation list, select the prepared conversation and orient the judges to the transcript and checklist. Identify operator, customer and any bot or system context.

## 1:00–3:00 · Evaluation and evidence

**Show:** Run or open the evaluation. Explain the total and one criterion's answer, weight and reasoning. Click its evidence and show the highlighted message. Show a valid N/A and explain why it does not count, then point out any separate gross-error flag.

**Say:** “The model proposes answers and evidence; a fixed scoring formula calculates the total. A reviewer can inspect the source before trusting the result.”

If showing a call, demonstrate playback or navigation to the relevant part.

## 3:00–4:00 · Appeal and decision

**Show:** Appeal one criterion with a short comment. As reviewer, inspect the score and evidence, enter a reason and change or confirm the answer. If changed, point out the recalculated total. Show the original and final results together.

## 4:00–5:00 · Change the checklist

**Show:** Edit or replace a criterion in the interface, save the checklist and apply it to the provided conversation. Show the new criterion in the result.

**Close:** “The checklist can evolve with the business, while reviewers can trace and challenge each assessment.”

## Questions about tone of voice (c09, calls)

Full rationale and limits: [`docs/research/call-tone.md`](../docs/research/call-tone.md).

- **Зачем?** «Тон есть только в звуке, в брифе так и написано: для дикции и интонации нужен звук. Это отдельный критерий чек-листа звонков, в официальный файл результатов он не попадает.»
- **Корректно ли?** «Эмоции мы не определяем. Снижаем только за конкретный слышимый момент с привязкой к реплике: повысил голос, перебил, молчал без пояснения. Темп и паузы считает код, оператор может оспорить, решает человек.»
- **Точность?** «Экспертной разметки по тону нет, процент не называем. Модель различает звонки: из 5 DEV снижен один (p4-ru-001), там клиент сам говорит о холодном тоне.»
- **Не нужен?** «Это строка в чек-листе: вес 0 или удалить в редакторе, без кода.»

## After rehearsal

| Item | Result |
|---|---|
| Rehearsal date and duration | Not yet rehearsed |
| Conversation and checklist version | TBD |
| Features that failed or felt unclear | TBD |
| Backup path | TBD |

Keep a screenshot or notes only as a fallback for explaining a failure; the brief asks to demonstrate the working flows.
