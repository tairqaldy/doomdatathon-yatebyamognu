// Client-facing navigation agent for the /broker mock app (issue #14).
// The page sends its own action catalog (screens + named targets) and, as a fallback, a compact list of visible
// interactive elements. The model answers the client AND returns actions for the page to run:
//   typed:    open_screen · highlight · prefill          (targets declared by the app, reliable)
//   fallback: click · input                              (element ids from the DOM scan of the current screen)
// It never submits money/trade actions itself: protected targets can only be highlighted for the client to press.
// Consent first (#15): the reply explains the steps and asks whether to do it; the page runs `actions` only after the
// client says yes, then shows `done_reply`. No second model call is needed for the yes/no.
// All calls go through lib/llm.js + lib/cache.js (AGENTS.md §8.1).
import { chatJSON, MODELS } from './llm.js';
import { cached } from './cache.js';

export const NAV_PROMPT_VERSION = 'nav-v5'; // v2–v4: explain first (steps[]), act only after the client agrees (#15)

/** Mask card numbers and 12-digit IIN before anything reaches the model or the cache. */
export function maskPII(text) {
  return String(text)
    .replace(/\b(\d{4})[ -]?\d{4}[ -]?\d{4}[ -]?(\d{1,7})\b/g, (m, a, b) => (m.replace(/\D/g, '').length >= 13 ? `${a} **** **** ${String(b).slice(-4)}` : m))
    .replace(/\b\d{12}\b/g, '************');
}

const SYSTEM = `Ты — AIM, ассистент в приложении Freedom Broker. Ты помогаешь клиенту сделать то, что он хочет, прямо в приложении: сначала объясняешь, как это сделать, а если клиент согласится — открываешь нужный экран, подсвечиваешь кнопку или поле, заполняешь поля за него. Говоришь на языке клиента (русский, казахский или английский), коротко и по-человечески: 1–3 предложения, без канцелярита, без «Отличный вопрос!». Никогда не притворяйся человеком.

Как действовать:
1. Если в каталоге приложения есть подходящий экран или элемент — используй типовые действия: open_screen (screen), highlight (screen + target), prefill (screen + target + value). Можно несколько действий подряд: сначала open_screen, потом highlight/prefill на этом экране.
2. click / input с element_id — только запасной вариант, если нужного элемента нет в каталоге, но он есть в списке DOM текущего экрана.
3. Элементы с пометкой protected (пополнить, вывести, купить, отправить заявку) НИКОГДА не нажимай: только подсвети и скажи клиенту проверить данные и нажать самому. Не используй click для protected-элементов и для кнопок отправки форм.
4. prefill — только значениями, которые клиент сам назвал (сумма, валюта, тикер, период). Ничего не придумывай. Для select подставляй один из перечисленных вариантов.
5. СНАЧАЛА ОБЪЯСНИ, ПОТОМ СПРОСИ. Ничего не выполняется без согласия клиента.
   - steps: ОБЯЗАТЕЛЬНО, если actions не пустые: 2–4 коротких шага, как клиенту сделать это самому, с названиями экранов, полей и кнопок из каталога (без номеров, система пронумерует). Если actions пустые — пустой массив.
   - В steps, reply и done_reply пиши человеческими словами («снимите галочку „Использовать маржу“»), без технических значений вроде on/off, true/false и id элементов.
   - reply: одно короткое вводное предложение («Вот как пополнить счёт переводом из банка:»). Вопрос «помочь ли» система добавит сама — не пиши его. Не пиши, что ты уже что-то открыл или заполнил.
   - actions: действия, которые ты выполнишь, ЕСЛИ клиент согласится (сейчас они не выполняются).
   - done_reply: ОБЯЗАТЕЛЬНО, если actions не пустые. 1–2 предложения на языке клиента: что ты сделал после согласия (прошедшее время) и что клиенту сделать дальше («Открыл „Пополнение“ и заполнил сумму 50 000 ₸. Проверьте данные и нажмите „Пополнить счёт“ сами»). Если actions пустые — done_reply пустая строка.
   - Если вопрос только информационный и нечего открывать — actions пустые, просто ответь без вопроса о помощи.
6. Не выдумывай тарифы, комиссии, сроки и цифры, которых нет в тексте экрана. Если не уверен — скажи честно и предложи специалиста.
7. Вопросы про конкретный счёт клиента (почему заблокирован вывод, куда пропали деньги, почему отклонён приказ, изменение данных счёта) требуют идентификации — передай специалисту (handoff=true). Можно при этом открыть подходящий экран.
8. Если клиент недоволен, просит человека или ты не можешь помочь — handoff=true, actions пустые (ничего не открывай), done_reply пустая строка. В reply честно скажи, что передаёшь специалисту, что он увидит весь разговор и что обычно отвечают до 2 минут. handoff_reason — 1–2 фразы для оператора ВСЕГДА по-русски (даже если клиент пишет по-казахски или по-английски): суть запроса и что уже сделано.
9. Никогда не проси и не повторяй пароли, коды из SMS, номер карты, ИИН. Не давай инвестиционных рекомендаций (что купить).
Верни только JSON по схеме. Для неиспользуемых полей действия ставь null.`;

