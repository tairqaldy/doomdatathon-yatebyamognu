# Official Freedom Broker iOS app: what it looks like (for the phone demo)

> Captured 2026-11-07 from the live **Freedom Broker** iOS app, **v32.23.17** (App Store id 1558692227, seller Freedom Finance Global PLC), on an iPhone 14/15 Pro through macOS iPhone Mirroring. Read-only browsing: no orders, deposits, withdrawals or settings changes.
> Purpose: build a phone-frame demo page that shows the AIM widget inside a faithful copy of the real app, with **mock data only** (issue #20).
> Raw captures are **not in git**: they show a real client name, account numbers and balances. Everything below is described in text and tokens.

The app is **not** styled like fbroker.kz (`design-system.md`). The website is light and green. The app is a **dark navy, blue-accent** iOS app. It is probably built on the Tradernet platform: «Tradernet by Freedom Finance» ships the same version number, 32.23.17. The phone demo must follow this file, not the website tokens.

The App Store screenshots are about three years old (dark grey, 4 tabs, charts dated 2022). Don't copy them.

---

## 0. How this was captured (so anyone can redo it)

1. iPhone Mirroring open on the Mac, app logged in by the account owner.
2. Find the mirroring window: `CGWindowListCopyWindowInfo` filtered by the `iPhone Mirroring` PID; the phone window is the ~318×701 pt one.
3. Grant **Screen Recording** to the bundled Claude Code binary (`~/Library/Application Support/Claude/claude-code/<ver>/<hash>/claude.app`). Claude.app launches it through a `disclaimer` helper, so granting Claude.app alone is not enough.
4. Capture: `screencapture -l <windowId> -o -x frame.png` gives a 2x Retina frame (636×1402). A loop every 1.5 s that keeps only changed frames (md5) records a whole click-through. The owner taps; the mirrored screen is a video surface with no accessibility elements, so it can't be tapped by AX tools.
5. Colors: dominant color per region plus the most frequent far-from-background "ink" pixel (small CoreGraphics scripts). Mirroring compression shifts values by about ±1–2, so values are snapped to the obvious design token where one matches.
6. Measurements: the phone screen is 604×1309 px in the capture, which maps to **393×852 pt** (1.537 px/pt). All sizes below are iOS points.

---

## 1. App shell

| Part | What it is |
|---|---|
| Device | 393×852 pt, Dynamic Island, status bar 54 pt, home indicator inside the 83 pt tab bar |
| Theme | Dark only in this capture. Screen background `#171D2D` |
| Font | iOS system font (SF Pro). Web: `-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, sans-serif` |
| Tab bar | **6 tabs**, icon above label, 83 pt tall (49 + 34 home area), background `#171D2D`, 1 px top line `#242830` |
| Tabs | **Котировки** (bars icon) · **Портфель** (pie) · **Крипто** (₿) · **Идеи** (light bulb, red dot `#DC2626` when unread) · **Счета** (bank columns) · **Меню** (3×3 dots) |
| Tab colors | active icon + label `#3D83F7`, inactive icon `#9CA3AF`-ish grey, inactive label grey; label ~10 pt |
| Build tag | `32.23.17` printed vertically in tiny grey text at the right edge above the tab bar |

### Top bars (differ per tab)
| Tab | Top bar |
|---|---|
| Котировки, Идеи | Search field «Поиск по тикеру» (magnifier left), 39 pt tall, 16 pt side inset, fill `#1A2536`, radius ~12 pt, placeholder grey `#9CA3AF`. **Chat icon** (two speech bubbles, `#3D83F7`) at the right |
| Портфель | Search icon (left, blue) · account switcher pill «KZ #XXXXXXX ⌄» (fill `#1A2536`, centered) · settings gear (right, blue) |
| Счета | Title «Счета» centered, white, on a **deep blue header** `#011D57` with faint diagonal light streaks; content sits in a sheet with rounded top corners below it |
| Меню | Language chip (flag + «RU») left, QR-code icon right (blue) |
| Крипто | none: full-bleed promo |

---

## 2. Palette

Most values match **Tailwind's default palette** exactly or within capture noise, so the app's tokens are probably Tailwind colors.

| Token (proposed) | Value | Seen as | Tailwind match |
|---|---|---|---|
| `fa-bg` | `#171D2D` | screen, tab bar, cash card, menu rows | custom navy |
| `fa-bg-deep` | `#121828` | Идеи feed background (slightly darker) | custom |
| `fa-surface` | `#1A2536` | search field, account pill, lower panel on Портфель, language/account chips | custom |
| `fa-surface-2` | `#212838` | instrument card inside an idea; outline button `#212C3B` | custom |
| `fa-input` | `#0F131F` | text area fill (support form) | custom |
| `fa-backdrop` | `#121521` | blurred, darkened screen behind a bottom sheet | custom |
| `fa-disabled` | `#2C3444` / text `#6A7181` | disabled button; also input borders | custom |
| `fa-grabber` | `#4D5464` | bottom-sheet grabber | custom |
| `fa-segment-track` | `#474D5D` | segmented control track | custom |
| `fa-segment-thumb` | `#2C3444` | segmented control selected thumb | custom |
| `fa-blue-deep` | `#0D2E64` | promo card «Долгосрочные размещения», selected account row, icon tiles, «Все новости» pill, inactive chips | custom |
| `fa-blue-header` | `#011D57` | Счета header | custom |
| `fa-blue-secondary` | `#134293` | secondary button «Вывести» | custom |
| `fa-blue` | `#3D83F7` → use `#3B82F6` | primary buttons, active tab, icons, active chip, «Текущий» tag | **blue-500** |
| `fa-blue-light` | `#60A5FA` | € coin, small accents | **blue-400** |
| `fa-text` | `#FFFFFF` | headings, balances | white |
| `fa-text-2` | `#E5E7EB` | body rows, labels on dark | **gray-200** |
| `fa-text-3` | `#9CA3AF` | placeholder, hint paragraphs, segment labels | **gray-400** |
| `fa-text-4` | `#6B7280` | chevrons, meta («2 часа назад», «12 месяцев») | **gray-500** |
| `fa-line` | `#242830` / `#383D4D` | tab bar top line / list dividers | custom |
| `fa-up` | `#22C55E` | $ coin, positive % (text renders ~`#25B15A`) | **green-500** |
| `fa-down` | `#DC2626` → text ~`#E22F30` | negative %, ▼ | **red-600** |
| `fa-dot` | `#F43F5E` | unread dot on «Обзоры рынка» chip | **rose-500** |
| `fa-bar-up` / `fa-bar-down` | `#4CAF50` / `#F44336` | allocation bar on Счета (Material green/red) | Material |

---

## 3. Type scale (pt, SF Pro)

| Use | Size / weight | Example |
|---|---|---|
| Big balance | ~34 / bold | «$0.00», «$559.83» |
| Screen heading | ~28 / bold | «Инвестиционные идеи» |
| Card / section title | 20 / semibold | «Долгосрочные размещения», «Денежные средства», «Freedom Broker» |
| News headline (hero) | 20 / semibold, white on photo gradient | Котировки hero |
| List headline | 17 / semibold | news items, idea titles |
| Row label | 17 / regular | menu rows «Поддержка» … |
| Body / button | 15–16 / medium | «Пополнить», chips |
| Caption / meta | 12–13 / regular, grey | «Оценка чистых активов», «9 минут назад» |
| Tab label | 10 / medium | tab bar |

---

## 4. Components

| Component | Spec |
|---|---|
| **Segmented control** | full width minus 16 pt insets, ~30 pt tall, track `#474D5D` at low opacity over bg (reads `#2C3444`/`#474D5D`), selected thumb `#2C3444` with white label, others grey, thin vertical dividers. Used for Портфель / Приказы / Сделки and Инвестиции / Банк / Крипто |
| **Primary button** | fill `#3B82F6`, white 16 pt medium label, height 44 pt, radius ~10 pt. Pair with secondary `#134293` + blue label, 12 pt gap (Меню: Пополнить / Вывести) |
| **Quick actions** | 3 columns of blue line icon + white label: «Пополнить», «Обменять», «Еще» (Портфель) |
| **Promo card** | `#0D2E64`, radius ~12 pt, 16 pt padding, white 20 pt title, grey sub «Разместить средства под 6.3% годовых», chevron right, overlapping € (`#60A5FA`) and $ (`#22C55E`) coins |
| **Money card** | `#171D2D` on `#1A2536` panel, title + rows: 36 pt icon tile `#2C446E` with blue $ glyph, «USD», amount right, chevron |
| **Menu row** | 52 pt pitch, 36 pt rounded icon tile `#0D2E64` with blue glyph, 17 pt label, grey chevron. Rows: Поддержка · Поручения · Пригласить друга · Отчеты и документы · Бонусы · Настройки |
| **Filter chips** | pill, ~32 pt tall. Active: `#3B82F6` fill, white text. Inactive: `#0D2E64` fill, blue text. Unread dot `#F43F5E` on the top-right |
| **News hero** | full-width photo with bottom dark gradient, source badge pill («Oninvest», `#303745`), white headline, grey byline |
| **News row** | ticker + coloured % with ▲/▼, 17 pt headline, byline with 👁 view count, square thumbnail (right or left), divider |
| **Index row** | flag circle, name + code («Индекс S&P 500 / SPX.IDX»), price right, change in green/red under it; optional sparkline chart with «Вырастет» (green) / «Упадет» (red) mini buttons |
| **Idea card** | avatar + analyst name + role, bold headline, image, instrument strip (logo, ticker, potential % green, «NYSE \| company», horizon «12 месяцев»), likes / views / time |
| **Account row** | «FFG #XXXXXXX» + «Текущий» blue pill tag, amount right; selected row fill `#0D2E64`. Savings row sub-line «Накопительный счет - 3.94% USD, 2.41% EUR, 16.55% KZT» |
| **Allocation bar** | 8 pt rounded bar, green part + red part |
| **Empty state** | centered line icon (blue), grey text, link-style chips «С начала месяца», «С начала года», «Укажите период», «Все фильтры» |
| **Bottom sheet** | backdrop = blurred, darkened screen (reads `#121521`), sheet `#171D2D` with ~16 pt top radius, grabber 60×4 pt `#4D5464`, 20 pt semibold title, rows as cards (below) |
| **Sheet row card** | `#1A2536`, radius ~10 pt, 56 pt tall, 8 pt gap, 16 pt insets, blue glyph (no tile) + 17 pt white label + grey chevron |
| **Push nav bar** | «← Назад» blue `#3B82F6` 17 pt left, 17 pt semibold white title centered, optional right icons (mail, ⋮) |
| **Text area** | fill `#0F131F`, 1 px border `#2C3444`, radius ~8 pt, ~140 pt tall, placeholder `#606573` |
| **Checkbox** | 20 pt rounded square; on = `#3B82F6` fill + white tick, off = 1.5 px blue-grey border; 15 pt label |
| **Outline button** | «Выберите файл»: fill `#212C3B`, 1 px border `#2C3444`, white 17 pt label, 48 pt tall |
| **Disabled button** | fill `#2C3444`, label `#6A7181` («Отправить» until text is entered) |
| **Underline tabs** | «Активные 0 / Закрытые 2»: active label blue + 2 pt blue underline, count badge pill (blue for active, `#394050` for inactive) |
| **Key/value table** | Контакты: grey label left (13 pt), white value right (15 pt), hairline dividers, rounded group `#171D2D` on `#121828` |
| **Rate modal** | full-screen starfield/space background, Freedom Broker logo (green F + white «FREEDOM BROKER»), «Оцените приложение», two round glass buttons «Есть вопросы» (thumb down) / «Нравится» (thumb up), «Отменить» top left |

---

## 5. Screen inventory

| # | Screen | Key content (mock it like this) |
|---|---|---|
| 1 | **Котировки** (default) | search + chat icon · news hero · 2 news rows · «Все новости ›» pill · **Индексы** list (S&P 500, Dow Jones, NASDAQ, DAX, FTSE, KASE, HSI, CAC 40, «Развитые страны», «Развивающиеся страны» bond indices) with sparkline cards · **Мои списки** (Избранное, «+ Новый список», empty state «Ваш список пуст», button «Добавить +») |
| 2 | **Портфель / Портфель** | account pill · «Оценка чистых активов» + balance ⌄ · quick actions · promo «Долгосрочные размещения» · «Денежные средства» USD row · empty hint «Пополните свой счет уже сейчас…» |
| 3 | Портфель / Приказы | chip «Предыдущие 7 дней», empty state «Ничего не найдено по выбранным фильтрам…» + period chips |
| 4 | Портфель / Сделки | empty state «Нет информации о сделках по указанным параметрам» + button «Сменить настройки +» |
| 5 | **Крипто** | purple/blue galaxy promo «Открыть криптовалютный счет в Freedom Broker», 3 benefit rows (100+ инструментов · Торги 24/7 · Вывод на свой кошелек), button «Открыть счет» |
| 6 | **Идеи** | promo banner (Freedom bonds 8.5%) · chips Инвестидеи / Обзоры рынка / Подборки · heading «Инвестиционные идеи», «Идей рекомендовано: 4005» · idea cards |
| 7 | **Счета** | blue header · «Общие активы $…» · allocation bar · Инвестиции / Банк / Крипто segments · «Freedom Broker» section · account rows |
| 8 | **Меню** | language + QR · avatar · «Счет #… ⌄» chip · client name · «Моя визитка» · Пополнить / Вывести · menu rows |
| 9 | **Меню → Поддержка** (bottom sheet) | over a blurred Меню: «Поддержка» + rows **Написать в поддержку** · **FAQ** · **Контакты** · **Оцените приложение** |
| 10 | Поддержка → Написать в поддержку | push screen «← Назад · Поддержка» (mail + ⋮ icons), segments **Тикеты / Уведомления**, text area «Опишите возникшую у Вас проблему или пожелание», ☑ «Отправить копию ответа на Email», ☐ «Уведомить об ответе по SMS (услуга платная)», «Выберите файл», disabled «Отправить», «Ваши обращения» with «Активные 0 / Закрытые 2» |
| 11 | Поддержка → FAQ | push screen «FAQ», loads a web view («Загрузка…») |
| 12 | Поддержка → Контакты | key/value table: Название «Freedom Finance Global PLC» · Город «г. Астана» · Улица «район Есиль, улица Достык, здание 16, внп. 2 (Talan Towers)» · Номер телефона «+7 7172 67 77 55» · E-mail «info@fbroker.kz» · Часы работы «09:00 - 21:00 (по времени г. Астана)» (public company data, fine to reuse) |
| 13 | Поддержка → Оцените приложение | rate modal (see components) |
| – | not captured yet | instrument page (e.g. AAPL.US), and what the top-right chat icon on Котировки opens |

---

## 6. Where AIM goes (proposal)

**What support looks like today:** «Написать в поддержку» is an **asynchronous ticket form**. The client describes the problem, picks email/SMS for the reply, attaches a file and waits («Ваши обращения: Активные / Закрытые»). There is no instant answer anywhere in the app. That's the gap AIM fills, and it's a strong line for the pitch.

The app already has the entry points. Using them makes the widget look native, not bolted on.

1. **Меню → Поддержка sheet**: add one row at the **top** of the existing sheet, above «Написать в поддержку»: «AIM · ответ сразу» with a blue sparkle glyph, same row-card style. Tapping it opens AIM as a full-height sheet in the same style (grabber, `#171D2D` sheet, `#1A2536` input, blue send button).
2. **Hand-off to a human = the existing ticket form.** When AIM can't solve it, or the client asks for a person, AIM offers «Передать специалисту». That opens «Написать в поддержку» with the text area pre-filled with a summary of the conversation. This is the bot → human hand-off from the briefing, built on a screen Freedom already has.
3. **Chat icon (top right of Котировки / Идеи)**: open the same AIM sheet. Not captured yet, so we don't know what it opens today. In the demo it opens AIM.
4. **Optional floating button**: only if judges need it to be obvious. 52 pt blue circle above the tab bar, bottom right. Hide it while the sheet is open.

AIM's navigation actions (`open_screen`, `highlight`, `prefill`, see #14 / #19) map to the 6 tabs and the sub-tabs above: switch tab, switch segment, scroll to and pulse a row (e.g. «Отчеты и документы»), open «Пополнить». Protected actions (deposit, withdraw, buy) stay client-pressed, as in `broker/`.

`broker/agent.css` is already scoped and themeable through `--aim-*` (#17), so the dark theme should only need token overrides.

---

## 7. Demo page (built in #21: `/phone/`)

- **Desktop / projector**: page with one iPhone frame (393×852 pt screen, Dynamic Island, status bar with fixed time) centered. The mock app renders inside at 1:1 CSS pixels. Optionally a side caption explaining what AIM just did.
- **Real phone**: the same URL, but below ~500 px wide the frame drops and the app fills the viewport (`viewport-fit=cover`, safe-area insets).
- Mock data only: invented client «Демо Клиент», account «KZ #DEMO001», plausible balances and positions.
- Static HTML/CSS/JS, no new dependencies, same rules as `broker/`.
- **Expo Go** (optional): a React Native shell that loads the same page in a WebView, to show it running as a native app on a phone. Only if time allows.

---

## 8. Gaps / next capture

- Instrument page (chart, order buttons), what the Котировки chat icon opens, «Отчеты и документы», «Настройки». Поддержка was captured in a second pass (screens 9–13).
- Light theme (if the app has one): check Настройки.
- KZ / EN language variants of tab labels.
