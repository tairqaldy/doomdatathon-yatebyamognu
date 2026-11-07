// /broker: mock Freedom Broker client app (demo data only) that the AIM navigation agent drives (issue #14).
// The app declares its own action catalog (screens + named targets) so the agent can act reliably:
//   [data-target="<id>"] elements are what open_screen / highlight / prefill refer to.
// Protected targets (money, trades, requests) are never pressed by the agent; the client presses them.
const LANG_KEY = 'cqa-broker-lang';

const T = {
  RU: {
    demo: 'демо', nav: 'Разделы',
    s_portfolio: 'Портфель', s_quotes: 'Котировки', s_deposit: 'Пополнение', s_withdraw: 'Вывод', s_tariffs: 'Тарифы', s_documents: 'Отчёты и документы', s_profile: 'Профиль',
    sum_portfolio: 'Баланс, счета (торговый и D-счёт), позиции.', sum_quotes: 'Поиск акций и облигаций по названию или тикеру, заявка на покупку, опция «Использовать маржу».',
    sum_deposit: 'Пополнение брокерского счёта картой, Kaspi или переводом по реквизитам из банка.', sum_withdraw: 'Вывод денег на банковский счёт.',
    sum_tariffs: 'Текущий тариф и сравнение тарифов.', sum_documents: 'Отчёт брокера за период, налоговый отчёт, форма 1042-S.', sum_profile: 'Анкетные данные, их изменение, язык.',
    total: 'Стоимость портфеля', today: 'за сегодня', accounts: 'Счета', acc_trade: 'Торговый счёт', acc_trade_note: 'С него покупают акции и облигации.',
    acc_d: 'D-счёт', acc_d_note: 'Для накоплений. Купить бумаги напрямую с него нельзя: сначала переведите деньги на торговый счёт.',
    positions: 'Позиции', ticker: 'Бумага', qty: 'Кол-во', price: 'Цена', value: 'Стоимость', btn_deposit: 'Пополнить', btn_withdraw: 'Вывести',
    search: 'Название или тикер', market: 'Рынок', m_all: 'Все рынки', m_kase: 'KASE', m_us: 'США', kind: 'Тип', k_all: 'Все', k_stock: 'Акции', k_bond: 'Облигации',
    results: 'Результаты', choose: 'Выбрать', order: 'Заявка на покупку', order_pick: 'Выберите бумагу в результатах поиска.', order_qty: 'Количество', margin: 'Использовать маржу',
    margin_note: 'Если галочка стоит, покупка может идти за счёт заёмных средств.', btn_buy: 'Купить',
    method: 'Способ', m_card: 'Банковская карта', m_kaspi: 'Kaspi', m_req: 'Перевод по реквизитам', currency: 'Валюта', amount: 'Сумма',
    requisites: 'Реквизиты для перевода из банка', req_purpose: 'Назначение: пополнение брокерского счёта по договору № ДЕМО-0001',
    fee_note: 'Комиссия Freedom за пополнение: 0 ₸. Комиссию за перевод может взять ваш банк, уточните её в банке.', btn_dep_submit: 'Пополнить счёт',
    wd_to: 'На счёт', wd_status: 'Вывод доступен.', wd_note: 'Если приложение просит обновить анкету перед выводом: Профиль → «Изменить анкетные данные».', btn_wd_submit: 'Вывести деньги',
    your_tariff: 'Ваш тариф', tf_compare: 'Сравнение тарифов (демо-значения)', tf_name: 'Тариф', tf_kase: 'Комиссия KASE', tf_us: 'Комиссия США', tf_fee: 'Абонплата',
    doc_type: 'Документ', d_broker: 'Отчёт брокера', d_tax: 'Налоговый отчёт', d_1042: 'Форма 1042-S', d_from: 'С', d_to: 'По', btn_download: 'Сформировать',
    d_1042_note: 'Форма 1042-S предоставляется только на английском языке.', d_tariff_note: 'Название тарифа указано на первой странице отчёта брокера, под ФИО.',
    pr_data: 'Анкетные данные', pr_name: 'Клиент', pr_phone: 'Телефон', pr_status: 'Статус анкеты', pr_ok: 'актуальна', btn_pr_update: 'Изменить анкетные данные',
    pr_lang: 'Язык приложения', pr_security: 'Безопасность', pr_security_note: 'Пароль и коды из SMS никому не сообщайте, в том числе сотрудникам Freedom.',
    demo_action: 'Демо: операция не выполняется. В настоящем приложении здесь была бы проверка и подтверждение.', doc_ready: 'Отчёт сформирован (демо).', picked: 'Выбрано',
  },
  KZ: {
    demo: 'демо', nav: 'Бөлімдер',
    s_portfolio: 'Портфель', s_quotes: 'Котировкалар', s_deposit: 'Толықтыру', s_withdraw: 'Шығару', s_tariffs: 'Тарифтер', s_documents: 'Есептер мен құжаттар', s_profile: 'Профиль',
    sum_portfolio: 'Баланс, шоттар (сауда және D-шот), позициялар.', sum_quotes: 'Акциялар мен облигацияларды атауы не тикері бойынша іздеу, сатып алу өтінімі, «Использовать маржу».',
    sum_deposit: 'Брокерлік шотты картамен, Kaspi арқылы немесе деректемелер бойынша толықтыру.', sum_withdraw: 'Ақшаны банк шотына шығару.',
    sum_tariffs: 'Ағымдағы тариф және салыстыру.', sum_documents: 'Кезеңге брокер есебі, салық есебі, 1042-S нысаны.', sum_profile: 'Сауалнама деректері, оларды өзгерту, тіл.',
    total: 'Портфель құны', today: 'бүгін', accounts: 'Шоттар', acc_trade: 'Сауда шоты', acc_trade_note: 'Акциялар мен облигациялар осы шоттан сатып алынады.',
    acc_d: 'D-шот', acc_d_note: 'Жинақтауға арналған. Одан тікелей қағаз сатып алуға болмайды: алдымен ақшаны сауда шотына аударыңыз.',
    positions: 'Позициялар', ticker: 'Қағаз', qty: 'Саны', price: 'Бағасы', value: 'Құны', btn_deposit: 'Толықтыру', btn_withdraw: 'Шығару',
    search: 'Атауы немесе тикері', market: 'Нарық', m_all: 'Барлық нарық', m_kase: 'KASE', m_us: 'АҚШ', kind: 'Түрі', k_all: 'Барлығы', k_stock: 'Акциялар', k_bond: 'Облигациялар',
    results: 'Нәтижелер', choose: 'Таңдау', order: 'Сатып алу өтінімі', order_pick: 'Іздеу нәтижесінен қағазды таңдаңыз.', order_qty: 'Саны', margin: 'Использовать маржу',
    margin_note: 'Белгі тұрса, сатып алу қарыз қаражат есебінен болуы мүмкін.', btn_buy: 'Сатып алу',
    method: 'Тәсіл', m_card: 'Банк картасы', m_kaspi: 'Kaspi', m_req: 'Деректемелер бойынша аударым', currency: 'Валюта', amount: 'Сома',
    requisites: 'Банктен аударуға арналған деректемелер', req_purpose: 'Мақсаты: № ДЕМО-0001 шарт бойынша брокерлік шотты толықтыру',
    fee_note: 'Толықтыру үшін Freedom комиссиясы: 0 ₸. Аударым комиссиясын банкіңіз алуы мүмкін, банктен нақтылаңыз.', btn_dep_submit: 'Шотты толықтыру',
    wd_to: 'Шотқа', wd_status: 'Шығару қолжетімді.', wd_note: 'Шығару алдында сауалнаманы жаңарту сұралса: Профиль → «Изменить анкетные данные».', btn_wd_submit: 'Ақшаны шығару',
    your_tariff: 'Сіздің тарифіңіз', tf_compare: 'Тарифтерді салыстыру (демо мәндер)', tf_name: 'Тариф', tf_kase: 'KASE комиссиясы', tf_us: 'АҚШ комиссиясы', tf_fee: 'Абоненттік төлем',
    doc_type: 'Құжат', d_broker: 'Брокер есебі', d_tax: 'Салық есебі', d_1042: '1042-S нысаны', d_from: 'Бастап', d_to: 'Дейін', btn_download: 'Қалыптастыру',
    d_1042_note: '1042-S нысаны тек ағылшын тілінде беріледі.', d_tariff_note: 'Тариф атауы брокер есебінің бірінші бетінде, аты-жөніңіздің астында көрсетілген.',
    pr_data: 'Сауалнама деректері', pr_name: 'Клиент', pr_phone: 'Телефон', pr_status: 'Сауалнама күйі', pr_ok: 'өзекті', btn_pr_update: 'Изменить анкетные данные',
    pr_lang: 'Қосымша тілі', pr_security: 'Қауіпсіздік', pr_security_note: 'Құпиясөзді және SMS кодтарын ешкімге, тіпті Freedom қызметкерлеріне де айтпаңыз.',
    demo_action: 'Демо: операция орындалмайды. Нақты қосымшада мұнда тексеру мен растау болар еді.', doc_ready: 'Есеп қалыптасты (демо).', picked: 'Таңдалды',
  },
  EN: {
    demo: 'demo', nav: 'Sections',
    s_portfolio: 'Portfolio', s_quotes: 'Quotes', s_deposit: 'Add funds', s_withdraw: 'Withdraw', s_tariffs: 'Pricing plans', s_documents: 'Reports & documents', s_profile: 'Profile',
    sum_portfolio: 'Balance, accounts (trading and D account), positions.', sum_quotes: 'Search stocks and bonds by name or ticker, buy order, "Use margin" option.',
    sum_deposit: 'Fund the brokerage account by card, Kaspi or bank transfer with the account details.', sum_withdraw: 'Withdraw money to a bank account.',
    sum_tariffs: 'Current plan and plan comparison.', sum_documents: 'Broker report for a period, tax report, form 1042-S.', sum_profile: 'Personal details, changing them, language.',
    total: 'Portfolio value', today: 'today', accounts: 'Accounts', acc_trade: 'Trading account', acc_trade_note: 'Stocks and bonds are bought from this account.',
    acc_d: 'D account', acc_d_note: 'For savings. You cannot buy securities directly from it: move the money to the trading account first.',
    positions: 'Positions', ticker: 'Security', qty: 'Qty', price: 'Price', value: 'Value', btn_deposit: 'Add funds', btn_withdraw: 'Withdraw',
    search: 'Name or ticker', market: 'Market', m_all: 'All markets', m_kase: 'KASE', m_us: 'US', kind: 'Type', k_all: 'All', k_stock: 'Stocks', k_bond: 'Bonds',
    results: 'Results', choose: 'Select', order: 'Buy order', order_pick: 'Pick a security from the search results.', order_qty: 'Quantity', margin: 'Use margin',
    margin_note: 'When ticked, the purchase may use borrowed funds.', btn_buy: 'Buy',
    method: 'Method', m_card: 'Bank card', m_kaspi: 'Kaspi', m_req: 'Bank transfer (account details)', currency: 'Currency', amount: 'Amount',
    requisites: 'Account details for a bank transfer', req_purpose: 'Purpose: brokerage account top-up, agreement No. DEMO-0001',
    fee_note: 'Freedom charges 0 ₸ to add funds. Your bank may charge a transfer fee; check with your bank.', btn_dep_submit: 'Add funds',
    wd_to: 'To account', wd_status: 'Withdrawals are available.', wd_note: 'If the app asks you to update your profile before withdrawing: Profile → "Change personal details".', btn_wd_submit: 'Withdraw money',
    your_tariff: 'Your plan', tf_compare: 'Plan comparison (demo values)', tf_name: 'Plan', tf_kase: 'KASE fee', tf_us: 'US fee', tf_fee: 'Monthly fee',
    doc_type: 'Document', d_broker: 'Broker report', d_tax: 'Tax report', d_1042: 'Form 1042-S', d_from: 'From', d_to: 'To', btn_download: 'Generate',
    d_1042_note: 'Form 1042-S is provided in English only.', d_tariff_note: 'The plan name is on the first page of the broker report, under your name.',
    pr_data: 'Personal details', pr_name: 'Client', pr_phone: 'Phone', pr_status: 'Profile status', pr_ok: 'up to date', btn_pr_update: 'Change personal details',
    pr_lang: 'App language', pr_security: 'Security', pr_security_note: 'Never share your password or SMS codes, including with Freedom staff.',
    demo_action: 'Demo: nothing is executed. The real app would verify and confirm here.', doc_ready: 'Report generated (demo).', picked: 'Selected',
  },
};

