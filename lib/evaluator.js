// LLM evaluator: conversation + checklist → per-criterion answer, explanation, deduction reason, evidence.
// The model NEVER computes points; prototype/scoring.js (→ app/src/scoring.ts) does. Output shape: docs/CONTRACTS.md §3.
// Scoring rules the prompt encodes: docs/playbook/scoring-playbook.md. Measurements: eval/runs/*-v5-report.md.
//
// eval-v5.x: facts first, then per-criterion checks → answer; deterministic derivation for the unchanged built-in
// closing / identification / gross-error criteria; k samples with a majority vote per criterion (self-consistency).
// eval-v5.3 (default) = eval-v5.1 + need facts (clarifying question, why the need was missed) and request statuses
// next_step_given / deflected, with two more derivations for unchanged built-ins: need (C2) and consultation (C4) top-step cap.
// Why each rule: docs/playbook/scoring-playbook.md; measured: eval/runs/*-v53-report.md.
// eval-v5.1 and eval-v4 stay selectable (evaluate(..., { promptVersion })) for comparison/fallback.
import { chatJSON, MODELS } from './llm.js'; // routes openai:<model> → OpenAI direct, else OpenRouter
import { cached } from './cache.js';

export const PROMPT_VERSION = 'eval-v5.3';
// eval-v5 (first draft) and eval-v5.2 were measured but never shipped: eval/runs/*-v5-report.md, docs/playbook/eval-v5.2-candidate.diff
export const PROMPT_VERSIONS = ['eval-v4', 'eval-v5.1', 'eval-v5.3'];
// Self-consistency samples. Measured for the default eval model only, so other models (experiments, test doubles) run
// one sample unless asked. Override per call ({ samples }) or with CQA_EVAL_SAMPLES.
export const DEFAULT_SAMPLES = 3;

const SPEAKER = { client: 'КЛИЕНТ', operator: 'ОПЕРАТОР', bot: 'БОТ', system: 'СИСТЕМА' };

export function renderTranscript(conv) {
  return conv.transcript.map((m, i) => `[${i}] ${m.timestamp} ${SPEAKER[m.speaker] || m.speaker}: ${m.text}`).join('\n');
}

function allowed(c) {
  if (c.type === 'scale') return [...c.scale.map((s) => String(s.value)), ...(c.na_allowed ? ['na'] : [])];
  return ['yes', 'no', ...(c.na_allowed ? ['na'] : [])];
}

function renderChecklist(cl) {
  return [...cl.criteria].sort((a, b) => a.order - b.order).map((c) => {
    const lines = [`- id: ${c.id} · «${c.title}» · тип: ${c.type === 'flag' ? 'флаг грубой ошибки (yes = нарушение есть)' : c.type === 'scale' ? 'шкала' : 'да/нет'}`,
      `  Что проверить: ${c.description}`];
    if (c.type === 'scale') lines.push(`  Ступени: ${c.scale.map((s) => `${s.value} = ${s.label}`).join(' | ')}`);
    lines.push(c.na_allowed ? `  N/A разрешён ТОЛЬКО если: ${c.na_condition}` : '  N/A запрещён.');
    lines.push(`  Допустимые ответы: ${allowed(c).join(', ')}`);
    return lines.join('\n');
  }).join('\n');
}

// eval-v4 prompt, unchanged (kept for comparison runs and as a fallback).
const SYSTEM_V4 = `Ты — эксперт службы контроля качества Freedom Broker. Ты оцениваешь работу ОПЕРАТОРА в диалоге с клиентом по чек-листу.
Правила:
1. Оценивай только реплики оператора. Реплики бота и системные события — контекст (например, «Оператор закрыл чат» подтверждает завершение, «Личность клиента подтверждена» — идентификацию).
2. Диалог может быть на русском, казахском или английском. Оценивай на языке диалога, но объяснения пиши по-русски, коротко (1–2 предложения), без воды.
3. Для каждого критерия дай ответ строго из списка допустимых. N/A ставь только если он разрешён И выполнено его условие. «Нет» — действие было нужно, но пропущено или сделано неправильно.
4. Доказательства: укажи номер реплики [i], на которую опираешься, и короткую точную цитату из неё. Если действие пропущено — укажи участок (range_start..range_end), где оно ожидалось. Для N/A — kind "na_condition" и какое условие выполнено.
5. deduction_reason: если ответ не даёт полный балл — одной фразой, за что снижено (как увидит оператор). Иначе пустая строка.
6. Для шкалы выбирай одну из ступеней. Не считай баллы и итог — это делает система.
7. Грубые ошибки (флаг): оскорбление клиента, предложение платной услуги в обход компании (перевести деньги лично, личный номер для частной консультации — достаточно самого предложения), раскрытие конфиденциальной информации.
8. summary: причина обращения, что сделал оператор, результат — по одной короткой фразе по-русски.
Уточнения (применяй к критериям с соответствующим смыслом, если они есть в чек-листе):
9. Выявление потребности: если запрос клиента был полностью ясен с самого начала и уточнять было нечего — ставь N/A (если разрешён). Не ставь «да» только потому, что оператор «учёл детали», и не ставь «нет», если уточнение не требовалось. «Нет» — только если без уточнения ответ был невозможен или неточен, а оператор не уточнил (или переспросил то, что клиент уже сообщил).
10. Завершение: если разговор оборвала система или клиент («соединение прервано», «клиент покинул чат», «клиент завершил разговор») сразу после реплики клиента или пока оператор ещё вёл диалог, — это N/A. Итогом считается и короткое резюме следующего шага («передам на проверку», «ответим в этом чате»): такое резюме вместе с прощанием — «да». «Нет» — если у оператора была возможность завершить, но он закрыл чат без прощания, попрощался одним словом без итога и без предложения помощи или оставил последний вопрос клиента без ответа.
11. Консультация оценивает только одно: решён ли запрос или дан ли корректный следующий шаг. Грубые нарушения (оскорбление, предложение услуг в обход компании) оцениваются флагом, а не снижают консультацию. Передача вопроса специалистам — корректный следующий шаг (полный балл), если оператор собрал нужные данные и сказал клиенту, что будет дальше (например, ответ придёт в этом чате). Нижняя ненулевая ступень — когда оператор лишь бросил «передам на проверку», не ответив на главный вопрос клиента и не объяснив, что будет дальше. 0 — только если ответа по существу нет совсем или ключевая рекомендация ошибочна. Если клиент ушёл, так и не сформулировав вопрос (например, только просил соединить с человеком), консультация — N/A.
12. Ведение диалога: если клиенту пришлось переспрашивать или повторять вопрос, потому что оператор ответил не на тот вопрос, проигнорировал его или ответил пустой либо неуместной репликой, — выбирай ступень «клиенту приходится переспрашивать», даже если каждая реплика сама по себе понятна. Один заметный сбой, после которого клиент спокойно продолжает, — средняя ступень. Ожидание в очереди до подключения оператора (между ботом и оператором) не учитывай: важно только ожидание по ходу работы самого оператора.
13. Конфиденциальность: сообщить сведения о конкретном счёте клиента (баланс, ограничения, операции, статус заявок) до подтверждения личности — это раскрытие конфиденциальной информации (флаг грубой ошибки = yes) и одновременно провал идентификации («нет»), особенно если оператор отказался проверять личность. Шаги самой процедуры идентификации — не раскрытие: запросить данные, отправить код на привязанный номер, сказать «данные не совпадают, уточните». Общая информация о продуктах, тарифах и навигации в приложении не требует идентификации.
Верни только JSON по схеме.`;

