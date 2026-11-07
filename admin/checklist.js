// Чек-лист: edit / add / replace / reorder criteria, change weights → save as a new version → re-evaluate all dialogs.
// Ported from prototype/app.js viewChecklist. Two checklists: chats (versions in the shared "cqa-prototype-v2" state)
// and calls (versions in "cqa-call-checklists-v1"). Each dialog is evaluated with the checklist for its channel.
import { $, $$, esc, fmt, plural, icon, toast, setHead, seg, uid, dateTime, fix, reduced, signed } from './ui.js';
import { S, checklistOf, versionsOf, setActiveVersion, addVersion, KINDS, kindOf, refresh, emit, on, reevaluateAll, aiReady, rows, compute, clHash } from './store.js';

let kind = 'chat';          // which checklist is being edited: 'chat' | 'call'
let draft = null;
let newId = null;
let replaced = new Map();   // newId → { oldId, oldTitle }
let mode = null;            // 'ai' | 'mock'
let lastRun = null;         // outcome of the last re-evaluation in this session
let offBusy = null;
const parked = { chat: {}, call: {} }; // per-kind editor state while the other checklist is open
function switchKind(k) {
  if (!KINDS[k] || k === kind) return;
  parked[kind] = { draft, newId, replaced, lastRun };
  kind = k; ({ draft = null, newId = null, replaced = new Map(), lastRun = null } = parked[k]);
}

const TYPES = { binary: 'Да / Нет', scale: 'Шкала', flag: 'Флаг (без баллов)' };

function diffOf(cl, d) {
  const out = [];
  const old = new Map(cl.criteria.map((c) => [c.id, c])); const now = new Map(d.criteria.map((c) => [c.id, c]));
  const replacedOld = new Set([...replaced.values()].map((r) => r.oldId));
  for (const c of [...d.criteria].sort((a, b) => a.order - b.order)) {
    const o = old.get(c.id);
    if (!o) { const r = replaced.get(c.id); out.push(r ? `заменён «${r.oldTitle}» на «${c.title}»` : `добавлен «${c.title}»`); continue; }
    if (o.title !== c.title) out.push(`переименован «${o.title}» в «${c.title}»`);
    if (Number(o.weight) !== Number(c.weight)) out.push(`вес «${c.title}»: ${o.weight} → ${c.weight}`);
    if ((o.description || '') !== (c.description || '')) out.push(`формулировка «${c.title}»`);
    if (o.type !== c.type) out.push(`тип ответа «${c.title}»: ${TYPES[o.type]} → ${TYPES[c.type]}`);
    if (!!o.na_allowed !== !!c.na_allowed || (o.na_condition || '') !== (c.na_condition || '')) out.push(`условие N/A «${c.title}»`);
    if (JSON.stringify(o.scale || null) !== JSON.stringify(c.scale || null) && o.type === c.type) out.push(`шкала «${c.title}»`);
    if (o.section_id !== c.section_id) out.push(`секция «${c.title}»`);
  }
  for (const o of cl.criteria) if (!now.has(o.id) && !replacedOld.has(o.id)) out.push(`удалён «${o.title}»`);
  const ord = (l) => [...l].sort((a, b) => a.order - b.order).map((c) => c.id).filter((id) => old.has(id) && now.has(id)).join();
  if (ord(cl.criteria) !== ord(d.criteria)) out.push('порядок критериев');
  return out;
}
const weightSum = (d) => d.criteria.filter((c) => c.type !== 'flag').reduce((s, c) => s + (Number(c.weight) || 0), 0);
const DESC_PH = { binary: 'Да — оператор …', scale: 'Высший балл — оператор …', flag: 'Нарушение — оператор …' };
/** First thing that blocks saving: { c, k, msg } (c/k point at the field to focus) or null. */
function problemOf(d) {
  for (const c of [...d.criteria].sort((a, b) => a.order - b.order)) {
    const name = String(c.title).trim() ? `«${String(c.title).trim()}»` : `Критерий ${String(c.order).padStart(2, '0')}`;
    if (!String(c.title).trim()) return { c, k: 'title', msg: `${name}: укажите название` };
    if (!String(c.description || '').trim()) return { c, k: 'description', msg: `${name}: опишите, что оценивается. По этому тексту AI ставит ответ` };
    if (c.type !== 'flag' && !(Number(c.weight) >= 0)) return { c, k: 'weight', msg: `${name}: вес должен быть числом от 0` };
    if (c.type === 'scale') {
      const v = (c.scale || []).map((s) => s.value);
      if (v.length < 2 || !(Math.max(...v) > 0)) return { c, k: 'scale', msg: `${name}: нужна шкала минимум из двух ступеней, высшая больше 0` };
    }
    if (c.na_allowed && !String(c.na_condition || '').trim()) return { c, k: 'na_condition', msg: `${name}: опишите, когда ставить N/A` };
  }
  if (!d.criteria.some((c) => c.type !== 'flag' && Number(c.weight) > 0)) return { msg: 'Нужен хотя бы один критерий с весом больше 0' };
  return null;
}
const devAvg = (k) => compute(rows().filter((r) => r.source === 'DEV' && r.E.kind === k)).avg;

