// Загрузка диалогов: any new transcript goes through the same evaluator as the DEV set, live, in front of the jury.
// Three ways in: paste the text of a dialog («Оператор: …» lines), a JSON file / JSON text (one record, an array or the
// organizers' API response), or a whole group by group_id through our /api/dataset proxy (the control set).
// Each dialog is sent inline to POST /api/evaluate (lib/evaluator.js, 3 samples + vote); points come from scoring.js.
import { $, esc, fmt, plural, icon, toast, setHead, seg, LANG, dateTime, uid } from './ui.js';
import { S, emit, on, aiEvaluate, aiReady, modelLabel, addImported, removeImported, importedConvs, mergeGroupEvaluations,
  hasAI, evaluation, checklistLabel, checklistFor, isCall, persist } from './store.js';
import { SOURCE_LABEL } from './card.js';

/* ---------- parsing ---------- */
const ROLES = [
  [/^(оператор|operator|agent|агент|менеджер|manager|специалист|specialist|support|поддержка|маман|сотрудник)$/i, 'operator'],
  [/^(клиент|client|customer|user|пользователь|тұтынушы|клиенттің|покупатель)$/i, 'client'],
  [/^(бот|bot|aim|ассистент|assistant|чат-бот|chatbot)$/i, 'bot'],
  [/^(система|system|жүйе|sys|событие|event)$/i, 'system'],
];
const roleOf = (w) => ROLES.find(([re]) => re.test(w.trim()))?.[1] || null;
const TS = '(\\d{1,2}:\\d{2}(?::\\d{2})?)';
// [00:12] Оператор: …  ·  00:12 - Оператор: …  ·  Оператор [00:12]: …  ·  Оператор (00:12): …
const LINE = new RegExp(`^(?:[\\[(]?${TS}[\\])]?\\s*[-–—|]?\\s*)?([^:：\\[\\]()]{2,24}?)\\s*(?:[\\[(]${TS}[\\])])?\\s*[:：]\\s?(.*)$`);
const toMMSS = (ts) => {
  const p = ts.split(':').map(Number);
  const sec = p.length === 3 ? p[0] * 3600 + p[1] * 60 + p[2] : p[0] * 60 + p[1];
  return { sec, s: `${String(Math.min(99, Math.floor(sec / 60))).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}` };
};
const STEP = 10; // seconds between turns when the text has no times

