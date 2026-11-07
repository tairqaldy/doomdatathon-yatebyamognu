// /phone: a copy of the official Freedom Broker iOS app (v32.23.17, docs/research/freedom-app.md) with AIM inside (#21).
// Mock data only. The app declares an action catalog (screens + named targets) for the AIM navigation agent:
//   [data-target="<id>"] elements are what open_screen / highlight / prefill refer to.
// Protected targets (money, trades, requests) are never pressed by AIM; the client presses them.
// AIM itself is broker/agent.js, mounted inside the phone screen through window.AIM_HOST (no widget code here).

// ---------------- i18n (app chrome; mock news content stays Russian) ----------------
const T = {
  RU: {
    t_quotes: 'Котировки', t_portfolio: 'Портфель', t_crypto: 'Крипто', t_ideas: 'Идеи', t_accounts: 'Счета', t_menu: 'Меню',
    search: 'Поиск по тикеру', chat: 'Чат с поддержкой', all_news: 'Все новости', indices: 'Индексы', my_lists: 'Мои списки', fav: 'Избранное', new_list: 'Новый список',
    list_empty: 'Ваш список пуст.\nДобавьте в него несколько компаний', add: 'Добавить', rise: 'Вырастет', fall: 'Упадет', nothing: 'Ничего не найдено',
    seg_portfolio: 'Портфель', seg_orders: 'Приказы', seg_trades: 'Сделки', net_assets: 'Оценка чистых активов', today: 'За сегодня',
    q_deposit: 'Пополнить', q_exchange: 'Обменять', q_more: 'Еще', promo_title: 'Долгосрочные размещения', promo_sub: 'Разместить средства под 6.3% годовых',
    cash: 'Денежные средства', positions: 'Позиции', orders_7d: 'Предыдущие 7 дней', orders_empty: 'Ничего не найдено по выбранным фильтрам. Пожалуйста, попробуйте другие фильтры',
    from_month: 'С начала месяца', from_year: 'С начала года', trades_empty: 'Нет информации о сделках по указанным параметрам', change_settings: 'Сменить настройки',
    crypto_title: 'Открыть криптовалютный счет в Freedom Broker', crypto_sub: 'Открытие и обслуживание счета бесплатно',
    c1: '100+ инструментов', c1s: 'BTC, ETH, USDC и все топовые активы', c2: 'Торги 24/7', c2s: 'Рынок доступен в любое время', c3: 'Вывод на свой кошелек', c3s: 'Пополняйте и выводите без ограничений', open_acc: 'Открыть счет',
    ideas_inv: 'Инвестидеи', ideas_reviews: 'Обзоры рынка', ideas_sets: 'Подборки', ideas_title: 'Инвестиционные идеи', ideas_count: 'Идей рекомендовано: 4005', months12: '12 месяцев',
    acc_title: 'Счета', total_assets: 'Общие активы', seg_inv: 'Инвестиции', seg_bank: 'Банк', seg_crypto: 'Крипто', current: 'Текущий', savings: 'Накопительный счет - 3.94% USD, 2.41% EUR, 16.55% KZT',
    d_note: 'D-счёт для накоплений: купить бумаги напрямую с него нельзя, сначала переведите деньги на торговый счёт.',
    my_card: 'Моя визитка', account: 'Счет', withdraw: 'Вывести', m_support: 'Поддержка', m_orders: 'Поручения', m_invite: 'Пригласить друга', m_docs: 'Отчеты и документы', m_bonus: 'Бонусы', m_settings: 'Настройки',
    sh_support: 'Поддержка', sh_aim: 'AIM · ответ сразу', sh_aim_sub: 'Объяснит и откроет нужный экран', sh_write: 'Написать в поддержку', sh_faq: 'FAQ', sh_contacts: 'Контакты', sh_rate: 'Оцените приложение', new: 'новое',
    back: 'Назад', s_deposit: 'Пополнение', s_withdraw: 'Вывод средств', s_exchange: 'Обмен валюты', s_docs: 'Отчеты и документы', s_settings: 'Настройки', s_ticket: 'Поддержка', s_contacts: 'Контакты', s_faq: 'FAQ',
    method: 'Способ пополнения', m_card: 'Банковская карта', m_kaspi: 'Kaspi', m_req: 'Перевод по реквизитам', currency: 'Валюта', amount: 'Сумма',
    req_title: 'Реквизиты для перевода из банка', req_text: 'Получатель: АО «Freedom Finance» (демо)\nIBAN: KZ00 0000 0000 0000 DEMO\nНазначение: пополнение брокерского счёта по договору № DEMO001',
    fee: 'Комиссия Freedom за пополнение: 0 ₸. Комиссию за перевод может взять ваш банк.', dep_submit: 'Пополнить счёт',
    wd_to: 'На счёт', wd_avail: 'Доступно к выводу: $1 204.50 · 152 000 ₸', wd_note: 'Если приложение просит обновить анкету перед выводом: Меню → Настройки → «Анкетные данные».', wd_submit: 'Вывести деньги',
    ex_from: 'Продать', ex_to: 'Купить', ex_rate: 'Курс (демо): 1 USD = 512.40 ₸', ex_submit: 'Обменять',
    doc_type: 'Документ', d_broker: 'Отчет брокера', d_tax: 'Налоговый отчет', d_1042: 'Форма 1042-S', d_from: 'С', d_to: 'По', d_make: 'Сформировать',
    d_1042_note: 'Форма 1042-S предоставляется только на английском языке.', d_tariff_note: 'Название тарифа указано на первой странице отчёта брокера.', d_ready: 'Отчёт сформирован (демо).',
    lang: 'Язык приложения', st_profile: 'Анкетные данные', st_profile_ok: 'актуальны', st_update: 'Изменить анкетные данные', st_push: 'Push-уведомления', st_security: 'Пароль и коды из SMS никому не сообщайте, в том числе сотрудникам Freedom.',
    tk_tickets: 'Тикеты', tk_notif: 'Уведомления', tk_place: 'Опишите возникшую у Вас проблему или пожелание', tk_email: 'Отправить копию ответа на Email', tk_sms: 'Уведомить об ответе по SMS (услуга платная)',
    tk_file: 'Выберите файл', tk_send: 'Отправить', tk_yours: 'Ваши обращения', tk_active: 'Активные', tk_closed: 'Закрытые', tk_none: 'Активных обращений нет', tk_sent: 'Обращение отправлено (демо). Ответ придёт на Email.',
    ct_name: 'Название', ct_city: 'Город', ct_street: 'Улица', ct_phone: 'Номер телефона', ct_email: 'E-mail', ct_hours: 'Часы работы',
    ct_city_v: 'г. Астана', ct_street_v: 'район Есиль, улица Достык, здание 16, внп. 2 (Talan Towers)', ct_hours_v: '09:00 - 21:00 (по времени г. Астана)',
    faq_q: ['Как пополнить брокерский счёт?', 'Где найти отчёт брокера?', 'Чем D-счёт отличается от торгового?', 'Как вывести деньги?'],
    demo_action: 'Демо: операция не выполняется. В настоящем приложении здесь была бы проверка и подтверждение.', soon: 'В демо этот раздел не показан.',
    sum_quotes: 'Новости, индексы (S&P 500, KASE и др.), поиск по тикеру, «Мои списки».', sum_portfolio: 'Оценка чистых активов, Пополнить / Обменять, денежные средства, позиции; вкладки Приказы и Сделки.',
    sum_crypto: 'Открытие криптовалютного счёта.', sum_ideas: 'Инвестидеи аналитиков, обзоры рынка, подборки.', sum_accounts: 'Все счета: торговый (Текущий) и накопительный D-счёт, общие активы.',
    sum_menu: 'Профиль, Пополнить / Вывести, Поддержка, Поручения, Отчеты и документы, Бонусы, Настройки.', sum_deposit: 'Пополнение брокерского счёта: карта, Kaspi или перевод по реквизитам.',
    sum_withdraw: 'Вывод денег на банковский счёт или карту.', sum_exchange: 'Обмен валюты между USD и KZT.', sum_docs: 'Отчет брокера за период, налоговый отчет, форма 1042-S.',
    sum_settings: 'Язык приложения, анкетные данные, уведомления.', sum_ticket: 'Написать в поддержку: тикет с описанием проблемы, ответ на Email.', sum_contacts: 'Адрес, телефон и часы работы Freedom.',
  },
  KZ: {
    t_quotes: 'Котировкалар', t_portfolio: 'Портфель', t_crypto: 'Крипто', t_ideas: 'Идеялар', t_accounts: 'Шоттар', t_menu: 'Мәзір',
    search: 'Тикер бойынша іздеу', chat: 'Қолдау чаты', all_news: 'Барлық жаңалықтар', indices: 'Индекстер', my_lists: 'Менің тізімдерім', fav: 'Таңдаулы', new_list: 'Жаңа тізім',
    list_empty: 'Тізіміңіз бос.\nОған бірнеше компания қосыңыз', add: 'Қосу', rise: 'Өседі', fall: 'Түседі', nothing: 'Ештеңе табылмады',
    seg_portfolio: 'Портфель', seg_orders: 'Бұйрықтар', seg_trades: 'Мәмілелер', net_assets: 'Таза активтер бағасы', today: 'Бүгін',
    q_deposit: 'Толықтыру', q_exchange: 'Айырбастау', q_more: 'Тағы', promo_title: 'Ұзақ мерзімді орналастыру', promo_sub: 'Қаражатты жылдық 6.3%-ға орналастыру',
    cash: 'Ақша қаражаты', positions: 'Позициялар', orders_7d: 'Соңғы 7 күн', orders_empty: 'Таңдалған сүзгілер бойынша ештеңе табылмады. Басқа сүзгілерді қолданып көріңіз',
    from_month: 'Ай басынан', from_year: 'Жыл басынан', trades_empty: 'Көрсетілген параметрлер бойынша мәмілелер жоқ', change_settings: 'Баптауларды өзгерту',
    crypto_title: 'Freedom Broker-де криптовалюта шотын ашу', crypto_sub: 'Шот ашу және қызмет көрсету тегін',
    c1: '100+ құрал', c1s: 'BTC, ETH, USDC және басқа топ активтер', c2: 'Сауда 24/7', c2s: 'Нарық кез келген уақытта қолжетімді', c3: 'Өз әмиянына шығару', c3s: 'Шектеусіз толықтырыңыз және шығарыңыз', open_acc: 'Шот ашу',
    ideas_inv: 'Инвестидеялар', ideas_reviews: 'Нарық шолулары', ideas_sets: 'Топтамалар', ideas_title: 'Инвестициялық идеялар', ideas_count: 'Ұсынылған идеялар: 4005', months12: '12 ай',
    acc_title: 'Шоттар', total_assets: 'Жалпы активтер', seg_inv: 'Инвестициялар', seg_bank: 'Банк', seg_crypto: 'Крипто', current: 'Ағымдағы', savings: 'Жинақ шоты - 3.94% USD, 2.41% EUR, 16.55% KZT',
    d_note: 'D-шот жинақтауға арналған: одан тікелей қағаз сатып алуға болмайды, алдымен ақшаны сауда шотына аударыңыз.',
    my_card: 'Менің визиткам', account: 'Шот', withdraw: 'Шығару', m_support: 'Қолдау', m_orders: 'Тапсырмалар', m_invite: 'Досыңды шақыр', m_docs: 'Есептер мен құжаттар', m_bonus: 'Бонустар', m_settings: 'Баптаулар',
    sh_support: 'Қолдау', sh_aim: 'AIM · бірден жауап', sh_aim_sub: 'Түсіндіріп, керекті экранды ашады', sh_write: 'Қолдауға жазу', sh_faq: 'FAQ', sh_contacts: 'Байланыс', sh_rate: 'Қосымшаны бағалаңыз', new: 'жаңа',
    back: 'Артқа', s_deposit: 'Толықтыру', s_withdraw: 'Қаражатты шығару', s_exchange: 'Валюта айырбастау', s_docs: 'Есептер мен құжаттар', s_settings: 'Баптаулар', s_ticket: 'Қолдау', s_contacts: 'Байланыс', s_faq: 'FAQ',
    method: 'Толықтыру тәсілі', m_card: 'Банк картасы', m_kaspi: 'Kaspi', m_req: 'Деректемелер бойынша аударым', currency: 'Валюта', amount: 'Сома',
    req_title: 'Банктен аударуға арналған деректемелер', req_text: 'Алушы: «Freedom Finance» АҚ (демо)\nIBAN: KZ00 0000 0000 0000 DEMO\nМақсаты: DEMO001 шарты бойынша брокерлік шотты толықтыру',
    fee: 'Freedom толықтыру комиссиясы: 0 ₸. Аударым комиссиясын банкіңіз алуы мүмкін.', dep_submit: 'Шотты толықтыру',
    wd_to: 'Шотқа', wd_avail: 'Шығаруға қолжетімді: $1 204.50 · 152 000 ₸', wd_note: 'Шығару алдында сауалнаманы жаңарту сұралса: Мәзір → Баптаулар → «Сауалнама деректері».', wd_submit: 'Ақшаны шығару',
    ex_from: 'Сату', ex_to: 'Сатып алу', ex_rate: 'Бағам (демо): 1 USD = 512.40 ₸', ex_submit: 'Айырбастау',
    doc_type: 'Құжат', d_broker: 'Брокер есебі', d_tax: 'Салық есебі', d_1042: '1042-S нысаны', d_from: 'Бастап', d_to: 'Дейін', d_make: 'Қалыптастыру',
    d_1042_note: '1042-S нысаны тек ағылшын тілінде беріледі.', d_tariff_note: 'Тариф атауы брокер есебінің бірінші бетінде көрсетілген.', d_ready: 'Есеп қалыптастырылды (демо).',
    lang: 'Қосымша тілі', st_profile: 'Сауалнама деректері', st_profile_ok: 'өзекті', st_update: 'Сауалнама деректерін өзгерту', st_push: 'Push-хабарламалар', st_security: 'Құпиясөз бен SMS кодтарын ешкімге, соның ішінде Freedom қызметкерлеріне де айтпаңыз.',
    tk_tickets: 'Тикеттер', tk_notif: 'Хабарламалар', tk_place: 'Мәселеңізді немесе тілегіңізді сипаттаңыз', tk_email: 'Жауаптың көшірмесін Email-ге жіберу', tk_sms: 'Жауап туралы SMS арқылы хабарлау (ақылы)',
    tk_file: 'Файлды таңдаңыз', tk_send: 'Жіберу', tk_yours: 'Сіздің өтініштеріңіз', tk_active: 'Белсенді', tk_closed: 'Жабық', tk_none: 'Белсенді өтініштер жоқ', tk_sent: 'Өтініш жіберілді (демо). Жауап Email-ге келеді.',
    ct_name: 'Атауы', ct_city: 'Қала', ct_street: 'Көше', ct_phone: 'Телефон нөмірі', ct_email: 'E-mail', ct_hours: 'Жұмыс уақыты',
    ct_city_v: 'Астана қ.', ct_street_v: 'Есіл ауданы, Достық көшесі, 16-ғимарат, 2-тұрғын емес үй-жай (Talan Towers)', ct_hours_v: '09:00 - 21:00 (Астана уақытымен)',
    faq_q: ['Брокерлік шотты қалай толықтырамын?', 'Брокер есебін қайдан табамын?', 'D-шоттың сауда шотынан айырмашылығы неде?', 'Ақшаны қалай шығарамын?'],
    demo_action: 'Демо: операция орындалмайды. Нағыз қосымшада мұнда тексеру мен растау болар еді.', soon: 'Демода бұл бөлім көрсетілмеген.',
  },
  EN: {
    t_quotes: 'Quotes', t_portfolio: 'Portfolio', t_crypto: 'Crypto', t_ideas: 'Ideas', t_accounts: 'Accounts', t_menu: 'Menu',
    search: 'Search by ticker', chat: 'Support chat', all_news: 'All news', indices: 'Indices', my_lists: 'My lists', fav: 'Favourites', new_list: 'New list',
    list_empty: 'Your list is empty.\nAdd a few companies to it', add: 'Add', rise: 'Will rise', fall: 'Will fall', nothing: 'Nothing found',
    seg_portfolio: 'Portfolio', seg_orders: 'Orders', seg_trades: 'Trades', net_assets: 'Net asset value', today: 'Today',
    q_deposit: 'Add funds', q_exchange: 'Exchange', q_more: 'More', promo_title: 'Long-term placements', promo_sub: 'Place funds at 6.3% a year',
    cash: 'Cash', positions: 'Positions', orders_7d: 'Last 7 days', orders_empty: 'Nothing matches the selected filters. Please try other filters',
    from_month: 'Month to date', from_year: 'Year to date', trades_empty: 'No trades for these settings', change_settings: 'Change settings',
    crypto_title: 'Open a crypto account with Freedom Broker', crypto_sub: 'Opening and maintenance are free',
    c1: '100+ instruments', c1s: 'BTC, ETH, USDC and all top assets', c2: 'Trading 24/7', c2s: 'The market is open any time', c3: 'Withdraw to your wallet', c3s: 'Deposit and withdraw without limits', open_acc: 'Open account',
    ideas_inv: 'Investment ideas', ideas_reviews: 'Market reviews', ideas_sets: 'Collections', ideas_title: 'Investment ideas', ideas_count: 'Ideas recommended: 4005', months12: '12 months',
    acc_title: 'Accounts', total_assets: 'Total assets', seg_inv: 'Investments', seg_bank: 'Bank', seg_crypto: 'Crypto', current: 'Current', savings: 'Savings account - 3.94% USD, 2.41% EUR, 16.55% KZT',
    d_note: 'The D-account is for savings: you can\'t buy securities from it directly, move money to the trading account first.',
    my_card: 'My card', account: 'Account', withdraw: 'Withdraw', m_support: 'Support', m_orders: 'Instructions', m_invite: 'Invite a friend', m_docs: 'Reports and documents', m_bonus: 'Bonuses', m_settings: 'Settings',
    sh_support: 'Support', sh_aim: 'AIM · instant answer', sh_aim_sub: 'Explains and opens the right screen', sh_write: 'Write to support', sh_faq: 'FAQ', sh_contacts: 'Contacts', sh_rate: 'Rate the app', new: 'new',
    back: 'Back', s_deposit: 'Add funds', s_withdraw: 'Withdraw funds', s_exchange: 'Currency exchange', s_docs: 'Reports and documents', s_settings: 'Settings', s_ticket: 'Support', s_contacts: 'Contacts', s_faq: 'FAQ',
    method: 'Method', m_card: 'Bank card', m_kaspi: 'Kaspi', m_req: 'Bank transfer', currency: 'Currency', amount: 'Amount',
    req_title: 'Details for a bank transfer', req_text: 'Recipient: Freedom Finance JSC (demo)\nIBAN: KZ00 0000 0000 0000 DEMO\nPurpose: brokerage account top-up, agreement DEMO001',
    fee: 'Freedom top-up fee: 0 ₸. Your bank may charge a transfer fee.', dep_submit: 'Add funds',
    wd_to: 'To account', wd_avail: 'Available: $1,204.50 · 152,000 ₸', wd_note: 'If the app asks you to update your profile first: Menu → Settings → "Profile data".', wd_submit: 'Withdraw money',
    ex_from: 'Sell', ex_to: 'Buy', ex_rate: 'Rate (demo): 1 USD = 512.40 ₸', ex_submit: 'Exchange',
    doc_type: 'Document', d_broker: 'Broker report', d_tax: 'Tax report', d_1042: 'Form 1042-S', d_from: 'From', d_to: 'To', d_make: 'Generate',
    d_1042_note: 'Form 1042-S is only available in English.', d_tariff_note: 'Your tariff name is on the first page of the broker report.', d_ready: 'Report generated (demo).',
    lang: 'App language', st_profile: 'Profile data', st_profile_ok: 'up to date', st_update: 'Change profile data', st_push: 'Push notifications', st_security: 'Never share your password or SMS codes, not even with Freedom staff.',
    tk_tickets: 'Tickets', tk_notif: 'Notifications', tk_place: 'Describe your problem or request', tk_email: 'Send a copy of the reply to my email', tk_sms: 'Notify me of the reply by SMS (paid)',
    tk_file: 'Choose file', tk_send: 'Send', tk_yours: 'Your requests', tk_active: 'Active', tk_closed: 'Closed', tk_none: 'No active requests', tk_sent: 'Request sent (demo). The reply will come by email.',
    ct_name: 'Name', ct_city: 'City', ct_street: 'Street', ct_phone: 'Phone', ct_email: 'E-mail', ct_hours: 'Hours',
    ct_city_v: 'Astana', ct_street_v: 'Yesil district, Dostyk street, building 16, premises 2 (Talan Towers)', ct_hours_v: '09:00 - 21:00 (Astana time)',
    faq_q: ['How do I add funds to my brokerage account?', 'Where is my broker report?', 'How is the D-account different from the trading account?', 'How do I withdraw money?'],
    demo_action: 'Demo: nothing is executed. The real app would check and confirm here.', soon: 'This section isn\'t part of the demo.',
  },
};
const LANG_KEY = 'cqa-phone-lang';
let lang = (() => { try { return localStorage.getItem(LANG_KEY) || 'RU'; } catch { return 'RU'; } })();
if (!T[lang]) lang = 'RU';
const t = (k) => T[lang][k] ?? T.RU[k] ?? k;
const langListeners = new Set();
function setLang(l) {
  if (!T[l] || l === lang) return; lang = l;
  try { localStorage.setItem(LANG_KEY, l); } catch {}
  document.documentElement.lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[l];
  render(); langListeners.forEach((fn) => fn(l));
}

