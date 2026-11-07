// Обзор: KPI tiles, distribution, language/channel, loss per criterion, heat-map, deduction reasons.
import { esc, fmt, pct, plural, LANG, CHAN, histogram, hbars, heatmap, icon } from './ui.js';
import { compute, metrics, rows, hrefFor, evalMeta, modelLabel } from './data.js';
import * as live from '/shared/live-store.js';

const kpi = (label, value, sub, mod = '') => `<div class="kpi ${mod}"><div class="g-label">${esc(label)}</div><div class="kpi__value">${value}</div><div class="kpi__sub">${sub}</div></div>`;

export function viewOverview(view) {
  const draw = () => {
    const list = rows();
    const st = compute(list);
    const m = metrics();
    const src = new Map(list.map((r) => [r.id, r.source]));
    const L = st.live;
    const maxLoss = Math.max(1, ...st.loss.map((l) => l.avg_lost));
    view.innerHTML = `
      <section class="kpis" aria-label="Ключевые показатели">
        ${kpi('Средний балл', fmt(st.avg, 1), `медиана ${fmt(st.median, 1)} из 100`)}
        ${kpi('Оценено диалогов', st.n, `${st.n_dev} DEV · ${st.n_live} живых`)}
        ${kpi('Грубые ошибки', st.gross, `${pct(st.n ? st.gross / st.n : null)} диалогов`, st.gross ? 'kpi--alert' : '')}
        ${kpi('Согласие с экспертами', m ? `${fmt(m.overall.strict, 1)}<small>%</small>` : '—', m ? `${m.gold_dialogs} эталонных диалогов · MAE ${fmt(m.total.mae, 1)}` : 'нет файла метрик')}
        ${kpi('Стоимость проверки', `<small>$</small>${st.cost.toFixed(5)}`, `${esc(modelLabel(evalMeta().model))}, все вызовы`)}
        ${kpi('Живые сессии сегодня', L.today, `${L.count} всего · ${L.waiting} ждут`)}
        ${kpi('Передача оператору', L.handoff_rate == null ? '—' : `${fmt(L.handoff_rate * 100, 0)}<small>%</small>`, `${L.handoffs} из ${L.count} ${plural(L.count, ['сессии', 'сессий', 'сессий'])}`)}
        ${kpi('CSAT', L.csat_avg == null ? '—' : `${fmt(L.csat_avg, 1)}<small>/5</small>`, L.csat_n ? `${L.csat_n} ${plural(L.csat_n, ['оценка', 'оценки', 'оценок'])} клиентов` : 'оценок пока нет')}
      </section>

      <div class="grid grid--2-1">
        <section class="panel">
          <header class="panel__head"><div><div class="g-label">Распределение</div><h2 class="panel__title">Итоговые баллы</h2></div><span class="g-label">${st.n} диалогов</span></header>
          ${histogram(st.bins, { title: 'Распределение итоговых баллов', desc: st.bins.map((b) => `${b.from}–${b.to}: ${b.n}`).join('; ') })}
          <div class="legend"><span><i style="background:var(--g-error)"></i>ниже 60</span><span><i style="background:var(--g-amber)"></i>60–79</span><span><i style="background:var(--g-mint)"></i>80 и выше</span></div>
        </section>
        <section class="panel">
          <header class="panel__head"><div><div class="g-label">Срезы</div><h2 class="panel__title">Средний балл</h2></div></header>
          <div class="g-label sub-label">По языку</div>
          ${hbars(['RU', 'KZ', 'EN'].filter((k) => st.byLang[k]).map((k) => ({ label: LANG[k], sub: `${st.byLang[k].n} диал.`, value: st.byLang[k].avg })), { title: 'Средний балл по языку' })}
          <div class="g-label sub-label">По каналу</div>
          ${hbars(['chat', 'call'].filter((k) => st.byChannel[k]).map((k) => ({ label: CHAN[k], sub: `${st.byChannel[k].n} диал.`, value: st.byChannel[k].avg })), { title: 'Средний балл по каналу' })}
        </section>
      </div>

      <div class="grid grid--2">
        <section class="panel">
          <header class="panel__head"><div><div class="g-label">Потери</div><h2 class="panel__title">Где теряются баллы</h2></div><span class="g-label">баллов на диалог</span></header>
          ${hbars(st.loss.map((l) => ({ label: l.title, sub: `вес ${l.weight} · N/A ${pct(l.na_rate)}`, value: l.avg_lost, color: 'var(--g-error)' })).sort((a, b) => b.value - a.value), { title: 'Средняя потеря баллов на диалог по критериям', max: maxLoss * 1.1, fmtv: (v) => `−${fmt(v, 1)}` })}
          <p class="note">Потеря = эффективный вес критерия минус набранные баллы, после перераспределения N/A. Среднее по всем ${st.n} диалогам.</p>
        </section>
        <section class="panel">
          <header class="panel__head"><div><div class="g-label">Карта</div><h2 class="panel__title">Критерий × язык</h2></div><span class="g-label">% от максимума</span></header>
          ${heatmap(st.heat.map((h) => ({ label: h.title, cells: h.cells.map((c) => ({ value: c.pct, n: c.n })) })), ['RU', 'KZ', 'EN'], { title: 'Доля набранных баллов по критериям и языкам', desc: 'Чем краснее ячейка, тем больше баллов теряется. Учитываются только применимые оценки.' })}
        </section>
      </div>

      <section class="panel">
        <header class="panel__head"><div><div class="g-label">Причины</div><h2 class="panel__title">За что снижают оценку</h2></div><span class="g-label">нажмите, чтобы открыть диалог</span></header>
        <div class="reasons">
          ${st.reasonGroups.map((g) => `
            <article class="reason-group ${g.gross ? 'reason-group--gross' : ''}">
              <header><span class="g-label">${esc(g.id)}</span><h3>${esc(g.title)}</h3><span class="reason-group__meta">${g.dialogs} диал.${g.gross ? '' : ` · −${fmt(g.lost / Math.max(1, st.n), 1)} на диалог`}</span></header>
              <ul>${g.items.slice(0, 4).map((it) => `<li><a href="${hrefFor(it.ids[0], src.get(it.ids[0]))}"><span>${esc(it.text)}</span><span class="g-label">${it.count > 1 ? `×${it.count} · ` : ''}${esc(it.ids[0])}</span></a></li>`).join('')}</ul>
              ${g.items.length > 4 ? `<a class="more" href="#/dialogs">Ещё ${g.items.length - 4} ${icon('arrow')}</a>` : ''}
            </article>`).join('')}
        </div>
      </section>`;
  };
  draw();
  let t = null;
  const off = live.subscribe(() => { clearTimeout(t); t = setTimeout(draw, 250); });
  return () => { off(); clearTimeout(t); };
}
