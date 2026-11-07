# Freedom CQA design system

> Reverse-engineered from **https://fbroker.kz** (Freedom Broker / Freedom Инвестиции Казахстан) on 2026-11-07, then extended for a dense QA analytics tool.
> Code lives in [`design/`](../../design). Clickable reference: [`prototype/`](../../prototype). Every UI in this repo uses these tokens. No ad-hoc colors, fonts or radii (AGENTS.md §0.9).

---

## 0. How this was reverse-engineered (so anyone can redo it)

1. `curl https://fbroker.kz/` → the page is a **Nuxt** app styled with **Tailwind CSS v3** and a custom theme. One main stylesheet: `/_nuxt/entry.<hash>.css` (~80 KB) + small component CSS files.
2. Tailwind compiles each theme value into a utility class, so the theme can be read back from class names: `.bg-brand-primary{background-color:rgb(0 179 35)}` → token `brand.primary = #00B323`. Same for `text-*`, `border-*`, `rounded-*`, `text-<size>`, `shadow-*`, `duration-*`, and the responsive prefixes (`mb:`, `tb:`, `sm:`, `md:`, `lg:`).
3. Custom typography classes (`.header-1`, `.subheader`, `.text-m`, `.button-s`, `.label`) and the `@media` blocks around them give the type scale and its mobile step-down.
4. The page HTML shows how utilities combine into components (buttons, cards, tabs, floating pills).
5. Contrast was checked with the WCAG formula. Failing pairs got accessible "ink" variants (marked **CQA addition**).

Re-run: see `docs/TOOLING.md` §7. If the site changes, diff the new CSS against the token tables below.

---

## 1. Brand character

| Trait | What it looks like on fbroker.kz | Why it matters for CQA |
|---|---|---|
| **Fresh, confident green** | Gradient CTAs (violet-blue → teal → bright green), green accents on hover and focus | Green = trust + money. We reserve it for primary actions and "pass" states |
| **Airy, light surfaces** | Very light blue-white (`#F3F8FF`) and mint (`#DFF5EC`) panels on white, few hard borders | Dense QA data needs calm backgrounds so evidence and scores stand out |
| **Soft geometry** | Large radii (16–24 px), pill floating bars, round icon buttons | Friendly, "human" feel, which helps with the briefing's *people don't trust AI* problem |
| **Heavy display type, quiet body** | Headers at weight 900/700, body at regular weight, line-height 1.4–1.5 | Clear hierarchy: score → criterion → explanation → quote |
| **Atmospheric glow** | Blurred conic-gradient blobs (green/blue/cyan) behind hero sections | Use only on landing/empty states, never behind data |
| **Calm motion** | 200–500 ms color/opacity transitions, ease-out, brightness on hover | Feedback without distraction for reviewers who scan all day |

---

## 2. Color

### 2.1 Brand
| Token | Hex | Source class | Use |
|---|---|---|---|
| `brand-primary` | `#00B323` | `bg/text/border-brand-primary` | Focus rings, active borders, icons, hover text. **Not for small text on white (2.8:1)** |
| `brand-secondary` | `#13AD64` | `brand-secondary` | Secondary green, hover borders, tinted fills at 20% |
| `brand-additional` | `#00E183` | `brand-additional` | Bright mint on dark backgrounds (10.8:1 on `#0C1411`) |
| `brand-accent` | `#FFA700` | `bg/fill-brand-accent` | Highlights, badges, "attention" icons |
| `brand-tertiary` | `#FF3A38` | `bg-brand-tertiary` | Promo red. In CQA: **gross-error flag** |

### 2.2 Text
| Token | Hex | Contrast on white | Use |
|---|---|---|---|
| `text-primary` | `#323335` | 12.7 ✔ | Body, headings, text on gradient buttons |
| `text-tertiary` | `#6A788A` | 4.5 ✔ (AA, just) | Secondary text, captions, meta |
| `text-secondary` | `#B2BCC8` | 1.9 ✖ | Placeholders, disabled, decorative only |
| `text-neutral` | `#E7E7EA` | n/a | Text on dark surfaces, borders |
| `link-blue` | `#0066CC` | 5.6 ✔ | Inline links in long text |