const SYSTEM_V5 = `Ты — эксперт службы контроля качества Freedom Broker. Ты оцениваешь работу ОПЕРАТОРА в диалоге с клиентом по чек-листу. Работай по шагам: сначала факты диалога, затем по каждому критерию короткая проверка и ответ.

ОБЩИЕ ПРАВИЛА
1. Оценивай только реплики оператора. Реплики бота и системные события — контекст и допустимые доказательства: «Личность клиента подтверждена» = идентификация пройдена; «Оператор закрыл чат» = чат закрыл оператор; «Соединение с клиентом прервано», «Клиент покинул чат», «Connection to customer lost» = чат оборвался.
2. Всё, что клиент написал боту до перевода на оператора, оператору известно. Ожидание в очереди до подключения оператора не учитывай.
3. Нахождение клиента в приложении не означает идентификацию: в расчёт идёт только событие подтверждения личности или завершённая проверка в этом чате.
4. Не придумывай факты. Базы знаний нет: ответ оператора считай ошибочным только при явном противоречии с диалогом, ответами бота или здравым смыслом брокерского обслуживания.
5. N/A — только если он разрешён И выполнено его условие. «Нет» — действие было нужно, но пропущено или сделано неправильно.
6. Каждое нарушение оценивай в своём критерии. Оскорбление, предложение услуг в обход компании и раскрытие данных — это грубая ошибка (раскрытие — ещё и провал идентификации). Сами по себе они не снижают полноту консультации и ясность ведения диалога; клиентоориентированность снижают, если оператор был груб или отмахнулся от опасения клиента.
7. Правила одинаковы для русского, казахского и английского. Пути меню на русском внутри казахского или английского ответа — норма продукта.
8. Не считай баллы и итог — это делает система.
9. Если текст критерия в чек-листе противоречит уточнениям ниже (критерий изменён), действует текст чек-листа. Новый или незнакомый критерий оценивай строго по его тексту, ступеням и условию N/A.

ШАГ 1. ФАКТЫ (поле facts; номера реплик [i]; null, если такого нет)
- client_requests: каждый вопрос или запрос клиента (включая заданные боту) и чем он закончился: resolved (решён) | partly (решён частично) | handed_off_with_next_step (передан специалистам, нужные данные собраны и клиенту сказано, что будет дальше) | handed_off_without_next_step | open (остался без ответа) | wrong_answer (ответ ошибочный).
- operator_first_turn: первая реплика оператора.
- identity_verified_turn: системное подтверждение личности или завершённая проверка.
- account_data_before_verification_turn: реплика оператора, где он сообщает сведения о КОНКРЕТНОМ счёте, приказе, платеже или ограничении клиента до подтверждения личности. Раскрытие — это сведения из систем компании, которых клиент сам не называл (баланс, ограничение, статус или причина отказа операции). Не раскрытие: шаги самой проверки (сказать, что счёт найден, запросить данные, отправить код на привязанный номер, «данные не совпадают»), пересказ или обсуждение того, что клиент сам сообщил о своём счёте или заявке, общие сведения о продуктах. Общее предположение без проверки счёта («биржа отменяет приказ») — ошибка консультации, а не раскрытие. Если сомневаешься — null.
- insult_turn: оператор оскорбляет или унижает клиента.
- off_company_offer_turn: оператор предлагает перевести деньги ему лично или просит личный номер клиента для частной платной консультации (достаточно самого предложения).
- client_reasks: реплики, где клиент переспрашивает или повторяет уже сказанное, и причина: operator_unclear (ответ расплывчатый или непонятный) | operator_ignored_question | operator_asked_known_info (оператор спросил уже известное) | operator_wrong_answer | reaction_to_misconduct (клиент возражает против грубости, предложения или раскрытия — это не сбой ведения диалога) | new_topic (новый вопрос клиента — не сбой) | confirmation (клиент уточняет или подтверждает, что понял уже данный верный ответ: «То есть …?», "So I don't need to …?" — не сбой).
- client_dissatisfaction_turns: реплики, где клиент выразил недовольство, раздражение, беспокойство или возражение. Спокойный отказ («Нет, спасибо», "No, I'm only asking about the app") — не недовольство.
- ending: чем закончился диалог: operator_closed_chat | operator_last_message | connection_lost | client_left_or_hung_up | client_last_message (запись просто кончается репликой клиента без системного события).
- cut_before_operator_could_close: true только если системное событие (обрыв связи, клиент покинул чат или положил трубку) прервало диалог сразу после реплики клиента или пока оператор ещё вёл диалог. Если запись просто закончилась без такого события — false.
- last_client_question_ignored_turn: последний вопрос клиента, на который оператор не отреагировал вовсе: проигнорировал, ответил про другое или только попрощался (null, если отреагировал; передача вопроса специалистам или названный следующий шаг — это реакция).
- operator_goodbye_turn: прощание оператора («До свидания», «Хорошего дня», «Всего доброго», «Сау болыңыз», «Күніңіз сәтті өтсін», "Goodbye", "Bye", "Have a good day", "Take care").
- summary_or_next_step_turn: в заключительной реплике оператора (после последней реплики клиента) он подводит итог или называет следующий шаг — пересказывает решение или что будет дальше («Вопрос передан», «Передам на проверку», «Для регистрации выберите другой логин», «Ответ придёт в этом чате», "We'll follow up here"). Вежливые формулы — НЕ итог: «Пожалуйста», «Рад помочь», «Отлично», «Спасибо за обращение», «Оқасы жоқ», «Көмегім тигеніне қуаныштымын», "You're welcome", "Happy to help", "Glad it worked".
- offer_more_help_turn: предложение дальнейшей помощи («Если вопрос останется, напишите», «Чем ещё помочь?», "Anything else I can help with?").

ШАГ 2. КРИТЕРИИ. Для каждого критерия сначала поле checks — 1–2 короткие фразы с ответами на вопросы процедуры и ссылками [i], затем answer. Процедуры по смыслу критерия (применяй к критерию с таким смыслом):
A. Установление контакта: смотри только ПЕРВУЮ реплику оператора. «Да» — в ней есть приветствие и представление (имя, «[Имя скрыто]» или «поддержка Freedom Broker») на языке клиента. Нет приветствия, нет имени, неформальное «Привет» без имени, приветствие только в более поздней реплике — «нет».
B. Выявление потребности: (1) оператор спросил то, что клиент уже сообщил (боту или ему), или ответил не на тот вопрос, проигнорировав названные клиентом детали → «нет». (2) Без недостающей детали (площадка, бумага, документ, текст ошибки, валюта, где именно клиент находится) ответ был невозможен или рискован: оператор уточнил до ответа → «да»; ответил наугад → «нет». (3) Клиент так и не сформулировал запрос, оператор спросил, чем помочь → «да». (4) Иначе запрос был ясен с самого начала → N/A: не ставь «да» за «учёт деталей» и «нет» за отсутствие вопросов. Подтверждение уже ясного запроса («Вам нужны реквизиты, верно?») — не уточнение.
C. Идентификация: (1) есть account_data_before_verification_turn → «нет». (2) В чате был защищённый шаг — оператор сообщил сведения о конкретном счёте или проверил, изменил или передал на проверку операцию по счёту (обещание сделать это, когда клиент пришлёт данные, — ещё не шаг): личность подтверждена до этого шага → «да»; не подтверждена → «нет». (3) Защищённого шага не было → N/A: общий вопрос, тариф, навигация, документы; или оператор только собрал несекретные детали (тикер, текст ошибки, где клиент смотрит), а клиент ушёл; или оператор правильно попросил пройти проверку, клиент отказался и ничего о счёте не раскрыто.
D. Консультация (шкала): клиент ушёл, не сформулировав запрос → N/A. Иначе по client_requests: все существенные вопросы закрыты или дан корректный следующий шаг (передача специалистам с собранными данными и сказано, где или когда будет ответ) → верхняя ступень; главный вопрос решён, упущена второстепенная деталь → вторая ступень; часть запроса закрыта, существенный вопрос остался открытым → средняя ступень; лишь общая подсказка или голое «передам на проверку» без ответа на главный вопрос и без того, что будет дальше → нижняя ненулевая ступень; ответа по существу нет или ключевая рекомендация ошибочна → 0. Если клиент подтвердил, что ответ помог («Вижу, спасибо», «Нашёл», "That worked"), этот вопрос решён. Передача специалистам после сбора нужных данных (и проверки личности, если она нужна), но без слов, где или когда будет ответ, — вторая ступень, не нижняя. Ответ по существу — конкретная инструкция или сведения от самого оператора; «Всё есть в приложении» и подобное — не ответ (0), даже если раньше подсказал бот. Ошибку, которую оператор сам исправил, оценивай по итоговому состоянию. Грубые нарушения консультацию не снижают: если вопрос клиента решён, а потом прозвучало недопустимое предложение, консультация — верхняя ступень.
E. Эмпатия и клиентоориентированность: «нет», если оператор хоть раз был груб, саркастичен или пренебрежителен («Ну, тогда сайт.», «Всё есть в приложении», отказ ответить на новый вопрос с отсылкой к уже сказанному — «Путь я указал», голое «До свидания» в ответ на вопрос) ИЛИ клиент выразил недовольство, беспокойство или возражение, а оператор не отреагировал на суть или отмахнулся. Иначе «да»: если клиент не жаловался, достаточно вежливости, отдельная фраза сочувствия не обязательна.
F. Управление диалогом (шкала): посчитай сбои по вине оператора — каждый client_reasks с причиной operator_*; вопрос клиента, оставшийся без ответа; непонятная или противоречивая реплика; заметное ожидание (около 2 минут и больше между репликой клиента и ответом оператора по времени) без предупреждения. Не считай reaction_to_misconduct, new_topic, confirmation и очередь до подключения оператора. Ход диалога непонятен из-за бессвязных или противоречивых реплик → 0. Клиенту пришлось переспросить или повторить из-за оператора, ИЛИ его вопрос остался без ответа и продолжить он не смог, ИЛИ сбоев два и больше → ступень «клиенту приходится переспрашивать». Ровно один заметный сбой, клиент понял и продолжил → ступень «один заметный сбой». Сбоев нет → верхняя ступень, даже если содержание реплики недопустимо (это оценивается в грубых ошибках). Для звонков: логика, ясность, неуместные выражения, управление паузами; шум распознавания речи — не вина оператора.
G. Завершение: (1) cut_before_operator_could_close → N/A. (2) Последний вопрос клиента проигнорирован (last_client_question_ignored_turn) → «нет». (3) «Да» только если в заключительной реплике оператора (после последней реплики клиента) есть прощание И (итог или следующий шаг ИЛИ предложение помощи); ответ, данный раньше, до реплики клиента, итогом не считается. Прощание с одними вежливыми формулами («Пожалуйста. Хорошего дня!», "You're welcome. Bye!") → «нет». Чат закрыт оператором без прощания → «нет».
H. Грубые ошибки (флаг, yes = нарушение есть): yes, если есть insult_turn, off_company_offer_turn или account_data_before_verification_turn (раскрытие конфиденциальной информации). Иначе no.

ДОКАЗАТЕЛЬСТВА: для каждого ответа укажи реплику [i] и короткую точную цитату из неё. Если действие пропущено — участок (range_start..range_end), где оно ожидалось. Для N/A — kind "na_condition" и какое условие выполнено.
explanation: 1–2 коротких предложения по-русски. deduction_reason: если ответ не даёт полный балл — одной фразой, за что снижено (как увидит оператор); иначе пустая строка.
summary: причина обращения, что сделал оператор, результат — по одной короткой фразе по-русски.
Верни только JSON по схеме.`;

