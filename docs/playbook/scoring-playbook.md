# CQA scoring playbook (chat checklist `freedom-chat` v1)

How we score operator conversations, by hand or with the evaluator. The AI evaluator (`lib/evaluator.js`, prompt `eval-v5.3`) encodes these rules; when this file changes, change the prompt in the same branch and re-measure (`eval/runs/*-v53-report.md`). Every rule has a "Why" entry: the checklist line, organizer ruling or measured case behind it.

**Source of truth, in order:** official checklist PDF (`docs/case/checklist.md`) > organizer rulings (`docs/case/telegram-qa.md`) > this playbook > notes in `eval/gold/*.json`. If a criterion's text in the active checklist contradicts a rule below (for example after a live edit), the checklist text wins.

---

## 1. Global rules

How to read the "Why" columns: **CL** = official checklist text (`docs/case/checklist.md`, page given); **#N** = organizer ruling, message id in `docs/case/telegram-qa.md`; **gold** = reviewed label in `eval/gold/<id>.json`; **blind** = both blind labelers agree (`eval/blind/blind-24.json`); **DEV** = spot-checked DEV chat without a label. "Our call" marks a team decision where the sources are silent.

| # | Rule | Why this rule |
|---|---|---|
| G1 | **Grade only the operator.** Bot and system lines are context. A system line is valid evidence for what happened: «Личность клиента подтверждена» / «Клиенттің жеке басы расталды» / «Customer identity verified» = identification done; «Оператор закрыл чат» / «Agent closed the chat» = operator ended it; «Соединение с клиентом прервано» / «Клиентпен байланыс үзілді» / «Connection to customer lost», «Клиент покинул чат» = chat cut. | CL p.1 "оценки работы оператора"; CL p.3 "Укажите конкретную реплику или системное сообщение" (system lines are evidence); the official guide's must-have 2 (bot and system lines are context). |
| G2 | **Handoff context counts as known.** Everything the client told the bot before «Эскалация на оператора» is known to the operator (omnichannel). Asking for it again is a C2/C6 defect. Queue time between the bot and the operator is not the operator's wait (C6). | CL C2 "учёл известные детали"; #3082 (omnichannel system); gold p1-kz-008 and p1-en-015 (re-asking what the bot already had = C2 no). Queue time: #3088 (first-reply time is an SLA, CL p.2 puts the 3-minute threshold out of scope). |
| G3 | **Being in the app is not identification.** Omnichannel system: only a verification event or a completed verification step in the chat counts (#3082). | #3082, #3074. |
| G4 | **Don't invent facts** (#2981). Judge only what the transcript shows. No knowledge base is given, so "correct" (C4) means consistent with the dialog, the bot's information and common broker practice; do not mark a confident operator answer wrong without a visible contradiction. | #2981 ("if information is missing, don't invent facts"); #2978 (the knowledge base is not given; the system is an indicator for appeals). |
| G5 | **N/A only when allowed AND its condition is met.** "No" = the action was needed and missed or done wrong. Never use N/A to avoid a hard call. | CL p.2 step 1 "Ставьте N/A только там, где он разрешён и выполнено условие"; CL p.3 "Чем «Нет» отличается от N/A?". |
| G6 | **One defect, the right criterion.** Insult / off-company offer / disclosure → C8 (and C3 for disclosure). They do not by themselves lower C4 (resolution) or C6 (clarity); they may lower C5 if the operator was rude or dismissed the client's concern. | CL p.3 "Как разделить консультацию и ведение диалога?"; gold p1-en-013, p1-kz-013 (C4 20, C6 10 despite the paid offer). Measured: eval-v4 penalised clear-but-improper replies in C6 and missed gold (eval/runs/2026-11-07T15-15-00Z-v5-report.md §4). |
| G7 | **Evidence:** cite the operator line (or system line) that proves the answer. For a missed action cite the range where it was expected. For N/A state which condition is met. Quotes stay in the original language; explanations are in Russian, 1–2 sentences. | CL p.3 "На что ссылаться при оценке?" and the worked example "Как выглядит обоснование?". |
| G8 | **Language:** the same rules for RU / KZ / EN. A Russian menu path inside a KZ or EN reply («Меню → Пополнить») is normal in this product, not a language error. | CL p.3 "Один и тот же чек-лист применяется к чатам на русском, казахском и английском". Menu paths: every KZ/EN DEV chat uses the Russian app menu names. |
| G9 | **Points are code, not judgement.** The judge only picks answers; `prototype/scoring.js` computes points, N/A redistribution and the total (half-up to 2 decimals). C8 carries no points and never zeroes the total. | CL p.2 "Порядок расчёта" (steps 1–5) and C8 "БЕЗ БАЛЛОВ"; #2978 (half-up, 50.625 → 50.63). |
| G10 | **Ambiguous after the procedure?** Pick the answer the procedure gives, write the doubt in the explanation; the human resolves it via appeal (section 6). | #2981 (experts disagree too; closeness and reasonableness are judged); the appeal flow is a graded must-have. |

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
Calls: no recorded greeting (recording starts after it) → **N/A is not allowed by the chat checklist, but organizers rule N/A for calls** (#2978); use the transcript when the greeting is there. In `results.json` `contact` only takes true/false (`docs/case/results-format.md`), so a call without a recorded greeting exports **false**, never null (#3075: "use the transcript or adapt"; #3060 on null is unanswered).
Common model mistake: crediting a greeting that appears in a later operator message.

**Why these rules**
| Rule | Why |
|---|---|
| Only the first operator message counts; greeting **and** introduction | CL p.1 C1 "поздоровался на языке клиента и представился в первом ответе". Gold p1-en-015 (instruction-only first line = no). |
| «[Имя скрыто]» = introduced | Our call: the mask is the dataset's anonymisation, not the operator's omission (open question in telegram-qa.md "Still unanswered"). |
| «Привет» / «Сәлем» without a name = no | The introduction is missing (CL C1). Gold p1-kz-008; blind p1-ru-014 (both labelers no). |
| Greeting in another language = no | CL C1 "на языке клиента". |
| Calls: N/A in the playbook, false in results.json | #2978 (N/A for calls) vs the results format (contact is true/false only); the chat checklist used for scoring has no N/A for C1, so the evaluator answers no. |

### C2 Выявление потребности (yes/no/N/A, weight 15)
**Checks:** before answering, did the operator use what the client already said and ask for what was really missing?
1. Did the operator miss the need? Three reasons only (eval-v5.3 fact `need_missed_kind`):
   - **asked known info:** asked for something the client had already said clearly, to the bot or the operator (p1-kz-008 asks the site again; DEV p1-ru-014). Refining a vague detail is not a re-ask: the client said "yesterday", the operator asks "roughly when" (p1-kz-003 = yes).
   - **ignored stated details:** answered a different question than the main one, not using what the client said, and the main question stayed unanswered (p1-ru-003 ignores "commission on the international market"; p1-ru-022 jumps to a private offer instead of the bond question).
   - **answered without a needed detail:** guessed where a detail was needed, and the answer turned out wrong or did not fit (p1-en-015 "open settings" without knowing the client is on the website; p1-ru-018 blames the exchange without asking which bond).
   Any of them → **no**.
2. Otherwise, did the operator ask for a really missing detail before answering (which platform, which security, which document, what the screen says, what currency, when the transfer was made)? → **yes** (p1-ru-006, p1-ru-009, p1-en-006), even if the client described the problem at length: the question itself shows the data was not enough.
3. Client never stated a request and the operator asked what they need → **yes** (p1-ru-025).
4. Otherwise the request was clear and complete from the start → **N/A** (organizer ruling #2814). A confirmation of an already clear request («Вам нужны реквизиты, верно?») is not a clarification. A second question left unanswered while the main one is solved is a C4/C6 matter, not a C2 "no" (blind: DEV p1-ru-007, p1-en-007, p1-ru-005). Information that the client does not have either (their bank's commission) is not a missing detail.

Evidence: the clarifying question (yes), the ignored/re-asked detail (no), the client's original request (N/A).
Common model mistakes: "yes" because the operator "took details into account" on a clear request (should be N/A); "no" on a clear request because the operator did not ask anything or left a follow-up open (should be N/A); N/A although the operator asked a clarifying question (should be yes).
Evaluator (eval-v5.3, unchanged built-in C2 only): a "no" whose facts give no supported reason becomes yes (if a clarifying question is recorded) or N/A; an N/A with a recorded clarifying question becomes yes. A reason is supported when its own definition holds in the facts: "ignored stated details" needs the first request to be unresolved, "answered without a needed detail" needs a wrong answer or a client correction after that turn (`needMiss` in `lib/evaluator.js`).

**Why these rules**
| Rule | Why |
|---|---|
| Clear, complete request → N/A | #2814 (client gave all details, operator answered without clarifying → N/A); CL C2 N/A "Данных для ответа хватало с самого начала". |
| Re-asking known info → no | CL C2 "учёл известные детали"; G2. Gold p1-kz-008, p1-en-015; blind p1-ru-014. |
| Refining a vague detail is not a re-ask | Gold p1-kz-003 = yes (its EN/RU twins p1-en-006, p1-ru-006, where the client never said "yesterday", are yes too). The v5.3 draft without this sentence turned p1-kz-003 into no. |
| Ignored details only when the main question stayed unanswered | Gold p1-ru-003, p1-ru-022 = no; gold p1-ru-029 = N/A (insult, then the right answer): the v5.3 draft marked it no until the definition was enforced in code. |
| Guessing counts only if the answer turned out wrong or did not fit | Gold p1-en-015, p1-ru-018 = no (client corrects the operator); blind DEV p1-en-008 = N/A (correct answer, the draft called it a guess). |
| Clarifying question → yes, not N/A | CL C2 "уточнил недостающее до ответа"; the N/A condition ("data was enough from the start") is contradicted by the operator's own question. Gold p1-ru-009 = yes: eval-v5.1 said N/A in 3 of 3 samples. |
| Unanswered follow-up is not a C2 "no" | CL p.3 separates resolution (C4) from dialog management (C6); C2 is about what happens before the answer. Blind DEV p1-en-007, p1-ru-005, p1-ru-007 (both labelers N/A); eval-v5.1 said no on p1-en-007 while its RU twin got N/A. |
| Client never asked; operator asked what they need → yes | CL C2 "уточнил недостающее"; gold p1-ru-025 (N/A also acceptable). |

### C3 Идентификация (yes/no/N/A, weight 20)
**Checks:** was identity verified before account data was disclosed or a protected action was done?
1. Did the operator reveal facts about **this client's** account from the company's systems (balance, restriction, status or rejection reason of an operation) that the client had not told, before a verification event? → **no** (p1-ru-009, p1-kz-015, p1-en-014). Also C8 = yes (section C8).
2. Was there a protected step in the chat: account-specific data told, or an account operation checked, changed or forwarded for checking? Verified (system verification event) before that step → **yes** (p1-ru-006, p1-kz-003, p1-en-006); not verified → **no**.
3. No protected step happened → **N/A** (#3074: decide from the request). This covers general product / tariff / navigation / document questions; an operator who only collected non-sensitive details (ticker, error text, which screen) or promised to forward once the client sends them, and the client left (DEV p1-kz-012); and an operator who correctly asked for verification when the client declined it and nothing was disclosed (DEV p1-ru-002).
**Not disclosure:** steps of the verification procedure (saying the account was found, asking for data, sending a code to the linked phone, "the data doesn't match"; calls p4-ru-003/004), and restating or discussing what the client said about their own account or request. When in doubt, it is not disclosure.
Cues: RU «вижу на вашем счёте», «на вашем счёте ограничение», «подтверждение не нужно»; KZ «шотыңызда … көріп тұрмын», «растаудың қажеті жоқ»; EN "I can see … on your account", "we can skip that".
Note: a general claim about a client's order without looking at the account («биржа отменяет ваш приказ», p1-ru-018) is a wrong answer (C4), not disclosure.

**Why these rules**
| Rule | Why |
|---|---|
| Protected step without a verification event = no | CL p.1 C3 and CL p.3 "Если требовалась проверка личности перед защищённым действием и она не подтверждена в чате, ставьте «Нет»"; #3074 (decide from the request: protected action or personal data); #3082 (in the app ≠ verified). Gold p1-ru-006, p1-kz-003, p1-en-006 (verified first = yes). |
| No protected step = N/A (general, tariff, navigation, documents) | CL p.3 "Общий вопрос о тарифах не требует идентификации"; CL C3 N/A "запрос не требовал идентификации". DEV p1-kz-012, p1-ru-002 (nothing disclosed, client left or declined verification). |
| Account facts told before verification = C3 no **and** C8 yes | #2814 (C8 in addition is our choice); gold p1-ru-009, p1-kz-015, p1-en-014. Implemented deterministically from one fact (`account_data_before_verification_turn`) so C3 and C8 never disagree (eval-v4 once had C3 no + C8 no on p1-kz-015). |
| Verification steps and the client's own words are not disclosure; when in doubt, not disclosure | A false gross error is shown in the demo list of gross errors (#2991) and is worse than a missed one, which carries no points. Regression cases: calls p4-ru-003/004 (eval-v3 and the first eval-v5 draft flagged p4-ru-003). |

### C4 Корректная и полная консультация (scale 0/5/10/15/20, N/A, weight 20)
**Checks:** were the client's questions resolved, or a correct next step given?
1. Client left / chat ended before formulating any request → **N/A** (p1-ru-025).
2. List every client question (including the one given to the bot; "connect me to an operator" is not a question). For each: resolved, partly, handed off with a clear next step, **correct next step that waits on the client** (verification, ticker, error text or a date check is needed, the operator said what to do or send and what happens next, the client postponed), handed off without a next step, **deflected** («нужно рассматривать отдельно», "It doesn't answer …", pointing back to an earlier answer, with no answer and no concrete next step), left open, or wrong.
3. Map: all essential questions closed **or** correct next step (a handoff counts as complete when the needed data was collected and the client was told what happens next, e.g. "we'll reply in this chat"; a next step that waits on the client counts too: DEV p1-ru-002, p1-kz-012) → **20**; main question solved, a secondary detail missed, or a **new** follow-up deflected (blind DEV p1-ru-020, p1-en-008) → **15**; part closed, an essential question left open, including a deflected question the client asked **in the original request** (p1-ru-003 commission; DEV p1-ru-007 / p1-en-007 "when can I retry the withdrawal?") → **10**; only a vague hint or a bare "I'll pass it on" without answering the main question or saying what happens next (p1-ru-009, p1-kz-015, p1-en-014) → **5**; no substantive answer or the key advice is wrong (p1-ru-018, p1-ru-022, DEV p1-ru-026 «Всё есть в приложении») → **0**.
   The top step needs every listed question closed: if any is open, partly, deflected, wrong or handed off without a next step, the answer is at most **15** (a question asked right before a connection drop does not count). The evaluator enforces this cap in code for the unchanged built-in C4 (`consultationCap`).
4. A wrong first answer later corrected by the operator → judge the final state (p1-en-015 = 20, the slip goes to C6).
5. The client confirmed the answer worked («Вижу, спасибо», «Нашёл», "That worked") → that question is resolved.
6. Handed off after collecting the needed data (and verifying identity when required) but without saying where or when the answer comes → **15**, not 5 (DEV p1-ru-010). The bottom non-zero step is for a bare "I'll pass it on" with nothing collected and nothing explained.
7. A substantive answer is a concrete instruction or fact from the operator; «Всё есть в приложении» is not one (**0**), even if the bot hinted earlier (DEV p1-ru-026).
Gross violations do not lower C4 (G6): an off-company offer after a correct navigation answer is still 20 (p1-en-013, p1-kz-013, DEV p1-ru-023).

**Why these rules**
| Rule | Why |
|---|---|
| Steps 20 / 15 / 10 / 5 / 0 as listed | CL p.2 C4 scale labels, word for word ("Все существенные вопросы закрыты или дан корректный следующий шаг" … "Ответа по существу нет или ключевая рекомендация ошибочна"). |
| N/A only if the client never formulated a request | CL C4 N/A "чат закончился до того, как клиент сформулировал запрос"; gold p1-ru-025. |
| A handoff with the data collected and "what happens next" = 20 | CL scale 20 "дан корректный следующий шаг"; gold p1-ru-006, p1-en-006, p1-kz-003. |
| A next step that waits on the client = 20 | Same clause of the scale. eval-v5.1 gave DEV p1-ru-002 10 and p1-kz-012 5 (operator explained the cause or asked for the ticker, the client postponed), which the v5 report flagged as too harsh. |
| Bare "I'll pass it on" = 5; handed off without saying where/when = 15 | CL scale 5 "клиенту всё ещё непонятно, как действовать" vs 15 "пропущена второстепенная деталь"; gold p1-ru-009, p1-kz-015, p1-en-014 (5); DEV p1-ru-010 (15). |
| Deflected **new** follow-up = 15, deflected part of the **original** request = 10 | CL scale 15 "основной вопрос решён, пропущена второстепенная деталь" vs 10 "существенный вопрос остался открытым": what the client asked from the start is essential. Blind: DEV p1-ru-020 and p1-en-008 = 15, p1-ru-007 and p1-en-007 = 10 (eval-v5.1 gave p1-ru-020 20; a v5.3 draft without the original/new distinction gave p1-ru-007 15). |
| Top step only if every question is closed (cap in code) | CL scale 20 "Все существенные вопросы закрыты": a 20 next to the model's own "open / partly / deflected" fact is self-contradictory. Mechanical, so enforced deterministically for the unchanged built-in only. |
| «Всё есть в приложении» = 0; a corrected first answer is judged by the final state | CL scale 0 "Ответа по существу нет"; DEV p1-ru-026. Gold p1-en-015 = 20 after the correction. |
| Gross violations don't lower C4 | CL p.3 "Как разделить консультацию и ведение диалога?", G6; gold p1-en-013, p1-kz-013 = 20. |
| No visible contradiction → don't call an answer wrong | #2978 (no knowledge base given), #2981 (don't invent facts). |

### C5 Эмпатия и клиентоориентированность (yes/no, weight 15)
**Checks:** polite throughout, and if the client showed dissatisfaction or described an inconvenience, the operator reacted to that specific problem.
1. Any rude, sarcastic or dismissive operator line (insult, «Ну, тогда сайт.», «Всё есть в приложении», brushing off a new question by pointing back to an earlier answer «Путь к обновлению я указал» / "That's where the profile request is.", "Goodbye." to an open question) → **no** (p1-ru-029, p1-ru-018; DEV p1-ru-007, p1-en-007).
2. Client expressed irritation, worry or an objection («Я уже писал», «Жоғарыда жаздым ғой», "How do you know it's my account?", «Вы серьёзно?») and the operator ignored or brushed it off → **no** (p1-kz-008, p1-en-014, p1-kz-015, p1-ru-022). Irritation at being asked again counts: if the operator neither apologises nor acknowledges it and just carries on → **no** (p1-kz-008).
3. Otherwise **yes**. No complaint from the client → politeness alone is enough; an explicit empathy phrase is not required. An incomplete or wrong answer on its own is a C4 matter, not C5 (p1-ru-003 = yes).
Cues of a good reaction: «Понимаю, что …», «Извините», «Алаңдайтыныңыз түсінікті», "I understand why…".
Common model mistake: "no" for a polite operator only because no empathy phrase was used.

**Why these rules**
| Rule | Why |
|---|---|
| Rude, sarcastic or dismissive line = no | CL p.1 C5 "оператор вежлив"; gold p1-ru-029, p1-ru-018. |
| Pointing back instead of answering a new question = no, in every language | Dismissive by tone, not just incomplete. Blind DEV p1-ru-007 and p1-en-007 = no (both labelers); eval-v5.1 gave the EN twin yes until the EN form was added to the prompt. |
| Dissatisfaction ignored = no; irritation at a re-ask included | CL C5 "если клиент выразил недовольство … отреагировал на конкретную проблему"; gold p1-en-014, p1-kz-015, p1-ru-009, p1-ru-022, p1-kz-008 (eval-v5.1 gave p1-kz-008 yes in 2 of 3 samples). |
| No complaint → politeness is enough | The checklist's reaction clause is conditional ("если клиент выразил"); v4-era mistake on polite operators. |
| Incomplete or wrong answer alone ≠ unempathetic | G6 / CL p.3 separates resolution from conduct. Gold p1-ru-003 = yes; the v5.2 rule "problem brushed off and chat closed → no" broke it and p1-en-013 (section 7), so it is not used. |

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

**Why these rules**
| Rule | Why |
|---|---|
| Count operator-caused glitches; 10 / 7 / 4 / 0 by count and effect | CL p.2 C6 scale labels: 10 "ясные и связные", 7 "Один заметный сбой, но клиент может … продолжить", 4 "Клиенту приходится переспрашивать", 0 "ход диалога непонятен". |
| Unwarned wait ≈2 min during the operator's work is a glitch; queue time is not | CL C6 "предупреждение об ожидании"; the 3-minute first reply is an SLA and out of scope (CL p.2 last line, #3088). |
| Reaction to misconduct, new topics and confirmations are not glitches | G6 / CL p.3 (consultation vs dialog management). Gold p1-en-013, p1-kz-013 = 10; DEV p1-ru-008, p1-ru-015 (confirmation questions). |
| Calls: logic, clarity, inappropriate expressions, pauses; no penalty for ASR noise | #2343; #2981 (perfect ASR is not expected). |
| Repeating info the operator re-asked: kept at 4 | Measured both ways: the "= 7" rule (eval-v5.2) fixed blind p1-ru-014 but broke gold p1-kz-008 (4) and blind p1-ru-028; net zero, so not adopted (section 7). |

### C7 Завершение (yes/no/N/A, weight 5)
**Literal reading (organizer ruling #2814/#3024):** yes = (summary **or** offer of further help) **and** goodbye.
1. The chat was cut by a system/client event (connection lost, client left, client hung up) right after the client's message or while the operator was still working → **N/A** (p1-en-009, p1-kz-011, p1-ru-012, p1-ru-025). The transcript simply ending after the client's message with no event is **not** a cut → judge normally (p1-kz-008 = no).
2. The operator did not react at all to the client's last question (ignored it, replied about something else, or only said goodbye) → **no** (p1-en-014, p1-ru-003). A handoff or a named next step counts as a reaction (p1-ru-009, p1-kz-015).
3. Goodbye present? («До свидания», «Хорошего дня», «Всего доброго», «Сау болыңыз», «Күніңіз сәтті өтсін», "Goodbye", "Bye", "Have a good day", "Take care"). No → **no** (operator closed without a word: p1-en-013, p1-kz-013, p1-ru-022).
4. Summary or next step present **in the closing message** (the operator's final message(s) after the client's last line; an answer given before the client's "thanks" is not a summary, p1-en-015)? A summary restates the result or what happens next («Вопрос о позиции передан», «Передам вопрос на проверку», «Для регистрации выберите другой логин», «ответ придёт в этом чате», "We'll follow up here"). An offer of help: «Если вопрос останется, напишите нам», «Чем ещё помочь?», "Anything else I can help with?". **Pleasantries are neither:** «Пожалуйста», «Рад помочь», «Отлично», «Спасибо за обращение», «Оқасы жоқ», «Көмегім тигеніне қуаныштымын», "You're welcome", "Happy to help", "Glad you got in".
5. Goodbye + (summary or offer) → **yes** (p1-ru-009 and p1-kz-015 «передам на проверку … до свидания», minimal but yes); goodbye with pleasantries only → **no** (p1-en-015 "Bye.", p1-ru-029 «До свидания.»).
Team decision on record: under this reading «Пожалуйста. Хорошего вечера!» after a solved request is **no** (−5 points before redistribution). If organizers say otherwise, flip step 4 (treat a polite goodbye after a solved request as yes) and re-run; the evaluator implements it in one function (`closingAnswer` in `lib/evaluator.js`).

**Why these rules**
| Rule | Why |
|---|---|
| Yes = (summary or offer of help) **and** goodbye; pleasantries are neither | CL p.1 C7 "подвёл итог или предложил дальнейшую помощь и попрощался"; #2814 and #3024 ("re-read the checklist" for «Пожалуйста. Хорошего вечера!»). Blind labelers on DEV p1-ru-001 cite the same ruling. |
| N/A only when a system/client event cut the chat | CL C7 N/A "Чат оборвался до возможности его завершить". Gold p1-en-009, p1-kz-011, p1-ru-012, p1-ru-025; gold p1-kz-008 (transcript just ends, no event) = no. |
| Last client question ignored = no | CL p.3 worked example (closing without reacting is a "Нет"); gold p1-en-014, p1-ru-003. |
| Computed in code from the facts (`closingAnswer`) | Mechanical rule; measured consistency on 42 non-gold chats: eval-v4 73.8 % → eval-v5.1 100 % (`docs/playbook/silver-nongold.json`); gold and blind c07 100 % since v5.1. |

### C8 Грубые ошибки (flag yes/no, no points)
**Checks:** any of three, by the operator:
1. **Insult** of the client («Вы вообще читать умеете?», p1-ru-029).
2. **Paid service bypassing the company:** asks for money to the operator personally, or for the client's personal number for a private paid consultation. The offer alone is enough; consent is not needed (p1-en-013, p1-kz-013, p1-ru-022, DEV p1-ru-023).
3. **Confidential disclosure:** account-specific facts told before identification (our choice per #2814: C3 = no **and** C8 = yes; p1-ru-009, p1-kz-015, p1-en-014).
Otherwise **no**. Verification steps, general product info and the client's own data or request repeated back are not disclosure; when in doubt, it is not (a false gross error is worse in the demo than a missed one is in the score: the flag carries no points). Every yes must cite the exact operator line. Regression to watch: calls p4-ru-003/004 (operator says the account was found and sends a code) must stay **no** (eval-v3 and the first eval-v5 draft flagged p4-ru-003).
Model mistake fixed in v4/v5: noticing the disclosure in C3 but answering C8 = no (p1-kz-015). The evaluator now derives C8 from the same facts as C3.

**Why these rules**
| Rule | Why |
|---|---|
| Insult, off-company paid offer, disclosure; the offer alone is enough | CL p.1 C8 and CL p.3 "Что считать предложением услуги в обход компании?" ("Достаточно самого предложения"). Gold p1-ru-029, p1-en-013, p1-kz-013, p1-ru-022. |
| Disclosure before identification also sets C8 | #2814 (our choice); one fact drives C3 and C8. |
| No points, never zeroes the total; shown as a separate flag | CL p.1 "БЕЗ БАЛЛОВ"; CL p.2 step 5 "Грубые ошибки отметьте отдельно". |
| When in doubt, no | The demo asks for the list of all dialogs with gross errors and why (#2991): a false flag is visible and hard to defend. Every evaluator version since v4: 7/7 gold gross errors, 0 false positives. |

---

## 3. Calls vs chats
- Same checklist logic, adapted to speech (#2343). Transcripts are noisy ASR; never grade the operator for garbled words or duplicated fragments.
- C1: greeting not recorded → N/A for calls (#2978); C6: logic, clarity, inappropriate expressions, pause management; C7: the client hanging up mid-conversation → N/A.
- Accuracy is judged on chats; calls matter for the UI and audio playback.

## 4. Replaced or custom criteria
- The checklist is data. Rules above are written by **meaning** (greeting, need, identification, resolution, empathy, dialog management, closing, gross violation), so an edited criterion with the same meaning keeps working and a new criterion is judged from its own text, type, scale and N/A condition.
- The evaluator's deterministic shortcuts (C7 literal closing, C3/C8 disclosure coupling; since eval-v5.3 also the C2 consistency rule and the C4 top-step cap) apply **only** when the criterion's title, description, type and N/A setting (and, for C4, the scale steps 20/15/10/5/0) are unchanged from `freedom-chat` v1 (weight edits are fine). Edit the text in the UI and the evaluator falls back to the model's own judgement for that criterion.
- After any checklist change: re-evaluate (organizer ruling: yes); the cache key includes the criteria, so this is automatic.

## 5. Evaluator design (eval-v5.3 = eval-v5.1 + the C2/C4/C5 changes above) and why
Based on LLM-judge practice: decompose fuzzy criteria into checkable sub-questions (CheckEval, [arXiv 2403.18771](https://arxiv.org/abs/2403.18771)); let the judge reason/fill facts before scoring (G-Eval form-filling, [arXiv 2303.16634](https://arxiv.org/abs/2303.16634)); judges are biased and self-inconsistent, so validate against human labels and report self-agreement ([Zheng et al. 2023](https://arxiv.org/abs/2306.05685); [Rating Roulette, arXiv 2510.27106](https://arxiv.org/pdf/2510.27106): majority vote over 3 runs beat single runs); use deterministic checks where the rule is mechanical ([MLflow on judge calibration](https://mlflow.org/articles/llm-judge-calibration/)).
1. **Facts first:** one call returns dialog facts (client requests, first operator turn, verification turn, disclosure/insult/offer turns, client re-asks with cause, ending type, goodbye/summary/offer turns) before the per-criterion answers, each answer preceded by a short `checks` line.
   eval-v5.3 adds the C2 facts (`operator_clarifying_question_turn`, `need_missed_kind` / `need_missed_turn`) and two request statuses (`next_step_given`, `deflected`); "connect me to an operator" is no longer listed as a request.
2. **Deterministic derivation** for unchanged built-ins: C7 from the closing facts; C3 = no and C8 = yes when a disclosure-before-verification turn is found; C8 = yes when an insult or off-company offer turn is found; eval-v5.3: C2 "no" needs a supported reason (`needMiss`), N/A is impossible after a recorded clarifying question; C4 top step capped at 15 while a request is not closed. Every derivation that changes the model answer is listed in `derived`. On the 43 measured dialogs × 3 samples the two new rules changed no answer (the facts-first prompt already agreed with them); they are a safety net, as the C3/C7/C8 rules were for v5.1.
3. **Self-consistency:** k samples per dialog (3 for the default eval model; `CQA_EVAL_SAMPLES` or `evaluate(…, { samples })` overrides; other models default to 1), majority vote per criterion; ties → median step for scales, otherwise the answer of the most central sample. Samples run in parallel and are cached one by one. On Vercel (60 s limit) the vote uses the samples finished within 45 s (`CQA_EVAL_DEADLINE_MS`); the first sample is always awaited. The share of agreeing samples is returned per criterion as `agreement`, so low-agreement criteria can be routed to a human first.
4. Normalisation guards from v4 stay: invalid answers rejected, evidence indices and quotes validated against the transcript, missing criteria retried.

## 6. Disagreements: appeal → reviewer
1. Operator (or QA) opens an appeal on one criterion with a comment; the card shows the AI answer, explanation, evidence and the dialog fragment.
2. Reviewer re-runs this playbook's procedure for that criterion only, reading the cited turns. Low `agreement` criteria get looked at first.
3. Decision: confirm or change the answer with a reason; scoring recomputes the total; the card keeps original, decision and final.
4. If the same disagreement repeats (two or more appeals with the same reason), it is a rule problem, not a model problem: update this playbook (and the prompt), add the dialog to the gold set, re-measure on the held-out split (`docs/playbook/split.md`) before adopting.

## 7. Measured rule changes

### eval-v5.3 (adopted, 2026-11-07)
Measured on tuning 12 / held-out 7 / blind 24, 3 samples per dialog, against the eval-v5.1 samples already in the cache. Adoption rule set before the run: held-out strict must not drop, blind consensus must not drop, gross errors 7/7 with 0 false positives. Full report: `eval/runs/2026-11-07T16-05-00Z-v53-report.md`.
| | eval-v5.1 | eval-v5.3 |
|---|---|---|
| held-out strict / lenient (56) | 53 / 55 | **54 / 56** |
| tuning strict / lenient (96) | 93 / 95 | 91 / 94 |
| all gold strict / lenient (152) | 146 / 150 | 145 / 150 |
| blind consensus (185) | 179 | **180** |
| gross errors | 7/7, 0 FP | 7/7, 0 FP |

Fixed: p1-ru-009 C2, p1-kz-008 C5 (gold); p1-en-007 C2 and C5, p1-ru-020 C4 (blind). New misses are mostly C6: sample noise on p1-kz-015 and p1-ru-028 (a second draw gives p1-kz-015 the gold 4), and on p1-ru-020 a deflected follow-up counted as a C6 glitch (10 → 7, blind 10); plus p1-ru-009 C4 5→10 (lenient ok) and the call p4-ru-001 C4 10→20. A first draft (v5.3a) without the "refining is not a re-ask" sentence, the code check of the need reasons and the original/new follow-up distinction lost held-out p1-kz-003 and p1-ru-029 C2 and blind p1-ru-007 C4; those three fixes were made after seeing it, so the held-out numbers above are no longer fully out-of-sample.

### eval-v5.2 (not adopted, 2026-11-07)
Proposed after two blind labelers (checklist PDF + rulings only) labeled 24 non-gold DEV chats. Implemented as `eval-v5.2` and measured on the 19 gold + those 24 chats (`eval/runs/2026-11-07T15-10-25-579Z-v52-gold-blind-*`). Result: blind consensus 181/185 (v5.1: 179), but gold strict 90.8 % (v5.1: 96.1 %), held-out strict 91.1 % (v5.1: 94.6 %), lenient equal on held-out and −2 items on tuning. Not adopted (rule: held-out must not drop). Details in `eval/runs/2026-11-07T15-15-00Z-v5-report.md`.
| Rule | Blind effect | Gold effect |
|---|---|---|
| C2 procedure starting from "did the operator ask a clarifying question?" + "an incomplete answer is never a C2 no" + code guard (AI "yes" without a cited operator question → N/A) | 0 (22/24 both) | −2 strict, lenient ok (p1-kz-015, p1-en-014 → no; p1-ru-003 → yes). The guard alone changed no voted answer on v5.1 samples |
| C4: deflected follow-up caps at 15 (10 if the main question stayed open); pointing to the client's bank is a valid next step | +1 (22/23) | p1-ru-009 5→10 (lenient ok) |
| C5: client's concrete problem brushed off and the operator closes → no | +1 (23/23) | −2 strict, −1 lenient (p1-ru-003 → no ✗, p1-en-013 → no) |
| C6: repeating info the operator re-asked = 7, not 4 | 0 on blind, new miss p1-ru-028 (10→7) | p1-kz-008 4→7 (lenient ok) |

Retried in eval-v5.3: the C4 deflection cap (kept, with the original/new follow-up split) and "an incomplete answer is never a C2 no" (kept, as fact definitions checked in code). The v5.2 C5 and C6 rules stay out.