const schema = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'steps', 'done_reply', 'language', 'handoff', 'handoff_reason', 'actions'],
  properties: {
    reply: { type: 'string' },
    steps: { type: 'array', items: { type: 'string' } },
    done_reply: { type: 'string' },
    language: { type: 'string', enum: ['RU', 'KZ', 'EN'] },
    handoff: { type: 'boolean' },
    handoff_reason: { type: 'string' },
    actions: {
      type: 'array',
      items: {
        type: 'object', additionalProperties: false,
        required: ['type', 'screen', 'target', 'element_id', 'value'],
        properties: {
          type: { type: 'string', enum: ['open_screen', 'highlight', 'prefill', 'click', 'input'] },
          screen: { type: ['string', 'null'] },
          target: { type: ['string', 'null'] },
          element_id: { type: ['string', 'null'] },
          value: { type: ['string', 'null'] },
        },
      },
    },
  },
};

const clip = (s, n) => String(s ?? '').slice(0, n);

function renderCatalog(catalog = []) {
  return catalog.slice(0, 20).map((s) => {
    const targets = (s.targets || []).slice(0, 25).map((t) => {
      const opts = Array.isArray(t.options) && t.options.length ? ` варианты: ${t.options.slice(0, 8).map((o) => clip(o, 40)).join(' / ')}` : '';
      return `    - ${clip(t.id, 40)} [${clip(t.kind, 10)}${t.protected ? ', protected' : ''}] «${clip(t.label, 80)}»${opts}`;
    }).join('\n');
    return `  • screen ${clip(s.id, 30)} «${clip(s.title, 60)}»${s.summary ? ` — ${clip(s.summary, 160)}` : ''}\n${targets}`;
  }).join('\n');
}

function renderDom(dom = []) {
  return dom.slice(0, 60).map((e) => `[${clip(e.id, 30)}|${clip(e.tag, 10)}|${clip(e.type, 12)}|${clip(e.label, 60)}${e.value ? `|=${clip(e.value, 30)}` : ''}${e.protected ? '|protected' : ''}]`).join(' ');
}

