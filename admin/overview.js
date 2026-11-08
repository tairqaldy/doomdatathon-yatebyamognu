// Обзор: the jury's six-step scenario (dismissible) → four key numbers → «Где теряем баллы» + «Грубые ошибки» →
// everything else (distribution, languages/channels, what to fix first) one click away under «Подробнее».
import { $, esc, fix, plural, icon, LANG, CHAN, tierVar, setHead, mountChart, hbarsSVG, histogramSVG, toast, countUp, seg } from './ui.js';
import { S, rows, compute, checklistOf, tier, modelLabel, aiReady, reevaluateAll, grossOf, hrefFor, reasonOf, missingAI, sortRows } from './store.js';
import * as live from '/shared/live-store.js';

const JURY_KEY = 'cqa-admin-jury-v1';       // 'hidden' once the jury panel is dismissed
const MORE_KEY = 'cqa-admin-overview-more'; // '1' while «Подробнее» is open
const ls = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} } };
const DEMO = 'p1-ru-009'; // RU chat with a gross error (data shown before identification): every step of the cycle has something to show
let counted = false;      // KPI count-up runs once per page load, not on every live redraw
// filters for the whole page (language, channel, source) and the two block sorts; URL first, then this tab's memory
const F_KEY = 'cqa-admin-overview-f';
const F0 = { lang: '', channel: '', source: '', lsort: 'lost', gsort: 'score' };
const ss = { get: () => { try { return JSON.parse(sessionStorage.getItem(F_KEY) || '{}'); } catch { return {}; } }, set: (v) => { try { sessionStorage.setItem(F_KEY, JSON.stringify(v)); } catch {} } };
const SOURCES = { DEV: 'DEV', import: 'Загруженные', live: 'Живые' };

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
function grossCard(list, f, q) {
  // score: lowest first · language: RU, KZ, EN, lowest score first inside each language
  const low = sortRows(list.filter((r) => r.gross), 'low');
  const g = f.gsort === 'lang' ? sortRows(low, 'lang') : low;
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
    <header class="card__head"><h2 id="gx-h">Грубые ошибки <span class="gx__count num">${g.length}</span></h2>${g.length ? `<a class="link" href="#/dialogs?gross=1${q}">Все с причинами ${icon('arrow')}</a>` : ''}</header>
    ${g.length > 1 ? `<div class="card__tools">${seg('gx-sort', [{ v: 'score', label: 'По баллу' }, { v: 'lang', label: 'По языку' }], f.gsort, 'Порядок грубых ошибок')}</div>` : ''}
    ${g.length ? `<ol class="gx-list">${g.slice(0, 5).map(item).join('')}</ol>${g.length > 5 ? `<a class="gx-more link" href="#/dialogs?gross=1${q}">Ещё ${g.length - 5} ${icon('arrow')}</a>` : ''}`
      : `<div class="banner banner--ok gx-none">${icon('check')}<div>Грубых ошибок нет.</div></div>`}
  </section>`;
}

export function viewOverview(view, _arg, query) {
  const fromQuery = ['lang', 'channel', 'source'].some((k) => query?.has(k));
  const f = { ...F0, ...ss.get(), ...(fromQuery ? { lang: '', channel: '', source: '', ...Object.fromEntries(['lang', 'channel', 'source'].filter((k) => query.has(k)).map((k) => [k, query.get(k)])) } : {}) };
  const sync = () => {
    const p = new URLSearchParams(['lang', 'channel', 'source'].filter((k) => f[k]).map((k) => [k, f[k]]));
    history.replaceState(null, '', `#/overview${p.toString() ? `?${p}` : ''}`); ss.set(f);
  };
  if (!['lost', 'n', 'name'].includes(f.lsort)) f.lsort = 'lost';
  if (!['score', 'lang'].includes(f.gsort)) f.gsort = 'score';
  if (fromQuery) ss.set(f); else if (f.lang || f.channel || f.source) sync();
  const draw = () => {
    const all = rows();
    const list = all.filter((r) => (!f.lang || r.language === f.lang) && (!f.channel || r.channel === f.channel) && (!f.source || r.source === f.source));
    const filtered = !!(f.lang || f.channel || f.source);
    // links into Диалоги carry the language and channel of this selection
    const q = `${f.lang ? `&lang=${f.lang}` : ''}${f.channel ? `&channel=${f.channel}` : ''}`;
    const qq = q ? `?${q.slice(1)}` : '';
    const sources = Object.keys(SOURCES).filter((k) => all.some((r) => r.source === k));
    const st = compute(list);
    const cl = checklistOf('chat'); const cc = checklistOf('call');
    const m = S.metrics;
    // after a checklist change: dialogs with no AI answer, or with new criteria the AI has not answered yet
    const mockRows = list.filter((r) => r.source === 'DEV' && (r.E.src !== 'ai' || r.E.base.partial)); const mockN = mockRows.length;
    const mockKinds = [...new Set(mockRows.map((r) => r.E.kind))];
    setHead('Обзор', `${filtered ? `выбрано ${st.n} из ${all.length}` : `${st.n} ${plural(st.n, ['диалог', 'диалога', 'диалогов'])}`} · чаты v${cl.version}, звонки v${cc.version} · ${modelLabel(S.pre?.model || S.api.model)}`);
    const agreeN = m ? Math.round((m.overall.n * m.overall.strict) / 100) : 0;
    // the metrics file may be older than the evaluations on screen: say which prompt it measured
    const metricsVer = m?.meta?.prompt_version || null;
    const mLang = f.lang && m?.per_language?.[f.lang] ? m.per_language[f.lang] : null;
    // the costliest non-gross reasons sit under the loss chart (gross errors have their own card)
    const fixFirst = st.reasonGroups.filter((g) => !g.gross).slice(0, 3);
    const showJury = ls.get(JURY_KEY) !== 'hidden';
    const moreOpen = ls.get(MORE_KEY) === '1';
    const grossPct = st.n ? Math.round((st.gross / st.n) * 100) : 0;
    const top = st.loss.find((l) => l.avg_lost >= 0.05);
    const conv3 = (n) => plural(n, ['разговор', 'разговора', 'разговоров']);
    const headline = st.n ? `${st.n} ${conv3(st.n)}, средний балл ${fix(st.avg, 1)}.${top ? ` Больше всего баллов теряется по критерию «${esc(top.c.title)}».` : ''} ${st.gross
      ? `${st.gross} ${plural(st.gross, ['разговор', 'разговора', 'разговоров'])} с грубыми ошибками: <a class="headline__go" href="#/dialogs?gross=1${q}">начните с ${st.gross === 1 ? 'него' : 'них'} ${icon('arrow')}</a>`
      : `Грубых ошибок нет: <a class="headline__go" href="#/dialogs?sort=low${q}">начните с самых низких оценок ${icon('arrow')}</a>`}` : filtered ? 'В этой выборке нет оценённых разговоров: <button class="headline__go link" type="button" data-reset>сбросить фильтры</button>' : 'Оценённых разговоров пока нет: <a class="headline__go" href="#/import">загрузите диалог</a>';

    view.innerHTML = `
      ${mockN && aiReady() ? `<div class="banner banner--info">${icon('alert')}<div><b>${mockN} ${plural(mockN, ['диалог', 'диалога', 'диалогов'])} AI ещё не оценил по новым критериям чек-листа.</b> Остальные ответы перенесены, цифры ниже предварительные.</div><button class="btn btn--s btn--primary" type="button" id="ov-ai">Оценить AI · ${mockN}</button></div>` : ''}
      <form class="ov-filters" aria-label="Выборка для всех блоков страницы" onsubmit="return false">
        ${seg('ov-lang', [{ v: '', label: 'Все языки' }, ...Object.keys(LANG).map((k) => ({ v: k, label: k }))], f.lang, 'Язык')}
        ${seg('ov-channel', [{ v: '', label: 'Все каналы' }, { v: 'chat', label: 'Чаты' }, { v: 'call', label: 'Звонки' }], f.channel, 'Канал')}
        ${sources.length > 1 ? seg('ov-source', [{ v: '', label: 'Все источники' }, ...sources.map((k) => ({ v: k, label: SOURCES[k] }))], f.source, 'Источник') : ''}
        ${filtered ? '<button class="link ov-filters__reset" type="button" data-reset>Сбросить</button>' : ''}
      </form>
      <p class="headline">${headline}</p>
      ${showJury ? juryPanel() : ''}
      <section class="kpis" aria-label="Ключевые показатели">
        ${kpi({ label: 'Средний балл', value: fix(st.avg, 1), unit: '/100', sub: `медиана ${fix(st.median, 1)}`, href: `#/dialogs?sort=low${q}`, meter: { p: st.avg || 0, color: tierVar(tier(st.avg)) }, count: st.avg != null ? { to: st.avg, d: 1 } : null })}
        ${kpi({ label: 'Диалогов оценено', value: st.n, sub: `${st.chats} ${plural(st.chats, ['чат', 'чата', 'чатов'])} · ${st.calls} ${plural(st.calls, ['звонок', 'звонка', 'звонков'])}`, href: `#/dialogs${qq}`, count: { to: st.n, d: 0 } })}
        ${kpi({ label: 'Грубые ошибки', value: st.gross, sub: `${grossPct}% диалогов`, href: `#/dialogs?gross=1${q}`, mod: st.gross ? 'kpi--flag' : '', count: { to: st.gross, d: 0 } })}
        ${kpi({ label: 'Совпадение с ручной разметкой', value: m ? fix((mLang || m.overall).strict, 1) : '—', unit: m ? '%' : '', sub: m ? (mLang ? `<span title="${Math.round((mLang.n * mLang.strict) / 100)} из ${mLang.n} ответов AI на ${f.lang} совпали с экспертной разметкой">${esc(f.lang)} · ${mLang.n} ответов · ${esc(metricsVer || '')}</span>` : `<span title="${agreeN} из ${m.overall.n} ответов AI по критериям совпали с экспертной разметкой, замер ${esc(metricsVer || '')}">${m.gold_dialogs} ${plural(m.gold_dialogs, ['диалог', 'диалога', 'диалогов'])} · ${esc(metricsVer || '')}</span>`) : 'нет файла метрик', count: m ? { to: (mLang || m.overall).strict, d: 1 } : null })}
      </section>

      <div class="grid grid--3-2">
        <section class="card chart-card" aria-labelledby="ch-loss">
          <header class="card__head"><h2 id="ch-loss">Где теряем баллы</h2><span class="muted small">в среднем на диалог</span></header>
          <div class="card__tools">${seg('loss-sort', [{ v: 'lost', label: 'По потерям' }, { v: 'n', label: 'По числу диалогов' }, { v: 'name', label: 'А–Я' }], f.lsort, 'Порядок критериев')}</div>
          <div class="chart-box" id="ch-loss-box"></div>
          ${fixFirst.length ? `<div class="loss-why"><span class="kicker">Частые причины</span><ol class="loss-why__list">${fixFirst.map((g) => {
            const it = g.items[0]; const ex = it.rows[0];
            return `<li><b>${esc(g.c.title)}</b><span class="loss-why__t">${esc(it.text)}${it.count > 1 ? ` <span class="muted">(${it.count} раза)</span>` : ''}</span><a class="link link--mono" href="#/dialog/${encodeURIComponent(ex.id)}">${esc(ex.id)}</a></li>`; }).join('')}</ol></div>` : ''}
        </section>
        ${grossCard(list, f, q)}
      </div>

      <details class="more" id="ov-more" ${moreOpen ? 'open' : ''}>
        <summary class="more__sum"><span>Подробнее</span><span class="muted small">распределение оценок · языки и каналы</span>${icon('down', 'ic more__chev')}</summary>
        <div class="grid grid--2">
          <section class="card chart-card" aria-labelledby="ch-dist">
            <header class="card__head"><h2 id="ch-dist">Распределение оценок</h2><span class="muted small">разговоров в диапазоне</span></header>
            <div class="chart-box" id="ch-dist-box"></div>
            <div class="legend"><span><i style="background:var(--bad)"></i>ниже 60: разобрать</span><span><i style="background:var(--calm)"></i>60 и выше</span></div>
          </section>
          <section class="card chart-card" aria-labelledby="ch-seg">
            <header class="card__head"><h2 id="ch-seg">Языки и каналы</h2><span class="muted small">средний балл</span></header>
            <div class="chart-box" id="ch-seg-box"></div>
          </section>
        </div>
      </details>
      ${showJury ? '' : '<p class="jury-restore"><button class="link" type="button" id="jury-show">Показать сценарий проверки для жюри</button></p>'}`;

    const lossRows = [...st.loss].sort(f.lsort === 'n' ? (a, b) => b.dialogs - a.dialogs || b.avg_lost - a.avg_lost : f.lsort === 'name' ? (a, b) => a.c.title.localeCompare(b.c.title, 'ru') : (a, b) => b.avg_lost - a.avg_lost);
    mountChart($('#ch-loss-box', view), (w) => hbarsSVG(w, lossRows.map((l) => ({
      label: l.c.title, sub: `${l.dialogs} ${plural(l.dialogs, ['диалог', 'диалога', 'диалогов'])}`, value: l.avg_lost, valueText: l.avg_lost < 0.05 ? '0' : `−${fix(l.avg_lost, 1)}`, color: l === top ? 'var(--mid)' : 'var(--calm)', href: `#/dialogs?crit=${encodeURIComponent(l.c.id)}${q}`,
    })), { title: 'Средняя потеря баллов на диалог по критериям', valueClass: 'ch-val--muted', desc: st.loss.map((l) => `${l.c.title}: −${fix(l.avg_lost, 1)}`).join('; ') }));
    mountChart($('#ch-dist-box', view), (w) => histogramSVG(w, st.bins, {
      title: 'Распределение итоговых баллов', calm: true, desc: st.bins.map((b) => `${b.from}–${b.to}: ${b.n}`).join('; '), hrefFor: (b) => `#/dialogs?range=${b.from}-${b.to}${q}`,
    }));
    const segRows = [{ group: 'Язык' }, ...['RU', 'KZ', 'EN'].filter((k) => st.byLang[k]).map((k) => ({ label: LANG[k], sub: `${st.byLang[k].n} диал.`, value: st.byLang[k].avg, valueText: fix(st.byLang[k].avg, 1), color: st.byLang[k].avg < 60 ? 'var(--bad)' : 'var(--calm-2)', href: `#/dialogs?lang=${k}` })),
      { group: 'Канал' }, ...['chat', 'call'].filter((k) => st.byChannel[k]).map((k) => ({ label: CHAN[k], sub: `${st.byChannel[k].n} диал.`, value: st.byChannel[k].avg, valueText: fix(st.byChannel[k].avg, 1), color: st.byChannel[k].avg < 60 ? 'var(--bad)' : 'var(--calm-2)', href: `#/dialogs?channel=${k}` }))];
    mountChart($('#ch-seg-box', view), (w) => hbarsSVG(w, segRows, { title: 'Средний балл по языку и каналу', desc: segRows.filter((r) => !r.group).map((r) => `${r.label}: ${r.valueText}`).join('; '), max: 100 }));

    if (!counted) { counted = true; view.querySelectorAll('[data-count]').forEach((el) => countUp(el, Number(el.dataset.count), Number(el.dataset.d))); }

    view.querySelectorAll('.ov-filters .seg, #loss-sort, #gx-sort').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const k = { 'ov-lang': 'lang', 'ov-channel': 'channel', 'ov-source': 'source', 'loss-sort': 'lsort', 'gx-sort': 'gsort' }[g.id];
      if (!k || f[k] === b.dataset.v) return;
      f[k] = b.dataset.v; sync(); draw(); view.querySelector(`#${g.id} button[data-v="${b.dataset.v}"]`)?.focus();
    }));
    view.querySelectorAll('[data-reset]').forEach((b) => b.addEventListener('click', () => { f.lang = ''; f.channel = ''; f.source = ''; sync(); draw(); view.querySelector('#ov-lang button')?.focus(); }));
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