let lang = (() => { try { return localStorage.getItem(LANG_KEY) || 'RU'; } catch { return 'RU'; } })();
if (!T[lang]) lang = 'RU';
export const t = (k) => T[lang][k] ?? T.RU[k] ?? k;
export const getLang = () => lang;
const langListeners = new Set();
export const onLang = (fn) => langListeners.add(fn);

// ---- demo data ----
const SECURITIES = [
  { ticker: 'KSPI', name: 'Kaspi.kz', market: 'kase', kind: 'stock', price: 46800, cur: '₸' },
  { ticker: 'HSBK', name: 'Halyk Bank', market: 'kase', kind: 'stock', price: 248, cur: '₸' },
  { ticker: 'KZTO', name: 'KazTransOil', market: 'kase', kind: 'stock', price: 905, cur: '₸' },
  { ticker: 'MUM120_0001', name: 'МЕУКАМ-120 (гос. облигация)', market: 'kase', kind: 'bond', price: 98.4, cur: '%' },
  { ticker: 'KZW1KD079', name: 'Казахстан, облигация 2029', market: 'kase', kind: 'bond', price: 101.2, cur: '%' },
  { ticker: 'AAPL', name: 'Apple Inc.', market: 'us', kind: 'stock', price: 231.5, cur: '$' },
  { ticker: 'TSLA', name: 'Tesla Inc.', market: 'us', kind: 'stock', price: 248.9, cur: '$' },
  { ticker: 'US10Y', name: 'US Treasury 10Y', market: 'us', kind: 'bond', price: 97.8, cur: '%' },
];
const POSITIONS = [{ ticker: 'KSPI', qty: 12 }, { ticker: 'AAPL', qty: 5 }, { ticker: 'MUM120_0001', qty: 30 }];
const fmt = (n) => Number(n).toLocaleString('ru-RU', { maximumFractionDigits: 2 });