// ---------------- mock data (invented) ----------------
const D = {
  client: 'Демо Клиент', acct: 'DEMO001', total: 12480.35, todayAbs: 84.2, todayPct: 0.68,
  cash: [{ cur: 'USD', sign: '$', amount: '1 204.50' }, { cur: 'KZT', sign: '₸', amount: '152 000.00' }],
  positions: [
    { t: 'AAPL.US', n: 'Apple Inc.', q: 10, p: '229.40', ch: 1.12, c: '#6B7280', g: 'A' },
    { t: 'KSPI.US', n: 'Kaspi.kz', q: 8, p: '98.10', ch: -0.84, c: '#EF4444', g: 'K' },
    { t: 'SPY.US', n: 'SPDR S&P 500 ETF', q: 5, p: '571.30', ch: 0.41, c: '#1D4ED8', g: 'S' },
    { t: 'FRHC.US', n: 'Freedom Holding Corp.', q: 6, p: '128.90', ch: 2.35, c: '#16A34A', g: 'F' },
  ],
  news: [
    { tk: [['MSFT.US', -1.14]], h: 'Как разные страны внедряют ИИ и что это значит для инвесторов', by: 'Демо-автор · 1 час назад · 101', g: ['#7C3AED', '#2563EB', '#F59E0B'] },
    { tk: [['NVDA.US', -2.16], ['AMD.US', 4.69], ['INTC.US', 11.71]], h: 'Главное в полупроводниках: отчёты, прогнозы и реакция рынка', by: 'Демо-автор · 2 часа назад · 95', g: ['#0EA5E9', '#1E3A8A', '#22D3EE'] },
  ],
  indices: [
    { n: 'Индекс S&P 500', c: 'SPX.IDX', v: '6 742.18', d: '+31.40', p: 0.47, f: '#1D4ED8', fl: 'US', sp: true },
    { n: 'Индекс Dow Jones', c: 'DJI30.IDX', v: '46 120.55', d: '-82.10', p: -0.18, f: '#1D4ED8', fl: 'US' },
    { n: 'Индекс NASDAQ', c: 'NASDAQ.IDX', v: '23 015.70', d: '+190.25', p: 0.83, f: '#1D4ED8', fl: 'US', sp: true },
    { n: 'Индекс DAX', c: 'DAX.IDX', v: '24 310.40', d: '-120.60', p: -0.49, f: '#111827', fl: 'DE' },
    { n: 'Индекс FTSE', c: 'FTSE.IDX', v: '9 412.05', d: '-35.70', p: -0.38, f: '#B91C1C', fl: 'UK' },
    { n: 'Индекс KASE', c: 'KASE.IDX', v: '7 015.30', d: '+42.80', p: 0.61, f: '#0EA5E9', fl: 'KZ' },
    { n: 'Индекс HSI', c: 'HSI.IDX', v: '25 880.90', d: '+310.40', p: 1.21, f: '#DC2626', fl: 'HK' },
    { n: 'Индекс CAC 40', c: 'FCHI.IDX', v: '8 102.60', d: '+18.20', p: 0.22, f: '#1E40AF', fl: 'FR' },
  ],
  ideas: [
    { a: 'Айгерим Сапарова', r: 'Equity Analyst (демо)', h: 'Спрос на облачные сервисы растёт быстрее прогноза: повышаем целевую цену', tk: 'MSFT.US', ex: 'NASDAQ | Microsoft Corp.', pot: 14.2, img: ['#1E3A8A', '#38BDF8'], likes: 12, views: '2.1k', ago: '3 часа назад', f: '#7C3AED' },
    { a: 'Даниял Ермеков', r: 'Senior Analyst, Healthcare (демо)', h: 'Новый препарат одобрен: компания пересматривает прогноз выручки вверх', tk: 'LLY.US', ex: 'NYSE | Eli Lilly and Co.', pot: 9.6, img: ['#065F46', '#34D399'], likes: 4, views: '1.4k', ago: '21 час назад', f: '#0EA5E9' },
  ],
};
const fmtUsd = (n) => '$' + n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).replace(',', '.');
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const pct = (p) => `${p > 0 ? '+' : ''}${p.toFixed(2)}%`;
const cls = (p) => (p >= 0 ? 'fa-up' : 'fa-down');

