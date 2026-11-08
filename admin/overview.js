// Обзор: the jury's six-step scenario (dismissible) → four key numbers → «Где теряем баллы» + «Грубые ошибки» →
// everything else (distribution, languages/channels, what to fix first) one click away under «Подробнее».
import { $, esc, fix, plural, icon, LANG, CHAN, tierVar, setHead, mountChart, hbarsSVG, histogramSVG, toast, countUp } from './ui.js';
import { S, rows, compute, checklistOf, tier, modelLabel, aiReady, reevaluateAll, grossOf, hrefFor, reasonOf, missingAI } from './store.js';
import * as live from '/shared/live-store.js';

const JURY_KEY = 'cqa-admin-jury-v1';       // 'hidden' once the jury panel is dismissed
const MORE_KEY = 'cqa-admin-overview-more'; // '1' while «Подробнее» is open
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} } };
const DEMO = 'p1-ru-009'; // RU chat with a gross error (data shown before identification): every step of the cycle has something to show
let counted = false;      // KPI count-up runs once per page load, not on every live redraw

// The cycle the jury checks, each step one click away (README «The cycle, step by step»).
const STEPS = [
  { n: 1, t: 'Чек-лист', s: 'критерии, веса, N/A', href: '#/checklist' },
  { n: 2, t: 'Диалоги', s: 'чаты и звонки', href: '#/dialogs' },
  { n: 3, t: 'Оценка', s: `${DEMO} → «Оценить заново»`, href: `#/dialog/${DEMO}?hint=reeval` },
  { n: 4, t: 'Результаты', s: 'грубые ошибки и причины', href: '#/dialogs?gross=1' },
  { n: 5, t: 'Апелляция', s: 'оспорить критерий', href: `#/dialog/${DEMO}?act=appeal` },
  { n: 6, t: 'Решение', s: 'проверяющий меняет балл', href: '#/appeals?role=reviewer' },
];
const juryPanel = () => `
  <section class="jury card" aria-labelledby="jury-h">
    <header class="jury__head">
      <h2 id="jury-h"><span class="jury__tag">Для жюри</span>Сценарий проверки</h2>
      <div class="jury__tools">
        <a class="btn btn--s" href="#/import">${icon('upload')}Оценить свой диалог</a>
        <button class="icon-btn" type="button" id="jury-hide" aria-label="Скрыть сценарий проверки" title="Скрыть">${icon('x')}</button>
      </div>
    </header>
    <ol class="jury__steps">${STEPS.map((x) => `<li><a class="jury__step" href="${x.href}"><span class="jury__n num">${x.n}</span><span class="jury__txt"><b>${esc(x.t)}</b><span>${esc(x.s)}</span></span></a></li>`).join('')}</ol>
  </section>`;

const kpi = ({ label, value, unit = '', sub, href, mod = '', meter, count }) => `
  <${href ? `a href="${href}"` : 'div'} class="kpi ${mod}">
    <span class="kpi__label">${esc(label)}</span>
    <span class="kpi__value num"><span ${count != null ? `data-count="${count.to}" data-d="${count.d}"` : ''}>${value}</span>${unit ? `<small>${unit}</small>` : ''}</span>
    ${meter ? `<span class="meter" aria-hidden="true"><span style="width:${meter.p}%;background:${meter.color}"></span></span>` : ''}
    <span class="kpi__sub">${sub}</span>
    ${href ? `<span class="kpi__go" aria-hidden="true">${icon('arrow')}</span>` : ''}
  </${href ? 'a' : 'div'}>`;

/** Compact «Грубые ошибки» list: dialog, flag, one-line reason; each row opens the card at the evidence message. */
function grossCard(list) {
  const g = list.filter((r) => r.gross);
  const item = (r) => {
    const x = grossOf(r.E); const a = x?.a || {};
    const ev = (a.evidence || []).find((e) => e.kind === 'message' || e.kind === 'range');
    const i = ev ? (ev.kind === 'message' ? ev.turn_index : ev.range[0]) : null;
    const href = `${hrefFor(r)}${i != null && r.source !== 'live' ? `?m=${i}` : ''}`;
    return `<li><a class="gx" href="${href}">
      <span class="gx__top"><span class="mono gx__id">${esc(r.id)}</span><span class="lang">${esc(r.language)}</span>${r.channel === 'call' ? `<span class="chan">${icon('phone')}</span>` : ''}${x && !/груб/i.test(x.c.title) ? `<span class="gx__crit">${esc(x.c.title)}</span>` : ''}<span class="gx__score num" title="Итог диалога: флаг не снимает баллы">${r.total == null ? '—' : fix(r.total, 2)}</span></span>
      <span class="gx__why">${esc(a.deduction_reason || reasonOf(r.E, x?.c) || 'Без пояснения')}</span>
    </a></li>`;
  };
  return `<section class="card gross-card" aria-labelledby="gx-h">
    <header class="card__head"><h2 id="gx-h">Грубые ошибки <span class="gx__count num">${g.length}</span></h2>${g.length ? `<a class="link" href="#/dialogs?gross=1">Все с причинами ${icon('arrow')}</a>` : ''}</header>
    ${g.length ? `<ol class="gx-list">${g.slice(0, 5).map(item).join('')}</ol>${g.length > 5 ? `<a class="gx-more link" href="#/dialogs?gross=1">Ещё ${g.length - 5} ${icon('arrow')}</a>` : ''}`
      : `<div class="banner banner--ok gx-none">${icon('check')}<div>Грубых ошибок нет.</div></div>`}
  </section>`;
}