// eval-v5.3 = the v5.1 prompt with targeted edits (each edit must hit, so a v5.1 text change can't silently drop one).
// Rule sources per edit: docs/playbook/scoring-playbook.md (C2, C4, C5 "Why this rule").
function patchPrompt(base, edits) {
  return edits.reduce((s, [from, to]) => {
    if (!s.includes(from)) throw new Error(`eval-v5.3 prompt patch did not apply: ${from.slice(0, 60)}…`);
    return s.replace(from, to);
  }, base);
}
const SYSTEM_V53 = patchPrompt(SYSTEM_V5, [
  // facts: request statuses for a correct next step that waits on the client, and for a deflected follow-up (C4)
  ['- client_requests: каждый вопрос или запрос клиента (включая заданные боту) и чем он закончился: resolved (решён) | partly (решён частично) | handed_off_with_next_step (передан специалистам, нужные данные собраны и клиенту сказано, что будет дальше) | handed_off_without_next_step | open (остался без ответа) | wrong_answer (ответ ошибочный).',
    '- client_requests: каждый вопрос или запрос клиента по существу (включая заданные боту; просьба соединить с оператором — не запрос) и чем он закончился: resolved (решён: ответ по существу или клиент подтвердил, что получилось) | partly (решён частично) | handed_off_with_next_step (передан специалистам, нужные данные собраны и клиенту сказано, что будет дальше) | next_step_given (решить сразу нельзя без действия клиента — проверки личности, тикера, текста ошибки, сверки дат; оператор объяснил возможную причину или что сделать и прислать и что будет дальше, а клиент сам отложил) | handed_off_without_next_step | deflected (отписка: оператор сослался на уже сказанное или ответил «это нужно рассматривать отдельно», "that doesn\'t answer …", не дав ни ответа по существу, ни конкретного следующего шага) | open (остался без ответа) | wrong_answer (ответ ошибочный).'],
  // facts: the two things C2 turns on (checklist: "учёл известные детали и уточнил недостающее до ответа")
  ['- client_dissatisfaction_turns:',
    '- operator_clarifying_question_turn: первая реплика, где оператор ДО ответа по существу спрашивает недостающие сведения, без которых ответ невозможен или рискован (что клиент видит на экране, приложение или сайт, какая бумага, валюта, когда был перевод, какой документ), или спрашивает, чем помочь, если клиент так и не сформулировал запрос. НЕ уточнение: подтверждение уже ясного запроса («Вам нужны реквизиты, верно?»), «Чем ещё помочь?», запрос данных для проверки личности, вопрос о том, что клиент уже сообщил (это need_missed).\n'
    + '- need_missed_kind и need_missed_turn (реплика оператора): почему оператор НЕ выявил потребность; none и null, если такого нет. asked_known_info — спросил то, что клиент уже ясно сообщил боту или ему (уточнить подробность к сказанному — «вчера» → «примерно когда, в какое время» — не повтор); ignored_stated_details — ответил не на главный вопрос клиента, не использовав названные им детали (площадка, тип операции), и главный вопрос остался без ответа; answered_without_needed_detail — ответил или перешёл к действию, не уточнив деталь, без которой верный ответ невозможен (какая бумага или приказ, сайт или приложение, цели клиента), и ответ оказался неверным или не подошёл. НЕ сюда: при решённом главном вопросе оставленный без ответа второй или последующий вопрос (это консультация и ведение диалога); сведения, которых нет и у клиента (например, комиссия его банка).\n'
    + '- client_dissatisfaction_turns:'],
  // C2 procedure: driven by the two facts above; an unanswered follow-up is not a need failure
  ['B. Выявление потребности: (1) оператор спросил то, что клиент уже сообщил (боту или ему), или ответил не на тот вопрос, проигнорировав названные клиентом детали → «нет». (2) Без недостающей детали (площадка, бумага, документ, текст ошибки, валюта, где именно клиент находится) ответ был невозможен или рискован: оператор уточнил до ответа → «да»; ответил наугад → «нет». (3) Клиент так и не сформулировал запрос, оператор спросил, чем помочь → «да». (4) Иначе запрос был ясен с самого начала → N/A: не ставь «да» за «учёт деталей» и «нет» за отсутствие вопросов. Подтверждение уже ясного запроса («Вам нужны реквизиты, верно?») — не уточнение.',
    'B. Выявление потребности (по need_missed_* и operator_clarifying_question_turn): (1) есть need_missed (спросил уже известное; ответил не на главный вопрос, проигнорировав названные клиентом детали; ответил наугад без нужной детали) → «нет». (2) Иначе оператор до ответа задал уточняющий вопрос о недостающем → «да», даже если клиент описал проблему подробно: сам вопрос показывает, что данных для ответа не хватало. (3) Клиент так и не сформулировал запрос, оператор спросил, чем помочь → «да». (4) Иначе запрос был ясен с самого начала → N/A: не ставь «да» за «учёт деталей» и «нет» за отсутствие вопросов. Подтверждение уже ясного запроса («Вам нужны реквизиты, верно?») — не уточнение. Оставленный без ответа второй или последующий вопрос при решённом главном — не «нет» здесь, а снижение консультации и ведения диалога.'],
  // C4: correct next step that waits on the client = top step; deflected follow-up caps the step
  ['Ошибку, которую оператор сам исправил, оценивай по итоговому состоянию.',
    'Ошибку, которую оператор сам исправил, оценивай по итоговому состоянию. Корректный следующий шаг — тоже верхняя ступень: если без действия клиента (проверка личности, тикер, текст ошибки, сверка) ответить нельзя, а оператор объяснил возможную причину или что сделать и прислать, клиент же сам отложил (next_step_given). Отписка (deflected: «нужно рассматривать отдельно», ссылка на уже сказанное) на вопрос, который клиент задал уже в исходном запросе (в том числе боту), — средняя ступень: существенный вопрос остался открытым; отписка на новый последующий вопрос при решённом исходном запросе — вторая ступень. Верхняя ступень — только если в client_requests нет open, partly, deflected, wrong_answer и handed_off_without_next_step (вопрос, заданный прямо перед обрывом связи, не в счёт).'],
  // C5: EN form of the "pointing back instead of answering" brush-off; irritation at being re-asked; incomplete ≠ unempathetic
  ['отказ ответить на новый вопрос с отсылкой к уже сказанному — «Путь я указал», голое «До свидания» в ответ на вопрос)',
    'отказ ответить на новый вопрос с отсылкой к уже сказанному — «Путь я указал», "That\'s where the request is.", голое «До свидания» в ответ на вопрос)'],
  ['Иначе «да»: если клиент не жаловался, достаточно вежливости, отдельная фраза сочувствия не обязательна.',
    'Раздражение клиента из-за того, что оператор переспросил уже сказанное («Я уже писал», «Жоғарыда жаздым ғой», "I already said"), — тоже недовольство: если оператор не извинился и не признал этого, а просто продолжил — «нет». Иначе «да»: если клиент не жаловался, достаточно вежливости, отдельная фраза сочувствия не обязательна. Неполный или ошибочный ответ сам по себе — снижение консультации, а не эмпатии.'],
]);

