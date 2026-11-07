// AIM navigation agent widget for /broker (issue #14). Our own implementation, no third-party code.
// Loop: client message → POST /api/agent { messages, page: { screen, catalog, dom, text } } → reply + actions → run them.
//   typed actions (reliable):  open_screen · highlight · prefill   on targets the app declares (broker/app.js SCREENS)
//   DOM fallback:              click · input · highlight_element    on elements scanned from the current screen
// Safety: protected elements are only highlighted, never pressed; the server drops actions on unknown targets.
// Consent first (#15): AIM explains the steps and asks; proposed actions wait in st.pending and run only after the
// client presses «Да» or types yes / да / иә. «Нет» leaves the page untouched. No extra model call for the answer.
// Handoff: copies the chat into a LiveSession (shared/live-store.js) → /admin/#/live operator console → QA on close.
// Voice: push-to-talk → POST /api/agent-voice (Nemotron) → text; replies read aloud with the browser's speechSynthesis.
import * as app from '/broker/app.js';
import * as store from '/shared/live-store.js';

const KEY = 'cqa-broker-agent-v1';
const CHECKLIST_URL = '/data/checklists/freedom-chat-v1.json';
const reduced = matchMedia('(prefers-reduced-motion: reduce)');

const S = {
  RU: { open: 'Спросить AIM', title: 'AIM · ассистент', sub_bot: 'Подскажу и помогу в приложении', sub_wait: 'Ждём специалиста', sub_op: '{name} на связи', sub_closed: 'Разговор завершён',
    hello: 'Здравствуйте! Я AIM, ассистент Freedom. Скажите, что нужно сделать: я объясню, как это сделать, а если захотите, открою нужный экран и заполню поля за вас. Деньги и заявки подтверждаете только вы.',
    ask_help: 'Хотите, я открою нужный экран и заполню поля за вас?', consent_yes: 'Да, помогите', consent_no: 'Нет, я сам(а)', done_default: 'Готово, всё подготовил на экране. Проверьте данные и нажмите кнопку сами.', declined: 'Хорошо, тогда по шагам выше. Если понадобится помощь, напишите.',
    placeholder: 'Например: пополнить счёт', send: 'Отправить', mic: 'Сказать голосом', mic_stop: 'Остановить запись', listening: 'Слушаю… нажмите ещё раз, чтобы закончить',
    transcribing: 'Распознаю речь…', speak_on: 'Озвучивать ответы', speak_off: 'Не озвучивать', close: 'Свернуть', thinking: 'AIM думает…', human: 'Позвать специалиста',
    chips: ['Как пополнить счёт?', 'Где мой отчёт брокера?', 'Как найти облигации?', 'Как убрать маржу?'],
    a_open: 'Открыл «{x}»', a_hl: 'Подсветил «{x}»', a_fill: 'Заполнил «{x}»: {v}', a_on: 'Поставил галочку «{x}»', a_off: 'Снял галочку «{x}»', a_click: 'Нажал «{x}»', a_hl_el: 'Подсветил «{x}», нажмите сами',
    handoff_sys: 'Разговор передан специалисту', handoff_card: 'Передаю специалисту. Он увидит весь разговор, повторять не нужно. Обычно отвечаем до 2 минут.',
    closed: 'Специалист завершил разговор. Спасибо, что обратились!', restart: 'Новый разговор', error: 'Не получилось связаться с AIM. Попробуйте ещё раз или позовите специалиста.',
    mic_denied: 'Нет доступа к микрофону. Разрешите его в браузере или напишите текстом.', voice_err: 'Не удалось распознать речь. Попробуйте ещё раз или напишите.', you: 'Вы', op: 'Специалист' },
  KZ: { open: 'AIM-нен сұрау', title: 'AIM · көмекші', sub_bot: 'Қосымшада түсіндіріп, көмектесемін', sub_wait: 'Маманды күтеміз', sub_op: '{name} байланыста', sub_closed: 'Сөйлесу аяқталды',
    hello: 'Сәлеметсіз бе! Мен AIM, Freedom көмекшісімін. Не істеу керек екенін айтыңыз: қалай істеуді түсіндіремін, ал қаласаңыз, керекті экранды ашып, өрістерді өзім толтырамын. Ақша мен өтінімдерді тек сіз растайсыз.',
    ask_help: 'Керекті экранды ашып, өрістерді өзім толтырайын ба?', consent_yes: 'Иә, көмектесіңіз', consent_no: 'Жоқ, өзім', done_default: 'Дайын, экранда бәрін дайындадым. Деректерді тексеріп, батырманы өзіңіз басыңыз.', declined: 'Жарайды, онда жоғарыдағы қадамдар бойынша жасаңыз. Көмек керек болса, жазыңыз.',
    placeholder: 'Мысалы: шотты толықтыру', send: 'Жіберу', mic: 'Дауыспен айту', mic_stop: 'Жазуды тоқтату', listening: 'Тыңдап тұрмын… аяқтау үшін қайта басыңыз',
    transcribing: 'Сөзді танып жатырмын…', speak_on: 'Жауаптарды дыбыстау', speak_off: 'Дыбыстамау', close: 'Жию', thinking: 'AIM ойланып жатыр…', human: 'Маманды шақыру',
    chips: ['Шотты қалай толықтырамын?', 'Брокер есебі қайда?', 'Облигацияларды қалай табамын?', 'Маржаны қалай алып тастаймын?'],
    a_open: '«{x}» ашылды', a_hl: '«{x}» белгіленді', a_fill: '«{x}» толтырылды: {v}', a_on: '«{x}» белгісі қойылды', a_off: '«{x}» белгісі алынды', a_click: '«{x}» басылды', a_hl_el: '«{x}» белгіленді, өзіңіз басыңыз',
    handoff_sys: 'Сөйлесу маманға берілді', handoff_card: 'Маманға беремін. Ол бүкіл сөйлесуді көреді, қайталаудың қажеті жоқ. Әдетте 2 минут ішінде жауап береміз.',
    closed: 'Маман сөйлесуді аяқтады. Хабарласқаныңызға рақмет!', restart: 'Жаңа сөйлесу', error: 'AIM-ге қосыла алмадым. Қайталап көріңіз немесе маманды шақырыңыз.',
    mic_denied: 'Микрофонға рұқсат жоқ. Браузерде рұқсат беріңіз немесе жазып жіберіңіз.', voice_err: 'Сөзді тану мүмкін болмады. Қайталап көріңіз немесе жазыңыз.', you: 'Сіз', op: 'Маман' },
  EN: { open: 'Ask AIM', title: 'AIM · assistant', sub_bot: 'I\'ll explain and help in the app', sub_wait: 'Waiting for a specialist', sub_op: '{name} is here', sub_closed: 'Conversation ended',
    hello: 'Hi! I\'m AIM, Freedom\'s assistant. Tell me what you need: I\'ll explain how to do it and, if you want, open the right screen and fill in the fields for you. Only you confirm money and orders.',
    ask_help: 'Want me to open the right screen and fill in the fields for you?', consent_yes: 'Yes, help me', consent_no: 'No, I\'ll do it', done_default: 'Done, it\'s all set up on screen. Check the details and press the button yourself.', declined: 'Okay, just follow the steps above. Write if you need help.',
    placeholder: 'For example: add funds', send: 'Send', mic: 'Speak', mic_stop: 'Stop recording', listening: 'Listening… tap again to finish',
    transcribing: 'Transcribing…', speak_on: 'Read replies aloud', speak_off: 'Don\'t read aloud', close: 'Minimise', thinking: 'AIM is thinking…', human: 'Talk to a specialist',
    chips: ['How do I add funds?', 'Where is my broker report?', 'How do I find bonds?', 'How do I turn off margin?'],
    a_open: 'Opened "{x}"', a_hl: 'Highlighted "{x}"', a_fill: 'Filled "{x}": {v}', a_on: 'Ticked "{x}"', a_off: 'Unticked "{x}"', a_click: 'Clicked "{x}"', a_hl_el: 'Highlighted "{x}", press it yourself',
    handoff_sys: 'Conversation passed to a specialist', handoff_card: 'Passing you to a specialist. They will see the whole conversation, no need to repeat yourself. We usually reply within 2 minutes.',
    closed: 'The specialist ended the conversation. Thanks for reaching out!', restart: 'New conversation', error: 'Couldn\'t reach AIM. Try again or ask for a specialist.',
    mic_denied: 'No microphone access. Allow it in the browser or type instead.', voice_err: 'Couldn\'t recognise speech. Try again or type.', you: 'You', op: 'Specialist' },
};
const tr = (k, vars = {}) => String(S[app.getLang()][k] ?? S.RU[k] ?? k).replace(/\{(\w+)\}/g, (_, v) => vars[v] ?? '');
// Consent texts follow the language AIM answered in (the client may write Russian in a Kazakh UI).
const trIn = (lang, k) => String((S[lang] || S[app.getLang()])[k] ?? S.RU[k] ?? k);