// ---------------- icons (own drawings) ----------------
const I = {
  quotes: '<svg viewBox="0 0 28 28" fill="currentColor"><rect x="4" y="15" width="5" height="8" rx="2.5"/><rect x="11.5" y="10" width="5" height="13" rx="2.5"/><rect x="19" y="5" width="5" height="18" rx="2.5"/></svg>',
  portfolio: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M13 4.1A10 10 0 1 0 23.9 15H13z"/><path d="M15.5 2.6V12.5h9.9A10 10 0 0 0 15.5 2.6z"/></svg>',
  crypto: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M10 5h2v2.2h2V5h2v2.3c2.7.4 4.3 1.9 4.3 4.1 0 1.4-.7 2.5-1.9 3 1.6.5 2.6 1.8 2.6 3.5 0 2.5-1.9 4.2-5 4.5V25h-2v-2.3h-2V25h-2v-2.3H8v-2.4h2V7.7H8V5.3h2zm2 4.6v4.1h3.2c1.3 0 2.1-.8 2.1-2s-.8-2.1-2.1-2.1zm0 6.4v4.4h3.7c1.4 0 2.3-.9 2.3-2.2s-.9-2.2-2.3-2.2z"/></svg>',
  ideas: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M14 4a8 8 0 0 0-4.7 14.5c.6.5 1 1.2 1 2V21h7.4v-.5c0-.8.4-1.5 1-2A8 8 0 0 0 14 4zm-3.6 18.6h7.2v1A2.4 2.4 0 0 1 15.2 26h-2.4a2.4 2.4 0 0 1-2.4-2.4z"/><path d="M14 0v2M4 4l1.5 1.5M24 4l-1.5 1.5M1 13h2M25 13h2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  accounts: '<svg viewBox="0 0 28 28" fill="currentColor"><path d="M14 2 3 7.5V10h22V7.5zM5 12h3v9H5zm5.5 0h3v9h-3zm5 0h3v9h-3zm5.5 0h3v9h-3zM3 23h22v3H3z"/></svg>',
  menu: '<svg viewBox="0 0 28 28" fill="currentColor"><circle cx="6" cy="6" r="2.5"/><circle cx="14" cy="6" r="2.5"/><circle cx="22" cy="6" r="2.5"/><circle cx="6" cy="14" r="2.5"/><circle cx="14" cy="14" r="2.5"/><circle cx="22" cy="14" r="2.5"/><circle cx="6" cy="22" r="2.5"/><circle cx="14" cy="22" r="2.5"/><circle cx="22" cy="22" r="2.5"/></svg>',
  search: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="10" cy="10" r="6.5"/><path d="m15 15 5.5 5.5"/></svg>',
  chat: '<svg viewBox="0 0 28 28" width="30" height="30" fill="currentColor"><path d="M4 6a3 3 0 0 1 3-3h11a3 3 0 0 1 3 3v8a3 3 0 0 1-3 3H9l-5 4z"/><path d="M23 8h1a3 3 0 0 1 3 3v13l-4-3h-9a3 3 0 0 1-3-3v-1h7a5 5 0 0 0 5-5z" opacity=".9"/></svg>',
  gear: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M10.3 2h3.4l.5 2.6 1.6.7 2.2-1.5 2.4 2.4-1.5 2.2.7 1.6 2.6.5v3.4l-2.6.5-.7 1.6 1.5 2.2-2.4 2.4-2.2-1.5-1.6.7-.5 2.6h-3.4l-.5-2.6-1.6-.7-2.2 1.5-2.4-2.4 1.5-2.2-.7-1.6L2 13.7v-3.4l2.6-.5.7-1.6-1.5-2.2 2.4-2.4 2.2 1.5 1.6-.7zM12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z"/></svg>',
  chevD: '<svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m4 6 4 4 4-4"/></svg>',
  chevR: '<svg viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="m6 3 5 5-5 5"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 12H5m6-6-6 6 6 6"/></svg>',
  cardPlus: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="6" width="20" height="15" rx="2.5"/><path d="M3 11h20M21 18v7M17.5 21.5h7"/></svg>',
  swap: '<svg viewBox="0 0 28 28" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 11a8.5 8.5 0 0 1 15-4m1 10a8.5 8.5 0 0 1-15 4"/><path d="M21 3v4h-4M7 25v-4h4"/><path d="M14 9v10m2-7.5c0-1-1-1.5-2-1.5s-2 .6-2 1.5 1 1.3 2 1.6 2 .7 2 1.7-1 1.5-2 1.5-2-.5-2-1.5"/></svg>',
  dots: '<svg viewBox="0 0 28 28" fill="currentColor"><circle cx="7" cy="14" r="2.2"/><circle cx="14" cy="14" r="2.2"/><circle cx="21" cy="14" r="2.2"/></svg>',
  phoneCard: '<svg viewBox="0 0 40 40" width="40" height="40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="11" y="5" width="18" height="30" rx="3"/><path d="M17 30h6"/><rect x="16" y="12" width="12" height="9" rx="1.5" fill="currentColor" stroke="none"/></svg>',
  mSupport: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2H7l-4 3z"/><path d="M18 7h1a2 2 0 0 1 2 2v11l-3-2.5h-7a2 2 0 0 1-2-2V15h5a4 4 0 0 0 4-4z" opacity=".85"/></svg>',
  mOrders: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 2h12a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 4v2h8V6zm1 8.5 2 2 4-4-1.2-1.2-2.8 2.8-.8-.8z"/></svg>',
  mInvite: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><circle cx="9" cy="7" r="4"/><path d="M2 20a7 7 0 0 1 11.6-5.3A5.5 5.5 0 0 0 12.5 20z"/><circle cx="18" cy="17" r="4.5"/><path d="M18 14.8v4.4M15.8 17h4.4" stroke="#0D2E64" stroke-width="1.6" stroke-linecap="round"/></svg>',
  mDocs: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M5 2h10l4 4v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2zm2 7v2h10V9zm0 4v2h10v-2zm0 4v2h6v-2z"/></svg>',
  mBonus: '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 8h18v4H3zm1 5h7v8H6a2 2 0 0 1-2-2zm9 0h7v6a2 2 0 0 1-2 2h-5zM12 7.5C10 4 6 3.5 6 6c0 1.3 1.5 1.8 6 1.5zm0 0c2-3.5 6-4 6-1.5 0 1.3-1.5 1.8-6 1.5z"/></svg>',
  book: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2 5c3-1.2 6-1 9 1v14c-3-2-6-2.2-9-1zm11 1c3-2 6-2.2 9-1v14c-3-1.2-6-1-9 1z"/></svg>',
  pin: '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M12 21s-6.5-6-6.5-11a6.5 6.5 0 0 1 13 0C18.5 15 12 21 12 21z"/><circle cx="12" cy="10" r="2.4"/><path d="M5 21h14" stroke-linecap="round"/></svg>',
  star: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="m12 2.5 2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2l2.2 6.3L20.5 10l-6.3 2.2L12 18.5l-2.2-6.3L3.5 10l6.3-1.7zM19 15l.9 2.4 2.4.9-2.4.9-.9 2.4-.9-2.4-2.4-.9 2.4-.9z"/></svg>',
  qr: '<svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M3 3h8v8H3zm2 2v4h4V5zm8-2h8v8h-8zm2 2v4h4V5zM3 13h8v8H3zm2 2v4h4v-4zm8-2h3v3h-3zm5 0h3v3h-3zm-5 5h3v3h-3zm5 0h3v3h-3zm-2.5-2.5h3v3h-3z"/></svg>',
  person: '<svg viewBox="0 0 92 92" width="92" height="92"><circle cx="46" cy="34" r="16" fill="#E5E7EB"/><path d="M14 78c4-16 17-24 32-24s28 8 32 24" fill="#E5E7EB"/></svg>',
  badge: '<svg viewBox="0 0 20 20" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.6"><path d="M3 6V3h3M14 3h3v3M17 14v3h-3M6 17H3v-3"/><circle cx="10" cy="8.5" r="2.2"/><path d="M6 14.5c.8-1.8 2.2-2.6 4-2.6s3.2.8 4 2.6"/></svg>',
  thumbUp: '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M2 9h3v9H2zm5 9h7.5a2 2 0 0 0 2-1.6l1.2-5.6A2 2 0 0 0 15.7 8.5H12l.6-3.4A1.8 1.8 0 0 0 9.5 3.8L7 9z"/></svg>',
  eye: '<svg viewBox="0 0 20 20" width="20" height="20" fill="currentColor"><path d="M10 4C5.5 4 2.3 7.6 1 10c1.3 2.4 4.5 6 9 6s7.7-3.6 9-6c-1.3-2.4-4.5-6-9-6zm0 9.5a3.5 3.5 0 1 1 0-7 3.5 3.5 0 0 1 0 7z"/><circle cx="10" cy="10" r="1.8"/></svg>',
  search2: '<svg viewBox="0 0 64 64" width="64" height="64" fill="none" stroke="#9CA3AF" stroke-width="5" stroke-linecap="round"><circle cx="26" cy="26" r="16"/><path d="m38 38 16 16"/></svg>',
  cog2: '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.4"><circle cx="24" cy="24" r="6"/><path d="M24 6v6m0 24v6M6 24h6m24 0h6M11 11l4 4m18 18 4 4m0-26-4 4M15 33l-4 4"/></svg>',
  listAdd: '<svg viewBox="0 0 48 48" width="48" height="48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><rect x="9" y="5" width="26" height="34" rx="3"/><path d="M15 14h14M15 21h14M15 28h8"/><circle cx="35" cy="36" r="8" fill="#171D2D"/><path d="M35 32v8m-4-4h8"/></svg>',
};