/** Plain text → transcript. Lines that don't start with a role continue the previous turn. */
export function parseText(text) {
  const turns = []; const errors = []; let timed = 0;
  const lines = String(text || '').replace(/\r/g, '').split('\n');
  lines.forEach((raw, n) => {
    const line = raw.replace(/^\s*(?:[-*>•]\s+)?/, '').replace(/\*\*/g, '').trimEnd();
    if (!line.trim()) return;
    const m = line.match(LINE);
    const speaker = m ? roleOf(m[2]) : null;
    if (speaker) {
      const ts = m[1] || m[3];
      turns.push({ speaker, text: (m[4] || '').trim(), ts: ts ? toMMSS(ts) : null });
      if (ts) timed++;
    } else if (turns.length) turns.at(-1).text += (turns.at(-1).text ? '\n' : '') + line.trim();
    else errors.push(`Строка ${n + 1}: не указано, кто говорит. Начните с «Оператор:», «Клиент:», «Бот:» или «Система:».`);
  });
  let t = 0;
  const transcript = turns.filter((x) => x.text).map((x, i) => {
    t = x.ts ? Math.max(x.ts.sec, i ? t : 0) : i ? t + STEP : 0;
    return { timestamp: toMMSS(`${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`).s, speaker: x.speaker, text: x.text };
  });
  if (turns.length && !transcript.some((x) => x.speaker === 'operator')) errors.push('Нет ни одной реплики оператора: оценивать нечего.');
  return { transcript, errors, timed: timed > 0 };
}
export function detectLang(text) {
  const s = String(text || '');
  const kz = (s.match(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g) || []).length;
  const cyr = (s.match(/[а-яё]/gi) || []).length, lat = (s.match(/[a-z]/gi) || []).length;
  return kz >= 3 ? 'KZ' : cyr >= lat ? 'RU' : 'EN';
}
/** JSON (one record, an array, { records }, or the organizers' { data: { records } }) → records. */
export function parseJson(text, fallbackPrefix = 'json') {
  let j; try { j = JSON.parse(text); } catch (e) { return { records: [], errors: [`Это не JSON: ${e.message}`] }; }
  const list = Array.isArray(j) ? j : j?.data?.records || j?.records || (j?.transcript ? [j] : null);
  if (!Array.isArray(list) || !list.length) return { records: [], errors: ['В JSON нет записей: ожидается запись с transcript, массив записей или ответ API { data: { records } }.'] };
  const errors = []; const records = [];
  list.forEach((r, i) => {
    const id = String(r?.conversation_id || `${fallbackPrefix}-${i + 1}`).replace(/[^A-Za-z0-9_.-]/g, '_');
    if (!Array.isArray(r?.transcript) || !r.transcript.length) { errors.push(`${id}: нет transcript`); return; }
    const transcript = r.transcript.map((m) => ({ timestamp: String(m?.timestamp ?? ''), speaker: String(m?.speaker || '').toLowerCase(), text: String(m?.text ?? '') }));
    const bad = transcript.findIndex((m) => !['client', 'operator', 'bot', 'system'].includes(m.speaker));
    if (bad >= 0) { errors.push(`${id}: реплика ${bad}: speaker «${transcript[bad].speaker}» (нужно client, operator, bot или system)`); return; }
    if (!transcript.some((m) => m.speaker === 'operator')) { errors.push(`${id}: нет реплик оператора`); return; }
    records.push({ conversation_id: id, channel: r.channel || 'agent chat', language: String(r.language || detectLang(transcript.map((m) => m.text).join(' '))).toUpperCase(), transcript, audio_url: r.audio_url || null });
  });
  return { records, errors, group: j?.data?.dataset_group_id || null };
}

/* ---------- examples (original, written for this demo) ---------- */
const EXAMPLES = {
  RU: `Клиент: Здравствуйте, почему у меня заблокирован вывод денег?
Бот: Здравствуйте! Я AIM, AI-ассистент Freedom Broker. Соединяю вас со специалистом.
Оператор: Добрый день! Меня зовут Арман. Сейчас посмотрю.
Оператор: У вас на счёте 1 240 000 тенге, вывод ограничен из-за незавершённой проверки документов.
Клиент: А как это снять?
Оператор: Загрузите скан удостоверения в приложении, раздел «Профиль» → «Документы». Проверка занимает до одного рабочего дня.
Клиент: Понял, спасибо.
Оператор: Пожалуйста.
Система: Оператор закрыл чат.`,
  KZ: `Клиент: Сәлеметсіз бе, тарифімді қалай өзгертуге болады?
Оператор: Сәлеметсіз бе! Менің атым Дана. Қай тарифке ауысқыңыз келеді?
Клиент: Комиссиясы азырақ тариф керек.
Оператор: Қосымшада «Профиль» → «Тариф» бөліміне өтіңіз, сонда барлық тарифтерді салыстыруға болады. Белсенді сауда жасасаңыз, «Сауда» тарифі тиімдірек.
Клиент: Рақмет, түсінікті.
Оператор: Тағы сұрақтарыңыз бар ма? Болмаса, күніңіз сәтті өтсін!
Система: Оператор чатты жапты.`,
  EN: `Client: Hi, I sent a deposit two days ago and it still isn't on my account.
Operator: Hello, my name is Alex. I'm sorry for the wait. To check the transfer, please confirm your full name and the last four digits of the card.
Client: John Smith, 4417.
Operator: Thank you, verified. The transfer is held by the bank because the payment reference was missing. I've sent a request to the payments team; you'll get an answer in this chat within 24 hours.
Client: Ok.
Operator: Anything else I can help with? Have a nice day!
System: The operator closed the chat.`,
};