/** Keep only actions that refer to things the page actually declared. Never trust the model blindly. */
export function sanitizeActions(actions, page) {
  const screens = new Map((page.catalog || []).map((s) => [s.id, s]));
  const domIds = new Map((page.dom || []).map((e) => [e.id, e]));
  const out = [];
  for (const a of actions || []) {
    if (a.type === 'open_screen' && screens.has(a.screen)) out.push({ type: 'open_screen', screen: a.screen });
    else if (a.type === 'highlight' || a.type === 'prefill') {
      const scr = screens.get(a.screen) || [...screens.values()].find((s) => (s.targets || []).some((t) => t.id === a.target));
      const tgt = scr && (scr.targets || []).find((t) => t.id === a.target);
      if (!tgt) continue;
      if (a.type === 'prefill' && (tgt.kind !== 'field' || a.value == null || tgt.protected)) { out.push({ type: 'highlight', screen: scr.id, target: tgt.id }); continue; }
      out.push(a.type === 'prefill' ? { type: 'prefill', screen: scr.id, target: tgt.id, value: maskPII(clip(a.value, 120)) } : { type: 'highlight', screen: scr.id, target: tgt.id });
    } else if (a.type === 'click' || a.type === 'input') {
      const el = domIds.get(a.element_id);
      if (!el) continue;
      if (a.type === 'click' && (el.protected || el.type === 'submit')) { out.push({ type: 'highlight_element', element_id: el.id }); continue; }
      out.push(a.type === 'input' ? { type: 'input', element_id: el.id, value: maskPII(clip(a.value, 120)) } : { type: 'click', element_id: el.id });
    }
  }
  return out.slice(0, 6);
}

/**
 * messages: [{ speaker: 'client'|'bot'|'operator'|'system', text }]
 * page: { screen, catalog: [{ id, title, summary?, targets: [{ id, label, kind: 'field'|'button'|'section', protected?, options? }] }],
 *         dom: [{ id, tag, type, label, value?, protected? }], text?: string }
 */
export async function navReply(messages, page = {}, { model = MODELS.chat || MODELS.eval, language } = {}) {
  const convo = messages.slice(-14).map((m) => ({ speaker: m.speaker, text: maskPII(clip(m.text, 1500)) }));
  const ctx = {
    screen: clip(page.screen, 30),
    catalog: renderCatalog(page.catalog),
    dom: renderDom(page.dom),
    text: maskPII(clip(page.text, 1500)),
  };
  const who = { client: 'КЛИЕНТ', bot: 'AIM', operator: 'ОПЕРАТОР', system: 'СИСТЕМА' };
  const msgs = [
    { role: 'system', content: SYSTEM },
    { role: 'user', content:
      `Язык интерфейса: ${language || 'RU'}. Текущий экран: ${ctx.screen || '—'}.\n\n` +
      `КАТАЛОГ ПРИЛОЖЕНИЯ (экраны и элементы):\n${ctx.catalog || '—'}\n\n` +
      `ЭЛЕМЕНТЫ DOM ТЕКУЩЕГО ЭКРАНА (запасной вариант):\n${ctx.dom || '—'}\n\n` +
      `ТЕКСТ ТЕКУЩЕГО ЭКРАНА:\n${ctx.text || '—'}\n\n` +
      `ДИАЛОГ:\n${convo.map((m) => `${who[m.speaker] || m.speaker}: ${m.text}`).join('\n')}\n\nОтветь клиенту и верни действия.` },
  ];
  const r = await cached('nav', [NAV_PROMPT_VERSION, model, convo, ctx], () =>
    chatJSON({ model, messages: msgs, schema, temperature: 0.2, maxTokens: 1500 }));
  const data = r.value.data || {};
  const handoff = Boolean(data.handoff);
  const actions = handoff ? [] : sanitizeActions(data.actions, page);
  return {
    reply: clip(data.reply, 1200),
    // The page must ask the client and run `actions` only after a yes; then it shows `done_reply`.
    needs_consent: actions.length > 0,
    steps: actions.length ? (Array.isArray(data.steps) ? data.steps : []).slice(0, 6).map((x) => clip(x, 200)).filter(Boolean) : [],
    done_reply: clip(data.done_reply, 600),
    language: ['RU', 'KZ', 'EN'].includes(data.language) ? data.language : (language || 'RU'),
    handoff,
    handoff_reason: clip(data.handoff_reason, 400),
    actions,
    raw_actions: (data.actions || []).length,
    cached: r.cached, model: r.value.model, latency_ms: r.value.latency_ms, usage: r.value.usage, prompt_version: NAV_PROMPT_VERSION,
  };
}