const evidenceSchema = {
  type: 'object', additionalProperties: false,
  required: ['kind', 'turn_index', 'range_start', 'range_end', 'quote'],
  properties: {
    kind: { type: 'string', enum: ['message', 'range', 'na_condition'] },
    turn_index: { type: ['integer', 'null'] }, range_start: { type: ['integer', 'null'] }, range_end: { type: ['integer', 'null'] },
    quote: { type: 'string' },
  },
};
const summarySchema = { type: 'object', additionalProperties: false, required: ['reason', 'operator_actions', 'outcome'],
  properties: { reason: { type: 'string' }, operator_actions: { type: 'string' }, outcome: { type: 'string' } } };

const TURN = { type: ['integer', 'null'] };
const FACT_TURNS = ['operator_first_turn', 'identity_verified_turn', 'account_data_before_verification_turn', 'insult_turn', 'off_company_offer_turn',
  'last_client_question_ignored_turn', 'operator_goodbye_turn', 'summary_or_next_step_turn', 'offer_more_help_turn'];
const factsSchema = {
  type: 'object', additionalProperties: false,
  required: ['client_requests', 'operator_first_turn', 'identity_verified_turn', 'account_data_before_verification_turn', 'insult_turn',
    'off_company_offer_turn', 'client_reasks', 'client_dissatisfaction_turns', 'ending', 'cut_before_operator_could_close',
    'last_client_question_ignored_turn', 'operator_goodbye_turn', 'summary_or_next_step_turn', 'offer_more_help_turn'],
  properties: {
    client_requests: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['turn', 'request', 'status'],
      properties: { turn: { type: 'integer' }, request: { type: 'string' },
        status: { type: 'string', enum: ['resolved', 'partly', 'handed_off_with_next_step', 'handed_off_without_next_step', 'open', 'wrong_answer'] } } } },
    operator_first_turn: TURN, identity_verified_turn: TURN, account_data_before_verification_turn: TURN, insult_turn: TURN, off_company_offer_turn: TURN,
    client_reasks: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['turn', 'cause'],
      properties: { turn: { type: 'integer' }, cause: { type: 'string', enum: ['operator_unclear', 'operator_ignored_question', 'operator_asked_known_info',
        'operator_wrong_answer', 'reaction_to_misconduct', 'new_topic', 'confirmation'] } } } },
    client_dissatisfaction_turns: { type: 'array', items: { type: 'integer' } },
    ending: { type: 'string', enum: ['operator_closed_chat', 'operator_last_message', 'connection_lost', 'client_left_or_hung_up', 'client_last_message'] },
    cut_before_operator_could_close: { type: 'boolean' },
    last_client_question_ignored_turn: TURN, operator_goodbye_turn: TURN, summary_or_next_step_turn: TURN, offer_more_help_turn: TURN,
  },
};
// eval-v5.3 facts: v5.1 facts + two request statuses + the need (C2) facts. Inserted before client_dissatisfaction_turns so the
// generation order follows the prompt (requests → clarifying question → need missed → dissatisfaction …).
const NEED_MISSED_KINDS = ['none', 'asked_known_info', 'ignored_stated_details', 'answered_without_needed_detail'];
const factsSchemaV53 = (() => {
  const props = {};
  for (const [k, v] of Object.entries(factsSchema.properties)) {
    if (k === 'client_dissatisfaction_turns') {
      props.operator_clarifying_question_turn = TURN;
      props.need_missed_kind = { type: 'string', enum: NEED_MISSED_KINDS };
      props.need_missed_turn = TURN;
    }
    props[k] = v;
  }
  const req = props.client_requests.items;
  props.client_requests = { ...props.client_requests, items: { ...req, properties: { ...req.properties,
    status: { type: 'string', enum: ['resolved', 'partly', 'handed_off_with_next_step', 'next_step_given', 'handed_off_without_next_step', 'deflected', 'open', 'wrong_answer'] } } } };
  return { ...factsSchema, required: Object.keys(props), properties: props };
})();