/* ---------- view state survives the re-renders that every store change triggers ---------- */
const D = { tab: 'text', text: '', id: '', lang: 'auto', channel: 'chat', json: '', jsonName: '', group: '', groupMsg: '', run: null, batch: null };
const newId = () => { const d = new Date(); const p = (x) => String(x).padStart(2, '0'); return `paste-${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };
let ticker = null;

async function evaluateOne(id) {
  D.run = { id, startedAt: Date.now(), status: 'pending' }; S.single[id] = { pending: true, startedAt: D.run.startedAt }; emit('change');
  try {
    const j = await aiEvaluate(id, { force: true });
    const ms = Date.now() - D.run.startedAt;
    S.single[id] = { done: { ms, model: j.model, cost: j.cached ? 0 : Number(j.usage?.cost) || 0, delta: null } };
    D.run = null; toast(`Оценено за ${fmt(ms / 1000, 1)} с`);
    location.hash = `#/dialog/${encodeURIComponent(id)}`;
  } catch (e) {
    const msg = e.name === 'AbortError' ? 'Оценка заняла больше 280 с.' : e.message;
    S.single[id] = { error: `${msg}.` }; D.run = { ...D.run, status: 'error', error: msg }; emit('change');
  }
}
/** Evaluate several imported dialogs with the AI, 3 at a time, with the progress pill at the top. */
async function evaluateMany(ids, label) {
  if (S.busy || !ids.length) return;
  S.busy = { label, mode: 'ai', kind: 'import', done: 0, total: ids.length, failed: 0, cost: 0, startedAt: Date.now() };
  D.batch = { ids, errors: {} }; emit('busy', S.busy); emit('change');
  const queue = [...ids];
  await Promise.all(Array.from({ length: 3 }, async () => {
    while (queue.length) {
      const id = queue.shift();
      try { const j = await aiEvaluate(id, { save: false }); S.busy.cost += j.cached ? 0 : Number(j.usage?.cost) || 0; }
      catch (e) { S.busy.failed++; D.batch.errors[id] = e.message; }
      S.busy.done++; emit('busy', S.busy);
    }
  }));
  const res = { ...S.busy, ms: Date.now() - S.busy.startedAt };
  S.busy = null; emit('busy', null);
  persist(); // aiEvaluate(save: false) leaves saving to the batch
  toast(`Оценено ${res.done - res.failed} из ${res.total} за ${fmt(res.ms / 1000, 0)} с${res.cost ? ` · $${res.cost.toFixed(3)}` : ''}${res.failed ? ` · ошибок: ${res.failed}` : ''}`, res.failed ? 'warn' : 'ok');
  emit('change');
}

const speakerCount = (tr) => { const n = { operator: 0, client: 0, bot: 0, system: 0 }; tr.forEach((m) => n[m.speaker]++); return n; };
const SPK_RU = { operator: 'оператор', client: 'клиент', bot: 'бот', system: 'система' };