export function viewOverview(view) {
  const draw = () => {
    const list = rows();
    const st = compute(list);
    const cl = checklistOf('chat'); const cc = checklistOf('call');
    const m = S.metrics;
    // after a checklist change: dialogs with no AI answer, or with new criteria the AI has not answered yet
    const mockRows = list.filter((r) => r.source === 'DEV' && (r.E.src !== 'ai' || r.E.base.partial)); const mockN = mockRows.length;
    const mockKinds = [...new Set(mockRows.map((r) => r.E.kind))];
    setHead('Обзор', `${st.n} ${plural(st.n, ['диалог', 'диалога', 'диалогов'])} · чаты v${cl.version}, звонки v${cc.version} · ${modelLabel(S.pre?.model || S.api.model)}`);
    const agreeN = m ? Math.round((m.overall.n * m.overall.strict) / 100) : 0;
    // the metrics file may be older than the evaluations on screen: say which prompt it measured
    const metricsVer = m?.meta?.prompt_version || null;
    // the costliest non-gross reasons sit under the loss chart (gross errors have their own card)
    const fixFirst = st.reasonGroups.filter((g) => !g.gross).slice(0, 3);
    const showJury = ls.get(JURY_KEY) !== 'hidden';
    const moreOpen = ls.get(MORE_KEY) === '1';
    const grossPct = st.n ? Math.round((st.gross / st.n) * 100) : 0;

    view.innerHTML = `
      ${mockN && aiReady() ? `<div class="banner banner--info">${icon('alert')}<div><b>${mockN} ${plural(mockN, ['диалог', 'диалога', 'диалогов'])} AI ещё не оценил по новым критериям чек-листа.</b> Остальные ответы перенесены, цифры ниже предварительные.</div><button class="btn btn--s btn--primary" type="button" id="ov-ai">Оценить AI · ${mockN}</button></div>` : ''}
      ${showJury ? juryPanel() : ''}
      <section class="kpis" aria-label="Ключевые показатели">
        ${kpi({ label: 'Средний балл', value: fix(st.avg, 1), unit: '/100', sub: `медиана ${fix(st.median, 1)}`, href: '#/dialogs?sort=low', meter: { p: st.avg || 0, color: tierVar(tier(st.avg)) }, count: st.avg != null ? { to: st.avg, d: 1 } : null })}
        ${kpi({ label: 'Диалогов оценено', value: st.n, sub: `${st.chats} ${plural(st.chats, ['чат', 'чата', 'чатов'])} · ${st.calls} ${plural(st.calls, ['звонок', 'звонка', 'звонков'])}`, href: '#/dialogs', count: { to: st.n, d: 0 } })}
        ${kpi({ label: 'Грубые ошибки', value: st.gross, sub: `${grossPct}% диалогов`, href: '#/dialogs?gross=1', mod: st.gross ? 'kpi--bad' : '', count: { to: st.gross, d: 0 } })}
        ${kpi({ label: 'Совпадение с ручной разметкой', value: m ? fix(m.overall.strict, 1) : '—', unit: m ? '%' : '', sub: m ? `<span title="${agreeN} из ${m.overall.n} ответов AI по критериям совпали с экспертной разметкой, замер ${esc(metricsVer || '')}">${m.gold_dialogs} ${plural(m.gold_dialogs, ['диалог', 'диалога', 'диалогов'])} · ${esc(metricsVer || '')}</span>` : 'нет файла метрик', count: m ? { to: m.overall.strict, d: 1 } : null })}
      </section>

      <div class="grid grid--3-2">
        <section class="card chart-card" aria-labelledby="ch-loss">
          <header class="card__head"><h2 id="ch-loss">Где теряем баллы</h2><span class="muted small">в среднем на диалог</span></header>
          <div class="chart-box" id="ch-loss-box"></div>
          ${fixFirst.length ? `<div class="loss-why"><span class="kicker">Что исправить первым</span><ol class="loss-why__list">${fixFirst.map((g) => {
            const it = g.items[0]; const ex = it.rows[0];
            return `<li><b>${esc(g.c.title)}</b><span class="loss-why__t">${esc(it.text)}${it.count > 1 ? ` <span class="muted">(${it.count} раза)</span>` : ''}</span><a class="link link--mono" href="#/dialog/${encodeURIComponent(ex.id)}">${esc(ex.id)}</a></li>`; }).join('')}</ol></div>` : ''}
        </section>
        ${grossCard(list)}
      </div>

      <details class="more" id="ov-more" ${moreOpen ? 'open' : ''}>
        <summary class="more__sum"><span>Подробнее</span><span class="muted small">распределение оценок · языки и каналы</span>${icon('down', 'ic more__chev')}</summary>
        <div class="grid grid--2">
          <section class="card chart-card" aria-labelledby="ch-dist">
            <header class="card__head"><h2 id="ch-dist">Распределение оценок</h2></header>
            <div class="chart-box" id="ch-dist-box"></div>
            <div class="legend"><span><i style="background:var(--bad)"></i>ниже 60</span><span><i style="background:var(--mid)"></i>60–84</span><span><i style="background:var(--good)"></i>85 и выше</span></div>
          </section>
          <section class="card chart-card" aria-labelledby="ch-seg">
            <header class="card__head"><h2 id="ch-seg">Языки и каналы</h2><span class="muted small">средний балл</span></header>
            <div class="chart-box" id="ch-seg-box"></div>
          </section>
        </div>
      </details>
      ${showJury ? '' : '<p class="jury-restore"><button class="link" type="button" id="jury-show">Показать сценарий проверки для жюри</button></p>'}`;

    mountChart($('#ch-loss-box', view), (w) => hbarsSVG(w, st.loss.map((l) => ({
      label: l.c.title, sub: `${l.dialogs} ${plural(l.dialogs, ['диалог', 'диалога', 'диалогов'])}`, value: l.avg_lost, valueText: l.avg_lost < 0.05 ? '0' : `−${fix(l.avg_lost, 1)}`, color: 'var(--bad)', href: `#/dialogs?crit=${encodeURIComponent(l.c.id)}`,
    })), { title: 'Средняя потеря баллов на диалог по критериям', desc: st.loss.map((l) => `${l.c.title}: −${fix(l.avg_lost, 1)}`).join('; ') }));
    mountChart($('#ch-dist-box', view), (w) => histogramSVG(w, st.bins, {
      title: 'Распределение итоговых баллов', desc: st.bins.map((b) => `${b.from}–${b.to}: ${b.n}`).join('; '), hrefFor: (b) => `#/dialogs?range=${b.from}-${b.to}`,
    }));
    const segRows = [{ group: 'Язык' }, ...['RU', 'KZ', 'EN'].filter((k) => st.byLang[k]).map((k) => ({ label: LANG[k], sub: `${st.byLang[k].n} диал.`, value: st.byLang[k].avg, valueText: fix(st.byLang[k].avg, 1), color: tierVar(tier(st.byLang[k].avg)), href: `#/dialogs?lang=${k}` })),
      { group: 'Канал' }, ...['chat', 'call'].filter((k) => st.byChannel[k]).map((k) => ({ label: CHAN[k], sub: `${st.byChannel[k].n} диал.`, value: st.byChannel[k].avg, valueText: fix(st.byChannel[k].avg, 1), color: tierVar(tier(st.byChannel[k].avg)), href: `#/dialogs?channel=${k}` }))];
    mountChart($('#ch-seg-box', view), (w) => hbarsSVG(w, segRows, { title: 'Средний балл по языку и каналу', desc: segRows.filter((r) => !r.group).map((r) => `${r.label}: ${r.valueText}`).join('; '), max: 100 }));

    if (!counted) { counted = true; view.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), Number(el.dataset.d))); }

    $('#ov-more', view).addEventListener('toggle', (e) => ls.set(MORE_KEY, e.target.open ? '1' : null));
    $('#jury-hide', view)?.addEventListener('click', () => { ls.set(JURY_KEY, 'hidden'); draw(); $('#jury-show', view)?.focus(); });
    $('#jury-show', view)?.addEventListener('click', () => { ls.set(JURY_KEY, null); draw(); $('#jury-h', view)?.scrollIntoView({ block: 'nearest' }); });
    $('#ov-ai', view)?.addEventListener('click', async () => {
      let done = 0, total = 0, failed = 0;
      for (const k of mockKinds) { const ids = missingAI(k); if (!ids.length) continue; const res = await reevaluateAll('ai', `AI-оценка: ${k === 'call' ? `звонки v${cc.version}` : `чаты v${cl.version}`}`, k, ids); if (res) { done += res.done; total += res.total; failed += res.failed; } }
      if (total) toast(`AI оценил ${done - failed} из ${total} диалогов${failed ? `, ошибок ${failed}` : ''}`, failed ? 'warn' : 'ok');
    });
  };
  draw();
  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(draw, 300); });
  return () => { off(); clearTimeout(t); };
}