// ---------------- screens (catalog for AIM + renderers) ----------------
// kind: tab screens show the tab bar; push screens get a back button and hide it (as in the real app).
const SCREENS = [
  { id: 'quotes', tab: true, title: 't_quotes', sum: 'sum_quotes', targets: [
    { id: 'q-search', label: 'search', kind: 'field' }, { id: 'q-chat', label: 'chat', kind: 'button' }, { id: 'q-indices', label: 'indices', kind: 'section' },
    { id: 'q-lists', label: 'my_lists', kind: 'section' }, { id: 'q-add', label: 'add', kind: 'button' }] },
  { id: 'portfolio', tab: true, title: 't_portfolio', sum: 'sum_portfolio', targets: [
    { id: 'pf-total', label: 'net_assets', kind: 'section' }, { id: 'pf-deposit', label: 'q_deposit', kind: 'button' }, { id: 'pf-exchange', label: 'q_exchange', kind: 'button' },
    { id: 'pf-promo', label: 'promo_title', kind: 'section' }, { id: 'pf-cash', label: 'cash', kind: 'section' }, { id: 'pf-positions', label: 'positions', kind: 'section' },
    { id: 'pf-tab-orders', label: 'seg_orders', kind: 'button' }, { id: 'pf-tab-trades', label: 'seg_trades', kind: 'button' }] },
  { id: 'crypto', tab: true, title: 't_crypto', sum: 'sum_crypto', targets: [{ id: 'cr-open', label: 'open_acc', kind: 'button', protected: true }] },
  { id: 'ideas', tab: true, title: 't_ideas', sum: 'sum_ideas', targets: [
    { id: 'id-inv', label: 'ideas_inv', kind: 'button' }, { id: 'id-reviews', label: 'ideas_reviews', kind: 'button' }, { id: 'id-sets', label: 'ideas_sets', kind: 'button' }, { id: 'id-feed', label: 'ideas_title', kind: 'section' }] },
  { id: 'accounts', tab: true, title: 't_accounts', sum: 'sum_accounts', targets: [
    { id: 'ac-total', label: 'total_assets', kind: 'section' }, { id: 'ac-trade', label: 'current', kind: 'section' }, { id: 'ac-savings', label: 'savings', kind: 'section' }] },
  { id: 'menu', tab: true, title: 't_menu', sum: 'sum_menu', targets: [
    { id: 'mn-deposit', label: 'q_deposit', kind: 'button' }, { id: 'mn-withdraw', label: 'withdraw', kind: 'button' }, { id: 'mn-support', label: 'm_support', kind: 'button' },
    { id: 'mn-docs', label: 'm_docs', kind: 'button' }, { id: 'mn-settings', label: 'm_settings', kind: 'button' }] },
  { id: 'deposit', title: 's_deposit', sum: 'sum_deposit', targets: [
    { id: 'dep-method', label: 'method', kind: 'field', options: ['m_card', 'm_kaspi', 'm_req'] }, { id: 'dep-currency', label: 'currency', kind: 'field', options: ['KZT', 'USD'] },
    { id: 'dep-amount', label: 'amount', kind: 'field' }, { id: 'dep-requisites', label: 'req_title', kind: 'section' }, { id: 'dep-fee', label: 'fee', kind: 'section' },
    { id: 'dep-submit', label: 'dep_submit', kind: 'button', protected: true }] },
  { id: 'withdraw', title: 's_withdraw', sum: 'sum_withdraw', targets: [
    { id: 'wd-account', label: 'wd_to', kind: 'field' }, { id: 'wd-currency', label: 'currency', kind: 'field', options: ['KZT', 'USD'] }, { id: 'wd-amount', label: 'amount', kind: 'field' },
    { id: 'wd-note', label: 'wd_note', kind: 'section' }, { id: 'wd-submit', label: 'wd_submit', kind: 'button', protected: true }] },
  { id: 'exchange', title: 's_exchange', sum: 'sum_exchange', targets: [
    { id: 'ex-from', label: 'ex_from', kind: 'field', options: ['USD', 'KZT'] }, { id: 'ex-to', label: 'ex_to', kind: 'field', options: ['KZT', 'USD'] },
    { id: 'ex-amount', label: 'amount', kind: 'field' }, { id: 'ex-submit', label: 'ex_submit', kind: 'button', protected: true }] },
  { id: 'documents', title: 's_docs', sum: 'sum_docs', targets: [
    { id: 'doc-type', label: 'doc_type', kind: 'field', options: ['d_broker', 'd_tax', 'd_1042'] }, { id: 'doc-from', label: 'd_from', kind: 'field' }, { id: 'doc-to', label: 'd_to', kind: 'field' },
    { id: 'doc-generate', label: 'd_make', kind: 'button' }, { id: 'doc-notes', label: 'd_1042_note', kind: 'section' }] },
  { id: 'settings', title: 's_settings', sum: 'sum_settings', targets: [
    { id: 'st-lang', label: 'lang', kind: 'field', options: ['RU', 'KZ', 'EN'] }, { id: 'st-profile', label: 'st_profile', kind: 'section' },
    { id: 'st-update', label: 'st_update', kind: 'button', protected: true }, { id: 'st-push', label: 'st_push', kind: 'field', options: ['on', 'off'] }] },
  { id: 'ticket', title: 's_ticket', sum: 'sum_ticket', targets: [
    { id: 'tk-text', label: 'tk_place', kind: 'field' }, { id: 'tk-email', label: 'tk_email', kind: 'field', options: ['on', 'off'] }, { id: 'tk-sms', label: 'tk_sms', kind: 'field', options: ['on', 'off'] },
    { id: 'tk-send', label: 'tk_send', kind: 'button', protected: true }] },
  { id: 'contacts', title: 's_contacts', sum: 'sum_contacts', targets: [{ id: 'ct-table', label: 's_contacts', kind: 'section' }] },
  { id: 'faq', title: 's_faq', sum: 'sum_contacts', targets: [] },
];
const byId = new Map(SCREENS.map((s) => [s.id, s]));
const TABS = SCREENS.filter((s) => s.tab);

