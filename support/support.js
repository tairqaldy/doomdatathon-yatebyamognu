// /support: customer chat with AIM (POST /api/chat), live handoff to an operator in /admin (shared/live-store.js),
// CSAT, then a background QA evaluation (POST /api/evaluate) saved into the session for the operator console.
import * as store from '/shared/live-store.js';

const SESSION_KEY = 'cqa-support-session';
const LANG_KEY = 'cqa-support-lang';
const CHECKLIST_URL = '/data/checklists/freedom-chat-v1.json';
const QUEUE_NOTICE_MS = 90_000; // no operator after this → honest "all busy" line
const ETA_MS = 120_000;         // "usually within 2 minutes" → progress line scale
const DEBUG = new URLSearchParams(location.search).has('debug');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = matchMedia('(hover: hover) and (pointer: fine)');

/* ---------------- copy ---------------- */
const STR = {
  RU: {
    title: 'Поддержка', back: 'Вернуться на главную', lang_label: 'Язык интерфейса', log_label: 'Переписка',
    status_bot: 'AIM на связи', status_waiting: 'Ждём специалиста', status_operator: '{name} на связи', status_closed: 'Разговор завершён',
    kicker: 'AIM, ассистент Freedom Broker', greet: 'Здравствуйте.',
    intro: 'Отвечаю на то, что знаю точно. Если вопрос нужно проверить или вы хотите поговорить с человеком, позову специалиста.',
    chips_label: 'Частые вопросы', chips: ['Где посмотреть мой тариф?', 'Как вывести деньги?', 'Чем D-счёт отличается от торгового?'], chip_human: 'Нужен оператор',
    placeholder: 'Напишите вопрос', placeholder_wait: 'Можно дописать детали', input_label: 'Ваше сообщение', send: 'Отправить',
    typing: 'AIM пишет ответ', hint: 'Enter — отправить, Shift+Enter — новая строка', jump: 'Перейти к новым сообщениям', jump_text: 'Новые сообщения',
    call_human: 'Позвать специалиста', end: 'Завершить разговор',
    you: 'Вы', bot_role: 'ассистент', op_role: 'специалист',
    handoff_title: 'Передаю специалисту', handoff_joined: 'Специалист на связи',
    handoff_seen: 'Он увидит весь разговор, повторять не нужно.', handoff_eta: 'Обычно отвечаем до 2 минут.',
    handoff_wait: 'Ожидание', handoff_waited: 'Подключился через',
    joined: 'К разговору подключился специалист: {name}',
    busy: 'Все специалисты сейчас заняты. Вы первый в очереди, ответим здесь же.',
    sys_handoff: 'Разговор передан специалисту', sys_closed: 'Клиент завершил разговор',
    chat_error: 'Не получилось получить ответ. Можно повторить или сразу позвать специалиста.', retry: 'Повторить',
    rate_title: 'Как прошёл разговор?', rate_body: 'Оцените, насколько вам помогли.', rate_low: 'плохо', rate_high: 'отлично',
    point: 'Оценка {n} из 5', rate_group: 'Оценка разговора', comment_ph: 'Что можно сделать лучше? Необязательно', comment_label: 'Комментарий',
    send_rating: 'Отправить оценку', skip: 'Пропустить',
    done_title: 'Спасибо.', done_body: 'Ваша оценка и этот разговор помогают Freedom улучшать поддержку. Если появится новый вопрос, мы здесь.',
    done_body_skip: 'Этот разговор поможет Freedom улучшать поддержку. Если появится новый вопрос, мы здесь.',
    new_q: 'Новый вопрос', home: 'На главную',
    debug: 'ответ за {s} с', cached: 'из кэша',
  },
  KZ: {
    title: 'Қолдау', back: 'Басты бетке оралу', lang_label: 'Интерфейс тілі', log_label: 'Хат алмасу',
    status_bot: 'AIM байланыста', status_waiting: 'Маманды күтеміз', status_operator: '{name} байланыста', status_closed: 'Сөйлесу аяқталды',
    kicker: 'AIM, Freedom Broker көмекшісі', greet: 'Сәлеметсіз бе.',
    intro: 'Нақты білетін сұрақтарға жауап беремін. Тексеру керек болса немесе адаммен сөйлескіңіз келсе, маманды шақырамын.',
    chips_label: 'Жиі қойылатын сұрақтар', chips: ['Тарифімді қайдан көремін?', 'Ақшаны қалай шығарамын?', 'D-шот сауда шотынан несімен ерекшеленеді?'], chip_human: 'Маған оператор керек',
    placeholder: 'Сұрағыңызды жазыңыз', placeholder_wait: 'Толығырақ жаза беріңіз', input_label: 'Хабарламаңыз', send: 'Жіберу',
    typing: 'AIM жауап жазып жатыр', hint: 'Enter — жіберу, Shift+Enter — жаңа жол', jump: 'Жаңа хабарларға өту', jump_text: 'Жаңа хабарлар',
    call_human: 'Маманды шақыру', end: 'Сөйлесуді аяқтау',
    you: 'Сіз', bot_role: 'көмекші', op_role: 'маман',
    handoff_title: 'Маманға беремін', handoff_joined: 'Маман байланыста',
    handoff_seen: 'Маман бүкіл хат алмасуды көреді, қайталаудың қажеті жоқ.', handoff_eta: 'Әдетте 2 минут ішінде жауап береміз.',
    handoff_wait: 'Күту', handoff_waited: 'Қосылды',
    joined: 'Сөйлесуге маман қосылды: {name}',
    busy: 'Барлық мамандар қазір бос емес. Сіз кезекте біріншісіз, осы жерде жауап береміз.',
    sys_handoff: 'Сөйлесу маманға берілді', sys_closed: 'Клиент сөйлесуді аяқтады',
    chat_error: 'Жауап алу мүмкін болмады. Қайталап көріңіз немесе маманды шақырыңыз.', retry: 'Қайталау',
    rate_title: 'Сөйлесу қалай өтті?', rate_body: 'Қаншалықты көмектескенімізді бағалаңыз.', rate_low: 'нашар', rate_high: 'өте жақсы',
    point: 'Баға: 5-тен {n}', rate_group: 'Сөйлесуді бағалау', comment_ph: 'Нені жақсартуға болады? Міндетті емес', comment_label: 'Пікір',
    send_rating: 'Бағаны жіберу', skip: 'Өткізіп жіберу',
    done_title: 'Рақмет.', done_body: 'Сіздің бағаңыз бен осы сөйлесу Freedom қолдауын жақсартуға көмектеседі. Жаңа сұрақ туса, біз осындамыз.',
    done_body_skip: 'Осы сөйлесу Freedom қолдауын жақсартуға көмектеседі. Жаңа сұрақ туса, біз осындамыз.',
    new_q: 'Жаңа сұрақ', home: 'Басты бет',
    debug: 'жауап {s} с', cached: 'кэштен',
  },
  EN: {
    title: 'Support', back: 'Back to the main page', lang_label: 'Interface language', log_label: 'Conversation',
    status_bot: 'AIM is here', status_waiting: 'Waiting for a specialist', status_operator: '{name} is here', status_closed: 'Conversation ended',
    kicker: 'AIM, Freedom Broker assistant', greet: 'Hello.',
    intro: 'I answer what I know for sure. If your question needs checking or you’d rather talk to a person, I’ll call a specialist.',
    chips_label: 'Common questions', chips: ['Where can I see my tariff?', 'How do I withdraw money?', 'How is a D-account different from a trading account?'], chip_human: 'I need a person',
    placeholder: 'Type your question', placeholder_wait: 'Add any details', input_label: 'Your message', send: 'Send',
    typing: 'AIM is writing a reply', hint: 'Enter to send, Shift+Enter for a new line', jump: 'Jump to new messages', jump_text: 'New messages',
    call_human: 'Talk to a specialist', end: 'End conversation',
    you: 'You', bot_role: 'assistant', op_role: 'specialist',
    handoff_title: 'Passing you to a specialist', handoff_joined: 'A specialist is here',
    handoff_seen: 'They will see the whole conversation, no need to repeat yourself.', handoff_eta: 'We usually reply within 2 minutes.',
    handoff_wait: 'Waiting', handoff_waited: 'Joined after',
    joined: 'Specialist {name} joined the conversation',
    busy: 'All specialists are busy right now. You are first in line, we will answer right here.',
    sys_handoff: 'Conversation passed to a specialist', sys_closed: 'Client ended the conversation',
    chat_error: 'Couldn’t get an answer. You can try again or call a specialist now.', retry: 'Try again',
    rate_title: 'How did it go?', rate_body: 'Rate how much we helped.', rate_low: 'poor', rate_high: 'great',
    point: 'Rating {n} of 5', rate_group: 'Rate the conversation', comment_ph: 'What could be better? Optional', comment_label: 'Comment',
    send_rating: 'Send rating', skip: 'Skip',
    done_title: 'Thank you.', done_body: 'Your rating and this conversation help Freedom improve support. If something else comes up, we are here.',
    done_body_skip: 'This conversation helps Freedom improve support. If something else comes up, we are here.',
    new_q: 'New question', home: 'Main page',
    debug: 'answered in {s} s', cached: 'cached',
  },
};
const HTML_LANG = { RU: 'ru', KZ: 'kk', EN: 'en' };
const LOCALE = { RU: 'ru-RU', KZ: 'kk-KZ', EN: 'en-GB' };
const ALL_BUSY = new Set(Object.values(STR).map((x) => x.busy));