export function viewChecklist(view, _arg, query) {
  refresh();
  if (query?.get('kind')) switchKind(query.get('kind'));
  const cl = checklistOf(kind);
  const nDialogs = { chat: S.convs.filter((c) => kindOf(c) === 'chat').length, call: S.convs.filter((c) => kindOf(c) === 'call').length };
  if (!draft || draft.__base !== cl.version) { draft = { ...structuredClone(cl), __base: cl.version }; replaced.clear(); newId = null; }
  if (!mode) mode = aiReady() ? 'ai' : 'mock';
  if (!aiReady()) mode = 'mock';
  const nextV = Math.max(...versionsOf(kind).map((c) => c.version)) + 1;
  const busy = S.busy;
  setHead('Чек-лист', `${KINDS[kind].name}: активна v${cl.version} · ${cl.criteria.length} ${plural(cl.criteria.length, ['критерий', 'критерия', 'критериев'])} · ${dateTime(cl.updated_at) || cl.updated_at}`);

  const focusKey = document.activeElement?.closest?.('[data-id]') && document.activeElement.dataset.k ? [document.activeElement.closest('[data-id]').dataset.id, document.activeElement.dataset.k] : null;
  const list = draft.criteria.sort((a, b) => a.order - b.order);
  view.innerHTML = `
    <div class="cl">
      <div class="cl-kinds">
        ${seg('cl-kind', [{ v: 'chat', label: `Чаты · ${nDialogs.chat} диал.` }, { v: 'call', label: `Звонки · ${nDialogs.call} диал.` }], kind, 'Какой чек-лист редактировать')}
        <span class="muted small">${kind === 'call' ? 'Применяется к звонкам. C1 допускает N/A, если приветствие не попало в запись; C4 и C6 адаптированы к устной речи.' : 'Применяется ко всем чатам, включая живые чаты из консоли оператора.'}</span>
      </div>
      <section class="card cl-bar" aria-label="Версия и сохранение">
        <div class="cl-bar__row">
          <label class="field field--inline"><span class="field__label">Версия</span>
            <select class="input input--s" id="ver" ${busy ? 'disabled' : ''}>${[...versionsOf(kind)].reverse().map((c) => `<option value="${c.version}" ${c.version === cl.version ? 'selected' : ''}>v${c.version} · ${esc(dateTime(c.updated_at) || c.updated_at)}${c.version === cl.version ? ' · активна' : ''}</option>`).join('')}</select></label>
          <button class="btn btn--s" type="button" id="add" ${busy ? 'disabled' : ''}>${icon('plus')}Добавить критерий</button>
          <span class="cl-bar__spacer"></span>
          <button class="btn btn--s btn--ghost" type="button" id="reset" hidden>Отменить изменения</button>
        </div>
        <div class="cl-bar__row cl-bar__row--save">
          <div class="cl-bar__mode"><span class="field__label">Переоценка после сохранения</span>
            ${aiReady() ? seg('mode', [{ v: 'ai', label: 'AI · /api/evaluate' }, { v: 'mock', label: 'Без AI · быстро' }], mode, 'Способ переоценки') : '<span class="muted small">AI недоступен на сервере, переоценка без AI</span>'}
          </div>
          <button class="btn btn--primary" type="button" id="save" disabled>Сохранить v${nextV} и переоценить</button>
        </div>
        <div id="cl-summary"></div>
      </section>

      <div id="cl-run">${runBlock(busy)}</div>

      <div class="crit-edit-list" id="rows">${list.map((c, i) => `
        <article class="crit-edit ${c.id === newId ? 'is-new' : ''} ${c.type === 'flag' ? 'is-flag' : ''}" data-id="${c.id}">
          <div class="crit-edit__top">
            <span class="crit-edit__n mono" aria-hidden="true">${String(c.order).padStart(2, '0')}</span>
            <label class="field crit-edit__title"><span class="field__label">Название</span><input class="input" data-k="title" value="${esc(c.title)}" placeholder="Например: Предложил дополнительную помощь"></label>
            <label class="field crit-edit__w"><span class="field__label">Вес</span><input class="input num" type="number" inputmode="numeric" min="0" max="100" step="1" data-k="weight" value="${c.weight}" ${c.type === 'flag' ? 'disabled' : ''}></label>
            <label class="field crit-edit__type"><span class="field__label">Тип ответа</span><select class="input" data-k="type">${Object.entries(TYPES).map(([k, v]) => `<option value="${k}" ${c.type === k ? 'selected' : ''}>${v}</option>`).join('')}</select></label>
            <label class="check crit-edit__na"><input type="checkbox" data-k="na_allowed" ${c.na_allowed ? 'checked' : ''} ${c.type === 'flag' ? 'disabled' : ''}><span>N/A разрешён</span></label>
            <div class="crit-edit__actions">
              <button class="icon-btn" type="button" data-up ${i === 0 ? 'disabled' : ''} aria-label="Поднять «${esc(c.title)}»">${icon('up')}</button>
              <button class="icon-btn" type="button" data-down ${i === list.length - 1 ? 'disabled' : ''} aria-label="Опустить «${esc(c.title)}»">${icon('down')}</button>
              <button class="icon-btn" type="button" data-replace aria-label="Заменить «${esc(c.title)}» новым критерием" title="Заменить новым критерием">${icon('swap')}</button>
              <button class="icon-btn icon-btn--danger" type="button" data-del aria-label="Удалить «${esc(c.title)}»" title="Удалить">${icon('trash')}</button>
            </div>
          </div>
          <div class="crit-edit__more">
            <label class="field"><span class="field__label">${c.type === 'flag' ? 'Что считается нарушением' : c.type === 'scale' ? 'Что оценивается (высший балл = полный вес)' : 'Что значит «Да»'}</span><textarea class="input" rows="2" data-k="description" placeholder="${DESC_PH[c.type] || ''}">${esc(c.description || '')}</textarea></label>
            ${c.na_allowed ? `<label class="field"><span class="field__label">Когда ставить N/A</span><input class="input" data-k="na_condition" value="${esc(c.na_condition || '')}" placeholder="Например: клиент сам дал все данные"></label>` : ''}
            ${c.type === 'scale' ? `<label class="field"><span class="field__label">Ступени шкалы через запятую</span><input class="input num" data-k="scale" value="${(c.scale || []).map((s) => s.value).join(', ')}"></label>` : ''}
            ${draft.sections?.length ? `<label class="field"><span class="field__label">Секция</span><select class="input" data-k="section_id">${draft.sections.map((s) => `<option value="${s.id}" ${s.id === c.section_id ? 'selected' : ''}>${esc(s.title)}</option>`).join('')}</select></label>` : ''}
          </div>
        </article>`).join('')}</div>
    </div>`;

  const summary = () => {
    const { __base, ...cmp } = draft;
    const dirty = JSON.stringify(cmp) !== JSON.stringify(cl);
    const ws = weightSum(draft); const changes = diffOf(cl, draft);
    const openHere = S.appeals.filter((a) => a.status === 'open' && a.checklist_hash === clHash(cl)).length;
    $('#save', view).disabled = !dirty || !!S.busy;
    $('#reset', view).hidden = !dirty;
    $('#cl-summary', view).innerHTML = `
      <div class="cl-sum">
        <span class="cl-sum__w ${ws === 100 ? 'is-ok' : 'is-warn'}">${icon(ws === 100 ? 'check' : 'alert')}Сумма весов <b class="num">${fmt(ws, 2)}</b> из 100</span>
        <span class="muted small">${ws === 100 ? 'Итог считается из 100 баллов.' : 'Итог всё равно нормируется до 100, но лучше выровнять веса.'} N/A перераспределяет вес между применимыми критериями. Округление до 2 знаков.</span>
      </div>
      ${changes.length ? `<div class="cl-diff"><span class="kicker">Изменения к сохранению</span><ul>${changes.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>${openHere ? `<p class="muted small">Открытых апелляций по v${cl.version}: ${openHere}. Они останутся привязаны к v${cl.version}: решение по ним можно принять, вернув эту версию активной.</p>` : ''}</div>` : ''}`;
  };
  summary();
  if (focusKey) { const el = view.querySelector(`[data-id="${focusKey[0]}"] [data-k="${focusKey[1]}"]`); el?.focus(); }

  const rowsEl = $('#rows', view);
  const find = (el) => draft.criteria.find((c) => c.id === el.closest('[data-id]').dataset.id);
  rowsEl.addEventListener('input', (e) => {
    const k = e.target.dataset.k; if (!k || !['title', 'description', 'weight', 'na_condition'].includes(k)) return;
    const c = find(e.target);
    if (k === 'weight') c.weight = e.target.value === '' ? 0 : Number(e.target.value); else c[k] = e.target.value;
    summary();
  });
  rowsEl.addEventListener('change', (e) => {
    const k = e.target.dataset.k; if (!k) return; const c = find(e.target);
    // clamp and show the stored value, so the field never says "-5" while the draft holds 0
    if (k === 'weight') { c.weight = Math.max(0, Number(e.target.value) || 0); e.target.value = String(c.weight); summary(); return; }
    if (['title', 'description', 'na_condition'].includes(k)) { c[k] = e.target.value; summary(); return; }
    if (k === 'na_allowed') { c.na_allowed = e.target.checked; if (!c.na_allowed) delete c.na_condition; }
    else if (k === 'scale') { const vals = e.target.value.split(/[,;\s]+/).filter(Boolean).map(Number).filter((v) => Number.isFinite(v) && v >= 0); c.scale = [...new Set(vals)].sort((a, b) => b - a).map((v) => ({ value: v, label: String(v) })); }
    else if (k === 'type') { c.type = e.target.value; if (c.type === 'scale' && !c.scale) c.scale = [10, 5, 0].map((v) => ({ value: v, label: String(v) })); if (c.type === 'flag') { c.weight = 0; c.na_allowed = false; delete c.na_condition; } }
    else c[k] = e.target.value;
    viewChecklist(view);
  });
  rowsEl.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return; const c = find(b); const l = draft.criteria.sort((x, y) => x.order - y.order); const i = l.indexOf(c);
    if (b.hasAttribute('data-del')) draft.criteria = l.filter((x) => x !== c);
    if (b.hasAttribute('data-up') && i > 0) [l[i - 1].order, c.order] = [c.order, l[i - 1].order];
    if (b.hasAttribute('data-down') && i < l.length - 1) [l[i + 1].order, c.order] = [c.order, l[i + 1].order];
    if (b.hasAttribute('data-replace')) {
      const id = `c${uid()}`; const prev = replaced.get(c.id);
      replaced.delete(c.id); replaced.set(id, prev || { oldId: c.id, oldTitle: c.title });
      Object.assign(c, { id, title: '', description: '', type: 'binary', na_allowed: false }); delete c.na_condition; delete c.scale;
      if (!(Number(c.weight) > 0)) c.weight = 10;
      newId = id;
    }
    draft.criteria.sort((x, y) => x.order - y.order).forEach((x, k) => { x.order = k + 1; });
    viewChecklist(view);
    if (b.hasAttribute('data-replace')) view.querySelector(`[data-id="${newId}"] [data-k="title"]`)?.focus();
  });
  $('#add', view).onclick = () => {
    newId = `c${uid()}`;
    const flagOrder = draft.criteria.find((c) => c.type === 'flag')?.order;
    const order = flagOrder ?? draft.criteria.length + 1;
    draft.criteria.forEach((c) => { if (c.order >= order) c.order++; });
    draft.criteria.push({ id: newId, order, section_id: draft.sections?.find((s) => s.id !== 's4')?.id || draft.sections?.[0]?.id, title: 'Новый критерий', description: '', type: 'binary', weight: 10, na_allowed: false });
    viewChecklist(view);
    const el = view.querySelector(`[data-id="${newId}"] [data-k="title"]`); el?.focus(); el?.select();
  };
  $('#reset', view).onclick = () => { draft = null; replaced.clear(); newId = null; viewChecklist(view); };
  $('#mode', view)?.addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.v; $$('#mode button', view).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); });
  $('#cl-kind', view).addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b || b.dataset.v === kind) return; switchKind(b.dataset.v); history.replaceState(null, '', `#/checklist?kind=${kind}`); emit('change'); });
  $('#ver', view).onchange = (e) => { setActiveVersion(kind, Number(e.target.value)); draft = null; lastRun = null; toast(`${KINDS[kind].name}: активна v${e.target.value}`); emit('change'); };
  $('#save', view).onclick = async () => {
    const bad = problemOf(draft);
    if (bad) {
      toast(bad.msg, 'warn');
      const el = bad.c && view.querySelector(`[data-id="${bad.c.id}"] [data-k="${bad.k}"]`);
      if (el) {
        el.setAttribute('aria-invalid', 'true');
        el.addEventListener('input', () => el.removeAttribute('aria-invalid'), { once: true });
        el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' }); el.focus({ preventScroll: true });
      }
      return;
    }
    const before = devAvg(kind); const fromV = cl.version; const k = kind;
    const { __base: _, ...clean } = draft;
    clean.criteria = clean.criteria.map((c) => ({ ...c, weight: Number(c.weight) || 0 }));
    refresh();
    addVersion(k, { ...structuredClone(clean), version: nextV, updated_at: new Date().toISOString() });
    draft = null; newId = null; replaced.clear();
    lastRun = null;
    emit('change');
    // the progress card and its result sit under the save bar: bring them into view instead of leaving the user mid-list
    scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
    const res = await reevaluateAll(mode, `${KINDS[k].label}: переоценка по v${nextV}`, k);
    if (!res) return;
    const run = { ...res, fromV, before, after: devAvg(k) };
    if (kind === k) lastRun = run; else parked[k].lastRun = run;
    toast(`${KINDS[k].name} v${nextV} применён: ${res.done - res.failed} из ${res.total} диалогов переоценены`, res.failed ? 'warn' : 'ok');
    emit('change');
  };
  offBusy?.();
  offBusy = on('busy', (b) => { const box = $('#cl-run', view); if (box) box.innerHTML = runBlock(b); if (!b && view.isConnected) summary(); });
  return () => { offBusy?.(); offBusy = null; };
}