// ---- screens: each declares the targets the agent may use ----
// kind: field (can be prefilled) · button · section. protected: only the client may press it.
export const SCREENS = [
  { id: 'portfolio', title: 's_portfolio', sum: 'sum_portfolio', targets: [
    { id: 'pf-total', label: 'total', kind: 'section' }, { id: 'pf-accounts', label: 'accounts', kind: 'section' },
    { id: 'pf-d-account', label: 'acc_d', kind: 'section' }, { id: 'pf-positions', label: 'positions', kind: 'section' },
    { id: 'pf-deposit', label: 'btn_deposit', kind: 'button' }, { id: 'pf-withdraw', label: 'btn_withdraw', kind: 'button' }] },
  { id: 'quotes', title: 's_quotes', sum: 'sum_quotes', targets: [
    { id: 'q-search', label: 'search', kind: 'field' }, { id: 'q-market', label: 'market', kind: 'field', options: ['m_all', 'm_kase', 'm_us'] },
    { id: 'q-kind', label: 'kind', kind: 'field', options: ['k_all', 'k_stock', 'k_bond'] }, { id: 'q-results', label: 'results', kind: 'section' },
    { id: 'q-qty', label: 'order_qty', kind: 'field' }, { id: 'q-margin', label: 'margin', kind: 'field', options: ['on', 'off'] },
    { id: 'q-buy', label: 'btn_buy', kind: 'button', protected: true }] },
  { id: 'deposit', title: 's_deposit', sum: 'sum_deposit', targets: [
    { id: 'dep-method', label: 'method', kind: 'field', options: ['m_card', 'm_kaspi', 'm_req'] }, { id: 'dep-currency', label: 'currency', kind: 'field', options: ['KZT', 'USD'] },
    { id: 'dep-amount', label: 'amount', kind: 'field' }, { id: 'dep-requisites', label: 'requisites', kind: 'section' },
    { id: 'dep-fee', label: 'fee_note', kind: 'section' }, { id: 'dep-submit', label: 'btn_dep_submit', kind: 'button', protected: true }] },
  { id: 'withdraw', title: 's_withdraw', sum: 'sum_withdraw', targets: [
    { id: 'wd-amount', label: 'amount', kind: 'field' }, { id: 'wd-currency', label: 'currency', kind: 'field', options: ['KZT', 'USD'] },
    { id: 'wd-account', label: 'wd_to', kind: 'field' }, { id: 'wd-status', label: 'wd_status', kind: 'section' },
    { id: 'wd-submit', label: 'btn_wd_submit', kind: 'button', protected: true }] },
  { id: 'tariffs', title: 's_tariffs', sum: 'sum_tariffs', targets: [
    { id: 'tf-current', label: 'your_tariff', kind: 'section' }, { id: 'tf-compare', label: 'tf_compare', kind: 'section' }] },
  { id: 'documents', title: 's_documents', sum: 'sum_documents', targets: [
    { id: 'doc-type', label: 'doc_type', kind: 'field', options: ['d_broker', 'd_tax', 'd_1042'] }, { id: 'doc-from', label: 'd_from', kind: 'field' },
    { id: 'doc-to', label: 'd_to', kind: 'field' }, { id: 'doc-generate', label: 'btn_download', kind: 'button' },
    { id: 'doc-notes', label: 'd_1042', kind: 'section' }] },
  { id: 'profile', title: 's_profile', sum: 'sum_profile', targets: [
    { id: 'pr-data', label: 'pr_data', kind: 'section' }, { id: 'pr-update', label: 'btn_pr_update', kind: 'button', protected: true },
    { id: 'pr-lang', label: 'pr_lang', kind: 'field', options: ['RU', 'KZ', 'EN'] }, { id: 'pr-security', label: 'pr_security', kind: 'section' }] },
];
const byId = new Map(SCREENS.map((s) => [s.id, s]));
const optLabel = (o) => (T.RU[o] ? t(o) : o);