// ---------- state ----------
const load = () => { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } };
let st = load() || { open: false, messages: [], sid: null, speak: false, pending: null };
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(st)); } catch {} };
let busy = false; let voiceTurn = false;

const maskPII = (s) => String(s).replace(/\b(\d{4})[ -]?\d{4}[ -]?\d{4}[ -]?(\d{1,7})\b/g, (m, a, b) => (m.replace(/\D/g, '').length >= 13 ? `${a} **** **** ${String(b).slice(-4)}` : m)).replace(/\b\d{12}\b/g, '************');

// ---------- DOM ----------
const h = (tag, attrs = {}, ...kids) => {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) { if (k === 'on') Object.entries(v).forEach(([e, fn]) => el.addEventListener(e, fn)); else if (v != null && v !== false) el.setAttribute(k, v === true ? '' : v); }
  kids.flat().forEach((k) => k != null && el.append(k.nodeType ? k : document.createTextNode(String(k))));
  return el;
};
const ICON = {
  mic: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M10 2.5a2.5 2.5 0 0 0-2.5 2.5v5a2.5 2.5 0 0 0 5 0V5A2.5 2.5 0 0 0 10 2.5Zm-5 7.5a5 5 0 0 0 10 0M10 15v2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>',
  send: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M3.5 10h11m-4.5-5 5 5-5 5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  speak: '<svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true"><path d="M4 8v4h3l4 3V5L7 8H4Zm10-.5a3.5 3.5 0 0 1 0 5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  close: '<svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};