export function schemaFor(cl, version = PROMPT_VERSION) {
  const ids = cl.criteria.map((c) => c.id);
  if (version === 'eval-v4') {
    return {
      type: 'object', additionalProperties: false, required: ['summary', 'criteria'],
      properties: {
        summary: summarySchema,
        criteria: { type: 'array', items: { type: 'object', additionalProperties: false,
          required: ['criterion_id', 'answer', 'explanation', 'deduction_reason', 'evidence'],
          properties: { criterion_id: { type: 'string', enum: ids }, answer: { type: 'string' }, explanation: { type: 'string' },
            deduction_reason: { type: 'string' }, evidence: { type: 'array', items: evidenceSchema } } } },
      },
    };
  }
  // v5: property order = generation order (facts → checks → answer), so the model commits to evidence before verdicts.
  return {
    type: 'object', additionalProperties: false, required: ['facts', 'criteria', 'summary'],
    properties: {
      facts: version === 'eval-v5.3' ? factsSchemaV53 : factsSchema,
      criteria: { type: 'array', items: { type: 'object', additionalProperties: false,
        required: ['criterion_id', 'checks', 'answer', 'explanation', 'deduction_reason', 'evidence'],
        properties: { criterion_id: { type: 'string', enum: ids }, checks: { type: 'string' }, answer: { type: 'string' }, explanation: { type: 'string' },
          deduction_reason: { type: 'string' }, evidence: { type: 'array', items: evidenceSchema } } } },
      summary: summarySchema,
    },
  };
}

export function buildMessages(conv, cl, version = PROMPT_VERSION) {
  if (version === 'eval-v4') {
    return [
      { role: 'system', content: SYSTEM_V4 },
      { role: 'user', content: `Канал: ${conv.channel}. Язык: ${conv.language}.\n\nЧЕК-ЛИСТ:\n${renderChecklist(cl)}\n\nДИАЛОГ (номер реплики в скобках):\n${renderTranscript(conv)}\n\nОцени каждый критерий (${cl.criteria.length} шт.).` },
    ];
  }
  return [
    { role: 'system', content: version === 'eval-v5.3' ? SYSTEM_V53 : SYSTEM_V5 },
    { role: 'user', content: `Канал: ${conv.channel}. Язык: ${conv.language}.\n\nЧЕК-ЛИСТ:\n${renderChecklist(cl)}\n\nДИАЛОГ (номер реплики в скобках, время от начала):\n${renderTranscript(conv)}\n\nСначала заполни facts, затем оцени каждый критерий (${cl.criteria.length} шт.).` },
  ];
}

/** Validate + normalize model output against the transcript and checklist. Never trust indices or quotes blindly. */
export function normalize(raw, conv, cl) {
  const n = conv.transcript.length;
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const out = {}; const problems = [];
  const squash = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  for (const c of cl.criteria) {
    const rows = (raw.criteria || []).filter((x) => x.criterion_id === c.id);
    const r = rows[0];
    if (!r) { problems.push(`${c.id}: missing`); continue; }
    if (rows.some((x) => String(x.answer).trim().toLowerCase() !== String(r.answer).trim().toLowerCase())) problems.push(`${c.id}: conflicting duplicate answers`);
    let a = String(r.answer).trim().toLowerCase();
    if (['да', 'yes', 'true'].includes(a)) a = 'yes';
    if (['нет', 'no', 'false'].includes(a)) a = 'no';
    if (['n/a', 'na', 'н/п'].includes(a)) a = 'na';
    let answer = c.type === 'scale' && a !== 'na' ? Number(a) : a;
    if (!allowed(c).includes(String(answer))) {
      problems.push(`${c.id}: invalid answer ${r.answer}`);
      // snap invalid scale numbers to nearest step; otherwise leave for retry/human
      if (c.type === 'scale' && Number.isFinite(answer)) answer = c.scale.reduce((b, s) => (Math.abs(s.value - answer) < Math.abs(b - answer) ? s.value : b), c.scale[0].value);
      else continue;
    }
    const evidence = (r.evidence || []).map((e) => {
      if (e.kind === 'message' && inRange(e.turn_index)) {
        const line = conv.transcript[e.turn_index].text;
        // The model's quote must actually come from that line; we still show the real text, but record the mismatch.
        if (e.quote && squash(e.quote).length > 3 && !squash(line).includes(squash(e.quote).slice(0, 60))) problems.push(`${c.id}: quote not found in turn ${e.turn_index}`);
        return { kind: 'message', turn_index: e.turn_index, quote: line.slice(0, 200) };
      }
      if (e.kind === 'range' && inRange(e.range_start) && inRange(e.range_end)) return { kind: 'range', range: [Math.min(e.range_start, e.range_end), Math.max(e.range_start, e.range_end)] };
      if (e.kind === 'na_condition') {
        if (answer === 'na' && c.na_allowed) return { kind: 'na_condition', quote: e.quote || c.na_condition || '' };
        problems.push(`${c.id}: N/A evidence for a non-N/A answer`); return null;
      }
      problems.push(`${c.id}: dropped invalid evidence`); return null;
    }).filter(Boolean);
    // Every scored or flagged judgement needs a transcript reference (AGENTS §8). A clean flag ("no violation") may have none.
    const needsRef = answer !== 'na' && !(c.type === 'flag' && answer === 'no');
    if (needsRef && !evidence.some((e) => e.kind === 'message' || e.kind === 'range')) problems.push(`${c.id}: no transcript evidence`);
    out[c.id] = { answer, explanation: r.explanation || '', deduction_reason: r.deduction_reason || '', evidence };
  }
  return { answers: out, summary: raw.summary || null, problems };
}

