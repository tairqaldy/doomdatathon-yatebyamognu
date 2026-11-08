// Анализ диалога: ported from prototype/app.js viewCard (Freedom's "Рабочее место контроля качества" layout).
// Header → per-speaker timeline with deduction markers + call audio → understanding strip →
// transcript (left) | score ring, history, sections, deduction reasons, justification of every criterion (right).
// Evidence jump/highlight, audio seek, appeal drawer, reviewer decision, live re-evaluation via /api/evaluate.
import { $, $$, esc, fmt, signed, plural, icon, toast, drawer, closeDrawer, ring, tierVar, reduced, setHead, LANG, dateTime, liquidMark, tickLiquid, doneMark } from './ui.js';
import { annotateRoles, NO_CLIENT_MESSAGE } from '/lib/roles.js';
import { S, evaluation, deductions, reasonOf, evidenceIdx, answerText, offsetSec, mmss, duration, isCall, SPK, score, tier, maxStep,
  aiEvaluate, aiReady, modelLabel, addAppeal, decideAppeal, sortedCrits, strHash, refresh, emit, checklistLabel, confidenceOf, markRecent } from './store.js';

let audioEl = null;
export const SOURCE_LABEL = (src) => (src === 'paste' ? 'вставлен текстом' : src === 'file' ? 'из JSON' : src.startsWith('group:') ? `группа ${src.slice(6)}` : src);
let ticker = null;

function answerBadge(c, a) {
  if (a == null) return '<span class="ans ans--none">не оценён</span>';
  if (c.type === 'flag') return a === 'yes' ? `<span class="ans ans--gross">${icon('alert')}Нарушение</span>` : `<span class="ans ans--ok">${icon('check')}Нет нарушения</span>`;
  if (a === 'na') return `<span class="ans ans--na">${icon('dash')}N/A</span>`;
  if (a === 'yes') return `<span class="ans ans--ok">${icon('check')}Да</span>`;
  if (a === 'no') return `<span class="ans ans--bad">${icon('x')}Нет</span>`;
  const m = maxStep(c); return `<span class="ans ans--${a >= m ? 'ok' : a === 0 ? 'bad' : 'mid'}">${a} из ${m}</span>`;
}
/**
 * «Как посчитан итог»: every weighted criterion is a slice as wide as its weight, filled by the points it got;
 * N/A slices drop out and the rest is scaled to 100 (scoring.js step 3). Numbers come from the same score() result.
 */
function calcHTML(crits, fs, answers, total) {
  const weighted = crits.filter((c) => c.type !== 'flag' && c.weight > 0);
  if (!weighted.length) return '';
  const rowOf = (c) => fs.criteria.find((x) => x.criterion_id === c.id);
  const isNA = (c) => answers[c.id] === 'na' || answers[c.id] == null;
  const got = weighted.reduce((s, c) => s + (isNA(c) ? 0 : rowOf(c)?.raw_points ?? 0), 0);
  const naW = weighted.filter(isNA).reduce((s, c) => s + c.weight, 0);
  const segs = weighted.map((c) => {
    const r = rowOf(c); const na = isNA(c); const p = na ? 0 : Math.max(0, Math.min(1, (r?.raw_points ?? 0) / c.weight));
    const tip = `${String(c.order).padStart(2, '0')} ${c.title}: ${na ? 'N/A, вес не учитывается' : `${fmt(r?.raw_points ?? 0, 2)} из ${c.weight}`}`;
    return `<span class="calc__seg ${na ? 'is-na' : p < 1 ? 'is-lost' : ''}" style="flex:${c.weight}" title="${esc(tip)}"><i style="width:${p * 100}%"></i><em>${String(c.order).padStart(2, '0')}</em></span>`;
  }).join('');
  return `<div class="calc">
    <span class="kicker">Как посчитан итог</span>
    <div class="calc__bar" aria-hidden="true">${segs}</div>
    ${total == null ? '<p class="calc__eq small">Все критерии с весом N/A: итог не рассчитан.</p>'
      : `<p class="calc__eq num"><span><b>${fmt(got, 2)}</b> ${Number.isInteger(got) ? plural(got, ['балл', 'балла', 'баллов']) : 'балла'}</span><span class="calc__op">÷</span><span><b>${fmt(fs.applicable_weight, 2)}</b> применимый вес${naW ? ` <span class="muted">(${fmt(fs.nominal_weight, 2)} − ${fmt(naW, 2)} N/A)</span>` : ''}</span><span class="calc__op">× 100 =</span><b class="calc__total">${fmt(total, 2)}</b></p>`}
    <div class="calc__key" aria-hidden="true"><span><i class="k-got"></i>получено</span><span><i class="k-lost"></i>снижено</span>${naW ? '<span><i class="k-na"></i>N/A, вес перераспределён</span>' : ''}</div>
  </div>`;
}
const timeOfMsg = (conv, i) => (isCall(conv) ? mmss(offsetSec(conv, i)) : conv.transcript[i]?.timestamp || '');
const evChip = (conv, i, quote) => `<button type="button" class="evidence evidence--btn" data-jump="${i}"><span class="evidence__meta mono">#${i} · ${esc(timeOfMsg(conv, i))}</span><q>${esc(quote || conv.transcript[i]?.text || '')}</q></button>`;

