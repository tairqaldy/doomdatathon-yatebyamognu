// Customer-facing support assistant ("AIM") for the /support demo.
// Grounded in how real Freedom operators answered in the DEV dataset (retrieved by keyword overlap), honest about
// limits, and hands off to a human with a clear expectation of WHEN (Freedom slide: «Я передам вопрос специалистам» —
// the client still doesn't know when to expect an answer).
import { chatJSON, MODELS } from './llm.js';
import { cached } from './cache.js';
import { loadDataset } from './data.js';

export const BOT_PROMPT_VERSION = 'bot-v1';
let KB = null;

async function knowledge() {
  if (KB) return KB;
  const ds = await loadDataset('DEV');
  KB = [];
  for (const c of ds.data.records) {
    const t = c.transcript;
    for (let i = 0; i < t.length; i++) {
      if (t[i].speaker !== 'client' || t[i].text.length < 12) continue;
      const ans = t.slice(i + 1, i + 4).find((m) => m.speaker === 'operator' && m.text.length > 30);
      if (ans) KB.push({ q: t[i].text, a: ans.text, lang: c.language });
    }
  }
  return KB;
}
const tokens = (s) => new Set(s.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/).filter((w) => w.length > 3).map((w) => w.slice(0, 6)));
async function retrieve(text, k = 6) {
  const q = tokens(text); const kb = await knowledge();
  return kb.map((e) => { const t = tokens(e.q + ' ' + e.a); let s = 0; for (const w of q) if (t.has(w)) s++; return { ...e, s }; })
    .filter((e) => e.s > 0).sort((a, b) => b.s - a.s).slice(0, k);
}

const SYSTEM = `Ты — AIM, ассистент поддержки Freedom Broker (брокер, Казахстан). Говоришь на языке клиента (русский, казахский или английский).
Тон: спокойный, человечный, короткие абзацы, без канцелярита и без шаблонных фраз вроде «Отличный вопрос!». Максимум 3–4 предложения.
Правила:
1. Отвечай только тем, в чём уверен: опирайся на примеры реальных ответов операторов ниже. Не выдумывай тарифы, цифры, сроки и ссылки.
2. Не запрашивай и не раскрывай персональные данные, пароли, коды. Вопросы о конкретном счёте, деньгах клиента, выводе средств, блокировках — это передача человеку (нужна идентификация).
3. Если не можешь помочь, клиент недоволен или просит человека — передай оператору. В reply честно скажи, что передаёшь, ЧТО оператор увидит всю переписку (повторять не нужно) и КОГДА ждать ответа (в демо: «обычно до 2 минут»).
4. Никогда не притворяйся человеком.
Верни JSON: reply (текст клиенту), handoff (true/false), handoff_reason (коротко, для оператора, пусто если handoff=false), topic (2–4 слова), language (RU|KZ|EN).`;

const schema = {
  type: 'object', additionalProperties: false, required: ['reply', 'handoff', 'handoff_reason', 'topic', 'language'],
  properties: { reply: { type: 'string' }, handoff: { type: 'boolean' }, handoff_reason: { type: 'string' }, topic: { type: 'string' }, language: { type: 'string', enum: ['RU', 'KZ', 'EN'] } },
};

/** messages: [{ speaker: 'client'|'bot'|'operator'|'system', text }] → { reply, handoff, handoff_reason, topic, language } */
export async function botReply(messages, { model = MODELS.chat || MODELS.eval } = {}) {
  const lastClient = [...messages].reverse().find((m) => m.speaker === 'client')?.text || '';
  const examples = await retrieve(messages.filter((m) => m.speaker === 'client').map((m) => m.text).join(' ') || lastClient);
  const kb = examples.map((e, i) => `Пример ${i + 1} (${e.lang}). Клиент: ${e.q}\nОператор Freedom: ${e.a}`).join('\n\n');
  const convo = messages.slice(-16).map((m) => `${{ client: 'КЛИЕНТ', bot: 'AIM', operator: 'ОПЕРАТОР', system: 'СИСТЕМА' }[m.speaker] || m.speaker}: ${m.text}`).join('\n');
  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: `Примеры реальных ответов операторов Freedom (используй как базу знаний, не цитируй дословно):\n${kb || '—'}\n\nДИАЛОГ:\n${convo}\n\nОтветь клиенту.` },
  ];
  const r = await cached('chat', [BOT_PROMPT_VERSION, model, messages.slice(-16)], () => chatJSON({ model, messages: msgs, schema, temperature: 0.3, maxTokens: 600 }));
  return { ...r.value.data, cached: r.cached, model: r.value.model, latency_ms: r.value.latency_ms, usage: r.value.usage, grounded_on: examples.length };
}