function runBlock(b) {
  if (b) {
    const p = b.total ? Math.round((b.done / b.total) * 100) : 0;
    return `<section class="card run-card" role="status" aria-live="polite">
      <div class="run-card__head"><span class="spinner" aria-hidden="true"></span><b>${esc(b.label)}</b><span class="muted small">${b.mode === 'ai' ? 'AI оценивает каждый диалог через /api/evaluate' : 'Оценка без AI по правилам'}</span><span class="num run-card__n">${b.done} из ${b.total}</span></div>
      <div class="progress progress--l" aria-hidden="true"><span style="width:${p}%"></span></div>
      ${b.mode === 'ai' ? `<span class="muted small">Затраты: $${b.cost.toFixed(4)}${b.failed ? ` · ошибок ${b.failed}` : ''}</span>` : ''}
    </section>`;
  }
  if (lastRun) {
    const r = lastRun; const d = r.after != null && r.before != null ? r.after - r.before : null;
    return `<section class="card run-card run-card--done" role="status">
      <div class="run-card__head">${icon('check')}<b>${esc(KINDS[r.kind]?.name || 'Чек-лист')} v${r.version} применён: ${r.done - r.failed} из ${r.total} ${plural(r.total, ['диалог переоценён', 'диалога переоценены', 'диалогов переоценены'])} за ${fmt(r.ms / 1000, 1)} с</b></div>
      <p class="run-card__res">Средний балл: <b class="num">${fix(r.before, 1)}</b> по v${r.fromV} → <b class="num">${fix(r.after, 1)}</b> по v${r.version}${d != null && Math.abs(d) >= 0.05 ? ` <span class="delta ${d > 0 ? 'delta--up' : 'delta--down'}">${signed(d, 1, fix)}</span>` : ''}${r.mode === 'ai' ? ` · $${r.cost.toFixed(4)}` : ' · без AI'}${r.failed ? ` · ошибок ${r.failed}` : ''}</p>
      <div class="btn-row"><a class="btn btn--s btn--primary" href="#/dialogs?channel=${r.kind === 'call' ? 'call' : 'chat'}&sort=low">Открыть диалоги</a><a class="btn btn--s" href="#/overview">Открыть обзор</a></div>
    </section>`;
  }
  return '';
}