export function viewCard(view, convId, query) {
  refresh();
  const conv = S.byId[convId];
  if (!conv) {
    setHead('Анализ диалога');
    view.innerHTML = `<div class="empty"><h2>Диалог не найден</h2><p>Проверьте ссылку или выберите диалог из списка.</p><a class="btn btn--primary" href="#/dialogs">К списку диалогов</a></div>`;
    return;
  }
  markRecent(convId);
  const E = evaluation(convId);
  const { cl, answers, finalScore, aiScore, finalAnswers } = E;
  const crits = sortedCrits(cl);
  const dd = deductions(E);
  // lib/roles.js: operator identities, operator → colleague remarks (context, not graded), dialogs without a client
  const R = annotateRoles(conv).roles;
  const total = R.no_client ? null : finalScore.total, prev = S.lastTotals[convId];
  const idx = S.convs.findIndex((c) => c.conversation_id === convId);
  const prevId = S.convs[idx - 1]?.conversation_id, nextId = S.convs[idx + 1]?.conversation_id;
  const call = isCall(conv);
  const dur = duration(conv);
  const t0 = call ? new Date(conv.transcript[0].timestamp) : null;
  const date = t0 && Number.isFinite(t0.getTime()) ? t0.toLocaleString('ru-RU', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : null;
  const single = S.single[convId];
  const decided = E.appeals.filter((a) => a.status !== 'open');
  const open = E.appeals.filter((a) => a.status === 'open');
  const reviewer = S.role === 'reviewer';
  const lastAppeal = (cid) => E.appeals.filter((x) => x.criterion_id === cid).at(-1);
  // A gross error carries no points, so the total can stay high: the verdict must still say the dialog needs review.
  const gross = finalScore.gross_error;
  const verdict = gross ? 'Грубая ошибка' : total == null ? 'Итог не рассчитан' : total >= 85 ? 'Хорошая работа' : total >= 60 ? 'Есть замечания' : 'Требует внимания';
  const verdictColor = gross ? 'var(--bad-ink)' : tierVar(tier(total));
  // one short provenance line; the long version (cache, carried answers, file) sits in its tooltip
  const cost = E.base.usage?.cost && E.base.cached !== true ? Number(E.base.usage.cost) : null;
  const runShort = E.src === 'ai'
    ? [`AI · ${esc(modelLabel(E.model))}`, E.evaluatedAt ? esc(dateTime(E.evaluatedAt)) : '', E.base.wall_ms ? `${fmt(E.base.wall_ms / 1000, 1)} с` : '', cost ? `$${cost.toFixed(4)}` : '', E.base.carried_from ? `ответы из v${E.base.carried_from}` : ''].filter(Boolean).join(' · ')
    : 'Предварительная оценка без AI';
  const runLong = E.src === 'ai'
    ? `${E.base.carried_from ? `Ответы AI перенесены из v${E.base.carried_from}, баллы по весам v${cl.version}. ` : ''}${E.base.evaluated_at && E.base.cached === false ? 'Новый запрос к модели. ' : E.base.cached ? 'Ответ из кэша: этот текст уже оценивался. ' : ''}${E.base.from_file ? `Из ${E.base.from_file}. ` : ''}${cost ? 'Стоимость: все вызовы модели для этого диалога.' : ''}`
    : 'Нажмите «Оценить заново», чтобы оценил AI';
  const nChanged = decided.filter((a) => a.status === 'changed').length, nConfirmed = decided.filter((a) => a.status === 'confirmed').length;
  const secs = finalScore.sections.filter((x) => x.max > 0);
  // each criterion is explained once: point deductions in «Причина снижения», the fired gross flag in its red banner,
  // everything else (full points, N/A, not evaluated) in «Остальные критерии»
  const ddPts = dd.filter((d) => !d.gross);
  // calls: the audio criteria (c09 tone) are our extension; results.json scores the 8 official criteria only
  // (eval/export-results.mjs drops input: "audio"), so show that number too when it differs
  const audioCrits = cl.criteria.filter((c) => c.input === 'audio');
  const noTone = call && audioCrits.length ? score({ ...cl, criteria: cl.criteria.filter((c) => c.input !== 'audio') }, finalAnswers).total : null;
  const restCrits = crits.filter((c) => !ddPts.some((d) => d.c.id === c.id) && !(c.type === 'flag' && finalAnswers[c.id] === 'yes'));
  const clLabel = checklistLabel(cl);
  setHead('Анализ диалога', `${conv.conversation_id} · ${clLabel}`);

  view.innerHTML = `
    <header class="dlg-head">
      <div class="dlg-head__main">
        <a class="back-link" href="#/dialogs">${icon('back')}Все диалоги</a>
        <h2 class="dlg-title"><span class="mono">${esc(conv.conversation_id)}</span>${E.finalScore.gross_error ? '<span class="l-chip l-chip--bad">Грубая ошибка</span>' : ''}${open.length ? `<span class="l-chip l-chip--warn">Апелляция: ${open.length}</span>` : ''}</h2>
        <div class="meta-line"><span>${call ? 'Звонок' : 'Чат'}</span><span>${esc(LANG[conv.language] || conv.language)}</span><span class="mono">${mmss(dur)}</span><span>${conv.transcript.length} ${plural(conv.transcript.length, ['реплика', 'реплики', 'реплик'])}</span>${R.operators.length > 1 ? `<span class="l-chip" title="В разговоре несколько операторов; реплики коллеге — контекст, не оцениваются">Операторы: ${esc(R.operators.join(' → '))}</span>` : ''}${conv._source ? `<span class="l-chip l-chip--info" title="Диалог добавлен в «Загрузке» ${esc(dateTime(conv._added_at))}">Загружен: ${esc(SOURCE_LABEL(conv._source))}</span>` : ''}${date ? `<span>${esc(date)}</span>` : ''}<a class="meta-link" href="#/checklist?kind=${E.kind}" title="Открыть этот чек-лист в редакторе">${icon('checklist')}${esc(clLabel)}</a></div>
      </div>
      <div class="dlg-head__nav">
        <a class="icon-btn icon-btn--line ${prevId ? '' : 'is-disabled'}" ${prevId ? `href="#/dialog/${encodeURIComponent(prevId)}"` : 'aria-disabled="true"'} aria-label="Предыдущий диалог">${icon('back')}</a>
        <a class="icon-btn icon-btn--line ${nextId ? '' : 'is-disabled'}" ${nextId ? `href="#/dialog/${encodeURIComponent(nextId)}"` : 'aria-disabled="true"'} aria-label="Следующий диалог">${icon('next')}</a>
      </div>
    </header>

    <section class="card timeline-card ${call ? '' : 'timeline-card--chat'}" aria-label="Хронология разговора">
      <div class="timeline" id="timeline">
        ${['client', 'operator', 'bot'].map((sp) => `<div class="track"><span class="track__label">${SPK[sp]}</span><div class="track__lane" data-lane="${sp}">${
          conv.transcript.map((m, i) => (m.speaker !== sp ? '' : (() => {
            const x = (offsetSec(conv, i) / dur) * 100; const nx = i + 1 < conv.transcript.length ? (offsetSec(conv, i + 1) / dur) * 100 : 100;
            const w = Math.max(0.8, Math.min(nx - x, Math.max(1.2, m.text.length / 9) * (60 / dur) * 1.5, 14));
            const bars = Math.max(2, Math.round(w * 1.4)); const h0 = parseInt(strHash(m.text).slice(0, 4), 36);
            // a chat has no audio: plain blocks, no drawn waveform
            return `<button type="button" class="seg-bar seg-bar--${sp} ${call ? '' : 'seg-bar--flat'}" style="left:${x}%;width:${w}%" data-jump="${i}" aria-label="Реплика ${i}: ${esc(m.text.slice(0, 60))}" title="#${i} ${esc(m.text.slice(0, 80))}">${call ? Array.from({ length: bars }, (_, k) => `<i style="height:${30 + ((h0 >> (k % 12)) % 7) * 10 + (k % 3) * 5}%"></i>`).join('') : ''}</button>`;
          })())).join('')}</div></div>`).join('')}
        <div class="track track--events"><span class="track__label">Снижения</span><div class="track__lane">
          ${conv.transcript.map((m, i) => (m.speaker === 'system' ? `<button type="button" class="evt" style="left:${(offsetSec(conv, i) / dur) * 100}%" data-jump="${i}" aria-label="Событие: ${esc(m.text.slice(0, 60))}" title="${esc(m.text)}"></button>` : '')).join('')}
          ${dd.map((d) => { const i = evidenceIdx(E, d.c); return i == null ? '' : `<button type="button" class="mark ${d.gross ? 'mark--gross' : d.lost >= (finalScore.criteria.find((r) => r.criterion_id === d.c.id)?.effective_weight || d.c.weight) * 0.5 ? 'mark--bad' : 'mark--mid'}" style="left:${(offsetSec(conv, i) / dur) * 100}%" data-jump="${i}" aria-label="${esc(d.c.title)}${d.gross ? ', грубая ошибка' : `, минус ${fmt(d.lost, 2)}`}" title="${esc(d.c.title)}${d.gross ? '' : ` −${fmt(d.lost, 2)}`}">${d.c.order}</button>`; }).join('')}
        </div></div>
        <div class="playhead" id="playhead" aria-hidden="true"></div>
      </div>
      <div class="player">
        <button type="button" class="play-btn" id="play" ${call && S.api.ok ? '' : 'disabled'} aria-label="Воспроизвести запись">${icon('play')}</button>
        <span class="mono player__t" id="tpos">00:00</span>
        <div class="scrub" id="scrub" role="slider" tabindex="0" aria-label="Позиция" aria-valuemin="0" aria-valuemax="${Math.round(dur)}" aria-valuenow="0"><span id="scrub-fill"></span></div>
        <span class="mono player__t">${mmss(dur)}</span>
        <span class="player__hint">${call ? (S.api.ok ? 'Запись звонка. Клик по дорожке или по доказательству переносит к моменту.' : 'Запись доступна при запуске с API.') : 'Чат. Клик по дорожке переносит к реплике.'}</span>
      </div>
    </section>

    <section class="understand" aria-label="Понимание разговора">
      <div class="understand__item"><span class="understand__ic">${icon('target')}</span><div><span class="kicker">Причина обращения</span><p class="clamp">${esc(E.summary?.reason || '—')}</p></div></div>
      <div class="understand__item"><span class="understand__ic">${icon('user')}</span><div><span class="kicker">Действия оператора</span><p class="clamp">${esc(E.summary?.operator_actions || '—')}</p></div></div>
      <div class="understand__item"><span class="understand__ic">${icon('outcome')}</span><div><span class="kicker">Результат</span><p class="clamp">${esc(E.summary?.outcome || '—')}</p></div></div>
    </section>

    <div class="analysis">
      <section class="card tx-card" aria-labelledby="tx-h">
        <header class="card__head card__head--line"><h2 id="tx-h">Расшифровка</h2><span class="muted small">Бот и система — контекст, не оцениваются</span></header>
        <div class="tx" id="transcript" tabindex="0" aria-label="Реплики разговора">${conv.transcript.map((m, i) => `
          <div class="tx-row tx-row--${esc(m.speaker)}${R.internal.includes(i) ? ' tx-row--internal' : ''}" id="m-${i}">
            <span class="tx-time mono">${esc(timeOfMsg(conv, i))}</span>
            <span class="tx-spk"><i class="spk spk--${esc(m.speaker)}"></i>${SPK[m.speaker] || esc(m.speaker)}${R.names[i] && R.operators.length > 1 ? ` <span class="tx-name">${esc(R.names[i])}</span>` : ''}</span>
            <span class="tx-text">${R.internal.includes(i) ? '<span class="l-chip tx-int" title="Оператор обращается к коллеге, а не к клиенту: контекст, не оценивается">внутренняя реплика</span> ' : ''}${esc(m.text)}</span>
            <span class="tx-idx mono">#${i}</span>
          </div>`).join('')}</div>
      </section>

      <div class="side">
        <section class="card score-card" aria-labelledby="score-h">
          <header class="card__head"><h2 id="score-h">Итоговая оценка</h2><span class="l-chip ${E.src === 'ai' ? 'l-chip--ok' : ''}">${E.src === 'ai' ? 'AI' : 'Без AI'}</span></header>
          <div class="score-head">
            <div class="ring-wrap" id="ring-wrap">${ring(prev ?? 0, tier(total))}<span class="ring-wrap__num num" id="total">${prev == null ? '—' : fmt(prev, 2)}</span><span class="ring-wrap__of">из 100</span></div>
            <div class="score-head__text">
              <b class="verdict" style="color:${verdictColor}">${verdict}</b>
              ${gross ? '<span class="small verdict-note">Флаг не снимает баллы, но диалог нужно разобрать.</span>' : ''}
              <span class="muted small run-line" title="${esc(runLong)}">${runShort}</span>
            </div>
          </div>
          ${calcHTML(crits, finalScore, finalAnswers, total)}
          ${noTone != null && total != null && Math.abs(noTone - total) >= 0.005 ? `<p class="calc-note small" title="Официальный формат results.json содержит 8 критериев чек-листа; тон по записи звонка — наше дополнение">В results.json без тона (8 критериев): <b class="num">${fmt(noTone, 2)}</b></p>` : ''}
          ${secs.length ? `<div class="secs" aria-label="Итоги по секциям">${secs.map((s) => `
            <div class="sec" title="${esc(s.title)}: ${fmt(s.points, 2)} из ${fmt(s.max, 2)}"><span class="sec__t">${esc(s.title)}</span><b class="num">${fmt(s.points, 1)}<small> / ${fmt(s.max, 1)}</small></b><span class="meter meter--s" aria-hidden="true"><span style="width:${s.score ?? 0}%;background:${tierVar(tier(s.score))}"></span></span></div>`).join('')}</div>` : ''}
          <ol class="path" aria-label="Путь оценки">
            <li class="path__s is-done"><span>${E.src === 'ai' ? 'Оценка AI' : 'Без AI'}</span><b class="num">${fmt(aiScore.total, 2)}</b></li>
            <li class="path__s ${open.length ? 'is-active' : E.appeals.length ? 'is-done' : ''}"><span>Апелляция</span><b>${open.length ? `открыта: ${open.length}` : E.appeals.length ? `подано: ${E.appeals.length}` : 'нет'}</b></li>
            <li class="path__s ${decided.length ? 'is-done' : open.length ? 'is-wait' : ''}"><span>Решение</span><b>${decided.length ? [nChanged ? `изменено: ${nChanged}` : '', nConfirmed ? `подтверждено: ${nConfirmed}` : ''].filter(Boolean).join(' · ') : open.length ? 'ждёт проверяющего' : '—'}</b></li>
            <li class="path__s path__s--final"><span>Итог</span><b class="num">${fmt(total, 2)}</b>${total !== aiScore.total && total != null && aiScore.total != null ? `<span class="delta ${total > aiScore.total ? 'delta--up' : 'delta--down'}">${signed(total - aiScore.total)}</span>` : ''}</li>
          </ol>
          ${decided.length ? `<ul class="decisions">${decided.map((a) => { const c = cl.criteria.find((x) => x.id === a.criterion_id); return c ? `<li><b>${esc(c.title)}</b>: ${a.status === 'changed' ? `${esc(answerText(c, answers[c.id]?.answer))} → ${esc(answerText(c, a.decision.new_answer))}` : 'оценка подтверждена'}<span class="muted"> · «${esc(a.decision.reason)}»</span></li>` : ''; }).join('')}</ul>` : ''}
          <div class="btn-row">
            ${reviewer && open.length ? `<button class="btn btn--primary" type="button" data-review="${open[0].id}">${icon('appeals')}Рассмотреть апелляцию</button>` : `<button class="btn btn--primary" type="button" id="appeal-main">${icon('appeals')}Оспорить оценку</button>`}
            <button class="btn" type="button" id="reeval" ${single?.pending ? 'disabled aria-busy="true"' : ''} ${aiReady() ? '' : 'title="AI недоступен на сервере"'}>${icon('refresh')}Оценить заново</button>
          </div>
          ${single?.pending ? `<div class="run run--pending run--lq" role="status" aria-live="polite">${liquidMark('run')}<div><b>Анализ: <span id="run-stage">читаю разговор</span></b><span class="muted small"><span class="num" id="run-t">0,0</span> с · обычно 30–60 с, звонок до 2,5 мин (3 оценки и голосование). Текущая оценка остаётся на экране.</span></div></div>`
            : single?.error ? `<div class="run run--error" role="alert">${icon('alert')}<div><b>Не удалось оценить</b><span class="small">${esc(single.error)} Текущая оценка сохранена.</span></div></div>`
            : single?.done ? `<div class="run run--ok run--done" role="status">${doneMark()}<div><b>Готово за ${fmt(single.done.ms / 1000, 1)} с</b><span class="muted small">${single.done.cost ? 'новая оценка' : 'из кэша'} · ${esc(modelLabel(single.done.model))}${single.done.cost ? ` · $${single.done.cost.toFixed(4)}` : ' · $0'}${single.done.delta != null ? (Math.abs(single.done.delta) < 0.005 ? ' · итог не изменился' : ` · итог ${signed(single.done.delta)}`) : ''}</span></div></div>` : ''}
        </section>

        ${R.no_client ? `<div class="banner banner--info" role="status">${icon('dash')}<div><b>Итог не рассчитан</b><p>${esc(E.base?.message || NO_CLIENT_MESSAGE)}.</p></div></div>` : ''}
        <!-- gross-error flag: carries no points, shown as its own red block under the score -->
        ${finalScore.gross_error ? (() => { const g = crits.find((c) => c.type === 'flag' && finalAnswers[c.id] === 'yes'); const i = g ? evidenceIdx(E, g) : null; return `<div class="banner banner--bad">${icon('alert')}<div><b>${esc(g && !/груб/i.test(g.title) ? `Грубая ошибка: ${g.title}` : 'Грубая ошибка')}</b><p>${esc(reasonOf(E, g))}</p>${i != null ? evChip(conv, i, answers[g.id]?.evidence?.find((e) => e.turn_index === i)?.quote) : ''}</div></div>`; })() : ''}

        <section class="card reasons-card" aria-labelledby="ded-h">
          <header class="card__head"><h2 id="ded-h">Причина снижения оценки</h2><span class="muted small">${ddPts.length ? `${ddPts.length} ${plural(ddPts.length, ['пункт', 'пункта', 'пунктов'])}` : ''}</span></header>
          ${ddPts.length ? `<div class="ded-list">${ddPts.map((d) => { const row = finalScore.criteria.find((x) => x.criterion_id === d.c.id); const i = evidenceIdx(E, d.c); const ap = lastAppeal(d.c.id); const q = answers[d.c.id]?.evidence?.find((e) => e.turn_index === i || e.range?.[0] === i)?.quote; return `
            <article class="ded ${d.gross ? 'ded--gross' : ''}">
              <header class="ded__head"><button type="button" class="crit__title" data-open="${d.c.id}"><span class="crit__n mono">${String(d.c.order).padStart(2, '0')}</span>${esc(d.c.title)}</button>${answerBadge(d.c, finalAnswers[d.c.id])}${confChip(E, d.c.id)}<span class="ded__lost num" title="баллы / вес после перераспределения N/A">−${fmt(d.lost, 2)}<small> · ${fmt(row?.points, 2)} / ${fmt(row?.effective_weight, 2)}</small></span></header>
              <p class="ded__why clamp">${esc(reasonOf(E, d.c))}</p>
              ${i != null ? evChip(conv, i, q) : ''}
              <div class="ded__foot">${ap?.status === 'open' ? `<span class="l-chip l-chip--warn">Апелляция на рассмотрении</span>${reviewer ? `<button class="btn btn--s btn--primary" type="button" data-review="${ap.id}">Принять решение</button>` : ''}` : ap?.status === 'changed' ? '<span class="l-chip l-chip--info">Оценка изменена</span>' : ap?.status === 'confirmed' ? '<span class="l-chip">Подтверждено проверяющим</span>' : `<button class="btn btn--s btn--appeal" type="button" data-appeal="${d.c.id}">${icon('appeals')}Оспорить</button>`}</div>
            </article>`; }).join('')}</div>` : R.no_client ? '<p class="muted small">Оценка не применяется: в разговоре нет клиента.</p>' : total == null ? `<div class="banner banner--info">${icon('dash')}<div>Итог не рассчитан: ни один критерий с весом не применим к этому диалогу. Причины N/A — ниже, в обосновании по критериям.</div></div>`
            : `<div class="banner banner--ok">${icon('check')}<div>Баллы не снижены ни по одному применимому критерию.</div></div>`}
        </section>

        <section class="card crit-card" aria-labelledby="crit-h">
          <header class="card__head"><h2 id="crit-h">${ddPts.length || gross ? 'Остальные критерии' : 'Обоснование по каждому критерию'}</h2><span class="muted small">${(() => { const low = crits.filter((c) => confidenceOf(E, c.id)?.low).length; return low ? `<span class="l-chip l-chip--warn" title="AI оценивает диалог ${E.base.samples} раза независимо и голосует. Где оценки разошлись, ответ стоит проверить человеку.">голоса AI разошлись: ${low}</span> · ` : ''; })()}баллы / вес</span></header>
          <div class="crit-list">${restCrits.map((c) => {
            const row = finalScore.criteria.find((x) => x.criterion_id === c.id); const a = finalAnswers[c.id]; const r = answers[c.id] || {};
            const ap = lastAppeal(c.id); const ev = (r.evidence || []).find((e) => e.kind === 'message' || e.kind === 'range'); const na = (r.evidence || []).find((e) => e.kind === 'na_condition');
            const i = ev ? (ev.kind === 'message' ? ev.turn_index : ev.range[0]) : null;
            const lost = row?.points != null && row.effective_weight - row.points > 0.001;
            return `<article class="crit ${ap?.status === 'open' ? 'is-appealed' : ap?.status === 'changed' ? 'is-overridden' : ''}">
              <header class="crit__head">
                <button type="button" class="crit__title" data-open="${c.id}"><span class="crit__n mono">${String(c.order).padStart(2, '0')}</span>${esc(c.title)}</button>
                ${answerBadge(c, a)}${confChip(E, c.id)}
                <span class="crit__pts num">${c.type === 'flag' ? '<span class="muted">флаг</span>' : row?.points == null ? '<span class="muted">не учит.</span>' : `${fmt(row.points, 2)}<small> / ${fmt(row.effective_weight, 2)}</small>`}</span>
              </header>
              <p class="crit__why clamp">${esc(r.explanation || (a == null ? 'AI ещё не оценил этот критерий по текущей версии чек-листа: в итог не входит. Нажмите «Оценить заново».' : '—'))}</p>
              ${lost && r.deduction_reason ? `<p class="crit__lost"><b>За что снижено:</b> ${esc(r.deduction_reason)}</p>` : ''}
              ${a === 'na' ? `<p class="crit__na"><b>Условие N/A из чек-листа:</b> ${esc(c.na_condition || 'не задано')}${na?.quote && na.quote !== c.na_condition ? `<br><b>Основание:</b> «${esc(na.quote)}»` : ''}</p>` : ''}
              ${a != null && row?.error ? `<p class="crit__lost"><b>Ответ не по правилам чек-листа:</b> ${esc(row.error)}. В итог не входит, нажмите «Оценить заново».</p>` : ''}
              ${i != null && a !== 'na' ? `<div class="crit__ev">${evChip(conv, i, ev.quote)}${ev.kind === 'range' ? `<span class="muted small">проверен участок #${ev.range[0]}–${ev.range[1]}</span>` : ''}</div>` : ''}
              ${ap ? `<p class="crit__appeal">${ap.status === 'open' ? `Апелляция: «${esc(ap.comment)}»` : ap.status === 'changed' ? `Изменено проверяющим: ${esc(answerText(c, r.answer))} → ${esc(answerText(c, ap.decision.new_answer))} · «${esc(ap.decision.reason)}»` : `Подтверждено проверяющим · «${esc(ap.decision.reason)}»`}</p>` : ''}
            </article>`;
          }).join('')}</div>
        </section>
      </div>
    </div>`;

  animateScore(prev ?? 0, total);
  S.lastTotals[convId] = total;

  // audio (calls) via /api/audio: organizer links are HTML pages with 1h mp3 links
  audioEl?.pause(); audioEl = null;
  if (call && S.api.ok) {
    audioEl = new Audio(`/api/audio?id=${encodeURIComponent(convId)}`); audioEl.preload = 'none';
    audioEl.addEventListener('timeupdate', () => setPlayhead(audioEl.currentTime, dur));
    audioEl.addEventListener('ended', () => { const p = $('#play'); if (p) p.innerHTML = icon('play'); });
    audioEl.addEventListener('error', () => toast('Не удалось загрузить запись звонка', 'warn'));
    $('#play', view).onclick = () => {
      if (audioEl.paused) { audioEl.play().catch(() => toast('Запись недоступна', 'warn')); $('#play', view).innerHTML = icon('pause'); $('#play', view).setAttribute('aria-label', 'Пауза'); }
      else { audioEl.pause(); $('#play', view).innerHTML = icon('play'); $('#play', view).setAttribute('aria-label', 'Воспроизвести запись'); }
    };
  }
  const scrub = $('#scrub', view);
  // on a call, seeking from the timeline/player keeps the player on screen (only the transcript box scrolls)
  const keepPage = { keepPage: call };
  scrub.addEventListener('click', (e) => { const r = e.currentTarget.getBoundingClientRect(); seekTo(conv, ((e.clientX - r.left) / r.width) * dur, keepPage); });
  scrub.addEventListener('keydown', (e) => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; e.preventDefault(); const cur = Number(scrub.getAttribute('aria-valuenow')) || 0; seekTo(conv, Math.max(0, Math.min(dur, cur + (e.key === 'ArrowRight' ? 5 : -5))), keepPage); });
  $$('.track__lane', view).forEach((lane) => lane.addEventListener('click', (e) => { if (e.target.closest('[data-jump]')) return; const r = lane.getBoundingClientRect(); seekTo(conv, ((e.clientX - r.left) / r.width) * dur, keepPage); }));
  // long texts are clamped to 2–3 lines; «ещё» appears only where something is actually cut
  $$('.clamp', view).forEach((el) => { if (el.scrollHeight > el.clientHeight + 2) el.insertAdjacentHTML('afterend', '<button type="button" class="more-btn" aria-expanded="false">ещё</button>'); });
  view.addEventListener('click', (e) => {
    const mb = e.target.closest('.more-btn'); if (mb) { const open = mb.previousElementSibling.classList.toggle('is-open'); mb.textContent = open ? 'свернуть' : 'ещё'; mb.setAttribute('aria-expanded', String(open)); return; }
    const j = e.target.closest('[data-jump]'); if (j) { jumpTo(conv, [Number(j.dataset.jump)], undefined, { keepPage: call && !!j.closest('.timeline-card') }); return; }
    const o = e.target.closest('[data-open]'); if (o) { openCriterion(conv, o.dataset.open); return; }
    const a = e.target.closest('[data-appeal]'); if (a) { openAppeal(conv, a.dataset.appeal); return; }
    const r = e.target.closest('[data-review]'); if (r) { openReview(r.dataset.review); }
  });
  $('#appeal-main', view)?.addEventListener('click', () => openAppeal(conv, dd[0]?.c.id || crits[0].id));
  $('#reeval', view).addEventListener('click', () => reevaluate(convId));
  clearInterval(ticker);
  if (single?.pending) ticker = setInterval(() => {
    const k = tickLiquid('run', single.startedAt);
    const t = $('#run-t'); if (t) t.textContent = (k.ms / 1000).toLocaleString('ru-RU', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
    const st = $('#run-stage'); if (st) st.textContent = k.stage;
  }, 100);
  const m = Number(query?.get('m'));
  if (query?.has('m') && Number.isInteger(m) && conv.transcript[m]) setTimeout(() => jumpTo(conv, [m]), 150);
  // one-click steps from the jury scenario on Обзор: ?act=appeal opens the appeal sheet, ?hint=reeval points at the button.
  // The query is dropped right away so a later redraw of this card does not repeat it.
  const act = query?.get('act'), hint = query?.get('hint');
  if (act || hint) history.replaceState(null, '', `#/dialog/${encodeURIComponent(convId)}`);
  if (act === 'appeal') setTimeout(() => { if (view.isConnected) openAppeal(conv, dd[0]?.c.id || crits[0].id); }, 120);
  if (hint === 'reeval') {
    const b = $('#reeval', view);
    setTimeout(() => { if (!b.isConnected) return; b.scrollIntoView({ block: 'center', behavior: reduced() ? 'auto' : 'smooth' }); b.classList.add('is-hint'); b.focus({ preventScroll: true }); }, 150);
    b.addEventListener('blur', () => b.classList.remove('is-hint'), { once: true });
  }
  return () => { audioEl?.pause(); audioEl = null; clearInterval(ticker); };
}

async function reevaluate(convId) {
  if (S.single[convId]?.pending) return;
  if (!aiReady()) { S.single[convId] = { error: 'AI недоступен на сервере.' }; emit('change'); return; }
  const before = evaluation(convId).finalScore.total;
  S.single[convId] = { pending: true, startedAt: Date.now() }; emit('change');
  try {
    const j = await aiEvaluate(convId, { force: true });
    const after = evaluation(convId).finalScore.total;
    S.single[convId] = { done: { ms: Date.now() - S.single[convId].startedAt, model: j.model, cost: j.cached ? 0 : Number(j.usage?.cost) || 0, delta: before != null && after != null ? after - before : null } };
    toast('Оценка готова');
  } catch (e) {
    S.single[convId] = { error: e.name === 'AbortError' ? 'Оценка заняла слишком много времени.' : `${e.message}.` };
  }
  if (location.hash.startsWith(`#/dialog/${encodeURIComponent(convId)}`) || location.hash.startsWith(`#/dialog/${convId}`)) emit('change');
}

function setPlayhead(sec, dur) {
  const p = Math.max(0, Math.min(100, (sec / dur) * 100));
  $('#playhead')?.style.setProperty('--p', p / 100);
  const f = $('#scrub-fill'); if (f) f.style.width = `${p}%`;
  const t = $('#tpos'); if (t) t.textContent = mmss(sec);
  $('#scrub')?.setAttribute('aria-valuenow', String(Math.round(sec)));
}
function seekTo(conv, sec, opts) {
  let best = 0; for (let i = 0; i < conv.transcript.length; i++) if (offsetSec(conv, i) <= sec) best = i;
  jumpTo(conv, [best], sec, opts);
}
export function jumpTo(conv, indices, sec, { keepPage = false } = {}) {
  $$('.tx-row.is-evidence').forEach((el) => el.classList.remove('is-evidence', 'is-flash'));
  indices.forEach((i) => { const el = $(`#m-${i}`); if (el) { el.classList.add('is-evidence'); void el.offsetWidth; el.classList.add('is-flash'); } });
  const first = $(`#m-${indices[0]}`); const box = $('#transcript');
  const behavior = reduced() ? 'auto' : 'smooth';
  if (first && box) {
    // row position inside the scroll box (offsetTop is relative to the card and includes its header);
    // when the page stays put the box may be only partly on screen, so put the row near its top edge
    const inBox = first.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop;
    box.scrollTo({ top: inBox - (keepPage ? 12 : box.clientHeight / 3), behavior });
    const r = box.getBoundingClientRect();
    if (!keepPage && (r.top < 64 || r.top > innerHeight * 0.6)) box.closest('.tx-card')?.scrollIntoView({ behavior, block: 'start' });
  }
  // call timestamps mark where a phrase ENDS, so a jump to a turn starts the audio at the previous timestamp
  const t = sec ?? (isCall(conv) && indices[0] > 0 ? offsetSec(conv, indices[0] - 1) : offsetSec(conv, indices[0]));
  setPlayhead(t, duration(conv));
  if (audioEl) { try { audioEl.currentTime = t; } catch {} }
}
function animateScore(from, to) {
  const wrap = $('#ring-wrap'); if (!wrap) return;
  const arc = wrap.querySelector('.ring__arc'); const num = $('#total'); const c = Number(arc.dataset.c);
  const set = (v) => { arc.setAttribute('stroke-dasharray', `${(c * Math.max(0, Math.min(100, v))) / 100} ${c}`); };
  if (to == null) { set(0); num.textContent = '—'; return; }
  const d = reduced() ? 1 : 700; const t0 = performance.now();
  const step = (now) => { const k = Math.min(1, (now - t0) / d), e = 1 - (1 - k) ** 3, v = from + (to - from) * e; set(v); num.textContent = k < 1 ? fmt(v, 0) : fmt(to, 2); if (k < 1) requestAnimationFrame(step); };
  requestAnimationFrame(step);
  setTimeout(() => { if (num.isConnected) { set(to); num.textContent = fmt(to, 2); } }, d + 60);
}

/* ---------- drawers ---------- */
function fragment(conv, evid) {
  const ids = (evid || []).flatMap((e) => (e.kind === 'message' ? [e.turn_index] : e.kind === 'range' ? [e.range[0], e.range[1]] : []));
  const na = (evid || []).find((e) => e.kind === 'na_condition');
  if (!ids.length) return `<div class="banner banner--info">${icon('dash')}<div>${na ? `N/A: ${esc(na.quote)}` : 'Нет ссылки на реплику.'}</div></div>`;
  const lo = Math.max(0, Math.min(...ids) - 1), hi = Math.min(conv.transcript.length - 1, Math.max(...ids) + 1);
  return `<div class="tx tx--mini">${conv.transcript.slice(lo, hi + 1).map((m, k) => { const i = lo + k; return `<div class="tx-row tx-row--${esc(m.speaker)} ${ids.includes(i) ? 'is-evidence' : ''}"><span class="tx-time mono">#${i}</span><span class="tx-spk"><i class="spk spk--${esc(m.speaker)}"></i>${SPK[m.speaker] || esc(m.speaker)}</span><span class="tx-text">${esc(m.text)}</span></div>`; }).join('')}</div>`;
}

/** Vote agreement chip: «3 из 3» quietly, «2 из 3 · проверьте» as a warning (samples split). */
function confChip(E, critId, long = false) {
  const cf = confidenceOf(E, critId); if (!cf) return '';
  const tip = `Независимых оценок AI: ${cf.n}, с этим ответом согласны ${cf.k}.${cf.low ? ' Оценки разошлись: проверьте вручную или оспорьте.' : ''}`;
  return cf.low ? `<span class="l-chip l-chip--warn conf" title="${esc(tip)}">${cf.k} из ${cf.n}${long ? ' · голоса AI разошлись, проверьте' : ' · проверьте'}</span>`
    : `<span class="muted small conf" title="${esc(tip)}">${cf.k} из ${cf.n}</span>`;
}

function openCriterion(conv, critId) {
  const E = evaluation(conv.conversation_id); const c = E.cl.criteria.find((x) => x.id === critId); const r = E.answers[critId] || {};
  const row = E.finalScore.criteria.find((x) => x.criterion_id === critId); const ap = E.appeals.filter((a) => a.criterion_id === critId);
  const hasEv = (r.evidence || []).some((e) => e.kind !== 'na_condition');
  const w = drawer(`${String(c.order).padStart(2, '0')} · ${c.title}`, `
    <div class="spread">${answerBadge(c, E.finalAnswers[critId])}${confChip(E, critId, true)}<span class="num"><b>${row.points == null ? '—' : fmt(row.points, 2)}</b> / ${row.effective_weight == null ? '—' : fmt(row.effective_weight, 2)} <span class="muted small">(вес ${c.weight})</span></span></div>
    <p class="muted small">${esc(c.description)}</p>
    <div class="note"><span class="kicker">${E.src === 'ai' ? 'Объяснение AI' : 'Объяснение (без AI)'}</span><p>${esc(r.explanation || '—')}</p>${r.deduction_reason ? `<p><b>За что снижено:</b> ${esc(r.deduction_reason)}</p>` : ''}</div>
    ${c.input === 'audio' ? `<p class="muted small">Оценено по записи звонка, не по тексту${r.audio_metrics ? ` · темп оператора ≈ ${r.audio_metrics.op_wpm_median ?? '—'} слов/мин · долгое молчание: ${r.audio_metrics.long_waits.length ? r.audio_metrics.long_waits.map((w) => `${w.at} (${w.wait_s} с)`).join(', ') : 'нет'}` : ''}</p>` : ''}
    <div class="field"><span class="field__label">Доказательство</span>${fragment(conv, r.evidence)}</div>
    ${ap.length ? `<ol class="steps"><li><b>Автооценка:</b> ${esc(answerText(c, r.answer))}</li>${ap.map((a) => `<li class="steps__appeal"><b>Апелляция:</b> «${esc(a.comment)}»</li>${a.decision ? `<li class="steps__${a.status}"><b>Решение:</b> ${a.status === 'changed' ? `изменено на «${esc(answerText(c, a.decision.new_answer))}»` : 'подтверждено'} · ${esc(a.decision.reason)}</li>` : ''}`).join('')}</ol>` : ''}`,
    `<button class="btn" type="button" data-close>Закрыть</button>${hasEv ? '<button class="btn" type="button" id="cr-jump">К реплике</button>' : ''}<button class="btn btn--primary" type="button" id="cr-appeal">Оспорить</button>`);
  w.querySelector('#cr-appeal').onclick = () => openAppeal(conv, critId);
  const jb = w.querySelector('#cr-jump'); if (jb) jb.onclick = () => { const e = r.evidence.find((x) => x.kind !== 'na_condition'); closeDrawer(false); jumpTo(conv, e.kind === 'message' ? [e.turn_index] : Array.from({ length: e.range[1] - e.range[0] + 1 }, (_, k) => e.range[0] + k)); };
}

export function openAppeal(conv, critId) {
  const E = evaluation(conv.conversation_id); const cl = E.cl;
  const crits = sortedCrits(cl).filter((c) => !E.appeals.some((a) => a.criterion_id === c.id && a.status === 'open'));
  if (!crits.length) { toast('По всем критериям уже есть открытые апелляции', 'warn'); return; }
  const w = drawer('Апелляция', `
    <p class="muted small">Оператор или оценщик не согласен с оценкой. Проверяющий увидит спорную оценку, комментарий и фрагмент диалога.</p>
    <div class="field"><label class="field__label" for="ap-crit">Критерий</label>
      <select class="input" id="ap-crit">${crits.map((c) => `<option value="${c.id}" ${c.id === critId ? 'selected' : ''}>${String(c.order).padStart(2, '0')} · ${esc(c.title)} — ${esc(answerText(c, E.finalAnswers[c.id]))}</option>`).join('')}</select></div>
    <div id="ap-ctx"></div>
    <div class="field"><label class="field__label" for="ap-comment">Комментарий</label>
      <textarea class="input" id="ap-comment" rows="4" placeholder="Почему оценка неверна? Сошлитесь на реплику, например #9."></textarea>
      <span class="field__err" id="ap-err" role="alert"></span></div>`,
    `<button class="btn" type="button" data-close>Отмена</button><button class="btn btn--primary" type="button" id="ap-save">Отправить на апелляцию</button>`);
  const ctx = () => { const id = w.querySelector('#ap-crit').value; const c = cl.criteria.find((x) => x.id === id); const r = E.answers[id] || {};
    w.querySelector('#ap-ctx').innerHTML = `<div class="note"><div class="spread"><b>${esc(c.title)}</b>${answerBadge(c, E.finalAnswers[id])}</div><p class="small">${esc(r.deduction_reason || r.explanation || '')}</p>${fragment(conv, r.evidence)}</div>`; };
  ctx(); w.querySelector('#ap-crit').addEventListener('change', ctx);
  w.querySelector('#ap-save').onclick = () => {
    const ta = w.querySelector('#ap-comment'); const comment = ta.value.trim();
    if (!comment) { ta.setAttribute('aria-invalid', 'true'); w.querySelector('#ap-err').textContent = 'Напишите, почему оценка неверна'; ta.focus(); return; }
    const crit = w.querySelector('#ap-crit').value;
    closeDrawer(false); addAppeal(conv.conversation_id, crit, comment);
    toast('Апелляция отправлена проверяющему');
  };
}

export function openReview(appealId) {
  refresh();
  const ap = S.appeals.find((a) => a.id === appealId); if (!ap) return;
  const conv = S.byId[ap.conversation_id]; if (!conv) return;
  const E = evaluation(conv.conversation_id); const cl = E.cl;
  const c = cl.criteria.find((x) => x.id === ap.criterion_id);
  if (!c) { toast('Критерий апелляции отсутствует в активной версии чек-листа', 'warn'); return; }
  const r = E.answers[c.id] || {}; const orig = r.answer;
  const options = c.type === 'scale' ? [...c.scale.map((s) => s.value), ...(c.na_allowed ? ['na'] : [])] : ['yes', 'no', ...(c.na_allowed ? ['na'] : [])];
  const label = (v) => (c.type === 'flag' ? (v === 'yes' ? 'Нарушение' : v === 'no' ? 'Нет нарушения' : String(v)) : v === 'yes' ? 'Да' : v === 'no' ? 'Нет' : v === 'na' ? 'N/A' : String(v));
  let pick = orig, mode = 'confirm';
  const w = drawer(`Решение по апелляции · ${conv.conversation_id}`, `
    <div class="note">
      <div class="spread"><b>${String(c.order).padStart(2, '0')} · ${esc(c.title)}</b>${answerBadge(c, orig)}</div>
      <p class="small"><span class="muted">Автооценка:</span> ${esc(r.explanation || '')}</p>
      <div class="banner banner--warn">${icon('appeals')}<div><b>Комментарий к апелляции</b><p>${esc(ap.comment)}</p></div></div>
    </div>
    <div class="field"><span class="field__label">Фрагмент диалога</span>${fragment(conv, r.evidence)}</div>
    <div class="field"><span class="field__label">Решение</span><div class="seg seg--wide" id="rv-mode" role="group" aria-label="Решение"><button type="button" data-m="confirm" aria-pressed="true">Подтвердить оценку</button><button type="button" data-m="change" aria-pressed="false">Изменить оценку</button></div></div>
    <div class="field" id="rv-new" hidden><span class="field__label">Новый ответ</span><div class="seg" id="rv-answer" role="group" aria-label="Новый ответ">${options.map((v) => `<button type="button" data-v="${v}" aria-pressed="${v === orig}">${label(v)}</button>`).join('')}</div></div>
    <div class="field"><label class="field__label" for="rv-reason">Причина решения</label><textarea class="input" id="rv-reason" rows="3" placeholder="Обоснование со ссылкой на реплику"></textarea><span class="field__err" id="rv-err" role="alert"></span></div>
    <div class="banner banner--info" id="rv-preview"></div>`,
    `<button class="btn" type="button" data-close>Отмена</button><button class="btn btn--primary" type="button" id="rv-save">Сохранить решение</button>`);
  const preview = () => {
    const base = evaluation(conv.conversation_id); const ans = { ...base.finalAnswers, [c.id]: mode === 'change' ? pick : base.finalAnswers[c.id] };
    const nt = score(cl, ans).total, ot = base.finalScore.total;
    w.querySelector('#rv-preview').innerHTML = `${icon('refresh')}<div>Итог после решения: <b class="num">${fmt(ot, 2)}</b> → <b class="num">${fmt(nt, 2)}</b> ${nt !== ot && nt != null && ot != null ? `<span class="delta ${nt > ot ? 'delta--up' : 'delta--down'}">${signed(nt - ot)}</span>` : ''}</div>`;
  };
  w.querySelector('#rv-mode').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; mode = b.dataset.m; w.querySelectorAll('#rv-mode button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); w.querySelector('#rv-new').hidden = mode !== 'change'; preview(); });
  w.querySelector('#rv-answer').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; pick = ['yes', 'no', 'na'].includes(b.dataset.v) ? b.dataset.v : Number(b.dataset.v); w.querySelectorAll('#rv-answer button').forEach((x) => x.setAttribute('aria-pressed', String(x === b))); preview(); });
  preview();
  w.querySelector('#rv-save').onclick = () => {
    const ta = w.querySelector('#rv-reason'); const reason = ta.value.trim();
    if (!reason) { ta.setAttribute('aria-invalid', 'true'); w.querySelector('#rv-err').textContent = 'Укажите причину решения'; ta.focus(); return; }
    closeDrawer(false);
    const res = decideAppeal(ap.id, { change: mode === 'change', answer: pick, reason });
    toast(res?.status === 'changed' ? 'Оценка изменена, итог пересчитан' : 'Оценка подтверждена');
    const target = `#/dialog/${encodeURIComponent(conv.conversation_id)}`;
    if (!location.hash.startsWith(target)) location.hash = target;
  };
}