// ---------------- state + routing ----------------
const st = { tab: 'quotes', screen: 'quotes', seg: { portfolio: 'portfolio', accounts: 'inv', ticket: 'tickets' }, idea: 'inv', q: '', form: {}, tickets: 0 };
const screenListeners = new Set();
const $ = (sel, root = document) => root.querySelector(sel);
const main = $('#fa-main');

function parseHash() {
  const id = location.hash.replace(/^#\/?/, '');
  return byId.has(id) ? id : 'quotes';
}
// In-app back stack (like a native navigation stack): tabs reset it, push screens add to it.
const stack = [];
async function go(screen, { back = false } = {}) {
  if (!byId.has(screen)) return false;
  closeSheet();
  if (byId.get(screen).tab) stack.length = 0;
  else if (!back && screen !== st.screen) stack.push(st.screen);
  history.replaceState(null, '', `#/${screen}`);
  show(screen);
  await new Promise((r) => requestAnimationFrame(() => r()));
  return true;
}
const goBack = () => go(stack.pop() || st.tab, { back: true });
function show(screen) {
  const s = byId.get(screen);
  if (s.tab) st.tab = screen;
  st.screen = screen;
  render();
  main.scrollTop = 0;
  screenListeners.forEach((fn) => fn(screen));
  const log = $('#ph-log'); if (log) log.textContent = `Экран: ${t(s.title)}`;
}
addEventListener('hashchange', () => { const id = parseHash(); if (id !== st.screen) go(id); });

// ---------------- render helpers ----------------
const target = (id, extra = '') => `data-target="${id}" ${extra}`;
const topSearch = () => `<div class="fa-top"><label class="fa-search">${I.search}<input type="search" ${target('q-search')} placeholder="${esc(t('search'))}" aria-label="${esc(t('search'))}" value="${esc(st.q)}" autocomplete="off"></label>
  <button class="fa-ico-btn" type="button" ${target('q-chat')} data-act="aim" aria-label="${esc(t('chat'))}">${I.chat}</button></div>`;
const navBar = (title, end = '') => `<div class="fa-nav"><button class="fa-back" type="button" data-act="back">${I.back}<span>${esc(t('back'))}</span></button><h1 class="fa-nav-title">${esc(title)}</h1><div class="fa-nav-end">${end}</div></div>`;
const seg = (key, items) => `<div class="fa-seg" role="tablist">${items.map(([v, label, tid]) => `<button type="button" role="tab" data-seg="${key}" data-v="${v}" ${tid ? target(tid) : ''} aria-selected="${st.seg[key] === v}">${esc(t(label))}</button>`).join('')}</div>`;
function sparkline(seed, up) {
  let y = 20, pts = []; for (let i = 0; i <= 40; i++) { y += Math.sin(i * 0.7 + seed) * 2.2 + (up ? -0.35 : 0.35) + Math.cos(i * 1.9 + seed * 2) * 1.4; y = Math.max(4, Math.min(36, y)); pts.push(`${i * 5},${y.toFixed(1)}`); }
  const c = up ? '#22C55E' : '#EF4444';
  return `<svg viewBox="0 0 200 40" width="100%" height="40" preserveAspectRatio="none"><defs><linearGradient id="g${seed}" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="${c}" stop-opacity=".35"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></linearGradient></defs><polygon points="0,40 ${pts.join(' ')} 200,40" fill="url(#g${seed})"/><polyline points="${pts.join(' ')}" fill="none" stroke="${c}" stroke-width="1.6"/></svg>`;
}
const art = (g, extra = '') => `background: radial-gradient(circle at 25% 30%, ${g[2] || g[1]} 0 12%, transparent 13%), radial-gradient(circle at 75% 65%, ${g[1]} 0 22%, transparent 23%), linear-gradient(135deg, ${g[0]}, ${g[1]});${extra}`;

// ---------------- screens ----------------
const R = {
  quotes() {
    const q = st.q.trim().toLowerCase();
    const idx = D.indices.filter((x) => !q || x.n.toLowerCase().includes(q) || x.c.toLowerCase().includes(q));
    return `${topSearch()}
    <button class="fa-hero" type="button" data-act="toast" data-msg="soon"><div class="fa-hero-img" style="${art(['#0F172A', '#1E40AF', '#F59E0B'])}"></div>
      <div class="fa-hero-body"><span class="fa-src">Freedom Media · демо</span><h2 class="fa-hero-title">Рынки США растут третий день подряд: что купить до конца квартала</h2><p class="fa-meta" style="color:#C7CBD3">Демо-автор · 9 минут назад</p></div></button>
    ${D.news.map((n, i) => `<button class="fa-news" type="button" data-act="toast" data-msg="soon" style="${i ? 'flex-direction:row-reverse' : ''}"><div class="fa-row-main">
      <p class="fa-tick">${n.tk.map(([tk, p]) => `${tk} <span class="${cls(p)}">${pct(p)} ${p >= 0 ? '▲' : '▼'}</span>`).join(' &nbsp;')}</p><h3>${esc(n.h)}</h3><p class="fa-meta">${esc(n.by)}</p></div>
      <div class="fa-news-thumb" style="${art(n.g)}"></div></button>`).join('')}
    <div style="display:flex;justify-content:center;padding:18px 0 6px"><button class="fa-link-pill" type="button" data-act="toast" data-msg="soon">${esc(t('all_news'))} ${I.chevR}</button></div>
    <section ${target('q-indices')}><div class="fa-sec"><h2 class="fa-h2">${esc(t('indices'))}</h2></div>
      ${idx.length ? idx.map((x, i) => `<button class="fa-idx" type="button" data-act="toast" data-msg="soon"><span class="fa-flag" style="background:${x.f}">${x.fl}</span>
        <span class="fa-row-main"><span style="display:block;font-size:16px">${esc(x.n)}</span><span class="fa-meta">${x.c}</span></span>
        <span class="fa-row-end"><span style="display:block;font-size:16px">${x.v}</span><span class="${cls(x.p)}" style="font-size:12px">${x.d} ${pct(x.p)}</span></span></button>
        ${x.sp ? `<div class="fa-spark">${sparkline(i + 1, x.p >= 0)}<div class="fa-vote"><span style="background:#16A34A">${esc(t('rise'))}</span><span style="background:#DC2626">${esc(t('fall'))}</span></div></div>` : ''}`).join('')
        : `<p class="fa-empty">${esc(t('nothing'))}</p>`}
    </section>
    <section ${target('q-lists')}><div class="fa-sec"><h2 class="fa-h2">${esc(t('my_lists'))}</h2><span style="color:var(--fa-blue)">${I.gear}</span></div>
      <div class="fa-pad" style="display:flex;gap:16px;font-size:15px;color:var(--fa-text-2)"><span>⭐ ${esc(t('fav'))}</span><span style="color:var(--fa-text-3)">+ ${esc(t('new_list'))}</span></div>
      <div class="fa-empty">${I.listAdd}<p style="white-space:pre-line">${esc(t('list_empty'))}</p></div>
      <div class="fa-pad"><button class="fa-btn fa-btn-block" type="button" ${target('q-add')} data-act="toast" data-msg="demo_action">${esc(t('add'))} +</button></div><div class="fa-spacer"></div></section>`;
  },
  portfolio() {
    const tabs = seg('portfolio', [['portfolio', 'seg_portfolio'], ['orders', 'seg_orders', 'pf-tab-orders'], ['trades', 'seg_trades', 'pf-tab-trades']]);
    const head = `<div class="fa-top fa-top-c"><button class="fa-ico-btn" type="button" data-act="focus-search">${I.search}</button>
      <button class="fa-pill" type="button" data-act="go" data-to="accounts">KZ #${D.acct} ${I.chevD}</button><button class="fa-ico-btn" type="button" data-act="go" data-to="settings" aria-label="${esc(t('m_settings'))}">${I.gear}</button></div>${tabs}`;
    if (st.seg.portfolio === 'orders') return `${head}<div class="fa-pad" style="padding-top:16px"><span class="fa-tag" style="font-weight:500">${esc(t('orders_7d'))}</span></div>
      <div class="fa-empty" style="padding-top:80px">${I.search2}<p>${esc(t('orders_empty'))}</p><p style="display:flex;gap:16px;color:var(--fa-blue)"><span>${esc(t('from_month'))}</span><span>${esc(t('from_year'))}</span></p></div>`;
    if (st.seg.portfolio === 'trades') return `${head}<div class="fa-empty" style="padding-top:110px">${I.cog2}<p>${esc(t('trades_empty'))}</p></div>
      <div class="fa-pad"><button class="fa-btn fa-btn-block" type="button" data-act="toast" data-msg="soon">${esc(t('change_settings'))} +</button></div>`;
    return `${head}
    <div ${target('pf-total')} style="text-align:center;padding:24px 16px 0"><p class="fa-cap">${esc(t('net_assets'))}</p>
      <p style="display:inline-flex;align-items:center;gap:8px;font-size:34px;font-weight:700;margin-top:4px">${fmtUsd(D.total)} <span style="display:grid;place-items:center;width:26px;height:26px;border-radius:50%;background:var(--fa-surface);color:var(--fa-text-3)">${I.chevD}</span></p>
      <p class="fa-cap" style="margin-top:4px">${esc(t('today'))} <span class="fa-up">+${fmtUsd(D.todayAbs)} · +${D.todayPct}%</span></p></div>
    <div class="fa-quick"><button type="button" ${target('pf-deposit')} data-act="go" data-to="deposit">${I.cardPlus}${esc(t('q_deposit'))}</button>
      <button type="button" ${target('pf-exchange')} data-act="go" data-to="exchange">${I.swap}${esc(t('q_exchange'))}</button><button type="button" data-act="sheet" data-sheet="more">${I.dots}${esc(t('q_more'))}</button></div>
    <div class="fa-panel">
      <button class="fa-card fa-card-promo" type="button" ${target('pf-promo')} data-act="toast" data-msg="soon"><span><span class="fa-h2" style="display:block;margin-bottom:6px">${esc(t('promo_title'))}</span><p>${esc(t('promo_sub'))}</p></span>
        <span style="display:flex;flex-direction:column;justify-content:space-between;align-items:flex-end"><span class="fa-chev">${I.chevR}</span><span class="fa-coins"><span class="fa-coin" style="background:#60A5FA">€</span><span class="fa-coin" style="background:#22C55E">$</span></span></span></button>
      <div class="fa-card" ${target('pf-cash')}><h2 class="fa-h2" style="margin-bottom:6px">${esc(t('cash'))}</h2>
        ${D.cash.map((c) => `<div class="fa-row"><span class="fa-tile">${c.sign}</span><span class="fa-row-main" style="font-size:17px">${c.cur}</span><span style="font-size:17px">${c.amount}</span><span class="fa-chev">${I.chevR}</span></div>`).join('')}</div>
      <div class="fa-card" ${target('pf-positions')}><h2 class="fa-h2" style="margin-bottom:6px">${esc(t('positions'))}</h2><div class="fa-divide">
        ${D.positions.map((p) => `<div class="fa-row"><span class="fa-tile" style="background:${p.c};color:#fff">${p.g || ''}</span><span class="fa-row-main"><span style="display:block;font-size:16px">${p.t}</span><span class="fa-meta">${esc(p.n)} · ${p.q} шт.</span></span>
          <span class="fa-row-end"><span style="display:block;font-size:16px">$${p.p}</span><span class="${cls(p.ch)}" style="font-size:12px">${pct(p.ch)}</span></span></div>`).join('')}</div></div>
    </div>`;
  },
  crypto() {
    return `<div class="fa-galaxy"><div class="fa-orb">${I.crypto.replace('viewBox', 'width="56" height="56" style="color:#fff" viewBox')}</div>
      <h1 class="fa-h2" style="font-size:22px;line-height:1.3">${esc(t('crypto_title'))}</h1><p class="fa-cap">${esc(t('crypto_sub'))}</p>
      <ul class="fa-benefits">${[['c1', 'c1s', '#F59E0B'], ['c2', 'c2s', '#3B82F6'], ['c3', 'c3s', '#3B82F6']].map(([a, b, c]) => `<li><span class="fa-tile" style="background:${c};color:#fff;width:28px;height:28px">✓</span><span><b style="font-weight:600">${esc(t(a))}</b><span class="fa-meta" style="display:block">${esc(t(b))}</span></span></li>`).join('')}</ul>
      <button class="fa-btn fa-btn-block" type="button" ${target('cr-open', 'data-protected="true"')} data-act="toast" data-msg="demo_action">${esc(t('open_acc'))}</button></div>`;
  },
  ideas() {
    const chip = (v, label, tid, dot) => `<button type="button" class="fa-chip${dot ? ' fa-chip-dot' : ''}" ${target(tid)} data-idea="${v}" aria-pressed="${st.idea === v}">${esc(t(label))}</button>`;
    return `${topSearch()}
    <div class="fa-chips">${chip('inv', 'ideas_inv', 'id-inv')}${chip('reviews', 'ideas_reviews', 'id-reviews', true)}${chip('sets', 'ideas_sets', 'id-sets')}</div>
    <section ${target('id-feed')}><div class="fa-pad" style="padding-bottom:4px"><h1 class="fa-h1">${esc(t('ideas_title'))}</h1><p class="fa-cap" style="margin-top:6px">${esc(t('ideas_count'))}</p></div>
    ${D.ideas.map((x) => `<article class="fa-idea"><div class="fa-author"><span class="fa-face" style="background:${x.f}">${x.a.split(' ').map((w) => w[0]).join('')}</span><span><span style="display:block;font-size:16px">${esc(x.a)}</span><span class="fa-cap">${esc(x.r)}</span></span></div>
      <h3>${esc(x.h)}</h3><div class="fa-idea-img" style="${art(x.img)}"></div>
      <div class="fa-strip"><span style="font-size:17px">${x.tk}</span><span class="fa-up" style="font-size:17px">+${x.pot}%</span><span class="fa-meta">${esc(x.ex)}</span><span class="fa-meta">${esc(t('months12'))}</span></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:14px;color:var(--fa-text-3);font-size:15px">${I.thumbUp}<span>${x.likes}</span>&nbsp;${I.eye}<span>${x.views}</span><span style="margin-left:auto" class="fa-meta">${x.ago}</span></div></article>`).join('')}</section>`;
  },
  accounts() {
    return `<div class="fa-acc-head">${esc(t('acc_title'))}</div><div class="fa-acc-sheet">
      <div ${target('ac-total')} style="padding:22px 16px 0"><p class="fa-cap">${esc(t('total_assets'))}</p><p style="display:flex;align-items:center;justify-content:space-between;font-size:34px;font-weight:700">${fmtUsd(D.total)}
        <svg viewBox="0 0 28 28" width="28" height="28" fill="none" stroke="#3B82F6" stroke-width="3.5" stroke-linecap="round"><path d="M14 3a11 11 0 1 1-9.5 5.5" /></svg></p></div>
      <div class="fa-bar"><span style="flex:94;background:#4CAF50"></span><span style="flex:6;background:#F44336"></span></div>
      ${seg('accounts', [['inv', 'seg_inv'], ['bank', 'seg_bank'], ['crypto', 'seg_crypto']])}
      ${st.seg.accounts === 'inv' ? `<h2 class="fa-h2" style="padding:24px 16px 16px">Freedom Broker</h2>
      <button class="fa-acc-row" type="button" aria-current="true" ${target('ac-trade')} data-act="go" data-to="portfolio"><span style="font-size:17px">FFG #${D.acct}</span><span class="fa-tag">${esc(t('current'))}</span><span style="margin-left:auto;font-size:17px;color:var(--fa-text-3)">${fmtUsd(D.total)}</span></button>
      <div class="fa-acc-row" ${target('ac-savings')} style="flex-wrap:wrap"><span style="font-size:17px">FFG #D${D.acct}</span><span style="margin-left:auto;font-size:17px;color:var(--fa-text-3)">$0.00</span>
        <span class="fa-cap" style="width:100%">${esc(t('savings'))}</span><span class="fa-meta" style="width:100%">${esc(t('d_note'))}</span></div>`
      : `<div class="fa-empty" style="padding-top:60px"><p>${esc(t('soon'))}</p></div>`}</div>`;
  },
  menu() {
    const row = (id, icon, label, act) => `<button class="fa-menu-row" type="button" ${target(id)} ${act}><span class="fa-tile fa-tile-blue">${icon}</span><span class="fa-row-main">${esc(t(label))}</span><span class="fa-chev">${I.chevR}</span></button>`;
    return `<div class="fa-top fa-top-c"><button class="fa-pill" type="button" data-act="cycle-lang" style="background:none;padding:0">${{ RU: '🇷🇺', KZ: '🇰🇿', EN: '🇬🇧' }[lang]} ${lang}</button><span class="fa-ico-btn">${I.qr}</span></div>
    <div class="fa-menu-head"><div class="fa-avatar">${I.person}</div><span class="fa-chip-acct">${esc(t('account'))} #${D.acct} ${I.chevD}</span><p class="fa-name">${esc(D.client)}</p><p class="fa-cap" style="display:flex;gap:6px;align-items:center">${I.badge} ${esc(t('my_card'))}</p></div>
    <div class="fa-btn-row"><button class="fa-btn" type="button" ${target('mn-deposit')} data-act="go" data-to="deposit">${esc(t('q_deposit'))}</button><button class="fa-btn fa-btn-2" type="button" ${target('mn-withdraw')} data-act="go" data-to="withdraw">${esc(t('withdraw'))}</button></div>
    <div class="fa-menu-list">${row('mn-support', I.mSupport, 'm_support', 'data-act="sheet" data-sheet="support"')}${row('mn-orders', I.mOrders, 'm_orders', 'data-act="toast" data-msg="soon"')}
      ${row('mn-invite', I.mInvite, 'm_invite', 'data-act="toast" data-msg="soon"')}${row('mn-docs', I.mDocs, 'm_docs', 'data-act="go" data-to="documents"')}
      ${row('mn-bonus', I.mBonus, 'm_bonus', 'data-act="toast" data-msg="soon"')}${row('mn-settings', I.gear.replace('width="26" height="26"', 'width="22" height="22"'), 'm_settings', 'data-act="go" data-to="settings"')}</div>`;
  },
  deposit() {
    const f = st.form;
    return `${navBar(t('s_deposit'))}<form class="fa-form" data-form="deposit">
      <label class="fa-field"><span>${esc(t('method'))}</span><select class="fa-inp" name="dep-method" ${target('dep-method')}>${['m_card', 'm_kaspi', 'm_req'].map((m) => `<option value="${m}" ${f['dep-method'] === m ? 'selected' : ''}>${esc(t(m))}</option>`).join('')}</select></label>
      <label class="fa-field"><span>${esc(t('currency'))}</span><select class="fa-inp" name="dep-currency" ${target('dep-currency')}>${['KZT', 'USD'].map((c) => `<option ${f['dep-currency'] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="fa-field"><span>${esc(t('amount'))}</span><input class="fa-inp" name="dep-amount" ${target('dep-amount')} inputmode="decimal" placeholder="0" value="${esc(f['dep-amount'] || '')}"></label>
      ${f['dep-method'] === 'm_req' ? `<div class="fa-note" ${target('dep-requisites')}><b style="display:block;color:#fff;margin-bottom:6px">${esc(t('req_title'))}</b><span style="white-space:pre-line">${esc(t('req_text'))}</span></div>` : ''}
      <p class="fa-cap" ${target('dep-fee')}>${esc(t('fee'))}</p>
      <button class="fa-btn fa-btn-block" type="button" ${target('dep-submit', 'data-protected="true"')} data-act="toast" data-msg="demo_action">${esc(t('dep_submit'))}</button></form>`;
  },
  withdraw() {
    const f = st.form;
    return `${navBar(t('s_withdraw'))}<form class="fa-form" data-form="withdraw"><p class="fa-note">${esc(t('wd_avail'))}</p>
      <label class="fa-field"><span>${esc(t('wd_to'))}</span><select class="fa-inp" name="wd-account" ${target('wd-account')}><option>Kaspi Gold •• 4821 (демо)</option><option>Halyk •• 1093 (демо)</option></select></label>
      <label class="fa-field"><span>${esc(t('currency'))}</span><select class="fa-inp" name="wd-currency" ${target('wd-currency')}>${['KZT', 'USD'].map((c) => `<option ${f['wd-currency'] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="fa-field"><span>${esc(t('amount'))}</span><input class="fa-inp" name="wd-amount" ${target('wd-amount')} inputmode="decimal" placeholder="0" value="${esc(f['wd-amount'] || '')}"></label>
      <p class="fa-cap" ${target('wd-note')}>${esc(t('wd_note'))}</p>
      <button class="fa-btn fa-btn-block" type="button" ${target('wd-submit', 'data-protected="true"')} data-act="toast" data-msg="demo_action">${esc(t('wd_submit'))}</button></form>`;
  },
  exchange() {
    const f = st.form;
    return `${navBar(t('s_exchange'))}<form class="fa-form" data-form="exchange">
      <label class="fa-field"><span>${esc(t('ex_from'))}</span><select class="fa-inp" name="ex-from" ${target('ex-from')}>${['USD', 'KZT'].map((c) => `<option ${f['ex-from'] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="fa-field"><span>${esc(t('ex_to'))}</span><select class="fa-inp" name="ex-to" ${target('ex-to')}>${['KZT', 'USD'].map((c) => `<option ${f['ex-to'] === c ? 'selected' : ''}>${c}</option>`).join('')}</select></label>
      <label class="fa-field"><span>${esc(t('amount'))}</span><input class="fa-inp" name="ex-amount" ${target('ex-amount')} inputmode="decimal" placeholder="0" value="${esc(f['ex-amount'] || '')}"></label>
      <p class="fa-cap">${esc(t('ex_rate'))}</p>
      <button class="fa-btn fa-btn-block" type="button" ${target('ex-submit', 'data-protected="true"')} data-act="toast" data-msg="demo_action">${esc(t('ex_submit'))}</button></form>`;
  },
  documents() {
    const f = st.form;
    return `${navBar(t('s_docs'))}<form class="fa-form" data-form="documents">
      <label class="fa-field"><span>${esc(t('doc_type'))}</span><select class="fa-inp" name="doc-type" ${target('doc-type')}>${['d_broker', 'd_tax', 'd_1042'].map((d) => `<option value="${d}" ${f['doc-type'] === d ? 'selected' : ''}>${esc(t(d))}</option>`).join('')}</select></label>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px"><label class="fa-field"><span>${esc(t('d_from'))}</span><input class="fa-inp" type="date" name="doc-from" ${target('doc-from')} value="${esc(f['doc-from'] || '2026-01-01')}"></label>
        <label class="fa-field"><span>${esc(t('d_to'))}</span><input class="fa-inp" type="date" name="doc-to" ${target('doc-to')} value="${esc(f['doc-to'] || '2026-11-07')}"></label></div>
      <div class="fa-note" ${target('doc-notes')}>${esc(t('d_1042_note'))}<br>${esc(t('d_tariff_note'))}</div>
      <button class="fa-btn fa-btn-block" type="button" ${target('doc-generate')} data-act="toast" data-msg="d_ready">${esc(t('d_make'))}</button></form>`;
  },
  settings() {
    return `${navBar(t('s_settings'))}<form class="fa-form" data-form="settings">
      <label class="fa-field"><span>${esc(t('lang'))}</span><select class="fa-inp" name="st-lang" ${target('st-lang')}>${['RU', 'KZ', 'EN'].map((l) => `<option ${lang === l ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
      <div class="fa-card" ${target('st-profile')} style="background:var(--fa-surface)"><p class="fa-cap">${esc(t('st_profile'))}</p><p style="font-size:17px;margin-top:4px">${esc(D.client)} · <span class="fa-up">${esc(t('st_profile_ok'))}</span></p></div>
      <button class="fa-btn fa-btn-out fa-btn-block" type="button" ${target('st-update', 'data-protected="true"')} data-act="toast" data-msg="demo_action">${esc(t('st_update'))}</button>
      <label class="fa-check"><input type="checkbox" name="st-push" ${target('st-push')} ${st.form['st-push'] === false ? '' : 'checked'}>${esc(t('st_push'))}</label>
      <p class="fa-note">${esc(t('st_security'))}</p></form>`;
  },
  ticket() {
    const f = st.form;
    return `${navBar(t('s_ticket'), `<span class="fa-ico-btn">${I.mSupport}</span>`)}${seg('ticket', [['tickets', 'tk_tickets'], ['notif', 'tk_notif']])}
    <form class="fa-form" data-form="ticket" style="background:var(--fa-bg-deep);margin-top:12px">
      <textarea class="fa-area" name="tk-text" ${target('tk-text')} placeholder="${esc(t('tk_place'))}" aria-label="${esc(t('tk_place'))}">${esc(f['tk-text'] || '')}</textarea>
      <label class="fa-check"><input type="checkbox" name="tk-email" ${target('tk-email')} ${f['tk-email'] === false ? '' : 'checked'}>${esc(t('tk_email'))}</label>
      <label class="fa-check"><input type="checkbox" name="tk-sms" ${target('tk-sms')} ${f['tk-sms'] ? 'checked' : ''}>${esc(t('tk_sms'))}</label>
      <button class="fa-btn fa-btn-out fa-btn-block" type="button" data-act="toast" data-msg="soon" style="margin-top:12px">${esc(t('tk_file'))}</button>
      <button class="fa-btn fa-btn-block" type="button" ${target('tk-send', 'data-protected="true"')} data-act="send-ticket" ${(f['tk-text'] || '').trim() ? '' : 'disabled'}>${esc(t('tk_send'))}</button>
      <h2 class="fa-h2" style="margin-top:16px">${esc(t('tk_yours'))}</h2></form>
    <div class="fa-utabs" style="background:var(--fa-bg-deep)"><button type="button" aria-selected="true">${esc(t('tk_active'))} <span class="fa-count">${st.tickets}</span></button><button type="button" aria-selected="false">${esc(t('tk_closed'))} <span class="fa-count">2</span></button></div>
    <div class="fa-empty" style="background:var(--fa-bg-deep);min-height:160px">${st.tickets ? esc(t('tk_sent')) : esc(t('tk_none'))}</div>`;
  },
  contacts() {
    const rows = [['ct_name', 'Freedom Finance Global PLC'], ['ct_city', t('ct_city_v')], ['ct_street', t('ct_street_v')], ['ct_phone', '+7 7172 67 77 55'], ['ct_email', 'info@fbroker.kz'], ['ct_hours', t('ct_hours_v')]];
    return `${navBar(t('s_contacts'))}<dl class="fa-kv" ${target('ct-table')}>${rows.map(([k, v]) => `<div><dt>${esc(t(k))}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>`;
  },
  faq() {
    return `${navBar(t('s_faq'))}<div class="fa-card" style="margin:16px;padding:0 16px"><div class="fa-divide">${t('faq_q').map((q) => `<button class="fa-row" type="button" data-act="aim-ask" data-q="${esc(q)}"><span class="fa-row-main" style="font-size:16px">${esc(q)}</span><span class="fa-chev">${I.chevR}</span></button>`).join('')}</div></div>`;
  },
};

function renderTabs() {
  const nav = $('#fa-tabs');
  nav.hidden = !byId.get(st.screen).tab;
  nav.setAttribute('aria-label', t('t_menu'));
  nav.innerHTML = TABS.map((s) => `<button class="fa-tab" type="button" data-act="go" data-to="${s.id}" ${st.tab === s.id ? 'aria-current="page"' : ''}>${I[s.id]}<span>${esc(t(s.title))}</span>${s.id === 'ideas' ? '<span class="fa-tab-dot"></span>' : ''}</button>`).join('');
}
function render() {
  document.getElementById('cqa-root').dataset.screen = st.screen;
  main.innerHTML = R[st.screen]();
  renderTabs();
}

// ---------------- bottom sheets ----------------
const sheetEl = $('#fa-sheet');
function openSheet(kind) {
  const rows = kind === 'support'
    ? [['aim', I.spark, 'sh_aim', 'sh_aim_sub'], ['ticket', I.mSupport, 'sh_write'], ['faq', I.book, 'sh_faq'], ['contacts', I.pin, 'sh_contacts'], ['rate', I.star, 'sh_rate']]
    : [['exchange', I.swap.replace('viewBox', 'width="24" height="24" viewBox'), 'q_exchange'], ['withdraw', I.cardPlus.replace('viewBox', 'width="24" height="24" viewBox'), 'withdraw'], ['documents', I.mDocs, 'm_docs']];
  sheetEl.innerHTML = `<div class="fa-sheet" role="dialog" aria-modal="true" aria-labelledby="fa-sheet-t"><div class="fa-grabber"></div>
    <h2 class="fa-h2 fa-sheet-title" id="fa-sheet-t">${esc(t(kind === 'support' ? 'sh_support' : 'q_more'))}</h2>
    <div class="fa-sheet-rows">${rows.map(([id, icon, label, sub]) => `<button class="fa-sheet-row${id === 'aim' ? ' fa-sheet-row-aim' : ''}" type="button" data-sheet-go="${id}" ${id === 'aim' ? 'data-target="sh-aim"' : id === 'ticket' ? 'data-target="sh-ticket"' : ''}>${icon}
      <span class="fa-row-main">${esc(t(label))}${sub ? `<small>${esc(t(sub))}</small>` : ''}</span>${id === 'aim' ? `<span class="fa-badge-new">${esc(t('new'))}</span>` : ''}<span class="fa-chev">${I.chevR}</span></button>`).join('')}</div></div>`;
  sheetEl.hidden = false;
  sheetEl.querySelector('.fa-sheet-row')?.focus({ preventScroll: true });
}
function closeSheet() { sheetEl.hidden = true; sheetEl.innerHTML = ''; }
sheetEl.addEventListener('click', (e) => {
  if (e.target === sheetEl) return closeSheet();
  const b = e.target.closest('[data-sheet-go]'); if (!b) return;
  const to = b.dataset.sheetGo;
  if (to === 'aim') { closeSheet(); openAim(); return; }
  if (to === 'rate') { closeSheet(); toast(t('soon')); return; }
  go(to);
});

// ---------------- AIM bridge ----------------
function openAim(question) {
  const w = $('#aim-widget');
  const fab = w?.querySelector('.ag-fab');
  if (fab && !fab.hidden) fab.click();
  if (question) setTimeout(() => window.CQA?.brokerAgent?.send(question), 60);
}

// ---------------- events ----------------
let toastTimer;
function toast(text) { const el = $('#fa-toast'); el.textContent = text; el.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { el.hidden = true; }, 3200); }
document.getElementById('cqa-root').addEventListener('click', (e) => {
  const b = e.target.closest('[data-act], [data-seg], [data-idea]');
  if (!b || b.disabled) return;
  if (b.dataset.seg) { st.seg[b.dataset.seg] = b.dataset.v; render(); return; }
  if (b.dataset.idea) { st.idea = b.dataset.idea; render(); return; }
  const act = b.dataset.act;
  if (act === 'go') go(b.dataset.to);
  else if (act === 'back') goBack();
  else if (act === 'sheet') openSheet(b.dataset.sheet);
  else if (act === 'aim') openAim();
  else if (act === 'aim-ask') openAim(b.dataset.q);
  else if (act === 'toast') toast(t(b.dataset.msg));
  else if (act === 'cycle-lang') setLang({ RU: 'KZ', KZ: 'EN', EN: 'RU' }[lang]);
  else if (act === 'focus-search') go('quotes').then(() => $('[data-target="q-search"]')?.focus());
  else if (act === 'send-ticket') { st.tickets = 1; st.form['tk-text'] = ''; render(); toast(t('tk_sent')); }
});
// Form fields keep their value in st.form, so re-renders (language switch, AIM prefill + method change) don't lose input.
main.addEventListener('input', (e) => {
  const el = e.target;
  if (el.dataset.target === 'q-search') { st.q = el.value; const pos = el.selectionStart; render(); const n = $('[data-target="q-search"]'); n.focus(); try { n.setSelectionRange(pos, pos); } catch {} return; }
  if (!el.name) return;
  st.form[el.name] = el.type === 'checkbox' ? el.checked : el.value;
  if (el.name === 'tk-text') { const send = $('[data-target="tk-send"]'); if (send) send.disabled = !el.value.trim(); }
});
main.addEventListener('change', (e) => {
  const el = e.target;
  if (el.name === 'st-lang') { setLang(el.value); return; }
  if (el.name === 'dep-method') { st.form['dep-method'] = el.value; render(); }
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !sheetEl.hidden) closeSheet(); });

// ---------------- device frame: clock + fit to screen ----------------
function tick() { const d = new Date(); $('#fa-time').textContent = `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`; }
tick(); setInterval(tick, 15000);
function fit() {
  const dev = $('#ph-device');
  const s = innerWidth <= 500 ? 1 : Math.min(1, (innerHeight - 56) / 876, (innerWidth - 48) / 417);
  dev.style.setProperty('--scale', String(Math.max(0.5, s)));
}
addEventListener('resize', fit); fit();

// ---------------- boot ----------------
document.documentElement.lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[lang];
st.screen = parseHash(); if (byId.get(st.screen).tab) st.tab = st.screen;
history.replaceState(null, '', `#/${st.screen}`);
render();

// AIM host adapter: the widget asks this page about its screens, language and targets (see broker/agent-host.js).
window.AIM_HOST = {
  getLang: () => lang,
  onLang: (fn) => langListeners.add(fn),
  currentScreen: () => st.screen,
  catalog: () => SCREENS.map((s) => ({ id: s.id, title: t(s.title), summary: t(s.sum),
    targets: s.targets.map((x) => ({ id: x.id, label: t(x.label), kind: x.kind, ...(x.protected ? { protected: true } : {}), ...(x.options ? { options: x.options.map((o) => (T.RU[o] ? t(o) : o)) } : {}) })) })),
  go,
  findTarget: (id) => document.querySelector(`#cqa-root [data-target="${CSS.escape(id)}"]`),
  contentRoot: () => main,
  compact: () => true,
  apiBase: '',
  checklistUrl: '/data/checklists/freedom-chat-v1.json',
};
await import('/broker/agent.js');
window.CQA = Object.assign(window.CQA || {}, { phone: { go, openSheet, openAim, setLang, state: st } });