/** Catalog in the current language, as sent to /api/agent. */
export function catalog() {
  return SCREENS.map((s) => ({ id: s.id, title: t(s.title), summary: t(s.sum),
    targets: s.targets.map((x) => ({ id: x.id, label: t(x.label), kind: x.kind, ...(x.protected ? { protected: true } : {}), ...(x.options ? { options: x.options.map(optLabel) } : {}) })) }));
}

const state = { picked: null, query: '', market: 'm_all', kind: 'k_all' };

const sel = (id, opts, cur) => `<select id="${id}" data-target="${id}">${opts.map((o) => `<option value="${o}"${o === cur ? ' selected' : ''}>${optLabel(o)}</option>`).join('')}</select>`;
const field = (id, labelKey, control) => `<label class="br-field" for="${id}"><span>${t(labelKey)}</span>${control}</label>`;
const btn = (id, key, cls = '', extra = '') => `<button type="button" class="br-btn ${cls}" id="${id}" data-target="${id}"${extra}>${t(key)}</button>`;

const VIEWS = {
  portfolio: () => {
    const rows = POSITIONS.map((p) => { const s = SECURITIES.find((x) => x.ticker === p.ticker); const v = s.cur === '%' ? p.qty * 1000 * s.price / 100 * 1 : p.qty * s.price * (s.cur === '$' ? 470 : 1);
      return `<tr><td><b>${s.ticker}</b><small>${s.name}</small></td><td>${p.qty}</td><td>${fmt(s.price)} ${s.cur}</td><td>${fmt(v)} ₸</td></tr>`; }).join('');
    return `<section class="br-card br-hero" data-target="pf-total"><p class="br-muted">${t('total')}</p><p class="br-big">1 250 430 ₸</p><p class="br-up">+2,4 % ${t('today')}</p>
        <div class="br-row">${btn('pf-deposit', 'btn_deposit', 'br-primary', ' data-go="deposit"')}${btn('pf-withdraw', 'btn_withdraw', '', ' data-go="withdraw"')}</div></section>
      <section class="br-card" data-target="pf-accounts"><h2>${t('accounts')}</h2>
        <div class="br-acc"><div><b>${t('acc_trade')}</b><p class="br-muted">${t('acc_trade_note')}</p></div><span>1 102 930 ₸</span></div>
        <div class="br-acc" data-target="pf-d-account"><div><b>${t('acc_d')}</b><p class="br-muted">${t('acc_d_note')}</p></div><span>147 500 ₸</span></div></section>
      <section class="br-card" data-target="pf-positions"><h2>${t('positions')}</h2><table class="br-table"><thead><tr><th>${t('ticker')}</th><th>${t('qty')}</th><th>${t('price')}</th><th>${t('value')}</th></tr></thead><tbody>${rows}</tbody></table></section>`;
  },
  quotes: () => {
    const q = state.query.trim().toLowerCase();
    const list = SECURITIES.filter((s) => (!q || s.ticker.toLowerCase().includes(q) || s.name.toLowerCase().includes(q))
      && (state.market === 'm_all' || s.market === state.market.slice(2)) && (state.kind === 'k_all' || s.kind === state.kind.slice(2)));
    const res = list.map((s) => `<li><div><b>${s.ticker}</b><small>${s.name} · ${s.market.toUpperCase()}</small></div><span>${fmt(s.price)} ${s.cur}</span><button type="button" class="br-btn br-sm" data-pick="${s.ticker}">${t('choose')}</button></li>`).join('') || '<li class="br-muted">—</li>';
    const p = state.picked && SECURITIES.find((s) => s.ticker === state.picked);
    return `<section class="br-card"><div class="br-grid3">
        ${field('q-search', 'search', `<input id="q-search" data-target="q-search" type="search" autocomplete="off" value="${state.query.replace(/"/g, '&quot;')}">`)}
        ${field('q-market', 'market', sel('q-market', ['m_all', 'm_kase', 'm_us'], state.market))}
        ${field('q-kind', 'kind', sel('q-kind', ['k_all', 'k_stock', 'k_bond'], state.kind))}</div></section>
      <section class="br-card" data-target="q-results"><h2>${t('results')}</h2><ul class="br-list">${res}</ul></section>
      <section class="br-card"><h2>${t('order')}</h2>${p ? `<p><b>${t('picked')}:</b> ${p.ticker} · ${p.name}</p>` : `<p class="br-muted">${t('order_pick')}</p>`}
        <div class="br-grid2">${field('q-qty', 'order_qty', '<input id="q-qty" data-target="q-qty" type="number" min="1" inputmode="numeric">')}
        <label class="br-check" for="q-margin"><input type="checkbox" id="q-margin" data-target="q-margin" checked><span>${t('margin')}</span></label></div>
        <p class="br-muted">${t('margin_note')}</p>${btn('q-buy', 'btn_buy', 'br-primary', ' data-protected="true"')}</section>`;
  },
  deposit: () => `<section class="br-card"><div class="br-grid3">
        ${field('dep-method', 'method', sel('dep-method', ['m_card', 'm_kaspi', 'm_req'], 'm_card'))}
        ${field('dep-currency', 'currency', sel('dep-currency', ['KZT', 'USD'], 'KZT'))}
        ${field('dep-amount', 'amount', '<input id="dep-amount" data-target="dep-amount" type="number" min="1" inputmode="decimal">')}</div>
        <p class="br-note" data-target="dep-fee">${t('fee_note')}</p>${btn('dep-submit', 'btn_dep_submit', 'br-primary', ' data-protected="true"')}</section>
      <section class="br-card" data-target="dep-requisites"><h2>${t('requisites')}</h2>
        <dl class="br-dl"><dt>Получатель</dt><dd>АО «Freedom Broker» (демо)</dd><dt>БИН</dt><dd>000000000000</dd><dt>IBAN</dt><dd>KZ00 0000 0000 0000 DEMO</dd><dt>Банк</dt><dd>АО «Банк Демо», BIC DEMOKZKA</dd></dl>
        <p class="br-muted">${t('req_purpose')}</p></section>`,
  withdraw: () => `<section class="br-card"><p class="br-ok" data-target="wd-status">${t('wd_status')}</p><p class="br-muted">${t('wd_note')}</p><div class="br-grid3">
        ${field('wd-amount', 'amount', '<input id="wd-amount" data-target="wd-amount" type="number" min="1" inputmode="decimal">')}
        ${field('wd-currency', 'currency', sel('wd-currency', ['KZT', 'USD'], 'KZT'))}
        ${field('wd-account', 'wd_to', '<select id="wd-account" data-target="wd-account"><option>KZ** **** **** 1234 · Halyk (демо)</option></select>')}</div>
        ${btn('wd-submit', 'btn_wd_submit', 'br-primary', ' data-protected="true"')}</section>`,
  tariffs: () => `<section class="br-card br-hero" data-target="tf-current"><p class="br-muted">${t('your_tariff')}</p><p class="br-big">«Инвестор»</p></section>
      <section class="br-card" data-target="tf-compare"><h2>${t('tf_compare')}</h2><table class="br-table"><thead><tr><th>${t('tf_name')}</th><th>${t('tf_kase')}</th><th>${t('tf_us')}</th><th>${t('tf_fee')}</th></tr></thead>
        <tbody><tr><td>Инвестор</td><td>0,1 %</td><td>$1,2 + 0,1 %</td><td>0 ₸</td></tr><tr><td>Трейдер</td><td>0,05 %</td><td>$0,8 + 0,05 %</td><td>5 000 ₸</td></tr><tr><td>Free</td><td>0,15 %</td><td>$2 + 0,15 %</td><td>0 ₸</td></tr></tbody></table></section>`,
  documents: () => `<section class="br-card"><div class="br-grid3">
        ${field('doc-type', 'doc_type', sel('doc-type', ['d_broker', 'd_tax', 'd_1042'], 'd_broker'))}
        ${field('doc-from', 'd_from', '<input id="doc-from" data-target="doc-from" type="date">')}
        ${field('doc-to', 'd_to', '<input id="doc-to" data-target="doc-to" type="date">')}</div>${btn('doc-generate', 'btn_download', 'br-primary', ' data-toast="doc_ready"')}</section>
      <section class="br-card" data-target="doc-notes"><p class="br-note">${t('d_1042_note')}</p><p class="br-note">${t('d_tariff_note')}</p></section>`,
  profile: () => `<section class="br-card" data-target="pr-data"><h2>${t('pr_data')}</h2><dl class="br-dl"><dt>${t('pr_name')}</dt><dd>А***** К*****</dd><dt>${t('pr_phone')}</dt><dd>+7 7** *** ** 45</dd><dt>${t('pr_status')}</dt><dd class="br-ok">${t('pr_ok')}</dd></dl>
        ${btn('pr-update', 'btn_pr_update', '', ' data-protected="true"')}</section>
      <section class="br-card">${field('pr-lang', 'pr_lang', sel('pr-lang', ['RU', 'KZ', 'EN'], lang))}</section>
      <section class="br-card" data-target="pr-security"><h2>${t('pr_security')}</h2><p class="br-muted">${t('pr_security_note')}</p></section>`,
};

const main = () => document.getElementById('br-main');
let current = 'portfolio';
export const currentScreen = () => current;
const screenListeners = new Set();
export const onScreen = (fn) => screenListeners.add(fn);

function renderNav() {
  document.getElementById('br-nav').innerHTML = SCREENS.map((s) =>
    `<a href="#/${s.id}" class="br-tab${s.id === current ? ' is-active' : ''}"${s.id === current ? ' aria-current="page"' : ''}>${t(s.title)}</a>`).join('');
}
function render() {
  const view = VIEWS[current] || VIEWS.portfolio;
  main().innerHTML = `<h1 class="br-h1">${t(byId.get(current).title)}</h1>${view()}`;
  renderNav();
  screenListeners.forEach((fn) => fn(current));
}

/** Navigate; resolves after the screen is rendered so the agent can act on it. */
export function go(screen) {
  if (!byId.has(screen)) return Promise.resolve(false);
  return new Promise((resolve) => {
    if (current === screen) { resolve(true); return; }
    // rAF never fires in a hidden tab, so a timer backs it up (the agent must not hang in a background tab).
    const done = () => { removeEventListener('hashchange', done); let ok = false; const fin = () => { if (!ok) { ok = true; resolve(true); } }; requestAnimationFrame(fin); setTimeout(fin, 60); };
    addEventListener('hashchange', done);
    location.hash = `#/${screen}`;
  });
}