export function viewImport(view) {
  setHead('Загрузка диалогов', 'Новый диалог оценивает наш AI-агент на сервере, сейчас, по активному чек-листу');
  const ai = aiReady();
  const list = importedConvs();

  const textPane = () => {
    const p = parseText(D.text);
    const lang = D.lang === 'auto' ? detectLang(D.text) : D.lang;
    const n = speakerCount(p.transcript);
    const conv = { channel: D.channel === 'call' ? 'voice call' : 'agent chat' };
    const run = D.run;
    return `
      <div class="imp-grid">
        <div class="field">
          <label class="field__label" for="imp-text">Текст диалога: каждая реплика с новой строки, в начале роль</label>
          <textarea class="input imp-text mono" id="imp-text" rows="14" spellcheck="false" placeholder="Клиент: Здравствуйте, не могу войти в приложение
Оператор: Добрый день! Меня зовут Айгерим. Подскажите, какая ошибка появляется?
[00:45] Клиент: Пишет «неверный код»
Система: Оператор закрыл чат.">${esc(D.text)}</textarea>
          <span class="muted small">Роли: Оператор / Клиент / Бот / Система (или Operator, Client, Bot, System). Время в начале строки, например [00:45], необязательно. Строка без роли продолжает предыдущую реплику.</span>
          <div class="btn-row"><span class="muted small">Пример:</span>${Object.keys(EXAMPLES).map((k) => `<button type="button" class="btn btn--s btn--ghost" data-example="${k}">${k}</button>`).join('')}${D.text ? '<button type="button" class="btn btn--s btn--ghost" data-clear-text>Очистить</button>' : ''}</div>
        </div>
        <div class="imp-side">
          <div class="field"><label class="field__label" for="imp-id">ID диалога</label><input class="input input--s mono" id="imp-id" value="${esc(D.id)}" placeholder="${esc(newId())}" autocomplete="off"></div>
          <div class="field"><span class="field__label">Язык</span>${seg('imp-lang', [{ v: 'auto', label: `Авто${D.text ? ` (${detectLang(D.text)})` : ''}` }, ...Object.keys(LANG).map((k) => ({ v: k, label: k }))], D.lang, 'Язык')}</div>
          <div class="field"><span class="field__label">Канал</span>${seg('imp-chan', [{ v: 'chat', label: 'Чат' }, { v: 'call', label: 'Звонок (текст)' }], D.channel, 'Канал')}</div>
          <div class="imp-parsed" aria-live="polite">
            ${p.transcript.length ? `<b>${p.transcript.length} ${plural(p.transcript.length, ['реплика', 'реплики', 'реплик'])}</b>: ${Object.entries(n).filter(([, v]) => v).map(([k, v]) => `${SPK_RU[k]} ${v}`).join(', ')} · ${esc(LANG[lang])}${p.timed ? '' : ` · <span class="muted">время не указано, реплики через ${STEP} с</span>`}` : '<span class="muted">Вставьте текст, здесь появится разбор</span>'}
            ${p.errors.length ? `<ul class="imp-errors">${p.errors.slice(0, 4).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
          </div>
          <div class="muted small">Чек-лист: <b>${esc(checklistLabel(checklistFor(conv)))}</b></div>
          <button type="button" class="btn btn--primary" id="imp-go" ${!p.transcript.length || p.errors.length || D.run?.status === 'pending' ? 'disabled' : ''} ${ai ? '' : 'title="AI недоступен на сервере"'}>${icon('target')}Оценить AI-агентом</button>
          <button type="button" class="btn btn--s btn--ghost" id="imp-add" ${!p.transcript.length || p.errors.length ? 'disabled' : ''}>Только добавить в список</button>
        </div>
      </div>
      ${run ? runPanel(run, p) : ''}`;
  };
  const runPanel = (run, p) => run.status === 'pending'
    ? `<div class="run run--pending imp-run" role="status" aria-live="polite"><span class="spinner" aria-hidden="true"></span><div>
        <b>AI-агент оценивает ${esc(run.id)} · <span class="num" id="imp-t">0,0</span> с</b>
        <span class="small">1 · диалог разобран: ${p.transcript.length} реплик, оценивается только оператор · 2 · POST /api/evaluate → ${esc(modelLabel(S.api.model))}, 3 независимых прогона и голосование, цитата-доказательство проверяется по тексту · 3 · баллы и итог считает детерминированный движок scoring.js. Обычно 30–60 с.</span></div></div>`
    : `<div class="run run--error imp-run" role="alert">${icon('alert')}<div><b>Не удалось оценить ${esc(run.id)}</b><span class="small">${esc(run.error)} Диалог сохранён в списке ниже, можно повторить.</span></div></div>`;

  const jsonPane = () => {
    const p = D.json ? parseJson(D.json, D.jsonName.replace(/\.json$/i, '') || 'json') : { records: [], errors: [] };
    return `
      <div class="imp-grid">
        <div class="field">
          <label class="field__label" for="imp-json">JSON: одна запись, массив записей или ответ API организаторов</label>
          <label class="imp-drop" id="imp-drop"><input type="file" id="imp-file" accept=".json,application/json" class="sr-only">${icon('plus')}<span><b>Выбрать JSON-файл</b> или перетащить сюда${D.jsonName ? ` · <span class="mono">${esc(D.jsonName)}</span>` : ''}</span></label>
          <textarea class="input imp-text mono" id="imp-json" rows="10" spellcheck="false" placeholder='{ "conversation_id": "test-1", "channel": "agent chat", "language": "RU", "transcript": [ { "timestamp": "00:00", "speaker": "client", "text": "…" } ] }'>${esc(D.json)}</textarea>
        </div>
        <div class="imp-side">
          <div class="imp-parsed" aria-live="polite">
            ${p.records.length ? `<b>${p.records.length} ${plural(p.records.length, ['диалог', 'диалога', 'диалогов'])}</b>${p.group ? ` · группа <span class="mono">${esc(p.group)}</span>` : ''}<ul class="imp-recs">${p.records.slice(0, 12).map((r) => `<li><span class="mono">${esc(r.conversation_id)}</span> · ${esc(r.language)} · ${r.transcript.length} реплик${/voice|call/i.test(r.channel) ? ' · звонок' : ''}</li>`).join('')}${p.records.length > 12 ? `<li class="muted">… ещё ${p.records.length - 12}</li>` : ''}</ul>` : '<span class="muted">Выберите файл или вставьте JSON</span>'}
            ${p.errors.length ? `<ul class="imp-errors">${p.errors.slice(0, 6).map((e) => `<li>${esc(e)}</li>`).join('')}</ul>` : ''}
          </div>
          <button type="button" class="btn btn--primary" id="imp-json-go" ${p.records.length && !S.busy ? '' : 'disabled'}>${icon('target')}Добавить и оценить AI${p.records.length > 1 ? ` (${p.records.length})` : ''}</button>
          <button type="button" class="btn btn--s btn--ghost" id="imp-json-add" ${p.records.length ? '' : 'disabled'}>Только добавить в список</button>
        </div>
      </div>`;
  };

  const groupPane = () => `
      <div class="imp-grid imp-grid--group">
        <div class="field">
          <label class="field__label" for="imp-group">group_id набора от организаторов (контрольный набор выдают в T+23h)</label>
          <div class="btn-row"><input class="input mono" id="imp-group" value="${esc(D.group)}" placeholder="например, a1b2c3" autocomplete="off" style="max-width:320px">
          <button type="button" class="btn btn--primary" id="imp-group-go">${icon('arrow')}Загрузить набор</button></div>
          <span class="muted small">Запрос идёт через наш сервер (/api/dataset), ключ API остаётся на сервере. Если контрольный прогон уже сделан (<span class="mono">npm run results -- --group …</span>), его оценки подтянутся из <span class="mono">data/evaluations/&lt;group&gt;.json</span> сразу; остальные можно оценить здесь.</span>
          ${D.groupMsg ? `<p class="imp-parsed">${D.groupMsg}</p>` : ''}
        </div>
      </div>`;

  const listPane = () => {
    if (!list.length) return '';
    const pendingAI = list.filter((c) => !hasAI(c.conversation_id)).map((c) => c.conversation_id);
    return `<section class="card imp-list"><div class="card__head card__head--line"><h2>Загруженные диалоги · ${list.length}</h2>
      <div class="btn-row">${pendingAI.length ? `<button type="button" class="btn btn--s btn--primary" data-eval-all ${S.busy || !ai ? 'disabled' : ''}>${icon('target')}Оценить AI без оценки (${pendingAI.length})</button>` : ''}<button type="button" class="btn btn--s btn--ghost" data-remove-all>${icon('trash')}Убрать все</button></div></div>
      <div class="table-wrap imp-table"><table class="table"><thead><tr><th>Диалог</th><th>Источник</th><th>Реплик</th><th>Оценка</th><th class="num-col">Итог</th><th></th></tr></thead><tbody>
      ${list.map((c) => {
        const id = c.conversation_id; const E = evaluation(id); const err = D.batch?.errors?.[id] || S.single[id]?.error;
        const state = S.single[id]?.pending || (S.busy && D.batch?.ids.includes(id) && !hasAI(id) && !err) ? '<span class="l-chip l-chip--info">оценивается…</span>'
          : err ? `<span class="l-chip l-chip--bad" title="${esc(err)}">ошибка</span>`
          : E.src === 'ai' ? `<span class="l-chip l-chip--ok">AI · ${esc(modelLabel(E.model))}</span>${E.base.wall_ms ? ` <span class="muted small">${fmt(E.base.wall_ms / 1000, 1)} с</span>` : ''}` : '<span class="l-chip">без AI</span>';
        return `<tr><td><a class="mono" href="#/dialog/${encodeURIComponent(id)}">${esc(id)}</a> <span class="lang">${esc(c.language)}</span>${isCall(c) ? ' <span class="muted small">звонок</span>' : ''}</td>
          <td class="small">${esc(SOURCE_LABEL(c._source))}<span class="td-sub">${esc(dateTime(c._added_at))}</span></td><td class="num">${c.transcript.length}</td><td>${state}</td>
          <td class="num-col">${E.src !== 'ai' || E.finalScore.total == null ? '<span class="muted" title="Итог появится после оценки AI">—</span>' : fmt(E.finalScore.total, 2)}${E.src === 'ai' && E.finalScore.gross_error ? ' <span class="l-chip l-chip--bad">грубая</span>' : ''}</td>
          <td><button type="button" class="icon-btn" data-remove="${esc(id)}" aria-label="Убрать ${esc(id)}">${icon('x')}</button></td></tr>`;
      }).join('')}</tbody></table></div></section>`;
  };

  const draw = () => {
    view.innerHTML = `
      ${ai ? '' : '<div class="run run--error" role="alert" style="margin:0 0 16px">' + icon('alert') + '<div><b>AI недоступен на сервере</b><span class="small">Диалоги можно добавить, но оценит их только офлайн-оценщик без AI.</span></div></div>'}
      <section class="card imp-card">
        <div class="card__head">${seg('imp-tab', [{ v: 'text', label: 'Вставить текст' }, { v: 'json', label: 'JSON-файл' }, { v: 'group', label: 'Набор по group_id' }], D.tab, 'Способ загрузки')}</div>
        <div class="imp-body">${D.tab === 'text' ? textPane() : D.tab === 'json' ? jsonPane() : groupPane()}</div>
      </section>
      ${listPane()}`;
    clearInterval(ticker);
    if (D.run?.status === 'pending') ticker = setInterval(() => { const t = $('#imp-t', view); if (t) t.textContent = ((Date.now() - D.run.startedAt) / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 }); }, 100);
  };
  draw();
  // Typing must not re-render the textarea (the caret would jump): update only the parse summary + buttons.
  const redrawKeepFocus = (id) => { const el = $(`#${id}`, view); const pos = el?.selectionStart; draw(); const n = $(`#${id}`, view); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch {} } };
  let deb = null;
  view.addEventListener('input', (e) => {
    const t = e.target;
    if (t.id === 'imp-text') D.text = t.value; else if (t.id === 'imp-id') { D.id = t.value; return; } else if (t.id === 'imp-json') D.json = t.value; else if (t.id === 'imp-group') { D.group = t.value; return; } else return;
    clearTimeout(deb); deb = setTimeout(() => redrawKeepFocus(t.id), 250);
  });

  const readFile = (f) => { if (!f) return; const r = new FileReader(); r.onload = () => { D.json = String(r.result || ''); D.jsonName = f.name; draw(); }; r.readAsText(f); };
  view.addEventListener('change', (e) => { if (e.target.id === 'imp-file') readFile(e.target.files?.[0]); });
  view.addEventListener('dragover', (e) => { if (e.target.closest('#imp-drop')) { e.preventDefault(); e.target.closest('#imp-drop').classList.add('is-over'); } });
  view.addEventListener('dragleave', (e) => e.target.closest('#imp-drop')?.classList.remove('is-over'));
  view.addEventListener('drop', (e) => { if (!e.target.closest('#imp-drop')) return; e.preventDefault(); readFile(e.dataTransfer.files?.[0]); });

  const buildPasted = () => {
    const p = parseText(D.text);
    const id = (D.id.trim() || newId()).replace(/[^A-Za-z0-9_.-]/g, '_');
    const conv = { conversation_id: id, channel: D.channel === 'call' ? 'voice call' : 'agent chat', language: D.lang === 'auto' ? detectLang(D.text) : D.lang, transcript: p.transcript, audio_url: null };
    return { conv, p };
  };
  const addTo = (records, source) => {
    const r = addImported(records, source);
    if (r.skipped.length) toast(`Уже есть в наборе DEV, не заменены: ${r.skipped.join(', ')}`, 'warn');
    return [...r.added, ...r.replaced];
  };

  view.addEventListener('click', async (e) => {
    const b = e.target.closest('button'); if (!b) return;
    const group = b.closest('.seg');
    if (group) {
      const k = { 'imp-tab': 'tab', 'imp-lang': 'lang', 'imp-chan': 'channel' }[group.id];
      if (k) { D[k] = b.dataset.v; draw(); }
      return;
    }
    if (b.dataset.example) { D.text = EXAMPLES[b.dataset.example]; D.lang = 'auto'; D.id = ''; draw(); return; }
    if (b.hasAttribute('data-clear-text')) { D.text = ''; D.id = ''; D.run = null; draw(); return; }
    if (b.id === 'imp-go' || b.id === 'imp-add') {
      const { conv } = buildPasted();
      // store changes re-render the route into a fresh node, so the draft is cleared before adding
      const keep = { id: D.id, text: D.text }; D.id = ''; if (b.id === 'imp-add') D.text = '';
      const ids = addTo([conv], 'paste'); if (!ids.length) { Object.assign(D, keep); emit('change'); return; }
      if (b.id === 'imp-add' || !ai) { toast(`Добавлен ${conv.conversation_id}`); location.hash = `#/dialog/${encodeURIComponent(conv.conversation_id)}`; return; }
      evaluateOne(conv.conversation_id);
      return;
    }
    if (b.id === 'imp-json-go' || b.id === 'imp-json-add') {
      const p = parseJson(D.json, D.jsonName.replace(/\.json$/i, '') || `json-${uid()}`);
      D.json = ''; D.jsonName = '';
      const ids = addTo(p.records, p.group ? `group:${p.group}` : 'file');
      if (p.group) await mergeGroupEvaluations(p.group);
      toast(`Добавлено ${ids.length} ${plural(ids.length, ['диалог', 'диалога', 'диалогов'])}`);
      if (b.id === 'imp-json-go' && ai) {
        const todo = ids.filter((id) => !hasAI(id));
        if (todo.length === 1) evaluateOne(todo[0]); else evaluateMany(todo, 'AI оценивает загруженные диалоги');
      }
      return;
    }
    if (b.id === 'imp-group-go') {
      const g = D.group.trim(); if (!/^[A-Za-z0-9_-]+$/.test(g)) { D.groupMsg = '<span class="field__err">group_id: только латиница, цифры, - и _</span>'; draw(); return; }
      b.disabled = true; b.textContent = 'Загружаем…';
      try {
        const r = await fetch(`/api/dataset?group_id=${encodeURIComponent(g)}`, { cache: 'no-store' });
        const j = await r.json().catch(() => ({}));
        if (!r.ok || !Array.isArray(j?.data?.records)) throw new Error(typeof j.error === 'object' ? JSON.stringify(j.error) : j.error || `HTTP ${r.status}`);
        const p = parseJson(JSON.stringify(j), g);
        const ids = addTo(p.records, `group:${g}`);
        const merged = await mergeGroupEvaluations(g);
        D.groupMsg = `Загружено <b>${ids.length}</b> ${plural(ids.length, ['диалог', 'диалога', 'диалогов'])} из группы <span class="mono">${esc(g)}</span>${merged ? ` · оценки контрольного прогона: ${merged}` : ''}${p.errors.length ? ` · пропущено: ${p.errors.length}` : ''}.`;
      } catch (err) { D.groupMsg = `<span class="field__err">Не удалось загрузить группу: ${esc(err.message)}</span>`; }
      emit('change'); return;
    }
    if (b.hasAttribute('data-eval-all')) { evaluateMany(importedConvs().filter((c) => !hasAI(c.conversation_id)).map((c) => c.conversation_id), 'AI оценивает загруженные диалоги'); return; }
    if (b.dataset.remove) { removeImported([b.dataset.remove]); return; }
    if (b.hasAttribute('data-remove-all')) { if (confirm(`Убрать ${list.length} загруженных диалогов из списка? Их оценки в этом браузере останутся в кэше.`)) removeImported(list.map((c) => c.conversation_id)); }
  });

  const offBusy = on('busy', () => { if (D.batch) { clearTimeout(deb); deb = setTimeout(draw, 120); } });
  return () => { clearInterval(ticker); clearTimeout(deb); offBusy(); };
}