let lang = readLang();
const t = (key, vars = {}) => String(STR[lang][key] ?? STR.RU[key] ?? key).replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/* ---------------- dom ---------------- */
const $ = (id) => document.getElementById(id);
const els = {
  log: $('sp-log'), msgs: $('sp-msgs'), welcome: $('sp-welcome'), chips: $('sp-chips'), typing: $('sp-typing'), jump: $('sp-jump'),
  form: $('sp-form'), input: $('sp-input'), send: $('sp-send'), foot: $('sp-foot'), human: $('sp-human'), end: $('sp-end'), hint: $('sp-hint'),
  status: $('sp-status'), statusText: $('sp-status-text'),
};
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v; else if (k === 'text') el.textContent = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null) el.append(kid);
  return el;
};

/* ---------------- state ---------------- */
let sid = null;            // current LiveSession id
let rendered = 0;          // messages already in the DOM
let lastSpeaker = null;    // for grouping consecutive bubbles
let card = null;           // handoff card element
let joinedAt = null;       // when we saw the operator accept
const joinShown = new Set();
let phase = 'chat';        // chat | rating | done
let inFlight = false;
let errorEl = null;
let stick = true;          // auto-scroll while the reader is at the bottom
let programmaticUntil = 0;
let ticker = null;

/* ---------------- i18n ---------------- */
function readLang() { try { const v = localStorage.getItem(LANG_KEY); return STR[v] ? v : 'RU'; } catch { return 'RU'; } }
function applyLang() {
  document.documentElement.lang = HTML_LANG[lang];
  document.querySelectorAll('[data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
  document.querySelectorAll('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n, el.dataset); });
  document.querySelectorAll('[data-i18n-aria]').forEach((el) => el.setAttribute('aria-label', t(el.dataset.i18nAria, el.dataset)));
  document.querySelectorAll('[data-i18n-ph]').forEach((el) => el.setAttribute('placeholder', t(el.dataset.i18nPh)));
  document.title = `${t('title')} · Freedom`;
  renderChips();
  const s = sid && store.get(sid);
  if (s) { updateStatus(s); updateControls(s); }
}
document.querySelectorAll('[data-lang]').forEach((b) => b.addEventListener('click', () => {
  lang = b.dataset.lang; try { localStorage.setItem(LANG_KEY, lang); } catch {}
  applyLang();
}));

function renderChips() {
  els.chips.replaceChildren(
    ...STR[lang].chips.map((text, i) => h('button', { type: 'button', class: 'sp-chip', style: `animation-delay:${120 + i * 60}ms`, onclick: () => sendText(text) }, text)),
    h('button', { type: 'button', class: 'sp-chip sp-chip--human', style: `animation-delay:${120 + STR[lang].chips.length * 60}ms`,
      onclick: () => { const text = t('chip_human'); ensureSession(); store.addMessage(sid, 'client', text); handoff('Клиент попросил оператора'); focusInput(); } }, t('chip_human')),
  );
}

/* ---------------- scrolling ---------------- */
const nearBottom = () => els.log.scrollHeight - els.log.scrollTop - els.log.clientHeight < 80;
function scrollToBottom(smooth = true) {
  programmaticUntil = performance.now() + 600;
  els.log.scrollTo({ top: els.log.scrollHeight, behavior: smooth && !reducedMotion.matches ? 'smooth' : 'auto' });
  stick = true; els.jump.hidden = true;
}
els.log.addEventListener('scroll', () => {
  if (performance.now() < programmaticUntil) return;
  stick = nearBottom(); if (stick) els.jump.hidden = true;
}, { passive: true });
els.jump.addEventListener('click', () => scrollToBottom());
// keep the latest message in view when the panel resizes (keyboard opening, rotation, window resize)
if ('ResizeObserver' in window) new ResizeObserver(() => { if (stick) scrollToBottom(false); }).observe(els.log);
function afterAppend(force = false, smooth = true) {
  if (force || stick) requestAnimationFrame(() => scrollToBottom(smooth));
  else els.jump.hidden = false;
}

/* ---------------- rendering ---------------- */
const fmtTime = (iso) => { try { return new Date(iso).toLocaleTimeString(LOCALE[lang], { hour: '2-digit', minute: '2-digit' }); } catch { return ''; } };

function messageEl(s, m, animate) {
  if (m.speaker === 'system') {
    lastSpeaker = 'system';
    const join = s.operator_name && m.text.includes(s.operator_name);
    return h('li', { class: `sp-sys${join ? ' sp-sys--join' : ''}${animate ? '' : ' no-anim'}` }, m.text);
  }
  const showWho = m.speaker !== lastSpeaker;
  lastSpeaker = m.speaker;
  let who = null;
  if (showWho && m.speaker === 'bot') who = h('p', { class: 'sp-who' }, 'AIM', h('span', { class: 'sp-role', 'data-i18n': 'bot_role' }, t('bot_role')));
  if (showWho && m.speaker === 'operator') who = h('p', { class: 'sp-who' }, s.operator_name || 'Freedom', h('span', { class: 'sp-role', 'data-i18n': 'op_role' }, t('op_role')));
  const metaBits = [fmtTime(m.at)];
  if (DEBUG && m.speaker === 'bot' && m.latency_ms != null) {
    metaBits.push(t('debug', { s: (m.latency_ms / 1000).toLocaleString(LOCALE[lang], { maximumFractionDigits: 1, minimumFractionDigits: 1 }) }));
    if (m.cached) metaBits.push(t('cached'));
  }
  const label = m.speaker === 'client' ? t('you') : m.speaker === 'bot' ? 'AIM' : (s.operator_name || t('op_role'));
  return h('li', { class: `sp-msg sp-msg--${m.speaker}${animate ? '' : ' no-anim'}` },
    who,
    h('div', { class: 'sp-bubble' }, h('span', { class: 'sp-sr' }, `${label}: `), m.text),
    h('p', { class: 'sp-meta' }, metaBits.filter(Boolean).join(' · ')));
}

function render(s, { animate = true } = {}) {
  let appended = false; let ownMessage = false;
  for (let i = rendered; i < s.messages.length; i++) {
    const m = s.messages[i];
    if (s.handoff && !card && new Date(m.at) > new Date(s.handoff.at)) appendCard(s, animate);
    els.msgs.append(messageEl(s, m, animate));
    appended = true; if (m.speaker === 'client') ownMessage = true;
  }
  rendered = s.messages.length;
  if (s.handoff && !card) { appendCard(s, animate); appended = true; }
  if (s.messages.length) els.welcome.classList.add('is-compact');
  updateCard(s); updateStatus(s); updateControls(s); maybeJoinNotice(s); maybeQueueNotice(s);
  if (appended) afterAppend(ownMessage, animate);
  if (s.status === 'closed' && phase === 'chat') showClosing(s, animate);
}

/* handoff card */
function appendCard(s, animate) {
  card = h('li', { class: `sp-card${animate ? '' : ' no-anim'}`, role: 'status' },
    h('span', { class: 'sp-card-icon', 'aria-hidden': 'true' }),
    h('div', { class: 'sp-card-body' },
      h('h3', { 'data-i18n': 'handoff_title' }, t('handoff_title')),
      h('p', {}, h('span', { 'data-i18n': 'handoff_seen' }, t('handoff_seen')), ' ', h('span', { 'data-i18n': 'handoff_eta' }, t('handoff_eta'))),
      h('div', { class: 'sp-card-row' }, h('span', { class: 'sp-card-label', 'data-i18n': 'handoff_wait' }, t('handoff_wait')), h('span', { class: 'sp-timer', 'aria-hidden': 'true' }, '00:00')),
      h('div', { class: 'sp-progress', 'aria-hidden': 'true' }, h('i'))));
  lastSpeaker = 'system';
  els.msgs.append(card);
  if (!ticker) ticker = setInterval(tick, 1000);
}
const mmss = (ms) => { const x = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
function updateCard(s) {
  if (!card || !s.handoff) return;
  const start = new Date(s.handoff.at).getTime();
  const joined = s.status === 'operator' || (s.status === 'closed' && s.operator_name);
  if (joined && !joinedAt) joinedAt = firstOperatorTime(s) || Date.now();
  const end = joined ? joinedAt : s.status === 'closed' ? (s.closed_at ? new Date(s.closed_at).getTime() : Date.now()) : Date.now();
  card.querySelector('.sp-timer').textContent = mmss(end - start);
  card.querySelector('.sp-progress i').style.width = `${Math.min(100, ((end - start) / ETA_MS) * 100)}%`;
  card.classList.toggle('is-done', Boolean(joined));
  const title = card.querySelector('h3'); const k = joined ? 'handoff_joined' : 'handoff_title';
  if (title.dataset.i18n !== k) { title.dataset.i18n = k; title.textContent = t(k); }
  const lbl = card.querySelector('.sp-card-label'); const lk = joined ? 'handoff_waited' : 'handoff_wait';
  if (lbl.dataset.i18n !== lk) { lbl.dataset.i18n = lk; lbl.textContent = t(lk); }
  if (s.status !== 'waiting_operator' && ticker) { clearInterval(ticker); ticker = null; }
}
function firstOperatorTime(s) {
  const after = s.messages.filter((m) => new Date(m.at) >= new Date(s.handoff.at));
  const m = after.find((x) => (x.speaker === 'system' && s.operator_name && x.text.includes(s.operator_name)) || x.speaker === 'operator');
  return m ? new Date(m.at).getTime() : null;
}
function tick() {
  const s = sid && store.get(sid); if (!s) return;
  updateCard(s); updateStatus(s); maybeQueueNotice(s);
}

/* "X joined" line: shown locally unless the console already wrote one into the session */
function maybeJoinNotice(s) {
  if (s.status !== 'operator' || !s.operator_name || joinShown.has(s.operator_name)) return;
  const name = s.operator_name; joinShown.add(name);
  setTimeout(() => {
    const cur = store.get(sid); if (!cur) return;
    const already = cur.messages.some((m) => m.speaker === 'system' && m.text.includes(name));
    if (already) return;
    els.msgs.append(h('li', { class: 'sp-sys sp-sys--join', 'data-i18n': 'joined', 'data-name': name }, t('joined', { name })));
    lastSpeaker = 'system'; afterAppend();
  }, 700);
}
function maybeQueueNotice(s) {
  if (s.status !== 'waiting_operator' || !s.handoff || s.queue_notified) return;
  if (Date.now() - new Date(s.handoff.at).getTime() < QUEUE_NOTICE_MS) return;
  if (s.messages.some((m) => m.speaker === 'system' && ALL_BUSY.has(m.text))) return;
  store.update(sid, { queue_notified: true });
  store.addMessage(sid, 'system', t('busy'));
}

/* header + footer controls */
function updateStatus(s) {
  const st = !s ? 'bot' : s.status;
  let key = 'status_bot'; let state = 'bot';
  if (st === 'waiting_operator') { key = 'status_waiting'; state = 'waiting'; }
  if (st === 'operator') { key = 'status_operator'; state = 'operator'; }
  if (st === 'closed') { key = 'status_closed'; state = 'closed'; }
  els.status.dataset.state = state;
  els.statusText.dataset.i18n = key;
  if (s?.operator_name) els.statusText.dataset.name = s.operator_name; else delete els.statusText.dataset.name;
  let text = t(key, { name: s?.operator_name || '' });
  if (st === 'waiting_operator' && s.handoff) text += ` · ${mmss(Date.now() - new Date(s.handoff.at).getTime())}`;
  els.statusText.textContent = text;
}
function updateControls(s) {
  const active = Boolean(s) && s.status !== 'closed';
  els.human.hidden = !(s && s.status === 'bot' && s.messages.length);
  els.end.hidden = !(active && s.messages.length);
  els.hint.hidden = Boolean(s && s.messages.length) || !finePointer.matches;
  els.input.placeholder = s && (s.status === 'waiting_operator') ? t('placeholder_wait') : t('placeholder');
  els.foot.classList.toggle('is-hidden', Boolean(s) && s.status === 'closed');
}
function showTyping(on) {
  els.typing.hidden = !on;
  if (on) afterAppend();
}

/* ---------------- session + bot ---------------- */
function ensureSession() {
  if (sid && store.get(sid)) return sid;
  const s = store.create({ language: lang });
  sid = s.id; rendered = 0; lastSpeaker = null;
  try { sessionStorage.setItem(SESSION_KEY, sid); } catch {}
  return sid;
}

function sendText(raw) {
  const text = raw.replace(/\s+$/g, '').replace(/^\s+/, '');
  if (!text) return;
  ensureSession();
  const s = store.get(sid);
  if (!s || s.status === 'closed') return;
  clearError();
  store.addMessage(sid, 'client', text);
  if (s.status === 'bot') askBot();
}

function pushBotMessage(text, meta) {
  store.update(sid, (s) => ({ messages: [...s.messages, {
    speaker: 'bot', text, at: new Date().toISOString(), timestamp: mmss(Date.now() - new Date(s.started_at).getTime()), ...meta,
  }] }));
}

async function askBot() {
  if (inFlight || !sid) return;
  const s = store.get(sid);
  if (!s || s.status !== 'bot' || s.messages.at(-1)?.speaker !== 'client') return;
  inFlight = true; showTyping(true);
  const sentCount = s.messages.length;
  const started = performance.now();
  let ok = false;
  try {
    const res = await fetch('/api/chat', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: s.messages.map(({ speaker, text }) => ({ speaker, text })), lang }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || typeof data.reply !== 'string' || !data.reply.trim()) throw new Error(data.error || `HTTP ${res.status}`);
    const wait = 650 - (performance.now() - started); // keep the dots visible long enough to read as a reply
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    const cur = store.get(sid);
    if (!cur || cur.status !== 'bot') { ok = true; return; } // a person took over or the chat ended meanwhile
    showTyping(false);
    pushBotMessage(data.reply.trim(), { latency_ms: data.latency_ms ?? Math.round(performance.now() - started), cached: Boolean(data.cached), model: data.model || null });
    const patch = {};
    if (data.language && STR[data.language]) patch.language = data.language;
    if (data.topic) patch.topic = data.topic;
    if (Object.keys(patch).length) store.update(sid, patch);
    if (data.handoff) handoff(data.handoff_reason || data.topic || 'AIM передал вопрос специалисту');
    ok = true;
  } catch (e) {
    console.warn('[support] /api/chat failed:', e);
    showError();
  } finally {
    inFlight = false; showTyping(false);
    const cur = sid && store.get(sid);
    if (ok && cur && cur.status === 'bot' && cur.messages.length > sentCount && cur.messages.at(-1).speaker === 'client') askBot();
  }
}

function handoff(reason) {
  if (!sid) return;
  const s = store.get(sid);
  if (!s || s.status !== 'bot') return;
  clearError();
  store.addMessage(sid, 'system', t('sys_handoff'));
  store.update(sid, { status: 'waiting_operator', handoff: { at: new Date().toISOString(), reason: String(reason || '').slice(0, 300) } });
}

function showError() {
  clearError();
  errorEl = h('li', { class: 'sp-inline', role: 'alert' },
    h('p', {}, t('chat_error')),
    h('div', { class: 'sp-inline-btns' },
      h('button', { type: 'button', onclick: () => { clearError(); askBot(); } }, t('retry')),
      h('button', { type: 'button', class: 'is-primary', onclick: () => { handoff('AIM недоступен, клиент попросил специалиста'); focusInput(); } }, t('call_human'))));
  els.msgs.append(errorEl); lastSpeaker = 'system';
  afterAppend(true);
}
function clearError() { errorEl?.remove(); errorEl = null; }

function endChat() {
  const s = sid && store.get(sid); if (!s || s.status === 'closed') return;
  store.addMessage(sid, 'system', t('sys_closed'));
  store.update(sid, { status: 'closed', closed_at: new Date().toISOString() });
}

/* ---------------- closing: rating → thank-you → background QA ---------------- */
function showClosing(s, animate = true) {
  if (s.csat != null || s.csat_skipped) return showDone(s, animate);
  phase = 'rating';
  let score = null;
  const points = [1, 2, 3, 4, 5].map((n) => h('button', {
    type: 'button', role: 'radio', 'aria-checked': 'false', 'aria-label': t('point', { n }), tabindex: n === 1 ? '0' : '-1',
    onclick: () => choose(n), onkeydown: (e) => {
      const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (dir) { e.preventDefault(); const next = Math.min(5, Math.max(1, (score || n) + dir)); choose(next); points[next - 1].focus(); }
    },
  }, String(n)));
  const comment = h('textarea', { class: 'sp-comment', rows: '3', maxlength: '1000', placeholder: t('comment_ph'), 'data-i18n-ph': 'comment_ph', 'aria-label': t('comment_label'), 'data-i18n-aria': 'comment_label' });
  const submit = h('button', { type: 'button', class: 'l-btn l-btn--primary', disabled: true, 'data-i18n': 'send_rating', onclick: () => finish(score, comment.value.trim()) }, t('send_rating'));
  function choose(n) {
    score = n;
    points.forEach((b, i) => { const on = i < n; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', String(i === n - 1)); b.tabIndex = i === n - 1 ? 0 : -1; });
    submit.disabled = false;
  }
  const el = h('li', { class: `sp-rate${animate ? '' : ' no-anim'}`, tabindex: '-1', 'aria-labelledby': 'sp-rate-title' },
    h('h3', { id: 'sp-rate-title', 'data-i18n': 'rate_title' }, t('rate_title')),
    h('p', { 'data-i18n': 'rate_body' }, t('rate_body')),
    h('div', { class: 'sp-points', role: 'radiogroup', 'aria-label': t('rate_group') }, points),
    h('div', { class: 'sp-scale', 'aria-hidden': 'true' }, h('span', { 'data-i18n': 'rate_low' }, t('rate_low')), h('span', { 'data-i18n': 'rate_high' }, t('rate_high'))),
    comment,
    h('div', { class: 'sp-rate-btns' }, submit, h('button', { type: 'button', class: 'l-btn l-btn--ghost', 'data-i18n': 'skip', onclick: () => finish(null, '') }, t('skip'))));
  els.msgs.append(el);
  afterAppend(true, animate);
  setTimeout(() => (finePointer.matches ? points[0] : el).focus({ preventScroll: true }), animate ? 350 : 0);
  function finish(csat, text) {
    store.update(sid, csat == null ? { csat_skipped: true } : { csat, csat_comment: text });
    el.remove();
    const cur = store.get(sid);
    showDone(cur, true);
  }
}

function showDone(s, animate = true) {
  phase = 'done';
  const el = h('li', { class: `sp-done${animate ? '' : ' no-anim'}`, tabindex: '-1', 'aria-labelledby': 'sp-done-title' },
    h('div', { class: 'sp-done-img', role: 'img', 'aria-hidden': 'true' }),
    h('h3', { id: 'sp-done-title', 'data-i18n': 'done_title' }, t('done_title')),
    h('p', { 'data-i18n': s.csat != null ? 'done_body' : 'done_body_skip' }, t(s.csat != null ? 'done_body' : 'done_body_skip')),
    h('div', { class: 'sp-done-btns' },
      h('button', { type: 'button', class: 'l-btn l-btn--primary', 'data-i18n': 'new_q', onclick: newQuestion }, t('new_q')),
      h('a', { class: 'l-btn l-btn--ghost', href: '/', 'data-i18n': 'home' }, t('home'))));
  els.msgs.append(el);
  afterAppend(true, animate);
  if (animate) setTimeout(() => el.focus({ preventScroll: true }), 300);
  // on restore a stale "pending" means the previous page unloaded mid-request: run it again
  if (!s.evaluation && (s.evaluation_status !== 'pending' || !animate)) runEvaluation(s.id);
}

const evaluating = new Set();
async function runEvaluation(id) {
  const s = store.get(id);
  if (!s || s.evaluation || !s.messages.length || evaluating.has(id)) return;
  evaluating.add(id);
  store.update(id, { evaluation_status: 'pending' });
  try {
    const checklist = await fetch(CHECKLIST_URL).then((r) => { if (!r.ok) throw new Error(`checklist HTTP ${r.status}`); return r.json(); });
    const res = await fetch('/api/evaluate', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ conversation: store.toConversation(store.get(id)), checklist }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    store.update(id, { evaluation: data, evaluation_status: 'done', evaluated_at: new Date().toISOString(), checklist_id: checklist.id, checklist_version: checklist.version });
  } catch (e) {
    console.warn('[support] /api/evaluate failed:', e);
    store.update(id, { evaluation_status: 'error', evaluation_error: String(e.message || e).slice(0, 300) });
  } finally { evaluating.delete(id); }
}

function newQuestion() {
  try { sessionStorage.removeItem(SESSION_KEY); } catch {}
  sid = null; rendered = 0; lastSpeaker = null; card = null; joinedAt = null; phase = 'chat'; errorEl = null;
  joinShown.clear(); if (ticker) { clearInterval(ticker); ticker = null; }
  els.msgs.replaceChildren(); els.welcome.classList.remove('is-compact');
  renderChips(); updateStatus(null); updateControls(null);
  els.log.scrollTop = 0; focusInput(true);
}

/* ---------------- composer ---------------- */
function autosize() { els.input.style.height = 'auto'; els.input.style.height = `${Math.min(els.input.scrollHeight, 152)}px`; }
function syncSend() { els.send.disabled = !els.input.value.trim(); }
function focusInput(always = false) { if (always || finePointer.matches) els.input.focus({ preventScroll: true }); }
els.input.addEventListener('input', () => { autosize(); syncSend(); });
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); els.form.requestSubmit(); }
});
els.form.addEventListener('submit', (e) => {
  e.preventDefault();
  const text = els.input.value;
  if (!text.trim()) return;
  els.input.value = ''; autosize(); syncSend();
  sendText(text);
  els.input.focus({ preventScroll: true });
});
els.human.addEventListener('click', () => { handoff('Клиент нажал «Позвать специалиста»'); focusInput(); });
els.end.addEventListener('click', endChat);

/* ---------------- live updates from this tab and the operator console ---------------- */
store.subscribe(() => { if (!sid) return; const s = store.get(sid); if (s) render(s); });

/* ---------------- boot ---------------- */
applyLang();
try { const saved = sessionStorage.getItem(SESSION_KEY); if (saved && store.get(saved)) sid = saved; else if (saved) sessionStorage.removeItem(SESSION_KEY); } catch {}
if (sid) {
  const s = store.get(sid);
  render(s, { animate: false });
  requestAnimationFrame(() => scrollToBottom(false));
  if (s.status === 'bot' && s.messages.at(-1)?.speaker === 'client') askBot(); // refreshed while AIM was answering
} else {
  updateStatus(null); updateControls(null);
}
focusInput();