const root = document.getElementById('cqa-root');
const fab = h('button', { type: 'button', class: 'ag-fab', 'aria-expanded': 'false', 'aria-controls': 'ag-panel' }, h('span', { class: 'ag-fab-dot', 'aria-hidden': 'true' }), h('span', { class: 'ag-fab-text' }));
const panel = h('section', { class: 'ag-panel', id: 'ag-panel', role: 'dialog', 'aria-labelledby': 'ag-title', hidden: true });
const head = h('header', { class: 'ag-head' });
const titleEl = h('h2', { id: 'ag-title', class: 'ag-title' }); const subEl = h('p', { class: 'ag-sub' });
const speakBtn = h('button', { type: 'button', class: 'ag-icon', 'aria-pressed': 'false' }); speakBtn.innerHTML = ICON.speak;
const closeBtn = h('button', { type: 'button', class: 'ag-icon' }); closeBtn.innerHTML = ICON.close;
head.append(h('div', { class: 'ag-head-mid' }, titleEl, subEl), speakBtn, closeBtn);
const list = h('ol', { class: 'ag-list', 'aria-live': 'polite' });
const chipsEl = h('div', { class: 'ag-chips' });
const statusEl = h('p', { class: 'ag-status', role: 'status', hidden: true });
const form = h('form', { class: 'ag-form' });
const input = h('textarea', { class: 'ag-input', rows: '1', maxlength: '1500' });
const micBtn = h('button', { type: 'button', class: 'ag-icon ag-mic', 'aria-pressed': 'false' }); micBtn.innerHTML = ICON.mic;
const sendBtn = h('button', { type: 'submit', class: 'ag-icon ag-send' }); sendBtn.innerHTML = ICON.send;
form.append(input, micBtn, sendBtn);
panel.append(head, list, chipsEl, statusEl, form);
root.append(fab, panel);

