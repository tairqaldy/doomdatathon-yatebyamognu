// Admin "ask the analyst": GPT answers questions about aggregated QA analytics and proposes concrete improvements.
// Input is an aggregate the admin UI already computes (no raw personal data needed). Cached per question + data.
import { chatJSON, MODELS } from './llm.js';
import { cached } from './cache.js';

export const INSIGHTS_PROMPT_VERSION = 'insights-v1';
const SYSTEM = `Ты — аналитик контроля качества поддержки Freedom Broker. Тебе дают агрегированную статистику автоматической оценки диалогов (баллы, потери по критериям, языки, каналы, апелляции, примеры причин снижения) и вопрос руководителя.
Отвечай по-русски, конкретно и по данным: называй цифры, критерии, языки. Не выдумывай данных, которых нет. Если данных мало — скажи об этом.
Верни JSON: answer (3–6 предложений), findings (2–5 коротких наблюдений с цифрами), actions (2–5 конкретных действий: что изменить в скриптах, обучении, боте или чек-листе, с ожидаемым эффектом), risks (0–3 пункта, где возможны ошибки оценки), follow_up_questions (2–3 полезных следующих вопроса).`;
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
