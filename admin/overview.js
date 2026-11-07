// Обзор: four key numbers, two charts that each answer one question, "what to fix first", language/channel comparison.
import { $, esc, fmt, fix, plural, icon, LANG, CHAN, tierVar, setHead, mountChart, hbarsSVG, histogramSVG, toast } from './ui.js';
import { S, rows, compute, checklistOf, tier, modelLabel, aiReady, reevaluateAll } from './store.js';
import * as live from '/shared/live-store.js';

const kpi = ({ label, value, unit = '', sub, href, mod = '', meter }) => `
  <${href ? `a href="${href}"` : 'div'} class="kpi ${mod}">
    <span class="kpi__label">${esc(label)}</span>
    <span class="kpi__value num">${value}${unit ? `<small>${unit}</small>` : ''}</span>
    ${meter ? `<span class="meter" aria-hidden="true"><span style="width:${meter.p}%;background:${meter.color}"></span></span>` : ''}
    <span class="kpi__sub">${sub}</span>
    ${href ? `<span class="kpi__go" aria-hidden="true">${icon('arrow')}</span>` : ''}
  </${href ? 'a' : 'div'}>`;

export function viewOverview(view) {
  const draw = () => {
    const list = rows();
    const st = compute(list);
    const cl = checklistOf('chat'); const cc = checklistOf('call');
    const m = S.metrics;
    const mockRows = list.filter((r) => r.source === 'DEV' && r.E.src !== 'ai'); const mockN = mockRows.length;
    const mockKinds = [...new Set(mockRows.map((r) => r.E.kind))];
    setHead('Обзор', `${st.n} ${plural(st.n, ['диалог', 'диалога', 'диалогов'])} · чек-листы: чаты v${cl.version}, звонки v${cc.version} · ${mockN ? `AI ${st.n_dev - mockN} из ${st.n_dev}` : `оценка AI, ${modelLabel(S.pre?.model || S.api.model)}`}`);
    const agreeN = m ? Math.round((m.overall.n * m.overall.strict) / 100) : 0;
    // the metrics file may be older than the evaluations on screen: say which prompt it measured
    const metricsVer = m?.meta?.prompt_version || null;
    const fixFirst = [...st.reasonGroups.filter((g) => g.gross).slice(0, 1), ...st.reasonGroups.filter((g) => !g.gross)].slice(0, 3);

    view.innerHTML = `
      ${mockN && aiReady() ? `<div class="banner banner--info">${icon('alert')}<div><b>${mockN} ${plural(mockN, ['диалог оценён', 'диалога оценены', 'диалогов оценены'])} без AI после изменения чек-листа.</b> Цифры ниже предварительные.</div><button class="btn btn--s btn--primary" type="button" id="ov-ai">Оценить AI</button></div>` : ''}
      <section class="kpis" aria-label="Ключевые показатели">
        ${kpi({ label: 'Средний балл', value: fix(st.avg, 1), unit: '/100', sub: `медиана ${fix(st.median, 1)}`, href: '#/dialogs?sort=low', meter: { p: st.avg || 0, color: tierVar(tier(st.avg)) } })}
        ${kpi({ label: 'Проверено диалогов', value: st.n, sub: `${st.chats} ${plural(st.chats, ['чат', 'чата', 'чатов'])} · ${st.calls} ${plural(st.calls, ['звонок', 'звонка', 'звонков'])}`, href: '#/dialogs' })}
        ${kpi({ label: 'Грубые ошибки', value: st.gross, sub: `${st.n ? Math.round((st.gross / st.n) * 100) : 0}% диалогов · показать с причинами`, href: '#/dialogs?gross=1', mod: st.gross ? 'kpi--bad' : '' })}
        ${kpi({ label: 'Согласие с проверяющими', value: m ? Math.round(m.overall.strict) : '—', unit: m ? '%' : '', sub: m ? `${agreeN} из ${m.overall.n} ответов AI совпали с ручной разметкой (${m.gold_dialogs} диалогов)${metricsVer && metricsVer !== S.pre?.prompt_version ? `, замер промпта ${esc(metricsVer)}` : ''}` : 'нет файла метрик' })}
      </section>

      <div class="grid grid--2">
        <section class="card chart-card" aria-labelledby="ch-loss">
          <header class="card__head"><h2 id="ch-loss">Где теряем баллы</h2></header>
          <p class="caption">Сколько баллов в среднем теряет один диалог по каждому критерию. Начните разбор с верхней строки, нажмите на неё, чтобы открыть диалоги.</p>
          <div class="chart-box" id="ch-loss-box"></div>
        </section>
        <section class="card chart-card" aria-labelledby="ch-dist">
          <header class="card__head"><h2 id="ch-dist">Как распределены оценки</h2></header>
          <p class="caption">Число диалогов по диапазонам итогового балла. Красная часть столбца — диалоги, которые нужно разобрать первыми.</p>
          <div class="chart-box" id="ch-dist-box"></div>
          <div class="legend"><span><i style="background:var(--bad)"></i>ниже 60</span><span><i style="background:var(--mid)"></i>60–84</span><span><i style="background:var(--good)"></i>85 и выше</span></div>
        </section>
      </div>

      <div class="grid grid--3-2">
        <section class="card" aria-labelledby="fix-first">
          <header class="card__head"><h2 id="fix-first">Что исправить первым</h2></header>
          <p class="caption">Причины, которые обходятся дороже всего. Откройте пример, чтобы увидеть реплику оператора.</p>
          ${fixFirst.length ? `<ol class="fix-list">${fixFirst.map((g, i) => {
            const it = g.items[0]; const ex = it.rows[0];
            const filter = g.gross ? '#/dialogs?gross=1' : `#/dialogs?crit=${encodeURIComponent(g.c.id)}`;
            return `<li class="fix ${g.gross ? 'fix--gross' : ''}">
              <span class="fix__n num">${i + 1}</span>
              <div class="fix__body">
                <div class="fix__head"><b>${esc(g.c.title)}</b><span class="fix__meta">${g.dialogs} ${plural(g.dialogs, ['диалог', 'диалога', 'диалогов'])}${g.gross ? ' · грубая ошибка' : ` · −${fix(g.lost / Math.max(1, st.n), 1)} в среднем`}</span></div>
                <p class="fix__why">${esc(it.text)}${it.count > 1 ? ` <span class="muted">(${it.count} раза)</span>` : ''}</p>
                <div class="fix__links"><a class="link" href="${filter}">Все ${g.dialogs} ${icon('arrow')}</a><a class="link link--mono" href="#/dialog/${encodeURIComponent(ex.id)}">Пример: ${esc(ex.id)}</a></div>
              </div></li>`; }).join('')}</ol>` : '<p class="muted">Снижений нет.</p>'}
        </section>
        <section class="card chart-card" aria-labelledby="ch-seg">
          <header class="card__head"><h2 id="ch-seg">Языки и каналы</h2></header>
          <p class="caption">Средний балл по языку и каналу. Заметный разрыв — повод проверить скрипты для этой группы.</p>
          <div class="chart-box" id="ch-seg-box"></div>
        </section>
      </div>`;

    mountChart($('#ch-loss-box', view), (w) => hbarsSVG(w, st.loss.map((l) => ({
      label: l.c.title, sub: `в ${l.dialogs} ${plural(l.dialogs, ['диалоге', 'диалогах', 'диалогах'])}`, value: l.avg_lost, valueText: l.avg_lost < 0.05 ? '0' : `−${fix(l.avg_lost, 1)}`, color: 'var(--bad)', href: `#/dialogs?crit=${encodeURIComponent(l.c.id)}`,
    })), { title: 'Средняя потеря баллов на диалог по критериям', desc: st.loss.map((l) => `${l.c.title}: −${fix(l.avg_lost, 1)}`).join('; ') }));
    mountChart($('#ch-dist-box', view), (w) => histogramSVG(w, st.bins, {
      title: 'Распределение итоговых баллов', desc: st.bins.map((b) => `${b.from}–${b.to}: ${b.n}`).join('; '), hrefFor: (b) => `#/dialogs?range=${b.from}-${b.to}`,
    }));
    const segRows = [{ group: 'Язык' }, ...['RU', 'KZ', 'EN'].filter((k) => st.byLang[k]).map((k) => ({ label: LANG[k], sub: `${st.byLang[k].n} диал.`, value: st.byLang[k].avg, valueText: fix(st.byLang[k].avg, 1), color: tierVar(tier(st.byLang[k].avg)), href: `#/dialogs?lang=${k}` })),
      { group: 'Канал' }, ...['chat', 'call'].filter((k) => st.byChannel[k]).map((k) => ({ label: CHAN[k], sub: `${st.byChannel[k].n} диал.`, value: st.byChannel[k].avg, valueText: fix(st.byChannel[k].avg, 1), color: tierVar(tier(st.byChannel[k].avg)), href: `#/dialogs?channel=${k}` }))];
    mountChart($('#ch-seg-box', view), (w) => hbarsSVG(w, segRows, { title: 'Средний балл по языку и каналу', desc: segRows.filter((r) => !r.group).map((r) => `${r.label}: ${r.valueText}`).join('; '), max: 100 }));

    $('#ov-ai', view)?.addEventListener('click', async () => {
      let done = 0, total = 0, failed = 0;
      for (const k of mockKinds) { const res = await reevaluateAll('ai', `AI-оценка: ${k === 'call' ? `звонки v${cc.version}` : `чаты v${cl.version}`}`, k); if (res) { done += res.done; total += res.total; failed += res.failed; } }
      if (total) toast(`AI оценил ${done - failed} из ${total} диалогов${failed ? `, ошибок ${failed}` : ''}`, failed ? 'warn' : 'ok');
    });
  };
  draw();
  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(draw, 300); });
  return () => { off(); clearTimeout(t); };
}