// ---------- rendering ----------
const session = () => (st.sid ? store.get(st.sid) : null);
function history() { const s = session(); return s ? s.messages : st.messages; }

function renderChrome() {
  const s = session();
  fab.querySelector('.ag-fab-text').textContent = tr('open');
  fab.setAttribute('aria-expanded', String(st.open)); panel.hidden = !st.open; fab.hidden = st.open;
  titleEl.textContent = tr('title');
  const sub = !s ? tr('sub_bot') : s.status === 'waiting_operator' ? tr('sub_wait') : s.status === 'operator' ? tr('sub_op', { name: s.operator_name || tr('op') }) : s.status === 'closed' ? tr('sub_closed') : tr('sub_bot');
  subEl.textContent = sub; subEl.dataset.state = s?.status || 'bot';
  speakBtn.setAttribute('aria-pressed', String(st.speak)); speakBtn.setAttribute('aria-label', st.speak ? tr('speak_off') : tr('speak_on')); speakBtn.title = speakBtn.getAttribute('aria-label');
  closeBtn.setAttribute('aria-label', tr('close')); closeBtn.title = tr('close');
  micBtn.setAttribute('aria-label', recording ? tr('mic_stop') : tr('mic')); micBtn.title = micBtn.getAttribute('aria-label'); micBtn.setAttribute('aria-pressed', String(Boolean(recording)));
  sendBtn.setAttribute('aria-label', tr('send'));
  input.placeholder = tr('placeholder'); input.setAttribute('aria-label', tr('placeholder'));
  const closed = s?.status === 'closed';
  form.hidden = closed;
  chipsEl.replaceChildren(...(closed
    ? [h('button', { type: 'button', class: 'ag-chip', on: { click: restart } }, tr('restart'))]
    : [...(history().some((m) => m.speaker === 'client') ? [] : S[app.getLang()].chips.map((c) => h('button', { type: 'button', class: 'ag-chip', on: { click: () => send(c) } }, c))),
       ...(!s && history().some((m) => m.speaker === 'client') ? [h('button', { type: 'button', class: 'ag-chip ag-chip-human', on: { click: () => handoff('Клиент попросил специалиста') } }, tr('human'))] : [])]));
}

function renderList() {
  const msgs = history();
  list.replaceChildren(...msgs.map((m) => {
    if (m.speaker === 'system') return h('li', { class: 'ag-sys' }, m.text);
    const who = m.speaker === 'client' ? tr('you') : m.speaker === 'bot' ? 'AIM' : (session()?.operator_name || tr('op'));
    const asking = m.consent === 'pending' && st.pending && st.pending.at === m.at && !session();
    return h('li', { class: `ag-msg ag-${m.speaker}` }, h('span', { class: 'ag-who' }, who), h('p', {}, m.text),
      ...(m.actions?.length ? [h('ul', { class: 'ag-acts' }, m.actions.map((a) => h('li', {}, a)))] : []),
      ...(asking ? [h('div', { class: 'ag-consent' },
        h('button', { type: 'button', class: 'ag-chip ag-chip-yes', on: { click: () => accept() } }, trIn(st.pending.language, 'consent_yes')),
        h('button', { type: 'button', class: 'ag-chip', on: { click: () => decline() } }, trIn(st.pending.language, 'consent_no')))] : []));
  }));
  const s = session();
  if (s?.handoff && s.status === 'waiting_operator') list.append(h('li', { class: 'ag-card' }, tr('handoff_card')));
  if (s?.status === 'closed') list.append(h('li', { class: 'ag-sys' }, tr('closed')));
  list.scrollTop = list.scrollHeight;
}
const renderAll = () => { renderChrome(); renderList(); };
function setStatus(text) { statusEl.textContent = text || ''; statusEl.hidden = !text; }