export function findTarget(id) { return main().querySelector(`[data-target="${CSS.escape(id)}"]`); }

export function setLang(l) {
  if (!T[l] || l === lang) return;
  lang = l; try { localStorage.setItem(LANG_KEY, l); } catch {}
  document.documentElement.lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[l];
  document.querySelectorAll('.br-lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === l)));
  document.querySelector('.br-demo').textContent = t('demo');
  render(); langListeners.forEach((fn) => fn(l));
}

let toastTimer = null;
export function toast(text) {
  const el = document.getElementById('br-toast'); el.textContent = text; el.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3600);
}

function onRoute() { const id = location.hash.replace(/^#\/?/, '') || 'portfolio'; current = byId.has(id) ? id : 'portfolio'; render(); }

// UI behaviour (client clicks). Agent-filled values trigger the same events.
document.addEventListener('click', (e) => {
  const el = e.target.closest('button, a'); if (!el || !document.getElementById('br-main').contains(el)) return;
  if (el.dataset.go) { go(el.dataset.go); return; }
  if (el.dataset.pick) { state.picked = el.dataset.pick; render(); return; }
  if (el.dataset.protected === 'true') { toast(t('demo_action')); return; }
  if (el.dataset.toast) toast(t(el.dataset.toast));
});
document.addEventListener('input', (e) => { if (e.target.id === 'q-search') { state.query = e.target.value; const pos = e.target.selectionStart; render(); const s = document.getElementById('q-search'); s.focus(); try { s.setSelectionRange(pos, pos); } catch {} } });
document.addEventListener('change', (e) => {
  if (e.target.id === 'q-market') { state.market = e.target.value; render(); }
  if (e.target.id === 'q-kind') { state.kind = e.target.value; render(); }
  if (e.target.id === 'pr-lang') setLang(e.target.value);
});
document.querySelectorAll('.br-lang [data-lang]').forEach((b) => b.addEventListener('click', () => setLang(b.dataset.lang)));
addEventListener('hashchange', onRoute);
document.documentElement.lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[lang];
document.querySelectorAll('.br-lang [data-lang]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
document.querySelector('.br-demo').textContent = t('demo');
onRoute();