/** v5 dialog facts: keep only indices that exist and point at the right speaker. Notes never trigger a paid retry. */
export function normalizeFacts(rawFacts, conv, version = 'eval-v5.1') {
  if (!rawFacts || typeof rawFacts !== 'object') return { facts: null, notes: ['facts: missing'] };
  const t = conv.transcript, notes = [];
  const ok = (i) => Number.isInteger(i) && i >= 0 && i < t.length;
  const opTurn = (k) => {
    const i = rawFacts[k];
    if (i == null) return null;
    if (!ok(i)) { notes.push(`facts.${k}: turn ${i} out of range`); return null; }
    if (k === 'identity_verified_turn') return i; // system event or the operator's confirmation
    if (k === 'last_client_question_ignored_turn') { if (t[i].speaker !== 'client') { notes.push(`facts.${k}: turn ${i} is not the client`); return null; } return i; }
    if (t[i].speaker !== 'operator') { notes.push(`facts.${k}: turn ${i} is not the operator`); return null; }
    return i;
  };
  const facts = Object.fromEntries(FACT_TURNS.map((k) => [k, opTurn(k)]));
  facts.client_requests = (rawFacts.client_requests || []).filter((r) => ok(r.turn));
  facts.client_reasks = (rawFacts.client_reasks || []).filter((r) => ok(r.turn));
  facts.client_dissatisfaction_turns = (rawFacts.client_dissatisfaction_turns || []).filter(ok);
  facts.ending = rawFacts.ending || null;
  facts.cut_before_operator_could_close = rawFacts.cut_before_operator_could_close === true;
  if (version === 'eval-v5.3') {
    facts.operator_clarifying_question_turn = opTurn('operator_clarifying_question_turn');
    const kind = NEED_MISSED_KINDS.includes(rawFacts.need_missed_kind) ? rawFacts.need_missed_kind : 'none';
    // The kind is kept even if its turn is not a valid operator line (then the turn is null and noted): a stated reason still
    // backs a C2 "no", so the C2 rule never flips an answer because of a bad index alone. Notes never trigger a paid retry.
    facts.need_missed_kind = kind;
    facts.need_missed_turn = kind === 'none' ? null : opTurn('need_missed_turn');
  }
  return { facts, notes };
}

// ---------- deterministic derivation for the unchanged built-in criteria (playbook §2 C3, C7, C8; eval-v5.3 also C2, C4) ----------
// Applied only when title + description + type + N/A settings (and scale steps) equal freedom-chat v1 (weights may change).
// Any text edit in the checklist UI → the model's own judgement is used for that criterion (playbook §4).
const BUILTIN = {
  need: { title: 'Выявление потребности', type: 'binary', na_allowed: true, description: 'Да — оператор учёл известные детали и уточнил недостающее до ответа.' },
  consultation: { title: 'Корректная и полная консультация', type: 'scale', na_allowed: true, steps: [20, 15, 10, 5, 0],
    description: 'Правильно и полно ли решён запрос или дан корректный следующий шаг.' },
  identification: { title: 'Идентификация', type: 'binary', na_allowed: true,
    description: 'Да — проверка личности подтверждена до раскрытия данных или защищённого действия. Если требовалась проверка перед защищённым действием и она не подтверждена в чате — Нет.' },
  closing: { title: 'Завершение', type: 'binary', na_allowed: true, description: 'Да — оператор подвёл итог или предложил дальнейшую помощь и попрощался.' },
  gross: { title: 'Грубые ошибки', type: 'flag', na_allowed: false,
    description: 'Да — выявлено оскорбление клиента, предложение платной услуги в обход компании (перевести деньги оператору лично, личный номер для частной платной консультации; достаточно самого предложения) или раскрытие конфиденциальной информации.' },
};
const norm = (s) => String(s || '').replace(/\s+/g, ' ').trim();
export function builtinRole(c) {
  for (const [role, b] of Object.entries(BUILTIN)) {
    const sameSteps = !b.steps || (Array.isArray(c.scale) && c.scale.map((s) => s.value).join() === b.steps.join());
    if (norm(c.title) === b.title && norm(c.description) === norm(b.description) && c.type === b.type && Boolean(c.na_allowed) === b.na_allowed && sameSteps) return role;
  }
  return null;
}

const msg = (i) => ({ kind: 'message', turn_index: i, quote: '' });
/** Literal closing rule (organizer ruling #2814/#3024): (summary OR offer of help) AND goodbye; N/A only if the chat was cut. */
export function closingAnswer(facts, conv) {
  const t = conv.transcript;
  const ops = t.map((m, i) => (m.speaker === 'operator' ? i : -1)).filter((i) => i >= 0);
  // closing block = the operator's final message plus the operator messages right before it (no client line in between)
  const tail = new Set();
  for (let i = ops.length ? ops[ops.length - 1] : -1; i >= 0 && t[i].speaker !== 'client'; i--) if (t[i].speaker === 'operator') tail.add(i);
  const bye = tail.has(facts.operator_goodbye_turn) ? facts.operator_goodbye_turn : null, sum = tail.has(facts.summary_or_next_step_turn) ? facts.summary_or_next_step_turn : null;
  const offer = tail.has(facts.offer_more_help_turn) ? facts.offer_more_help_turn : null;
  const open = facts.last_client_question_ignored_turn;
  const lastOp = ops.length ? ops[ops.length - 1] : null;
  if (bye != null && (sum != null || offer != null) && open == null) {
    return { answer: 'yes', explanation: 'Оператор подвёл итог или предложил помощь и попрощался.', deduction_reason: '',
      evidence: [...new Set([sum ?? offer, bye])].map(msg) };
  }
  if (facts.cut_before_operator_could_close && bye == null) {
    const ev = t.findLastIndex((m) => m.speaker === 'system');
    return { answer: 'na', explanation: 'Чат оборвался до того, как оператор мог его завершить.', deduction_reason: '',
      evidence: [{ kind: 'na_condition', quote: 'Чат оборвался до возможности его завершить.' }, ...(ev >= 0 ? [msg(ev)] : [])] };
  }
  if (open != null) {
    return { answer: 'no', explanation: `Последний вопрос клиента [${open}] остался без реакции оператора.`, deduction_reason: 'Последний вопрос клиента оставлен без ответа при завершении.',
      evidence: [msg(open), ...(lastOp != null && lastOp > open ? [msg(lastOp)] : [])] };
  }
  if (bye == null) {
    return { answer: 'no', explanation: 'Оператор не попрощался с клиентом.', deduction_reason: 'Нет прощания при завершении чата.',
      evidence: lastOp != null ? [{ kind: 'range', range: [lastOp, t.length - 1] }] : [] };
  }
  return { answer: 'no', explanation: 'Есть прощание, но нет итога и предложения дальнейшей помощи.', deduction_reason: 'Прощание без итога и без предложения помощи.',
    evidence: [msg(bye)] };
}