// ---------- page context for the agent ----------
const VISIBLE = (el) => el.offsetParent !== null || el.getClientRects().length > 0;
function labelOf(el) {
  const aria = el.getAttribute('aria-label'); if (aria) return aria;
  if (el.id) { const l = document.querySelector(`label[for="${CSS.escape(el.id)}"] span`) || document.querySelector(`label[for="${CSS.escape(el.id)}"]`); if (l) return l.textContent.trim(); }
  return (el.textContent || el.getAttribute('placeholder') || el.getAttribute('title') || '').trim().replace(/\s+/g, ' ').slice(0, 60);
}
let autoN = 0;
function scanDom() {
  const main = document.getElementById('br-main');
  return [...main.querySelectorAll('a[href], button, input, select, textarea')].filter(VISIBLE).slice(0, 60).map((el) => {
    let id = el.dataset.target || el.dataset.agentAuto;
    if (!id) { id = `el-${++autoN}`; el.dataset.agentAuto = id; }
    const tag = el.tagName.toLowerCase();
    const value = tag === 'select' ? el.options[el.selectedIndex]?.text : el.type === 'checkbox' ? (el.checked ? 'on' : 'off') : (el.value || '');
    return { id, tag, type: el.type || tag, label: labelOf(el), ...(value ? { value: maskPII(String(value).slice(0, 40)) } : {}), ...(el.dataset.protected === 'true' || el.type === 'submit' ? { protected: true } : {}) };
  });
}
const pageContext = () => ({ screen: app.currentScreen(), catalog: app.catalog(), dom: scanDom(), text: maskPII(document.getElementById('br-main').innerText.slice(0, 1500)) });

// ---------- actions ----------
function elFor(a) {
  if (a.target) return app.findTarget(a.target);
  if (a.element_id) return document.querySelector(`#br-main [data-target="${CSS.escape(a.element_id)}"], #br-main [data-agent-auto="${CSS.escape(a.element_id)}"]`);
  return null;
}
function flash(el) {
  if (!el) return;
  el.scrollIntoView({ block: 'center', behavior: reduced.matches ? 'auto' : 'smooth' });
  el.classList.remove('ag-hl'); void el.offsetWidth; el.classList.add('ag-hl');
  setTimeout(() => el.classList.remove('ag-hl'), 6000);
}
function setValue(el, raw) {
  const v = String(raw ?? '').trim();
  if (el.tagName === 'SELECT') {
    const lv = v.toLowerCase();
    const opt = [...el.options].find((o) => o.value.toLowerCase() === lv || o.text.toLowerCase() === lv)
      || [...el.options].find((o) => o.text.toLowerCase().includes(lv) || lv.includes(o.text.toLowerCase()));
    if (!opt) return false; el.value = opt.value;
  } else if (el.type === 'checkbox') {
    el.checked = /^(on|true|yes|да|иә|1|вкл|включ)/i.test(v);
  } else {
    const clean = el.type === 'number' ? v.replace(/[^\d.,]/g, '').replace(',', '.') : v;
    const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, clean);
  }
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
const titleOf = (screen) => app.catalog().find((s) => s.id === screen)?.title || screen;
const targetLabel = (a) => app.catalog().flatMap((s) => s.targets).find((x) => x.id === a.target)?.label || labelOf(elFor(a) || document.body) || a.target || a.element_id;
const wait = (ms) => new Promise((r) => setTimeout(r, reduced.matches ? 0 : ms));

