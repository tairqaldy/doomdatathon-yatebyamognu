# CQA scoring playbook (chat checklist `freedom-chat` v1)

How we score operator conversations, by hand or with the evaluator. The AI evaluator (`lib/evaluator.js`, prompt `eval-v5.1`) encodes these rules; when this file changes, change the prompt in the same branch and re-measure (`eval/runs/*-v5-report.md`).

**Source of truth, in order:** official checklist PDF (`docs/case/checklist.md`) > organizer rulings (`docs/case/telegram-qa.md`) > this playbook > notes in `eval/gold/*.json`. If a criterion's text in the active checklist contradicts a rule below (for example after a live edit), the checklist text wins.

---

## 1. Global rules

| # | Rule |
|---|---|
| G1 | **Grade only the operator.** Bot and system lines are context. A system line is valid evidence for what happened: «Личность клиента подтверждена» / «Клиенттің жеке басы расталды» / «Customer identity verified» = identification done; «Оператор закрыл чат» / «Agent closed the chat» = operator ended it; «Соединение с клиентом прервано» / «Клиентпен байланыс үзілді» / «Connection to customer lost», «Клиент покинул чат» = chat cut. |
| G2 | **Handoff context counts as known.** Everything the client told the bot before «Эскалация на оператора» is known to the operator (omnichannel). Asking for it again is a C2/C6 defect. Queue time between the bot and the operator is not the operator's wait (C6). |
| G3 | **Being in the app is not identification.** Omnichannel system: only a verification event or a completed verification step in the chat counts (#3082). |
| G4 | **Don't invent facts** (#2981). Judge only what the transcript shows. No knowledge base is given, so "correct" (C4) means consistent with the dialog, the bot's information and common broker practice; do not mark a confident operator answer wrong without a visible contradiction. |
| G5 | **N/A only when allowed AND its condition is met.** "No" = the action was needed and missed or done wrong. Never use N/A to avoid a hard call. |
| G6 | **One defect, the right criterion.** Insult / off-company offer / disclosure → C8 (and C3 for disclosure). They do not by themselves lower C4 (resolution) or C6 (clarity); they may lower C5 if the operator was rude or dismissed the client's concern. |
| G7 | **Evidence:** cite the operator line (or system line) that proves the answer. For a missed action cite the range where it was expected. For N/A state which condition is met. Quotes stay in the original language; explanations are in Russian, 1–2 sentences. |
| G8 | **Language:** the same rules for RU / KZ / EN. A Russian menu path inside a KZ or EN reply («Меню → Пополнить») is normal in this product, not a language error. |
| G9 | **Points are code, not judgement.** The judge only picks answers; `prototype/scoring.js` computes points, N/A redistribution and the total (half-up to 2 decimals). C8 carries no points and never zeroes the total. |
| G10 | **Ambiguous after the procedure?** Pick the answer the procedure gives, write the doubt in the explanation; the human resolves it via appeal (section 6). |

---

## 2. Criteria

Turn numbers are 0-based (`[i]` in the transcript). Gold references are `eval/gold/<id>.json`.

### C1 Установление контакта (yes/no, weight 10)
**Checks:** the operator's **first** message greets the client **and** introduces the operator (name or "support of Freedom Broker"), in the client's language.
1. Find the first operator line. No greeting there → **no**.
2. No name / self-introduction in that line → **no** (a name masked as «[Имя скрыто]» counts as introduced).
3. Greeting in a different language from the client's → **no**.
4. Otherwise **yes**.

Cues: RU «Здравствуйте», «Добрый день», «меня зовут …», «я …»; KZ «Сәлеметсіз бе», «менің атым …», «мен …мын»; EN "Hello/Hi, I'm …". Informal «Привет» / «Сәлем» + no name = **no** (p1-kz-008, DEV p1-ru-014). A first line with only an instruction (p1-en-015 "Open settings…") = **no**.
Calls: no recorded greeting (recording starts after it) → **N/A is not allowed by the chat checklist, but organizers rule N/A for calls** (#2978); use the transcript when the greeting is there.
Common model mistake: crediting a greeting that appears in a later operator message.

### C2 Выявление потребности (yes/no/N/A, weight 15)
**Checks:** before answering, did the operator use what the client already said and ask for what was really missing?
1. Did the operator ask for something the client already gave (to the bot or the operator), or answer a different question than the one asked, ignoring stated details? → **no** (p1-kz-008 asks the site again; p1-ru-003 ignores "commission on the international market"; p1-ru-022 ignores the bond question).
2. Was an answer impossible or likely wrong without a missing detail (which platform, which security, which document, what the screen says, what currency)? If yes and the operator asked before answering → **yes** (p1-ru-006, p1-ru-009, p1-en-006); if the operator guessed instead → **no** (p1-en-015 "open settings" without knowing the client is on the website; p1-ru-018 blames the exchange without asking which bond).
3. Client never stated a request and the operator asked what they need → **yes** (p1-ru-025).
4. Otherwise the request was clear and complete from the start → **N/A** (organizer ruling #2814). A confirmation of an already clear request («Вам нужны реквизиты, верно?») is not a clarification. A second question left unanswered is a C4 matter, not a C2 "no" (blind labelers, DEV p1-ru-007 / p1-en-007 / p1-ru-005; eval-v5.1 still misses two of these, see section 7).

Evidence: the clarifying question (yes), the ignored/re-asked detail (no), the client's original request (N/A).
Common model mistakes: "yes" because the operator "took details into account" on a clear request (should be N/A); "no" on a clear request because the operator did not ask anything (should be N/A).

### C3 Идентификация (yes/no/N/A, weight 20)
**Checks:** was identity verified before account data was disclosed or a protected action was done?
1. Did the operator reveal facts about **this client's** account from the company's systems (balance, restriction, status or rejection reason of an operation) that the client had not told, before a verification event? → **no** (p1-ru-009, p1-kz-015, p1-en-014). Also C8 = yes (section C8).
2. Was there a protected step in the chat: account-specific data told, or an account operation checked, changed or forwarded for checking? Verified (system verification event) before that step → **yes** (p1-ru-006, p1-kz-003, p1-en-006); not verified → **no**.
3. No protected step happened → **N/A** (#3074: decide from the request). This covers general product / tariff / navigation / document questions; an operator who only collected non-sensitive details (ticker, error text, which screen) or promised to forward once the client sends them, and the client left (DEV p1-kz-012); and an operator who correctly asked for verification when the client declined it and nothing was disclosed (DEV p1-ru-002).
**Not disclosure:** steps of the verification procedure (saying the account was found, asking for data, sending a code to the linked phone, "the data doesn't match"; calls p4-ru-003/004), and restating or discussing what the client said about their own account or request. When in doubt, it is not disclosure.
Cues: RU «вижу на вашем счёте», «на вашем счёте ограничение», «подтверждение не нужно»; KZ «шотыңызда … көріп тұрмын», «растаудың қажеті жоқ»; EN "I can see … on your account", "we can skip that".
Note: a general claim about a client's order without looking at the account («биржа отменяет ваш приказ», p1-ru-018) is a wrong answer (C4), not disclosure.

### C4 Корректная и полная консультация (scale 0/5/10/15/20, N/A, weight 20)
**Checks:** were the client's questions resolved, or a correct next step given?
1. Client left / chat ended before formulating any request → **N/A** (p1-ru-025).
2. List every client question (including the one given to the bot). For each: answered correctly, answered partly, handed off with a clear next step, or left open.
3. Map: all essential questions closed **or** correct next step (a handoff counts as complete when the needed data was collected and the client was told what happens next, e.g. "we'll reply in this chat") → **20**; main question solved, a secondary detail missed → **15**; part closed, an essential question left open (p1-ru-003 commission; DEV p1-ru-007 "when can I retry the withdrawal?") → **10**; only a vague hint or a bare "I'll pass it on" without answering the main question or saying what happens next (p1-ru-009, p1-kz-015, p1-en-014) → **5**; no substantive answer or the key advice is wrong (p1-ru-018, p1-ru-022, DEV p1-ru-026 «Всё есть в приложении») → **0**.
4. A wrong first answer later corrected by the operator → judge the final state (p1-en-015 = 20, the slip goes to C6).
5. The client confirmed the answer worked («Вижу, спасибо», «Нашёл», "That worked") → that question is resolved.
6. Handed off after collecting the needed data (and verifying identity when required) but without saying where or when the answer comes → **15**, not 5 (DEV p1-ru-010). The bottom non-zero step is for a bare "I'll pass it on" with nothing collected and nothing explained.
7. A substantive answer is a concrete instruction or fact from the operator; «Всё есть в приложении» is not one (**0**), even if the bot hinted earlier (DEV p1-ru-026).
Gross violations do not lower C4 (G6): an off-company offer after a correct navigation answer is still 20 (p1-en-013, p1-kz-013, DEV p1-ru-023).

### C5 Эмпатия и клиентоориентированность (yes/no, weight 15)
**Checks:** polite throughout, and if the client showed dissatisfaction or described an inconvenience, the operator reacted to that specific problem.
1. Any rude, sarcastic or dismissive operator line (insult, «Ну, тогда сайт.», «Всё есть в приложении», brushing off a new question by pointing back to an earlier answer «Путь к обновлению я указал», "Goodbye." to an open question) → **no** (p1-ru-029, p1-ru-018; DEV p1-ru-007). Its EN twin p1-en-007 ("That's where the profile request is. … Bye.") should get the same answer; eval-v5.1 gives yes there (known gap, section 7).
2. Client expressed irritation, worry or an objection («Я уже писал», «Жоғарыда жаздым ғой», "How do you know it's my account?", «Вы серьёзно?») and the operator ignored or brushed it off → **no** (p1-kz-008, p1-en-014, p1-kz-015, p1-ru-022).
3. Otherwise **yes**. No complaint from the client → politeness alone is enough; an explicit empathy phrase is not required.
Cues of a good reaction: «Понимаю, что …», «Извините», «Алаңдайтыныңыз түсінікті», "I understand why…".
Common model mistake: "no" for a polite operator only because no empathy phrase was used.

### C6 Управление диалогом, скорость и грамотность (scale 0/4/7/10, weight 15)
**Checks:** clarity, order of replies, warning about waits. Count operator-caused glitches:
- the client had to re-ask or repeat because the operator's reply was vague, wrong, off-topic, asked for known info, or ignored the question;
- a client question left without any reply;
- an unclear or self-contradictory line;
- a noticeable wait (≈2 min or more between the client's message and the operator's reply, by timestamps) without a warning like «Сейчас проверю».
Do **not** count: the client refusing or objecting to an improper offer (graded in C8), the client adding a new topic, a follow-up or confirmation question built on a correct answer («То есть вторую заявку не нужно делать?», "So I don't need to wait?"; DEV p1-ru-008, p1-ru-015), bot queue time.
1. Replies so incoherent or contradictory that the course of the dialog is unclear → **0** (alt for p1-ru-018).
2. The client had to re-ask or repeat because of the operator, or a client question was left unanswered and the client could not continue, or two or more glitches → **4** (p1-ru-003, p1-ru-009, p1-kz-015, p1-en-014, p1-kz-008).
3. Exactly one noticeable glitch and the client could continue → **7** (p1-ru-029: insulting first line that did not answer). Open question for the team: is repeating information the operator asked for again one glitch (**7**, the blind labelers on DEV p1-ru-014) or a re-ask (**4**, gold p1-kz-008 with 7 also acceptable)? eval-v5.1 gives 4; see section 7.
4. No glitches → **10**, even if the content was improper (p1-en-013, p1-kz-013, p1-ru-022) or the order of verification/handoff was unusual (p1-ru-006).
Calls (#2343): logic, clarity, no inappropriate expressions, correct wording, managing pauses; do not blame the operator for ASR noise.
Weakest criterion historically (v4 57.9 % strict); most errors were 4 for clear-but-improper replies and 10 when the client had to re-ask.

### C7 Завершение (yes/no/N/A, weight 5)
**Literal reading (organizer ruling #2814/#3024):** yes = (summary **or** offer of further help) **and** goodbye.
1. The chat was cut by a system/client event (connection lost, client left, client hung up) right after the client's message or while the operator was still working → **N/A** (p1-en-009, p1-kz-011, p1-ru-012, p1-ru-025). The transcript simply ending after the client's message with no event is **not** a cut → judge normally (p1-kz-008 = no).
2. The operator did not react at all to the client's last question (ignored it, replied about something else, or only said goodbye) → **no** (p1-en-014, p1-ru-003). A handoff or a named next step counts as a reaction (p1-ru-009, p1-kz-015).
3. Goodbye present? («До свидания», «Хорошего дня», «Всего доброго», «Сау болыңыз», «Күніңіз сәтті өтсін», "Goodbye", "Bye", "Have a good day", "Take care"). No → **no** (operator closed without a word: p1-en-013, p1-kz-013, p1-ru-022).
4. Summary or next step present **in the closing message** (the operator's final message(s) after the client's last line; an answer given before the client's "thanks" is not a summary, p1-en-015)? A summary restates the result or what happens next («Вопрос о позиции передан», «Передам вопрос на проверку», «Для регистрации выберите другой логин», «ответ придёт в этом чате», "We'll follow up here"). An offer of help: «Если вопрос останется, напишите нам», «Чем ещё помочь?», "Anything else I can help with?". **Pleasantries are neither:** «Пожалуйста», «Рад помочь», «Отлично», «Спасибо за обращение», «Оқасы жоқ», «Көмегім тигеніне қуаныштымын», "You're welcome", "Happy to help", "Glad you got in".
5. Goodbye + (summary or offer) → **yes** (p1-ru-009 and p1-kz-015 «передам на проверку … до свидания», minimal but yes); goodbye with pleasantries only → **no** (p1-en-015 "Bye.", p1-ru-029 «До свидания.»).
Team decision on record: under this reading «Пожалуйста. Хорошего вечера!» after a solved request is **no** (−5 points before redistribution). If organizers say otherwise, flip step 4 (treat a polite goodbye after a solved request as yes) and re-run; the evaluator implements it in one function (`closingAnswer` in `lib/evaluator.js`).

### C8 Грубые ошибки (flag yes/no, no points)
**Checks:** any of three, by the operator:
1. **Insult** of the client («Вы вообще читать умеете?», p1-ru-029).
2. **Paid service bypassing the company:** asks for money to the operator personally, or for the client's personal number for a private paid consultation. The offer alone is enough; consent is not needed (p1-en-013, p1-kz-013, p1-ru-022, DEV p1-ru-023).
3. **Confidential disclosure:** account-specific facts told before identification (our choice per #2814: C3 = no **and** C8 = yes; p1-ru-009, p1-kz-015, p1-en-014).
Otherwise **no**. Verification steps, general product info and the client's own data or request repeated back are not disclosure; when in doubt, it is not (a false gross error is worse in the demo than a missed one is in the score: the flag carries no points). Every yes must cite the exact operator line. Regression to watch: calls p4-ru-003/004 (operator says the account was found and sends a code) must stay **no** (eval-v3 and the first eval-v5 draft flagged p4-ru-003).
Model mistake fixed in v4/v5: noticing the disclosure in C3 but answering C8 = no (p1-kz-015). The evaluator now derives C8 from the same facts as C3.

---

## 3. Calls vs chats
- Same checklist logic, adapted to speech (#2343). Transcripts are noisy ASR; never grade the operator for garbled words or duplicated fragments.
- C1: greeting not recorded → N/A for calls (#2978); C6: logic, clarity, inappropriate expressions, pause management; C7: the client hanging up mid-conversation → N/A.
- Accuracy is judged on chats; calls matter for the UI and audio playback.

## 4. Replaced or custom criteria
- The checklist is data. Rules above are written by **meaning** (greeting, need, identification, resolution, empathy, dialog management, closing, gross violation), so an edited criterion with the same meaning keeps working and a new criterion is judged from its own text, type, scale and N/A condition.
- The evaluator's deterministic shortcuts (C7 literal closing, C3/C8 disclosure coupling) apply **only** when the criterion's title, description, type and N/A setting are unchanged from `freedom-chat` v1 (weight edits are fine). Edit the text in the UI and the evaluator falls back to the model's own judgement for that criterion.
- After any checklist change: re-evaluate (organizer ruling: yes); the cache key includes the criteria, so this is automatic.

## 5. Evaluator design (eval-v5.1) and why
Based on LLM-judge practice: decompose fuzzy criteria into checkable sub-questions (CheckEval, [arXiv 2403.18771](https://arxiv.org/abs/2403.18771)); let the judge reason/fill facts before scoring (G-Eval form-filling, [arXiv 2303.16634](https://arxiv.org/abs/2303.16634)); judges are biased and self-inconsistent, so validate against human labels and report self-agreement ([Zheng et al. 2023](https://arxiv.org/abs/2306.05685); [Rating Roulette, arXiv 2510.27106](https://arxiv.org/pdf/2510.27106): majority vote over 3 runs beat single runs); use deterministic checks where the rule is mechanical ([MLflow on judge calibration](https://mlflow.org/articles/llm-judge-calibration/)).
1. **Facts first:** one call returns dialog facts (client requests, first operator turn, verification turn, disclosure/insult/offer turns, client re-asks with cause, ending type, goodbye/summary/offer turns) before the per-criterion answers, each answer preceded by a short `checks` line.
2. **Deterministic derivation** for unchanged built-ins: C7 from the closing facts; C3 = no and C8 = yes when a disclosure-before-verification turn is found; C8 = yes when an insult or off-company offer turn is found. Every derivation that changes the model answer is listed in `derived` and `problems`.
3. **Self-consistency:** k samples per dialog (3 for the default eval model; `CQA_EVAL_SAMPLES` or `evaluate(…, { samples })` overrides; other models default to 1), majority vote per criterion; ties → median step for scales, otherwise the answer of the most central sample. Samples run in parallel and are cached one by one. On Vercel (60 s limit) the vote uses the samples finished within 45 s (`CQA_EVAL_DEADLINE_MS`); the first sample is always awaited. The share of agreeing samples is returned per criterion as `agreement`, so low-agreement criteria can be routed to a human first.
4. Normalisation guards from v4 stay: invalid answers rejected, evidence indices and quotes validated against the transcript, missing criteria retried.

## 6. Disagreements: appeal → reviewer
1. Operator (or QA) opens an appeal on one criterion with a comment; the card shows the AI answer, explanation, evidence and the dialog fragment.
2. Reviewer re-runs this playbook's procedure for that criterion only, reading the cited turns. Low `agreement` criteria get looked at first.
3. Decision: confirm or change the answer with a reason; scoring recomputes the total; the card keeps original, decision and final.
4. If the same disagreement repeats (two or more appeals with the same reason), it is a rule problem, not a model problem: update this playbook (and the prompt), add the dialog to the gold set, re-measure on the held-out split (`docs/playbook/split.md`) before adopting.

## 7. Candidate rules measured but not adopted (eval-v5.2, 2026-11-07)
Proposed after two blind labelers (checklist PDF + rulings only) labeled 24 non-gold DEV chats. Implemented as `eval-v5.2` and measured on the 19 gold + those 24 chats (`eval/runs/2026-11-07T15-10-25-579Z-v52-gold-blind-*`). Result: blind consensus 181/185 (v5.1: 179), but gold strict 90.8 % (v5.1: 96.1 %), held-out strict 91.1 % (v5.1: 94.6 %), lenient equal on held-out and −2 items on tuning. Not adopted (rule: held-out must not drop). Details in `eval/runs/2026-11-07T15-15-00Z-v5-report.md`.
| Rule | Blind effect | Gold effect |
|---|---|---|
| C2 procedure starting from "did the operator ask a clarifying question?" + "an incomplete answer is never a C2 no" + code guard (AI "yes" without a cited operator question → N/A) | 0 (22/24 both) | −2 strict, lenient ok (p1-kz-015, p1-en-014 → no; p1-ru-003 → yes). The guard alone changed no voted answer on v5.1 samples |
| C4: deflected follow-up caps at 15 (10 if the main question stayed open); pointing to the client's bank is a valid next step | +1 (22/23) | p1-ru-009 5→10 (lenient ok) |
| C5: client's concrete problem brushed off and the operator closes → no | +1 (23/23) | −2 strict, −1 lenient (p1-ru-003 → no ✗, p1-en-013 → no) |
| C6: repeating info the operator re-asked = 7, not 4 | 0 on blind, new miss p1-ru-028 (10→7) | p1-kz-008 4→7 (lenient ok) |
Worth retrying first with budget: the C4 cap alone (only rule with a blind gain and no lenient gold loss).