### 2.3 Surfaces and lines
| Token | Hex | Use |
|---|---|---|
| `bg-white` | `#FFFFFF` | Page and cards |
| `bg-primary` | `#F3F8FF` | Default panel / card fill, table header, hover |
| `bg-secondary` | `#DFF5EC` | Mint panel; hover on secondary buttons; "pass" tint |
| `bg-warning` | `#FFF8D5` | Warning banner; "appeal open" tint |
| `state-hover-light` | `#EDF4FF` | Row hover |
| `divider-primary` | `#F0F2F5` | Hairlines, table dividers |
| `gray-secondary` | `#F5F5F5` | Neutral chip fill |
| `gray-primary` | `#C6DCFF` | Selected/active light blue |
| `icon-primary` / `icon-secondary` | `#323335` / `#B2BCC8` | Icons |
| `overlay` | `rgba(0,0,0,.4)` | Modal scrim (`bg-bg-overlay`) |
| `blur` | `rgba(0,0,0,.8)` + backdrop-blur | Full-screen menus |

### 2.4 States
| Token | Hex | Text-safe ink (CQA addition) | Use in CQA |
|---|---|---|---|
| `state-success` | `#4FB446` | `success-ink #00801F` (5.1) | "Yes", passed criterion, high score |
| `state-error` | `#EE5555` | `error-ink #C93A3A` (5.1) | "No", failed criterion, low score |
| `state-notify` | `#F9B000` | `notify-ink #8A6200` (5.5) | Appeal pending, partial scale score |
| `text-secondary` | `#B2BCC8` | `text-tertiary #6A788A` | **N/A** (neutral, not a failure) |
| `brand-tertiary` | `#FF3A38` | `error-ink` | **Gross error** (criterion 08), always with an icon + label |

Rule: never use color alone for meaning. Every score state also has an icon and a text label (✓ Да, ✕ Нет, — N/A, ! Грубая ошибка).

### 2.5 Dark surfaces (site uses them for footer, hero, menus)
`dark-primary #0C1411` (deepest green-black), `bg-dark #1D1D1B`, `bg-cell #424245`, `divider-secondary #424245`, text `#FFFFFF` / `text-neutral #E7E7EA` / `text-secondary #B2BCC8`, accent `brand-additional #00E183`. Our tokens ship a `[data-theme="dark"]` set built from these, but **the CQA app is light by default** (D365 is light).

### 2.6 Gradients
| Token | Value | Use |
|---|---|---|
| `gradient-brand` | `linear-gradient(91deg, #7D8DEE -1.79%, #1CCC9E 25.51%, #1AE276 82.98%)` | Primary CTA fill, active tab indicator, progress |
| `gradient-brand-alt` | `linear-gradient(91deg, #99A6F9 -2%, #1CCC9E 26%, #1AE276 62%, #80FF61 90%)` | Hero highlights, score ring at 100 |
| `gradient-brand-light` | `linear-gradient(90deg, #00F26029, #04D4C829)` | Soft highlight band (evidence highlight in transcript) |
| `gradient-overlay` | `linear-gradient(90.64deg, #7EAFE50D, #1CCC9E0D, #1AE2760D, #4BD6290D)` | Very subtle section wash |
| Glow blobs | `conic-gradient(from 180deg, #00CF60, #3586EA 50deg, #23C5FF 187deg, #13DB4B 311deg)` + `blur(100–175px)`, opacity .25–.6 | Landing / empty states only |

Text on `gradient-brand` is **`text-primary` (dark)**, not white. The site does this (`!text-text-primary`), and it gives 6–7:1.

---

## 3. Typography

**Font:** `CoFo Sans` variable (100–900), Contrast Foundry, **licensed**, not redistributable. We use **Inter** (variable, full Cyrillic + Kazakh: ә ғ қ ң ө ұ ү һ і) as the stand-in with the same metrics feel. If Freedom provides CoFo Sans, swap `--cqa-font-sans` only.

Stack: `"CoFo Sans", "Inter", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif` · mono: `ui-monospace, SFMono-Regular, Menlo, Consolas, monospace` (timestamps, IDs).

### 3.1 Marketing scale (landing, pitch), from the site
| Class | Desktop | ≤991 px | Weight | Line-height |
|---|---|---|---|---|
| `header-1` | 84 | 48 | 900 | 1.2 |
| `header-2` | 60 | 32 | 900 | 1.2 |
| `header-3` | 36 | 32 | 700 | 1.2 |
| `header-4` | 28 | 24 | 700 | 1.2 |
| `subheader` | 24 | 20 | 500 | 1.4 |
| `text-l` | 20 | 18 | 400 | 1.5 |
| `text` | 18 | 16 | 400 | 1.5 |
| `text-m` | 16 | 14 | 400 | 1.5 |
| `text-s` | 14 | 12 | 400 | 1.4 |
| `label` | 12 | 12 | 500 | 1.4 |
| `button-l / button / button-m / button-s` | 20 / 18 / 16 / 14 | n/a | 600 | 1.4 |

