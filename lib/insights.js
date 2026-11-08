// Admin "ask the analyst": GPT answers questions about aggregated QA analytics and proposes concrete improvements.
// Input is an aggregate the admin UI already computes (no raw personal data needed). Cached per question + data.
import { chatJSON, MODELS } from './llm.js';
import { cached } from './cache.js';

export const INSIGHTS_PROMPT_VERSION = 'insights-v2';
const SYSTEM = `Ты — аналитик контроля качества поддержки Freedom Broker. Тебе дают агрегированную статистику автоматической оценки диалогов (баллы, потери по критериям, языки, каналы, апелляции, примеры причин снижения) и вопрос руководителя.
Читатель — руководитель контроля качества, не технический специалист. Пиши по-русски, коротко и по данным: называй цифры, критерии, языки. Не выдумывай данных, которых нет. Если данных мало — скажи об этом одной фразой.
Стиль: называй критерии по названию в кавычках («Завершение»), без кодов вроде c07. Не используй служебные слова: dev, gold, mock, prompt, N/A — пиши «тестовый набор», «ручная разметка экспертов», «неприменим». Числа с запятой (5,1), баллы округляй до десятых.
Верни JSON: answer (2–3 коротких предложения: главный вывод и что делать первым), findings (2–4 наблюдения, каждое до 20 слов, с цифрой), actions (2–3 действия: title до 6 слов; detail одно предложение — что изменить в скриптах, обучении, боте или чек-листе; impact одно короткое предложение), risks (0–2 пункта, где оценка может ошибаться), follow_up_questions (2–3 коротких вопроса).`;
const schema = {
  type: 'object', additionalProperties: false, required: ['answer', 'findings', 'actions', 'risks', 'follow_up_questions'],
  properties: {
    answer: { type: 'string' },
    findings: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'object', additionalProperties: false, required: ['title', 'detail', 'impact'], properties: { title: { type: 'string' }, detail: { type: 'string' }, impact: { type: 'string' } } } },
    risks: { type: 'array', items: { type: 'string' } },
    follow_up_questions: { type: 'array', items: { type: 'string' } },
  },
};

export async function askInsights(question, stats, { model = MODELS.eval } = {}) {
  const payload = JSON.stringify(stats).slice(0, 24000);
  const r = await cached('insights', [INSIGHTS_PROMPT_VERSION, model, question, payload], () =>
    chatJSON({ model, schema, temperature: 0.2, maxTokens: 1500, messages: [{ role: 'system', content: SYSTEM }, { role: 'user', content: `СТАТИСТИКА:\n${payload}\n\nВОПРОС: ${question}` }] }));
  return { ...r.value.data, cached: r.cached, model: r.value.model, latency_ms: r.value.latency_ms, usage: r.value.usage };
}