async function runActions(actions) {
  const done = [];
  for (const a of actions || []) {
    if (a.screen && a.screen !== app.currentScreen() && a.type !== 'open_screen') { await app.go(a.screen); done.push(tr('a_open', { x: titleOf(a.screen) })); await wait(250); }
    if (a.type === 'open_screen') { if (await app.go(a.screen)) done.push(tr('a_open', { x: titleOf(a.screen) })); await wait(250); continue; }
    const el = elFor(a); if (!el) continue;
    if (a.type === 'highlight') { flash(el); done.push(tr('a_hl', { x: targetLabel(a) })); }
    if (a.type === 'highlight_element') { flash(el); done.push(tr('a_hl_el', { x: labelOf(el) })); }
    if (a.type === 'prefill' || a.type === 'input') { if (setValue(el, a.value)) { const fresh = elFor(a) || el; flash(fresh); done.push(el.type === 'checkbox' ? tr(el.checked ? 'a_on' : 'a_off', { x: targetLabel(a) }) : tr('a_fill', { x: targetLabel(a), v: a.value })); } }
    if (a.type === 'click') {
      if (el.dataset.protected === 'true' || el.type === 'submit') { flash(el); done.push(tr('a_hl_el', { x: labelOf(el) })); }
      else { const lbl = labelOf(el); el.click(); flash(el); done.push(tr('a_click', { x: lbl })); }
    }
    await wait(350);
  }
  return [...new Set(done)];
}