### 3.2 App scale (CQA tool, dense): **CQA addition**, same rhythm one step smaller
| Token | Size / LH | Weight | Use |
|---|---|---|---|
| `app-title` | 28 / 1.2 | 700 | Page title |
| `app-h2` | 20 / 1.3 | 700 | Panel title |
| `app-h3` | 16 / 1.4 | 600 | Criterion name, card title |
| `app-body` | 14 / 1.5 | 400 | Default text, transcript |
| `app-small` | 12 / 1.4 | 500 | Meta, chips, table header (uppercase +.02em tracking) |
| `app-score` | 40 / 1 | 900 | Big total score |

Numbers use `font-variant-numeric: tabular-nums` so scores align.

---

## 4. Spacing, layout, breakpoints

- **Base unit 4 px.** The site uses numeric px utilities (`gap-12`, `p-24`, `px-40`), so our spacing tokens are literal px: 2, 4, 8, 12, 16, 20, 24, 28, 32, 40, 48, 64.
- **Container:** max-width **1340 px**, side padding **40 px** (16 px ≤991 px). Our app shell: sidebar 248 px + content.
- **Breakpoints (site's custom names):**

| Name | Query | Meaning |
|---|---|---|
| `mb` | `width ≤ 500px` | phone |
| `tb` | `501–991px` | tablet |
| `sm` | `width ≤ 991px` | "small" = phone + tablet |
| `md` | `992–1200px` | small laptop |
| `lg` | `width ≥ 992px` | desktop |

The Tailwind preset reproduces these names, so classes copied from the site work as they are. The D365 iframe can be ~800 px wide, so **every app screen must work at `tb`**.

---

## 5. Shape and elevation

**Radii:** 4, 8, 12, 16, 20, 24, 28, 32, 40, full.
| Element | Radius |
|---|---|
| Buttons, inputs, large cards, panels | **20** (site's signature) |
| Content cards, modals | 16–24 |
| Chips, small controls, menu items | 12 |
| Tags, icon tiles, progress bars | 8 |
| Floating pills, avatars, FAB | full |

**Shadows:** the site is mostly flat (fills, not shadows).
| Token | Value | Use |
|---|---|---|
| `shadow-default` | `0 5px 15px #00000014` | Cards that float over content, FAB |
| `shadow-elevated` | `8px 12px 40px rgba(3,9,17,.2)` | Modals, drawers, popovers |
| `shadow-glow` | `8px 12px 40px rgba(45,213,119,.2)` | Hover on the primary CTA / selected score card |
| `shadow-sm` | `0 1px 2px #0000000d` | Sticky headers on mobile |

Borders: 1–2 px, `divider-primary` by default. **Hover pattern:** `border-2 border-transparent → border-brand-primary` (cards).

---

## 6. Motion

| Token | Value | Use |
|---|---|---|
| `duration-fast` | 150 ms | Transforms on small controls |
| `duration-base` | 200 ms | Hover color, focus ring |
| `duration-medium` | 300 ms | **Default** (site uses it most): color, opacity, border |
| `duration-slow` | 500 ms | Tab indicator slide, panel open |
| `duration-score` | 1000 ms | Score ring / number count-up |
| `ease-out` | `cubic-bezier(0,0,.2,1)` | Entering elements |
| `ease-standard` | `cubic-bezier(.4,0,.2,1)` | Moves, transforms |
| `ease-emphasized` | `cubic-bezier(.2,0,0,1)` | Drawer / evidence jump (CQA addition) |

Patterns taken from the site:
- **Buttons:** `hover: brightness(1.1)`, `active: brightness(.9)`, 300 ms. Secondary: background fades to `bg-secondary`.
- **Cards:** border fades to brand green on hover (300 ms); icons switch to `brand-primary`.
- **Tabs:** a 4 px **gradient bar** slides under the active tab (500 ms).
- **Reveal:** elements rise 8–40 px with opacity (`translate-y`), 500 ms ease-out, optional 200 ms stagger.
- **Loading:** `pulse` skeleton (2 s) and a spinner (1 s linear).

CQA additions:
- **Evidence jump:** scroll the transcript smoothly to the message, then flash a `gradient-brand-light` highlight (1.2 s fade) with a 2 px brand-primary left bar that stays.
- **Score recalculation** (after an appeal): number counts from the old value to the new one (1 s), and the ring re-draws. The delta chip (`+3.75`) fades in.
- **Evaluation running:** criteria rows appear one by one (60 ms stagger) as results stream.
- All motion respects `prefers-reduced-motion: reduce`: transitions drop to 0–1 ms and there's no count-up.

---

## 7. Iconography

The site uses inline SVG icons with `stroke`/`fill` utilities (stroke 1.5–2 px, 24 px grid, rounded joins), recolored on hover. We follow the same: inline SVG, `currentColor`, 20/24 px, stroke 1.75. Source: any MIT set with the same feel (e.g. Lucide); log the choice in `docs/TOOLING.md`.

---

## 8. Components (in `design/components.css`, prefixed `cqa-`)

| Component | Anatomy / variants | Origin |
|---|---|---|
| **Button** `cqa-btn` | `--primary` (gradient-brand, dark text), `--secondary` (white, hover mint), `--ghost` (transparent), `--danger` (error-ink outline), `--on-dark` (white border); sizes `--s` (36 h), default (44 h), `--l` (56 h); radius 20; `--icon` round | site CTAs |
| **Card / Panel** `cqa-card` | `--tint` (bg-primary), `--mint`, `--interactive` (2 px border → green on hover), `--elevated` | site cards |
| **Badge / Chip** `cqa-badge` | `--pass`, `--fail`, `--na`, `--partial`, `--gross`, `--appeal`, `--neutral`, `--lang` (RU/KZ/EN), `--channel` | CQA |
| **Input / Select / Textarea** `cqa-input` | 44 h, radius 12, `divider` border → `brand-primary` on focus, placeholder `text-secondary` | site forms |
| **Switch / Segmented** `cqa-switch`, `cqa-seg` | Yes/No/N/A segmented control for reviewer decisions | CQA |
| **Tabs** `cqa-tabs` | text tabs with a sliding 4 px gradient indicator | site tabs |
| **Table** `cqa-table` | sticky header in bg-primary, 12 px uppercase head, row hover `state-hover-light` | CQA |
| **Score ring** `cqa-score` | conic progress ring, gradient at ≥85, notify at 60–84, error <60, "—" when not calculable | CQA |
| **Criterion row** `cqa-crit` | name · answer badge · points/weight · explanation · evidence link(s) · appeal action | CQA |
| **Transcript bubble** `cqa-msg` | `--client` (left, bg-primary), `--operator` (right, mint), `--bot` (left, dashed border + "бот" tag), `--system` (centered, small, gray); timestamp mono; `.is-evidence` highlight | CQA |
| **Audio player** `cqa-player` | native `<audio>` + seek to timestamp from evidence | CQA |
| **Drawer** `cqa-drawer` | right side panel, shadow-elevated, radius 24 left corners; appeal and review flows | CQA |
| **Toast** `cqa-toast` | bottom pill, dark (bg-dark) with mint icon | site pill |
| **Empty state** `cqa-empty` | glow blob + header-4 + one CTA | site hero |
| **Skeleton** `cqa-skeleton` | pulse in bg-primary | site |

Every component has: default, hover, focus-visible (2 px `brand-primary` ring, 2 px offset), active, disabled (`opacity .5`, no pointer), loading where it applies.

---

## 9. CQA UX patterns (how screens use the system)

1. **Evidence before verdict.** Each criterion shows the quote it relies on. One click jumps to and highlights the message (or seeks the call audio). This is the answer to "people don't trust AI": show the receipts.
2. **Three answer states look different:** Да (success), Нет (error), N/A (neutral gray, with *why* N/A). N/A is never red.
3. **Gross errors stand apart:** a red banner at the top of the card, with no points. It doesn't sink into the total.
4. **Human in the loop is visible:** original score → appeal → reviewer decision → final score, as a timeline in the card. The AI result is labeled "Автооценка" and the human one "Решение проверяющего".
5. **Weights are explicit:** `15 / 15` points, plus an "effective weight after N/A" tooltip, so the math is auditable.
6. **Checklist editor = live config:** edit, save → version++ → "Re-apply to N dialogs" CTA. Built for the defense moment where a criterion gets replaced.
7. **Language-aware:** RU/KZ/EN chip on every dialog; quotes stay in their original language; UI chrome is RU by default.
8. **Dense but calm:** 14 px base, white + `bg-primary` surfaces, green only where it means something.

---

## 10. Using it

- **Plain HTML (prototype, D365 web resource):** link `design/tokens.css`, `design/components.css` and `design/motion.css`, then wrap the app in `<div id="cqa-root" class="cqa">`.
- **Tailwind v3:** `presets: [require('../design/tailwind.preset.js')]` → `bg-brand-primary`, `text-text-tertiary`, `rounded-20`, `mb:hidden`, `bg-gradient-brand`, `shadow-elevated`, `duration-300`…
- **Tailwind v4:** `@import "tailwindcss"; @import "../design/theme.css";`
- Tailwind preflight: scope it (`important: '#cqa-root'`, or disable preflight and use `cqa` base styles) so the D365 host page isn't reset.
- Don't add a token without updating this doc + `tokens.css` + `tailwind.preset.js` + `theme.css` together (one commit).