const CLOSED = new Set(['resolved', 'handed_off_with_next_step', 'next_step_given']);
/** The need failure the facts actually support. Each kind's definition in the prompt has a condition that other facts can check:
 *  ignored_stated_details needs the main (first) request to stay unanswered; answered_without_needed_detail needs the answer to have
 *  turned out wrong or not to fit (a wrong_answer request, or the client correcting / re-asking after that operator turn). */
export function needMiss(facts) {
  const kind = facts.need_missed_kind;
  if (!kind || kind === 'none') return null;
  const reqs = [...(facts.client_requests || [])].sort((x, y) => x.turn - y.turn);
  if (kind === 'ignored_stated_details' && reqs.length && CLOSED.has(reqs[0].status)) return null;
  if (kind === 'answered_without_needed_detail') {
    const t = facts.need_missed_turn ?? -1;
    const corrected = (facts.client_reasks || []).some((r) => r.turn > t && String(r.cause).startsWith('operator_'));
    if (!reqs.some((r) => r.status === 'wrong_answer') && !corrected) return null;
  }
  return kind;
}

/** eval-v5.3, need (C2): a "no" must have a reason the facts support, and a clarifying question rules out N/A ("data was enough from
 *  the start"). Only corrects answers that contradict the sample's own facts; a "yes", or a "no" backed by needMiss, is left to the model. */
export function needAnswer(answer, facts, c) {
  if (!('need_missed_kind' in facts)) return null; // facts without the v5.3 need fields: nothing to check against
  const a = String(answer), ask = facts.operator_clarifying_question_turn;
  if (needMiss(facts)) return null;
  const yes = () => ({ answer: 'yes', explanation: `Оператор до ответа уточнил недостающие сведения [${ask}].`, deduction_reason: '', evidence: [msg(ask)] });
  if (a === 'no') {
    return ask != null ? yes() : { answer: 'na', explanation: 'Оператор не переспрашивал известное и не отвечал наугад: данных для ответа хватало с самого начала; неполный ответ на последующий вопрос оценивается в консультации.',
      deduction_reason: '', evidence: [{ kind: 'na_condition', quote: c.na_condition || 'Данных для ответа хватало с самого начала.' }] };
  }
  if (a === 'na' && ask != null) return yes();
  return null;
}

// Request statuses that mean "not every essential question was closed and no correct next step was given".
const NOT_CLOSED = { open: 'остался без ответа', partly: 'решён частично', deflected: 'получил отписку', wrong_answer: 'ответ ошибочный', handed_off_without_next_step: 'передан без следующего шага' };
/** eval-v5.3, consultation (C4): the top step needs every request closed or a correct next step (checklist scale "20"). If the sample's
 *  own facts list a request that was not closed, cap at the second step ("main question solved, a secondary detail missed").
 *  A request asked right before the chat was cut is not the operator's miss. */
export function consultationCap(answer, facts, conv, c) {
  const steps = c.scale.map((s) => s.value).sort((x, y) => y - x);
  if (Number(answer) !== steps[0]) return null;
  const lastOp = conv.transcript.findLastIndex((m) => m.speaker === 'operator');
  const open = (facts.client_requests || []).filter((r) => NOT_CLOSED[r.status] && !(facts.cut_before_operator_could_close && r.turn > lastOp));
  if (!open.length) return null;
  const r = open[open.length - 1];
  return { answer: steps[1], explanation: `Не все вопросы клиента закрыты: вопрос [${r.turn}] ${NOT_CLOSED[r.status]}, поэтому верхняя ступень невозможна.`,
    deduction_reason: `Вопрос клиента [${r.turn}] ${NOT_CLOSED[r.status]}.`, evidence: [msg(r.turn)] };
}

/** Disclosure before verification couples identification (no) and the gross-error flag (yes); insult / off-company offer set the flag.
 *  eval-v5.3 adds the need (C2) and consultation (C4) consistency rules above. */
export function deriveBuiltins(answers, facts, conv, cl, version = 'eval-v5.1') {
  if (!facts) return { answers, derived: [] };
  const out = { ...answers }; const derived = [];
  const disclosed = facts.account_data_before_verification_turn;
  const disclosure = disclosed != null && (facts.identity_verified_turn == null || facts.identity_verified_turn > disclosed) ? disclosed : null;
  const set = (c, v) => {
    const prev = out[c.id];
    if (prev && String(prev.answer) === String(v.answer)) return; // model already agrees: keep its wording and evidence
    out[c.id] = { ...v, evidence: v.evidence.map((e) => (e.kind === 'message' ? { ...e, quote: conv.transcript[e.turn_index].text.slice(0, 200) } : e)) };
    derived.push(`${c.id}: ${prev ? prev.answer : '∅'} → ${v.answer}`);
  };
  for (const c of cl.criteria) {
    const role = builtinRole(c);
    if (!role || !out[c.id]) continue;
    if (role === 'closing') set(c, closingAnswer(facts, conv));
    if (version === 'eval-v5.3' && role === 'need') { const v = needAnswer(out[c.id].answer, facts, c); if (v) set(c, v); }
    if (version === 'eval-v5.3' && role === 'consultation') { const v = consultationCap(out[c.id].answer, facts, conv, c); if (v) set(c, v); }
    if (role === 'identification' && disclosure != null) {
      set(c, { answer: 'no', explanation: `Оператор сообщил сведения о счёте клиента [${disclosure}] до подтверждения личности.`,
        deduction_reason: 'Данные счёта раскрыты до идентификации.', evidence: [msg(disclosure)] });
    }
    if (role === 'gross') {
      const turn = facts.insult_turn ?? facts.off_company_offer_turn ?? disclosure;
      if (turn != null) {
        const what = turn === facts.insult_turn ? 'оскорбление клиента' : turn === facts.off_company_offer_turn ? 'предложение платной услуги в обход компании'
          : 'раскрытие сведений о счёте до подтверждения личности';
        set(c, { answer: 'yes', explanation: `Грубая ошибка: ${what} [${turn}].`, deduction_reason: '', evidence: [msg(turn)] });
      }
    }
  }
  return { answers: out, derived };
}

