// LLM evaluator: conversation + checklist → per-criterion answer, explanation, deduction reason, evidence.
// The model NEVER computes points; prototype/scoring.js (→ app/src/scoring.ts) does. Output shape: docs/CONTRACTS.md §3.
import { chatJSON, MODELS } from './llm.js'; // routes openai:<model> → OpenAI direct, else OpenRouter
import { cached } from './cache.js';

export const PROMPT_VERSION = 'eval-v4';

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

const SYSTEM = `Ты — эксперт службы контроля качества Freedom Broker. Ты оцениваешь работу ОПЕРАТОРА в диалоге с клиентом по чек-листу.
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

export function schemaFor(cl) {
  const ev = {
    type: 'object', additionalProperties: false,
    required: ['kind', 'turn_index', 'range_start', 'range_end', 'quote'],
    properties: {
      kind: { type: 'string', enum: ['message', 'range', 'na_condition'] },
      turn_index: { type: ['integer', 'null'] }, range_start: { type: ['integer', 'null'] }, range_end: { type: ['integer', 'null'] },
      quote: { type: 'string' },
    },
  };
  return {
    type: 'object', additionalProperties: false, required: ['summary', 'criteria'],
    properties: {
      summary: { type: 'object', additionalProperties: false, required: ['reason', 'operator_actions', 'outcome'],
        properties: { reason: { type: 'string' }, operator_actions: { type: 'string' }, outcome: { type: 'string' } } },
      criteria: {
        type: 'array',
        items: {
          type: 'object', additionalProperties: false,
          required: ['criterion_id', 'answer', 'explanation', 'deduction_reason', 'evidence'],
          properties: {
            criterion_id: { type: 'string', enum: cl.criteria.map((c) => c.id) },
            answer: { type: 'string' }, explanation: { type: 'string' }, deduction_reason: { type: 'string' },
            evidence: { type: 'array', items: ev },
          },
        },
      },
    },
  };
}

export function buildMessages(conv, cl) {
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Канал: ${conv.channel}. Язык: ${conv.language}.\n\nЧЕК-ЛИСТ:\n${renderChecklist(cl)}\n\nДИАЛОГ (номер реплики в скобках):\n${renderTranscript(conv)}\n\nОцени каждый критерий (${cl.criteria.length} шт.).` },
  ];
}

/** Validate + normalize model output against the transcript and checklist. Never trust indices or quotes blindly. */
export function normalize(raw, conv, cl) {
  const n = conv.transcript.length;
  const inRange = (i) => Number.isInteger(i) && i >= 0 && i < n;
  const out = {}; const problems = [];
  for (const c of cl.criteria) {
    const r = (raw.criteria || []).find((x) => x.criterion_id === c.id);
    if (!r) { problems.push(`${c.id}: missing`); continue; }
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
      if (e.kind === 'message' && inRange(e.turn_index)) return { kind: 'message', turn_index: e.turn_index, quote: conv.transcript[e.turn_index].text.slice(0, 200) };
      if (e.kind === 'range' && inRange(e.range_start) && inRange(e.range_end)) return { kind: 'range', range: [Math.min(e.range_start, e.range_end), Math.max(e.range_start, e.range_end)] };
      if (e.kind === 'na_condition') return { kind: 'na_condition', quote: e.quote || c.na_condition || '' };
      problems.push(`${c.id}: dropped invalid evidence`); return null;
    }).filter(Boolean);
    out[c.id] = { answer, explanation: r.explanation || '', deduction_reason: r.deduction_reason || '', evidence };
  }
  return { answers: out, summary: raw.summary || null, problems };
}

/** Evaluate one conversation (cached). Returns CONTRACTS §3-like object without points (scoring adds them). */
export async function evaluate(conv, cl, { model = MODELS.eval, force = false } = {}) {
  const keyParts = [PROMPT_VERSION, model, conv.conversation_id, conv.transcript, cl.criteria];
  const run = async () => {
    let attempt = 0, last;
    while (attempt < 2) {
      attempt++;
      const res = await chatJSON({ model, messages: buildMessages(conv, cl), schema: schemaFor(cl) });
      const norm = normalize(res.data, conv, cl);
      last = { ...norm, model: res.model, prompt_version: PROMPT_VERSION, usage: res.usage, latency_ms: res.latency_ms, attempts: attempt };
      if (Object.keys(norm.answers).length === cl.criteria.length) break;
    }
    return last;
  };
  if (force) return { value: await run(), cached: false };
  return cached('eval', keyParts, run);
}