// ---------- talking to AIM ----------
async function send(text, { voice = false } = {}) {
  const clean = maskPII(text.trim()); if (!clean || busy) return;
  voiceTurn = voice;
  const s = session();
  if (s) { if (s.status !== 'closed') store.addMessage(st.sid, 'client', clean); return renderAll(); }
  if (st.pending) {
    // A typed answer to «Хотите, я помогу?» is handled locally; anything else drops the offer and goes to AIM.
    if (YES.test(clean) && clean.length <= 40) return accept(clean);
    if (NO.test(clean) && clean.length <= 40) return decline(clean);
    dropPending();
  }
  st.messages.push({ speaker: 'client', text: clean, at: new Date().toISOString() }); save(); renderAll();
  busy = true; setStatus(tr('thinking')); sendBtn.disabled = true;
  try {
    const res = await fetch('/api/agent', { method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages: st.messages.map(({ speaker, text: tx }) => ({ speaker, text: tx })), page: pageContext(), language: app.getLang() }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    const msg = { speaker: 'bot', text: data.reply || '…', actions: [], at: new Date().toISOString() };
    // Nothing runs yet: show how to do it yourself, ask, and keep the proposed actions until the client says yes (#15).
    if (data.actions?.length && !data.handoff) {
      const steps = (data.steps || []).map((x, i) => `${i + 1}. ${String(x).replace(/^\s*\d+[.)]\s*/, '')}`);
      msg.text = [data.reply, ...steps, trIn(data.language, 'ask_help')].filter(Boolean).join('\n');
      msg.consent = 'pending';
      st.pending = { at: msg.at, actions: data.actions, done_reply: data.done_reply || '', language: data.language };
    }
    st.messages.push(msg); save(); renderAll(); setStatus('');
    if (st.speak || voiceTurn) speak(data.reply, data.language);
    if (data.handoff) handoff(data.handoff_reason || 'AIM передал специалисту');
  } catch (e) {
    console.warn('[broker-agent]', e); st.messages.push({ speaker: 'bot', text: tr('error'), at: new Date().toISOString() }); save(); renderAll();
  } finally { busy = false; setStatus(''); sendBtn.disabled = false; }
}

const YES = /^(да|ага|угу|давай|давайте|помоги|помогите|конечно|хочу|ок|окей|ok|okay|yes|yeah|yep|sure|please|иә|ия|йә|жарайды|көмектес)/i;
const NO = /^(нет|не надо|не нужно|не хочу|сам|сама|no|nope|not now|жоқ|керек емес|өзім)/i;

function dropPending() {
  const m = st.messages.find((x) => x.at === st.pending?.at); if (m) m.consent = 'skipped';
  st.pending = null; save();
}
async function accept(said) {
  const p = st.pending; if (!p || busy) return;
  const asked = st.messages.find((x) => x.at === p.at); if (asked) asked.consent = 'yes';
  st.pending = null;
  st.messages.push({ speaker: 'client', text: said || trIn(p.language, 'consent_yes'), at: new Date().toISOString() });
  const msg = { speaker: 'bot', text: p.done_reply || trIn(p.language, 'done_default'), actions: [], at: new Date().toISOString() };
  st.messages.push(msg); save(); renderAll();
  busy = true;
  try {
    // On phones the sheet covers the app: minimise it while AIM acts so the client sees the highlight.
    const narrow = matchMedia('(max-width: 860px)').matches;
    if (narrow) { st.open = false; save(); renderChrome(); }
    msg.actions = await runActions(p.actions); save(); renderList();
    if (narrow && msg.actions.length) app.toast(`AIM: ${msg.actions.join(' · ')}`);
    if (st.speak || voiceTurn) speak(msg.text, p.language);
  } finally { busy = false; }
}
function decline(said) {
  const p = st.pending; if (!p) return;
  const asked = st.messages.find((x) => x.at === p.at); if (asked) asked.consent = 'no';
  st.pending = null;
  st.messages.push({ speaker: 'client', text: said || trIn(p.language, 'consent_no'), at: new Date().toISOString() });
  st.messages.push({ speaker: 'bot', text: trIn(p.language, 'declined'), at: new Date().toISOString() });
  save(); renderAll();
  if (st.speak || voiceTurn) speak(trIn(p.language, 'declined'), p.language);
}

const mmss = (ms) => { const x = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(x / 60)).padStart(2, '0')}:${String(x % 60).padStart(2, '0')}`; };
function handoff(reason) {
  if (st.sid) return;
  if (st.pending) dropPending();
  const s = store.create({ language: app.getLang() });
  st.sid = s.id; save();
  // Keep the real times of the AIM part: QA reads timestamps (waits, response order).
  const now = new Date().toISOString();
  const first = new Date(st.messages[0]?.at || now);
  store.update(s.id, { started_at: first.toISOString(), messages: st.messages.map((m) => ({ speaker: m.speaker, text: m.text, at: m.at || now,
    timestamp: mmss(new Date(m.at || now) - first), ...(m.actions?.length ? { actions: m.actions } : {}) })) });
  store.addMessage(s.id, 'system', tr('handoff_sys'));
  store.update(s.id, { status: 'waiting_operator', handoff: { at: new Date().toISOString(), reason: `${reason} · экран: ${titleOf(app.currentScreen())}` }, source: 'broker-agent' });
  renderAll();
}

// ---------- QA after the operator closes ----------
const evaluating = new Set();
async function evaluateIfClosed() {
  const s = session(); if (!s || s.status !== 'closed' || s.evaluation || s.evaluation_status === 'pending' || evaluating.has(s.id)) return;
  evaluating.add(s.id); store.update(s.id, { evaluation_status: 'pending' });
  try {
    const checklist = await fetch(CHECKLIST_URL).then((r) => r.json());
    const res = await fetch('/api/evaluate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ conversation: store.toConversation(store.get(s.id)), checklist }) });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
    store.update(s.id, { evaluation: data, evaluation_status: 'done', evaluated_at: new Date().toISOString(), checklist_id: checklist.id, checklist_version: checklist.version });
  } catch (e) { store.update(s.id, { evaluation_status: 'error', evaluation_error: String(e.message || e).slice(0, 300) }); }
  finally { evaluating.delete(s.id); }
}

function restart() { st = { open: true, messages: [{ speaker: 'bot', text: tr('hello'), at: new Date().toISOString() }], sid: null, speak: st.speak, pending: null }; save(); renderAll(); input.focus(); }

// ---------- voice ----------
let recording = null; let chunks = []; let stopTimer = null;
function pickMime() { for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (window.MediaRecorder?.isTypeSupported?.(m)) return m; return ''; }
async function toggleMic() {
  if (recording) { recording.stop(); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) { setStatus(tr('mic_denied')); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }); } catch { setStatus(tr('mic_denied')); return; }
  const mime = pickMime(); chunks = [];
  recording = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  recording.ondataavailable = (e) => e.data.size && chunks.push(e.data);
  recording.onstop = async () => {
    clearTimeout(stopTimer); stream.getTracks().forEach((t) => t.stop());
    const type = recording.mimeType || mime || 'audio/webm'; recording = null; renderChrome();
    const blob = new Blob(chunks, { type }); if (blob.size < 1200) { setStatus(''); return; }
    setStatus(tr('transcribing'));
    try {
      // Browsers record webm/opus (Chrome) or mp4/aac (Safari); we always send 16 kHz mono WAV, which Nemotron accepts.
      const wav = await toWav16k(blob).catch(() => null);
      const sendBlob = wav || blob;
      const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(sendBlob); });
      const format = wav ? 'wav' : type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : 'webm';
      const r = await fetch('/api/agent-voice', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: b64, format, language: app.getLang() }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok || data.error || !data.text) throw new Error(data.error || 'empty');
      setStatus(''); send(data.text, { voice: true });
    } catch (e) { console.warn('[broker-agent voice]', e); setStatus(tr('voice_err')); }
  };
  recording.start(); setStatus(tr('listening')); renderChrome();
  stopTimer = setTimeout(() => recording?.state === 'recording' && recording.stop(), 30_000);
}
/** Decode any recorded blob and re-encode it as 16 kHz mono 16-bit PCM WAV (≈ 32 KB per second). */
async function toWav16k(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx || !window.OfflineAudioContext) throw new Error('no WebAudio');
  const ctx = new Ctx(); const decoded = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close?.();
  const rate = 16000; const frames = Math.ceil(decoded.duration * rate);
  const off = new OfflineAudioContext(1, frames, rate);
  const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}

function speak(text, language) {
  if (!('speechSynthesis' in window) || !text) return;
  const tag = { RU: 'ru', KZ: 'kk', EN: 'en' }[language || app.getLang()];
  const voice = speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith(tag));
  if (!voice) return; // no voice for this language (often Kazakh): stay silent rather than read it with a wrong accent
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text.replace(/[«»"]/g, '')); u.voice = voice; u.lang = voice.lang; u.rate = 1.02;
  speechSynthesis.speak(u);
}

// ---------- wiring ----------
fab.addEventListener('click', () => { st.open = true; if (!st.messages.length && !st.sid) st.messages.push({ speaker: 'bot', text: tr('hello'), at: new Date().toISOString() }); save(); renderAll(); input.focus(); });
closeBtn.addEventListener('click', () => { st.open = false; save(); renderAll(); fab.focus(); });
speakBtn.addEventListener('click', () => { st.speak = !st.speak; if (!st.speak) speechSynthesis?.cancel(); save(); renderChrome(); });
micBtn.addEventListener('click', toggleMic);
form.addEventListener('submit', (e) => { e.preventDefault(); const v = input.value; input.value = ''; autosize(); send(v); });
input.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); form.requestSubmit(); } });
const autosize = () => { input.style.height = 'auto'; input.style.height = `${Math.min(input.scrollHeight, 120)}px`; input.style.overflowY = input.scrollHeight > 120 ? 'auto' : 'hidden'; };
input.addEventListener('input', autosize);
panel.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeBtn.click(); });
store.subscribe(() => { if (st.sid) { renderAll(); evaluateIfClosed(); } });
app.onLang(() => renderAll());
renderAll(); evaluateIfClosed(); autosize();

// Exposed for debugging and tests only (not used by the page).
window.CQA = Object.assign(window.CQA || {}, { brokerAgent: { send, runActions, pageContext, handoff, toWav16k, accept, decline } });