// ---------- self-consistency ----------
/** Majority vote per criterion. Ties: median step for scales, otherwise the most central sample's answer. */
export function vote(samples, cl) {
  const key = (a) => String(a);
  const counts = cl.criteria.map((c) => {
    const m = new Map();
    for (const s of samples) { const a = s.answers[c.id]?.answer; if (a !== undefined) m.set(key(a), (m.get(key(a)) || 0) + 1); }
    return [c.id, m];
  });
  const majority = Object.fromEntries(counts.map(([id, m]) => {
    const top = Math.max(0, ...m.values());
    const winners = [...m.entries()].filter(([, n]) => n === top).map(([a]) => a);
    return [id, winners.length === 1 ? winners[0] : null];
  }));
  // medoid: the sample that agrees with the clear majorities most often
  const centrality = samples.map((s) => cl.criteria.reduce((n, c) => n + (majority[c.id] != null && key(s.answers[c.id]?.answer) === majority[c.id] ? 1 : 0), 0));
  const medoid = centrality.indexOf(Math.max(...centrality));
  const answers = {}; const agreement = {};
  for (const c of cl.criteria) {
    const vals = samples.map((s) => s.answers[c.id]?.answer).filter((a) => a !== undefined);
    if (!vals.length) continue;
    let pick = majority[c.id];
    if (pick == null) {
      const nums = vals.filter((a) => typeof a === 'number').sort((a, b) => a - b);
      pick = c.type === 'scale' && nums.length === vals.length ? key(nums[Math.floor((nums.length - 1) / 2)]) : key(samples[medoid].answers[c.id]?.answer ?? vals[0]);
    }
    const from = [medoid, ...samples.keys()].find((i) => key(samples[i].answers[c.id]?.answer) === pick);
    answers[c.id] = { ...samples[from].answers[c.id] };
    agreement[c.id] = +(vals.filter((a) => key(a) === pick).length / samples.length).toFixed(2);
  }
  return { answers, agreement, medoid };
}

/** One model call with bounded repair (shared by v4 and each v5 sample). */
async function callOnce(conv, cl, { model, version }) {
  // At most 2 model calls. Retry on invalid JSON, a missing criterion, or evidence that fails validation. Cost and latency add
  // up across attempts. If criteria are still missing after the last attempt, fail loudly instead of returning a partial result.
  const MAX_ATTEMPTS = 2;
  let last = null, lastError = null, cost = 0, costKnown = false, latency = 0, promptTok = 0, complTok = 0;
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let res;
    try {
      res = await chatJSON({ model, messages: buildMessages(conv, cl, version), schema: schemaFor(cl, version), ...(version === 'eval-v4' ? {} : { maxTokens: 9000 }) });
    } catch (e) { if (e.status === 502 && attempt < MAX_ATTEMPTS) { lastError = e; continue; } throw e; }
    if (res.usage?.cost != null) { cost += res.usage.cost; costKnown = true; }
    promptTok += res.usage?.prompt_tokens || 0; complTok += res.usage?.completion_tokens || 0; latency += res.latency_ms || 0;
    const n = normalize(res.data, conv, cl);
    const complete = Object.keys(n.answers).length === cl.criteria.length;
    const f = version === 'eval-v4' ? null : normalizeFacts(res.data?.facts, conv, version);
    last = { ...n, ...(f ? { facts: f.facts, fact_notes: f.notes } : {}), complete, model: res.model, prompt_version: version, attempts: attempt, latency_ms: latency,
      usage: { prompt_tokens: promptTok, completion_tokens: complTok, cost: costKnown ? +cost.toFixed(6) : null } };
    if (complete && n.problems.length === 0) break;
  }
  if (!last) throw lastError || new Error('evaluation failed');
  if (!last.complete) throw Object.assign(new Error(`incomplete evaluation after ${last.attempts} attempts: ${last.problems.join('; ')}`), { status: 502 });
  return last;
}

/** Combine v5 samples: derive built-ins per sample, then vote. */
// `derive` overrides which version's derivation rules apply (offline what-if replays of cached samples); default: the sample's own version.
export function combineSamples(samples, conv, cl, { derive } = {}) {
  const derivedSamples = samples.map((s) => ({ ...s, ...deriveBuiltins(s.answers, s.facts, conv, cl, derive || s.prompt_version) }));
  const v = vote(derivedSamples, cl);
  const rep = derivedSamples[v.medoid];
  const sum = (k) => samples.reduce((a, s) => a + (s.usage?.[k] || 0), 0);
  const costs = samples.map((s) => s.usage?.cost).filter((x) => x != null);
  return {
    answers: v.answers, summary: rep.summary, facts: rep.facts, agreement: v.agreement, samples: samples.length,
    derived: derivedSamples.map((s, i) => s.derived.map((d) => `s${i + 1} ${d}`)).flat(),
    problems: samples.flatMap((s, i) => s.problems.map((p) => (samples.length > 1 ? `s${i + 1} ${p}` : p))),
    complete: Object.keys(v.answers).length === cl.criteria.length, model: rep.model, prompt_version: rep.prompt_version,
    attempts: samples.reduce((a, s) => a + s.attempts, 0), latency_ms: Math.max(...samples.map((s) => s.latency_ms || 0)), // samples run in parallel
    usage: { prompt_tokens: sum('prompt_tokens'), completion_tokens: sum('completion_tokens'), cost: costs.length ? +costs.reduce((a, b) => a + b, 0).toFixed(6) : null },
  };
}

/** Evaluate one conversation (cached). Returns CONTRACTS §3-like object without points (scoring adds them). */
export async function evaluate(conv, cl, { model = MODELS.eval, force = false, promptVersion = PROMPT_VERSION, samples, deadlineMs } = {}) {
  const version = PROMPT_VERSIONS.includes(promptVersion) ? promptVersion : PROMPT_VERSION;
  if (version === 'eval-v4') {
    const keyParts = ['eval-v4', model, conv.conversation_id, conv.transcript, cl.criteria];
    const run = () => callOnce(conv, cl, { model, version });
    if (force) return { value: await run(), cached: false };
    return cached('eval', keyParts, run);
  }
  const k = Math.max(1, Math.min(7, Number(samples ?? process.env.CQA_EVAL_SAMPLES ?? (model === MODELS.eval ? DEFAULT_SAMPLES : 1)) || 1));
  // Each sample is cached on its own, so raising k later reuses the samples already paid for.
  const one = (i) => {
    const run = () => callOnce(conv, cl, { model, version });
    if (force) return run().then((value) => ({ value, cached: false, tier: 'none' }));
    return cached('eval', [version, model, conv.conversation_id, conv.transcript, cl.criteria, `sample-${i}`], run);
  };
  // On a time-limited host (Vercel maxDuration 60 s) vote over the samples that finished by the deadline; the first sample is always awaited.
  const deadline = Number(deadlineMs ?? process.env.CQA_EVAL_DEADLINE_MS ?? (process.env.VERCEL ? 45000 : 0)) || 0;
  const done = new Array(k);
  const all = Promise.all(Array.from({ length: k }, (_, i) => one(i).then((v) => (done[i] = { ok: true, v }), (e) => (done[i] = { ok: false, e }))));
  if (deadline > 0 && k > 1) {
    let timer; await Promise.race([all, new Promise((r) => { timer = setTimeout(r, deadline); })]); clearTimeout(timer);
    if (!done.some((d) => d?.ok)) await all;
  } else await all;
  const ok = done.filter((d) => d?.ok).map((d) => d.v);
  if (!ok.length) throw done.find((d) => d && !d.ok)?.e || new Error('evaluation failed');
  const value = combineSamples(ok.map((r) => r.value), conv, cl);
  const failed = done.filter((d) => d && !d.ok), late = k - done.filter(Boolean).length;
  if (failed.length) value.problems.push(`${failed.length} of ${k} samples failed: ${failed[0].e?.message}`);
  if (late) value.problems.push(`${late} of ${k} samples missed the ${deadline} ms deadline`);
  return { value, cached: ok.every((r) => r.cached), tier: ok[0].tier };
}
