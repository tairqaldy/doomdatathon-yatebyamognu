#!/usr/bin/env node
// Freedom CQA demo video: a captioned, silent screen recording of the real product. Zero npm dependencies:
// Node 22 (global fetch + WebSocket), Google Chrome, /usr/bin/swift (AVFoundation, macOS).
//
//   node scripts/demo/record.mjs
//
// 1. Uses the local mirror of production on :3201 (starts scripts/dev-server.mjs if nothing answers there).
// 2. Launches headless Chrome and drives it over the DevTools Protocol (CDP) at 1440×900, DPR 1.
// 3. Injects a visible cursor and a caption bar into every page, then walks the defense script:
//    support chat → overview → gross errors → dialog card → appeal + decision → call audio → checklist → AI analyst → end card.
// 4. Grabs JPEG frames with Page.startScreencast on a clock that stops during long AI waits, so the video shows
//    a short "в видео ускорено" moment instead of 40 s of spinner.
// 5. scripts/demo/encode.swift (AVAssetWriter) writes H.264 at 24 fps with a bitrate that keeps the file under 12 MB.
// Output: landing-tair/assets/demo.mp4, landing-tair/assets/demo-poster.jpg, docs/media/*.jpg (README stills).
//
// Flags: --base <url>  app to record (default http://localhost:3201)
//        --keep        keep the raw frames (path is printed)
//        --no-encode   record and keep frames, skip the MP4
//        --snaps <dir> also save a debug screenshot at every caption
// Paid AI calls per run: two AIM replies, one evaluation (≈ $0.008, ≈ 45 s), one analyst answer. Re-runs mostly hit the cache.
import { spawn, spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const argv = process.argv.slice(2);
const has = (n) => argv.includes(`--${n}`);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const BASE = opt('base', 'http://localhost:3201').replace(/\/$/, '');
const SNAPS = opt('snaps', '');
const W = 1440, H = 900, FPS = 24;
const CDP_PORT = 9333;
const MAX_BYTES = 12_000_000;         // hard limit for the landing page
const TARGET_BYTES = 10_800_000;      // what the bitrate is sized for (the encoder overshoots a little)
const STILL_MAX = 250 * 1024;
const OUT_MP4 = path.join(ROOT, 'landing-tair/assets/demo.mp4');
const OUT_POSTER = path.join(ROOT, 'landing-tair/assets/demo-poster.jpg');
const MEDIA = path.join(ROOT, 'docs/media');
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const SWIFT = existsSync('/usr/bin/swift') ? '/usr/bin/swift' : 'swift';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/* ── captions: plain Russian, one idea each (keep this list as the single place to edit copy) ─────────── */
const C = {
  hero: 'Freedom CQA проверяет качество разговоров поддержки Freedom Broker',
  toSupport: 'Сначала глазами клиента: он пишет в поддержку',
  ask: 'Клиент спрашивает, где посмотреть тариф',
  answered: 'AIM отвечает сам: такой ответ уже давали операторы Freedom',
  askHuman: 'Клиент хочет сменить тариф и просит живого специалиста',
  handoff: 'AIM передаёт чат специалисту и говорит, сколько ждать',
  overview: (n, chats, calls) => `Консоль контроля качества: ${n} диалогов, ${chats} чатов и ${calls} звонков`,
  kpis: 'Сверху главное: средний балл, сколько проверено, сколько грубых ошибок',
  loss: '«Где теряем баллы»: сколько баллов в среднем снимает каждый критерий',
  dist: 'Рядом распределение итогов: диалоги ниже 60 разбираем первыми',
  toGross: 'Открываем все диалоги с грубыми ошибками',
  gross: (n) => `${n} ${plural(n, ['диалог', 'диалога', 'диалогов'])} с грубой ошибкой. У каждого причина и реплика оператора`,
  pick: 'p1-ru-009: оператор сообщил об ограничении на счёте до проверки личности',
  card: 'Карточка диалога: дорожка разговора, расшифровка и оценка',
  score: 'Итог из 100 и баллы по каждой секции чек-листа',
  reasons: '«Причина снижения оценки»: за что сняты баллы',
  jump: 'Клик по цитате прокручивает расшифровку и подсвечивает реплику',
  na: 'N/A: критерий не применим, AI пишет почему. Его вес делится между остальными',
  appeal: 'Оценщик не согласен с баллом за эмпатию и подаёт апелляцию',
  role: 'Переключаемся на роль проверяющего',
  review: 'Проверяющий видит спорный балл, комментарий и фрагмент диалога',
  change: 'Он меняет «Нет» на «Да» и пишет причину. Итог виден до сохранения',
  after: 'Итог пересчитан. В карточке автооценка, решение и новый итог',
  toCall: 'Звонки проверяются по тем же правилам, по расшифровке речи',
  call: 'Звонок: дорожки клиента и оператора, метки снижений и запись',
  mark: 'Клик по метке переносит запись к моменту, где сняты баллы',
  audio: (t) => `Запись играет с ${t}. Звука в этом видео нет`,
  audioFail: 'Клик по метке переносит запись к моменту, где сняты баллы',
  checklist: 'Чек-лист хранится как данные и меняется прямо здесь',
  edit: 'Уточняем формулировку критерия «Установление контакта»',
  weight: 'Вес «Управления диалогом» снижаем с 15 до 5',
  add: 'Добавляем новый критерий «Назвал срок ответа» с весом 10',
  diff: 'Перед сохранением видно все изменения. Сумма весов 100',
  mode: 'Все чаты пересчитаем быстро, без AI. Один диалог затем оценит AI',
  saved: (n) => `Версия 2 активна, версия 1 осталась в истории. Пересчитано ${n} чатов`,
  open: 'Открываем p1-ru-009 по новой версии чек-листа',
  reeval: 'Пока это оценка без AI. Нажимаем «Оценить заново»',
  wait: 'AI оценивает диалог по версии 2. В видео ускорено',
  done: (s) => `AI оценил диалог за ${s} с: три прогона GPT-6 Luna с голосованием`,
  newCrit: 'Новый критерий получил ответ AI и цитату из разговора',
  analyst: 'AI-аналитик видит только сводные цифры, тексты диалогов ему не передаются',
  analystWait: 'Задаём вопрос из подсказок',
  analystCut: (s) => `Ответ готов через ${s} с, в видео ускорено`,
  analystAns: 'Ответ: что видно в данных и что исправить первым',
};
function plural(n, [one, few, many]) { const m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; }
const readMs = (t) => Math.max(2000, 700 + t.length * 40);

/* ── overlay injected into every page: cursor, click ripple, caption bar, smooth scrolling helpers ───────── */
function overlay() {
  if (window.top !== window || window.__demo) return;
  const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
  const css = `
    #__demo{position:fixed;inset:0;pointer-events:none;z-index:2147483647}
    #__demo.is-hidden{display:none}
    #__demo-cursor{position:fixed;left:0;top:0;width:30px;height:30px;margin:-3px 0 0 -5px;will-change:transform;filter:drop-shadow(0 2px 3px rgba(14,21,28,.35))}
    .__demo-ripple{position:fixed;width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;border:3px solid #02b140;background:rgba(2,177,64,.14);animation:__demo-rip .6s cubic-bezier(0,0,.2,1) forwards}
    @keyframes __demo-rip{from{transform:scale(.3);opacity:1}to{transform:scale(1.3);opacity:0}}
    #__demo-cap{position:fixed;left:50%;bottom:28px;max-width:calc(100vw - 180px);width:max-content;padding:13px 30px 15px;border-radius:999px;background:#0e151c;color:#fff;
      font:500 24px/1.35 "Onest",system-ui,-apple-system,sans-serif;letter-spacing:-.01em;text-align:center;text-wrap:balance;
      box-shadow:0 10px 36px rgba(14,21,28,.28);opacity:0;transform:translate(-50%,10px);transition:opacity .25s ease,transform .25s ease}
    #__demo-cap.on{opacity:1;transform:translate(-50%,0)}
    .toast{bottom:104px!important}`;
  let pos = null; try { pos = JSON.parse(sessionStorage.getItem('__demo_pos')); } catch {}
  pos = pos || { x: 720, y: 450 };
  let cap = ''; try { cap = sessionStorage.getItem('__demo_cap') || ''; } catch {}
  let root = null, cur = null, capEl = null, capTimer = null;
  const place = () => { if (cur) cur.style.transform = `translate(${pos.x}px,${pos.y}px)`; };
  function mount() {
    if (document.getElementById('__demo')) return;
    const st = document.createElement('style'); st.textContent = css;
    root = document.createElement('div'); root.id = '__demo';
    root.innerHTML = '<div id="__demo-cursor"><svg width="30" height="30" viewBox="0 0 30 30" aria-hidden="true"><path d="M5 3v20.5l5.4-5 3.7 8.2 3.9-1.7-3.7-8.1h7.4z" fill="#fff" stroke="#0e151c" stroke-width="1.7" stroke-linejoin="round"/></svg></div><div id="__demo-cap"></div>';
    document.documentElement.append(st, root);
    cur = root.querySelector('#__demo-cursor'); capEl = root.querySelector('#__demo-cap');
    place();
    if (cap) { capEl.textContent = cap; capEl.classList.add('on'); }
  }
  function caption(text) {
    cap = text || ''; try { sessionStorage.setItem('__demo_cap', cap); } catch {}
    if (!capEl) return;
    clearTimeout(capTimer);
    if (!capEl.classList.contains('on')) { capEl.textContent = cap; if (cap) capEl.classList.add('on'); return; }
    capEl.classList.remove('on');
    capTimer = setTimeout(() => { capEl.textContent = cap; if (cap) capEl.classList.add('on'); }, 230);
  }
  const hide = (on) => root?.classList.toggle('is-hidden', !!on);
  const scrollParent = (el) => {
    for (let p = el.parentElement; p && p !== document.body && p !== document.documentElement; p = p.parentElement) {
      const oy = getComputedStyle(p).overflowY;
      if ((oy === 'auto' || oy === 'scroll') && p.scrollHeight > p.clientHeight + 4) return p;
    }
    return document.scrollingElement;
  };
  const safeTop = () => Math.max(12, ...['.top', '.cl-bar', '.sp-head', 'header.nav', '.l-nav'].map((s) => document.querySelector(s))
    .filter((e) => e && ['sticky', 'fixed'].includes(getComputedStyle(e).position)).map((e) => e.getBoundingClientRect().bottom + 12));
  const safeBottom = () => innerHeight - 104;
  function animate(sc, to, ms) {
    return new Promise((res) => {
      const from = sc.scrollTop; to = Math.max(0, Math.min(to, sc.scrollHeight - sc.clientHeight));
      if (Math.abs(to - from) < 2) return res();
      ms = ms || Math.min(1400, Math.max(450, 350 + Math.abs(to - from) * 0.55));
      const prev = sc.style.scrollBehavior; sc.style.scrollBehavior = 'auto';
      const t0 = performance.now();
      const step = (now) => { const k = Math.min(1, (now - t0) / ms); sc.scrollTop = from + (to - from) * ease(k); if (k < 1) requestAnimationFrame(step); else { sc.style.scrollBehavior = prev; res(); } };
      requestAnimationFrame(step);
    });
  }
  // Scroll so `el` sits at block = 'start' | 'center' inside its scroll container (and the window, if needed).
  async function bring(el, block = 'center', ms) {
    const sc = scrollParent(el);
    const win = sc === document.scrollingElement;
    const r = el.getBoundingClientRect();
    const box = win ? { top: safeTop(), bottom: safeBottom() } : (() => { const b = sc.getBoundingClientRect(); return { top: b.top + 8, bottom: b.bottom - 8 }; })();
    const want = block === 'start' ? box.top : box.top + Math.max(0, (box.bottom - box.top - r.height) / 2);
    await animate(sc, sc.scrollTop + (r.top - want), ms);
    if (!win) { const r2 = el.getBoundingClientRect(); if (r2.top < safeTop() || r2.bottom > safeBottom()) await bring(sc, 'center', ms); }
  }
  async function reveal(sel) {
    const el = document.querySelector(sel); if (!el) return null;
    let r = el.getBoundingClientRect();
    if (r.top < safeTop() || r.bottom > safeBottom()) { await bring(el, r.height > safeBottom() - safeTop() ? 'start' : 'center'); r = el.getBoundingClientRect(); }
    return { x: r.left, y: r.top, w: r.width, h: r.height };
  }
  async function scrollTo({ sel, y, block = 'start', ms } = {}) {
    if (sel) { const el = document.querySelector(sel); if (!el) return false; await bring(el, block, ms); return true; }
    await animate(document.scrollingElement, y, ms); return true;
  }
  // Tag the first element matching `sel` whose text includes `text` (optionally its `child`) and return a unique selector.
  let n = 0;
  function mark(sel, text, child) {
    const el = [...document.querySelectorAll(sel)].find((e) => !text || e.textContent.includes(text));
    const t = el && child ? el.querySelector(child) : el; if (!t) return null;
    if (!t.dataset.demo) t.dataset.demo = `d${++n}`;
    return `[data-demo="${t.dataset.demo}"]`;
  }
  addEventListener('mousemove', (e) => { pos = { x: e.clientX, y: e.clientY }; place(); try { sessionStorage.setItem('__demo_pos', JSON.stringify(pos)); } catch {} }, true);
  addEventListener('mousedown', (e) => {
    if (!root) return; const r = document.createElement('div'); r.className = '__demo-ripple';
    r.style.left = `${e.clientX}px`; r.style.top = `${e.clientY}px`; root.append(r); setTimeout(() => r.remove(), 700);
  }, true);
  window.__demo = { caption, hide, reveal, scrollTo, mark };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true }); else mount();
}

/* ── minimal CDP client ──────────────────────────────────────────────────────────────────────────────── */
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.handlers = new Map();
    ws.addEventListener('message', (e) => this.onMessage(JSON.parse(e.data)));
  }
  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error(`cannot connect to ${url}`)); });
    return new CDP(ws);
  }
  onMessage(m) {
    if (m.id) {
      const p = this.pending.get(m.id); if (!p) return; this.pending.delete(m.id);
      if (m.error) p.reject(new Error(`${p.method}: ${m.error.message}`)); else p.resolve(m.result);
      return;
    }
    for (const fn of this.handlers.get(m.method) || []) fn(m.params);
  }
  send(method, params = {}) {
    const id = ++this.id;
    return new Promise((resolve, reject) => { this.pending.set(id, { resolve, reject, method }); this.ws.send(JSON.stringify({ id, method, params })); });
  }
  on(method, fn) { if (!this.handlers.has(method)) this.handlers.set(method, []); this.handlers.get(method).push(fn); }
  close() { try { this.ws.close(); } catch {} }
}

/* ── processes: dev server + Chrome ──────────────────────────────────────────────────────────────────── */
const procs = [];
let profileDir = null;
async function ok(url) { try { return (await fetch(url, { signal: AbortSignal.timeout(2500) })).ok; } catch { return false; } }
async function ensureServer() {
  if (await ok(`${BASE}/api/health`)) return;
  const u = new URL(BASE);
  if (!['localhost', '127.0.0.1'].includes(u.hostname)) throw new Error(`${BASE} is not reachable`);
  console.log(`starting dev server on :${u.port || 80}`);
  procs.push(spawn(process.execPath, ['scripts/dev-server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: u.port || '80' }, stdio: 'ignore' }));
  for (let i = 0; i < 100; i++) { if (await ok(`${BASE}/api/health`)) return; await sleep(150); }
  throw new Error('dev server did not start');
}
async function launchChrome() {
  if (!existsSync(CHROME)) throw new Error(`Chrome not found at ${CHROME} (set CHROME=…)`);
  profileDir = mkdtempSync(path.join(os.tmpdir(), 'cqa-demo-profile-'));
  procs.push(spawn(CHROME, ['--headless=new', `--remote-debugging-port=${CDP_PORT}`, `--user-data-dir=${profileDir}`, '--hide-scrollbars', '--mute-audio',
    `--window-size=${W},${H}`, '--force-device-scale-factor=1', '--no-first-run', '--no-default-browser-check', '--lang=ru-RU',
    '--autoplay-policy=no-user-gesture-required', '--disable-features=Translate,MediaRouter', 'about:blank'], { stdio: 'ignore' }));
  for (let i = 0; i < 100; i++) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${CDP_PORT}/json/list`)).json();
      const page = list.find((t) => t.type === 'page');
      if (page) return page.webSocketDebuggerUrl;
    } catch {}
    await sleep(100);
  }
  throw new Error('Chrome did not open a debugging port');
}
function cleanup() {
  cdp?.close();
  for (const p of procs) { try { p.kill(); } catch {} }
  if (profileDir) { try { rmSync(profileDir, { recursive: true, force: true }); } catch {} }
}

/* ── recording clock + frames ────────────────────────────────────────────────────────────────────────── */
let cdp = null;
const rec = {
  dir: null, frames: [], base: 0, since: null, n: 0, lastT: -1e9, cut: 0,
  clock() { return this.base + (this.since == null ? 0 : performance.now() - this.since); },
  add(b64, force = false) {
    if (this.since == null) return;
    const t = this.clock(); const last = this.frames.at(-1);
    // Cap at ~33 fps by overwriting, never by dropping: a still screen sends no more frames, so the newest image
    // must survive (otherwise a half-faded caption could stay on screen for the whole hold).
    if (!force && last && t - this.lastT < 30) { writeFileSync(path.join(this.dir, last.f), Buffer.from(b64, 'base64')); return; }
    const f = `${String(++this.n).padStart(6, '0')}.jpg`;
    writeFileSync(path.join(this.dir, f), Buffer.from(b64, 'base64'));
    this.frames.push({ t: Math.round(t), f }); this.lastT = t;
  },
  async grab() { const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 90 }); this.add(data, true); },
  pause() { if (this.since == null) return; this.base = this.clock(); this.since = null; this.pausedAt = performance.now(); },
  async resume() { if (this.since != null) return; if (this.pausedAt) this.cut += performance.now() - this.pausedAt; this.since = performance.now(); await this.grab(); },
};

/* ── page helpers ────────────────────────────────────────────────────────────────────────────────────── */
const mouse = { x: W / 2, y: H / 2 };
const log = [];
const stamp = () => `${(rec.clock() / 1000).toFixed(1).padStart(6)}s`;
async function js(fn, ...args) {
  const expression = typeof fn === 'function' ? `(${fn})(...${JSON.stringify(args)})` : fn;
  const r = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.exceptionDetails) throw new Error(`page: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
  return r.result?.value;
}
async function waitFor(test, { timeout = 20000, args = [], what } = {}) {
  const t0 = Date.now();
  for (;;) {
    try { const v = typeof test === 'string' ? await js((s) => !!document.querySelector(s), test) : await js(test, ...args); if (v) return v; } catch {}
    if (Date.now() - t0 > timeout) throw new Error(`timed out waiting for ${what || test}`);
    await sleep(100);
  }
}
/** Wait for a slow result; after `visible` ms the clock stops, so the video skips the rest of the wait. */
async function until(test, { visible = 1800, timeout = 180000, args = [], what } = {}) {
  const t0 = Date.now(); let paused = false;
  for (;;) {
    let v = false; try { v = await js(test, ...args); } catch {}
    if (v) break;
    if (!paused && Date.now() - t0 > visible) { rec.pause(); paused = true; }
    if (Date.now() - t0 > timeout) { if (paused) await rec.resume(); throw new Error(`timed out waiting for ${what || 'result'}`); }
    await sleep(paused ? 200 : 100);
  }
  const ms = Date.now() - t0;
  if (paused) { await sleep(120); await rec.resume(); console.log(`${stamp()}  … waited ${(ms / 1000).toFixed(1)} s, cut from the video`); }
  return { ms, cut: paused };
}
async function ready(prefix = '') {
  await waitFor((p) => location.pathname.startsWith(p) && document.readyState === 'complete' && !!document.getElementById('__demo'), { args: [prefix], what: `page ${prefix}` });
  await js(() => document.fonts.ready.then(() => true));
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y });
}
async function goto(url) { await cdp.send('Page.navigate', { url }); await ready(new URL(url).pathname); }
async function moveTo(x, y, ms) {
  const x0 = mouse.x, y0 = mouse.y, dist = Math.hypot(x - x0, y - y0);
  ms = ms ?? Math.min(950, Math.max(300, 220 + dist * 0.55));
  const steps = Math.max(1, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) {
    const k = ease(i / steps); mouse.x = x0 + (x - x0) * k; mouse.y = y0 + (y - y0) * k;
    await cdp.send('Input.dispatchMouseEvent', { type: 'mouseMoved', x: mouse.x, y: mouse.y });
    await sleep(16);
  }
}
async function locate(sel) { const r = await js((s) => window.__demo.reveal(s), sel); if (!r) throw new Error(`not on the page: ${sel}`); return r; }
async function hover(sel, { dx = 0.5, dy = 0.5, ms } = {}) { const r = await locate(sel); await moveTo(r.x + r.w * dx, r.y + r.h * dy, ms); return r; }
async function click(sel, { pause = 350, dx = 0.5, dy = 0.5 } = {}) {
  const r = await locate(sel);
  const x = r.x + r.w * dx, y = r.y + r.h * dy;
  await moveTo(x, y); await sleep(120);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1 });
  await sleep(80);
  await cdp.send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1 });
  await sleep(pause);
}
async function type(text, { cps = 22 } = {}) {
  for (const ch of text) { await cdp.send('Input.insertText', { text: ch }); await sleep((1000 / cps) * (0.55 + rnd() * 0.9)); }
}
const selectAll = () => js(() => { document.execCommand('selectAll'); return true; });
async function mark(sel, text, child) { const s = await js((a, b, c) => window.__demo.mark(a, b, c), sel, text, child || null); if (!s) throw new Error(`not found: ${sel} «${text}» ${child || ''}`); return s; }
async function scroll(o) { await js((x) => window.__demo.scrollTo(x), o); await sleep(120); }
async function say(text, hold) {
  log.push(text); console.log(`${stamp()}  ${text}`);
  await js((t) => window.__demo?.caption(t), text);
  if (SNAPS) { await sleep(400); const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 }); writeFileSync(path.join(SNAPS, `${String(log.length).padStart(2, '0')}.jpg`), Buffer.from(data, 'base64')); }
  if (hold !== 0) await sleep(hold ?? readMs(text));
}
const quiet = () => js(() => window.__demo?.caption(''));
async function still(name, { poster = false } = {}) {
  rec.pause();
  await js(() => window.__demo.hide(true)); await sleep(180);
  let q = 88, buf;
  for (;;) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: q }); buf = Buffer.from(data, 'base64'); if (buf.length <= STILL_MAX || q <= 40) break; q -= 6; }
  writeFileSync(path.join(MEDIA, `${name}.jpg`), buf);
  if (poster) { const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 76 }); writeFileSync(OUT_POSTER, Buffer.from(data, 'base64')); }
  await js(() => window.__demo.hide(false)); await sleep(60);
  await rec.resume();
  console.log(`${stamp()}  still docs/media/${name}.jpg (${Math.round(buf.length / 1024)} KB, q${q})${poster ? ' + poster' : ''}`);
}
const text = (sel) => js((s) => document.querySelector(s)?.textContent.trim() || '', sel);

/* ── the flow ────────────────────────────────────────────────────────────────────────────────────────── */
const notes = []; // what needed a fallback, for the report

async function sceneLanding() {
  await goto(`${BASE}/`);
  await rec.resume();
  await sleep(600);
  await say(C.hero, 2600);
  await say(C.toSupport, 0);
  await hover('.hero__actions a[href="/support/"]');
  await sleep(700);
  await click('.hero__actions a[href="/support/"]', { pause: 0 });
  await ready('/support/');
}

async function sceneSupport() {
  await waitFor('#sp-input');
  await sleep(800);
  await say(C.ask, 0);
  await click('#sp-input', { pause: 200 });
  await type('Где посмотреть мой тариф?');
  await sleep(300);
  await click('#sp-send', { pause: 0 });
  await until(() => document.querySelectorAll('.sp-msg--bot').length >= 1 && document.getElementById('sp-typing').hidden, { visible: 2500, what: 'AIM reply' });
  await sleep(400);
  await say(C.answered, 2600);
  await say(C.askHuman, 0);
  await click('#sp-input', { pause: 200 });
  await type('Спасибо. Хочу сменить тариф, можно поговорить с человеком?', { cps: 26 });
  await sleep(250);
  await click('#sp-send', { pause: 0 });
  await until(() => !!document.querySelector('.sp-card'), { visible: 2500, what: 'handoff card' });
  await sleep(900);
  await say(C.handoff, 0);
  await hover('.sp-card', { dx: 0.8, dy: 0.5 });
  await sleep(2200);
  await still('support-handoff');
  await sleep(500);
}

async function sceneOverview() {
  await quiet();
  await goto(`${BASE}/admin/#/overview`);
  await waitFor('.kpis .kpi');
  await sleep(900);
  const n = Number(await text('.kpis .kpi:nth-child(2) .kpi__value'));
  const sub = await text('.kpis .kpi:nth-child(2) .kpi__sub');
  const [chats, calls] = (sub.match(/\d+/g) || ['60', '5']).map(Number);
  await say(C.overview(n, chats, calls), 1800);
  await still('admin-overview');
  await say(C.kpis, 0);
  for (const i of [1, 2, 3]) { await hover(`.kpis .kpi:nth-child(${i})`, { dy: 0.45 }); await sleep(550); }
  await sleep(900);
  await say(C.loss, 0);
  await hover('#ch-loss-box', { dx: 0.35, dy: 0.1 });
  await sleep(2500);
  await say(C.dist, 0);
  await hover('#ch-dist-box', { dx: 0.5, dy: 0.55 });
  await sleep(2000);
}

async function sceneGross() {
  await say(C.toGross, 0);
  await click('.kpis a.kpi[href="#/dialogs?gross=1"]', { pause: 0 });
  await waitFor('.gross-list .gross');
  await sleep(700);
  const n = await js(() => document.querySelectorAll('.gross-list .gross').length);
  await say(C.gross(n), 0);
  await hover('.gross-list .gross:first-child .gross__why', { dx: 0.3 });
  await sleep(2400);
  await still('gross-errors');
  const item = await mark('.gross-list .gross', 'p1-ru-009');
  await scroll({ sel: item, block: 'center' });
  await say(C.pick, 0);
  await hover(`${item} .evidence`, { dx: 0.3 });
  await sleep(2300);
  await click(`${item} .gross__foot a.btn`, { pause: 0 });
}

async function sceneCard() {
  await waitFor('#ring-wrap');
  await waitFor('.tx-row.is-evidence', { timeout: 5000 }).catch(() => {});
  await sleep(700);
  await scroll({ y: 0 });
  await say(C.card, 0);
  await hover('#timeline', { dx: 0.62, dy: 0.5 });
  await sleep(2000);
  await scroll({ sel: '.analysis', block: 'start' });
  await say(C.score, 0);
  await hover('.score-card .sections', { dx: 0.4 });
  await sleep(2300);
  await scroll({ sel: '.reasons-card', block: 'start' });
  await say(C.reasons, 0);
  await scroll({ sel: '#m-0', block: 'start' }); // transcript back to the top, so the jump below is visible
  await hover('.reasons-card .ded__why', { dx: 0.3 });
  await sleep(1600);
  const ded = await mark('.reasons-card .ded', 'Идентификация');
  await say(C.jump, 0);
  await click(`${ded} .evidence--btn`, { pause: 0, dx: 0.3 });
  await sleep(2300);
  await still('dialog-card', { poster: true });
  await sleep(500);
  const na = await mark('.crit-card .crit', 'Выявление потребности');
  await scroll({ sel: na, block: 'center' });
  await say(C.na, 0);
  await hover(`${na} .crit__na`, { dx: 0.3 });
  await sleep(3300);
}

async function sceneAppeal() {
  const ded = await mark('.reasons-card .ded', 'Эмпатия');
  await scroll({ sel: ded, block: 'center' });
  await say(C.appeal, 0);
  await click(`${ded} [data-appeal]`, { pause: 400 });
  await waitFor('#ap-comment');
  await click('#ap-comment', { pause: 150 });
  await type('В #13 оператор ответил на опасение клиента. Проверка личности уже учтена в критерии 3.', { cps: 50 });
  await sleep(400);
  await click('#ap-save', { pause: 1000 });
  await say(C.role, 0);
  await scroll({ y: 0 });
  await click('#role-switch button[data-v="reviewer"]', { pause: 900 });
  await click('.score-card [data-review]', { pause: 500 });
  await waitFor('#rv-mode');
  await say(C.review, 0);
  await hover('.drawer .banner--warn', { dx: 0.4 });
  await sleep(2300);
  await say(C.change, 0);
  await click('#rv-mode button[data-m="change"]', { pause: 300 });
  await click('#rv-answer button[data-v="yes"]', { pause: 400 });
  await hover('#rv-preview', { dx: 0.4 });
  await sleep(1000);
  await click('#rv-reason', { pause: 150 });
  await type('Согласен: реакция на опасение в #13 есть. Ошибка проверки личности снижена в критерии 3.', { cps: 50 });
  await sleep(400);
  await still('appeal-decision');
  await click('#rv-save', { pause: 300 });
  await waitFor('.history');
  await sleep(700);
  await scroll({ sel: '.score-card', block: 'start' });
  await say(C.after, 0);
  await hover('.history .history__step--final', { dx: 0.5 });
  await sleep(2500);
}

async function sceneCall() {
  await say(C.toCall, 0);
  await click('#nav a[href="#/dialogs"]', { pause: 400 });
  await waitFor('#f-channel');
  // the list remembers the "gross errors" filter from before: switch it off first
  if (await js(() => document.querySelector('#f-gross')?.getAttribute('aria-pressed') === 'true')) await click('#f-gross', { pause: 400 });
  await click('#f-channel button[data-v="call"]', { pause: 600 });
  await click('a.mono[href="#/dialog/p4-ru-001"]', { pause: 0 });
  await waitFor('#timeline .mark');
  await sleep(600);
  await say(C.call, 0);
  await hover('#timeline', { dx: 0.45, dy: 0.4 });
  await sleep(2000);
  const before = await text('#tpos');
  await say(C.mark, 0);
  await click('#timeline .mark', { pause: 900 });
  const at = await text('#tpos');
  await click('#play', { pause: 0 });
  const played = await until((t) => { const x = document.querySelector('#tpos')?.textContent; return x && x !== t ? x : false; }, { args: [at], visible: 2500, timeout: 20000 }).then(() => true).catch(() => false);
  if (played) {
    await say(C.audio(at), 0);
    await sleep(3000);
    await still('call-audio');
    await click('#play', { pause: 400 });
  } else {
    notes.push(`call audio did not start (playhead ${before} → ${at}); video shows the timeline seek only`);
    await say(C.audioFail, 2600);
    await still('call-audio');
  }
}

async function sceneChecklist() {
  await click('#nav a[href="#/checklist"]', { pause: 400 });
  await waitFor('.crit-edit');
  await sleep(600);
  await say(C.checklist, 2000);
  await say(C.edit, 0);
  await click('[data-id="c01"] textarea[data-k="description"]', { pause: 150, dx: 0.8 });
  await selectAll();
  await type('Да — оператор поздоровался на языке клиента и назвал своё имя в первом ответе.', { cps: 46 });
  await sleep(500);
  await say(C.weight, 0);
  await click('[data-id="c06"] input[data-k="weight"]', { pause: 150 });
  await selectAll();
  await type('5', { cps: 6 });
  await sleep(1400);
  await say(C.add, 0);
  await click('#add', { pause: 500 });
  await waitFor('.crit-edit.is-new');
  await hover('.crit-edit.is-new input[data-k="title"]', { dx: 0.3 });
  await js(() => { const i = document.querySelector('.crit-edit.is-new input[data-k="title"]'); i.focus(); i.select(); return true; });
  await type('Назвал срок ответа', { cps: 22 });
  await click('.crit-edit.is-new textarea[data-k="description"]', { pause: 150, dx: 0.6 });
  await selectAll();
  await type('Да — оператор сказал, когда клиент получит ответ или решение.', { cps: 46 });
  await hover('.crit-edit.is-new select[data-k="section_id"]', { dx: 0.4 });
  await js(() => { const s = document.querySelector('.crit-edit.is-new select[data-k="section_id"]'); if (s && [...s.options].some((o) => o.value === 's3')) { s.value = 's3'; s.dispatchEvent(new Event('change', { bubbles: true })); } return true; });
  await sleep(500);
  await scroll({ y: 0 });
  await say(C.diff, 0);
  await hover('.cl-diff', { dx: 0.3 });
  await sleep(2800);
  await still('checklist-editor');
  await say(C.mode, 0);
  await click('#mode button[data-v="mock"]', { pause: 700 });
  await click('#save', { pause: 0 });
  await until(() => !!document.querySelector('.run-card--done'), { visible: 4000, what: 'checklist re-run' });
  await sleep(500);
  const n = Number((await text('.run-card--done .run-card__head b')).match(/(\d+) из (\d+)/)?.[2] || 60);
  await say(C.saved(n), 0);
  await hover('.run-card--done .run-card__res', { dx: 0.4 });
  await sleep(2600);
}

async function sceneReevaluate() {
  await say(C.open, 0);
  await click('.run-card--done a.btn--primary', { pause: 600 });
  await waitFor('#f-q');
  await click('#f-q', { pause: 150 });
  await type('p1-ru-009', { cps: 20 });
  // blur first: the search box re-renders the table on "change", which would swallow a click that blurs it
  await js(() => { document.activeElement?.blur(); return true; });
  await sleep(500);
  await click('a.mono[href="#/dialog/p1-ru-009"]', { pause: 0 });
  await waitFor('#reeval');
  await sleep(900);
  await scroll({ sel: '.analysis', block: 'start' });
  await say(C.reeval, 0);
  await hover('.score-card .l-chip', { dx: 0.5 });
  await sleep(1300);
  await click('#reeval', { pause: 300 });
  await waitFor('.run--pending', { timeout: 5000 }).catch(() => {});
  await say(C.wait, 0);
  const r = await until(() => !!document.querySelector('.run--ok, .run--error'), { visible: 2600, timeout: 200000, what: 'AI evaluation' });
  const failed = await js(() => !!document.querySelector('.run--error'));
  if (failed) notes.push(`AI re-evaluation failed: ${await text('.run--error')}`);
  await sleep(600);
  await say(failed ? 'AI не ответил, оценка без AI осталась на экране' : C.done(Math.round(r.ms / 1000)), 0);
  await hover('.run--ok, .run--error', { dx: 0.4 });
  await sleep(2700);
  const crit = await mark('.crit-card .crit', 'Назвал срок ответа');
  await scroll({ sel: crit, block: 'center' });
  await say(C.newCrit, 0);
  await hover(`${crit} .evidence, ${crit} .crit__why`, { dx: 0.3 });
  await sleep(3500);
}

async function sceneAnalyst() {
  // the analyst should talk about the measured checklist v1, not the demo edit: switch the active version back first
  await js(() => { const k = 'cqa-prototype-v2'; const s = JSON.parse(localStorage.getItem(k)); s.activeVersion = 1; localStorage.setItem(k, JSON.stringify(s)); return true; });
  await click('#nav a[href="#/analyst"]', { pause: 500 });
  await waitFor('.analyst__intro .chip-btn');
  await say(C.analyst, 2300);
  await say(C.analystWait, 0);
  await click('.analyst__intro .chip-btn', { pause: 300, dx: 0.4 });
  const r = await until(() => !!document.querySelector('.qa .qa__answer, .qa .field__err'), { visible: 2400, timeout: 120000, what: 'analyst answer' });
  if (await js(() => !!document.querySelector('.qa .field__err'))) notes.push(`AI analyst failed: ${await text('.qa .field__err')}`);
  if (r.cut) await say(C.analystCut(Math.round(r.ms / 1000)), 2000); // only claim a cut when the clock really stopped
  else await sleep(900);
  await scroll({ sel: '.qa', block: 'start' });
  await say(C.analystAns, 0);
  await hover('.qa .qa__answer', { dx: 0.3 });
  await sleep(2200);
  await still('ai-analyst');
  await scroll({ sel: '.qa .actions', block: 'start', ms: 1400 }).catch(() => {});
  await sleep(1600);
}

async function sceneEnd() {
  await quiet();
  await sleep(300);
  await goto(`${BASE}/scripts/demo/end-card.html`);
  await js(() => window.__demo.hide(true));
  await sleep(150); await rec.grab();
  await sleep(6400);
}

/* ── main ────────────────────────────────────────────────────────────────────────────────────────────── */
async function main() {
  mkdirSync(MEDIA, { recursive: true });
  if (SNAPS) mkdirSync(SNAPS, { recursive: true });
  rec.dir = mkdtempSync(path.join(os.tmpdir(), 'cqa-demo-frames-'));
  await ensureServer();
  const login = await fetch(`${BASE}/api/admin-login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ passcode: process.env.ADMIN_PASSCODE || 'freedom' }) });
  if (!login.ok) throw new Error(`admin login failed: HTTP ${login.status} (set ADMIN_PASSCODE)`);
  const { token } = await login.json();

  cdp = await CDP.connect(await launchChrome());
  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');
  await cdp.send('Emulation.setDeviceMetricsOverride', { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await cdp.send('Emulation.setFocusEmulationEnabled', { enabled: true }).catch(() => {});
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `try { if (location.pathname.startsWith('/admin')) sessionStorage.setItem('cqa-admin-token', ${JSON.stringify(token)}); } catch {}` });
  await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `(${overlay})();` });
  cdp.on('Page.screencastFrame', ({ data, sessionId }) => { cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {}); rec.add(data); });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: W, maxHeight: H, everyNthFrame: 1 });

  let scenes = [sceneLanding, sceneSupport, sceneOverview, sceneGross, sceneCard, sceneAppeal, sceneCall, sceneChecklist, sceneReevaluate, sceneAnalyst, sceneEnd];
  const from = opt('from', ''); // debugging only: start at a later admin scene (e.g. --from call)
  if (from) {
    scenes = scenes.slice(Math.max(0, scenes.findIndex((s) => s.name.toLowerCase() === `scene${from.toLowerCase()}`)));
    if (scenes[0] !== sceneLanding) { await goto(`${BASE}/admin/#/overview`); await waitFor('.kpis .kpi'); await rec.resume(); }
  }
  for (const s of scenes) {
    console.log(`${stamp()}  ── ${s.name.replace('scene', '')}`);
    try { await s(); }
    catch (e) {
      const { data } = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 70 });
      const shot = path.join(os.tmpdir(), `cqa-demo-fail-${s.name}.jpg`); writeFileSync(shot, Buffer.from(data, 'base64'));
      throw new Error(`${s.name}: ${e.message} (screenshot ${shot}, frames ${rec.dir})`);
    }
  }
  rec.pause();
  await cdp.send('Page.stopScreencast').catch(() => {});
  const duration = Math.round(rec.clock());
  console.log(`recorded ${(duration / 1000).toFixed(1)} s of video, ${rec.frames.length} frames, ${(rec.cut / 1000).toFixed(0)} s of waiting cut`);
  cleanup();

  let bitrate = Math.min(1_600_000, Math.floor((TARGET_BYTES * 8) / (duration / 1000)));
  const manifest = path.join(rec.dir, 'manifest.json');
  const writeManifest = () => writeFileSync(manifest, JSON.stringify({ dir: rec.dir, fps: FPS, width: W, height: H, bitrate, keyframe_s: 10, duration_ms: duration, frames: rec.frames }));
  if (has('no-encode')) { writeManifest(); console.log(`frames + manifest kept in ${rec.dir} (swift scripts/demo/encode.swift ${manifest} out.mp4)`); return; }
  const tmpOut = path.join(rec.dir, 'demo.mp4');
  for (let attempt = 1; ; attempt++) {
    writeManifest();
    const r = spawnSync(SWIFT, [path.join(ROOT, 'scripts/demo/encode.swift'), manifest, tmpOut], { stdio: 'inherit' });
    if (r.status !== 0) throw new Error(`encode.swift failed (exit ${r.status}); frames kept in ${rec.dir}`);
    const size = statSync(tmpOut).size;
    if (size <= MAX_BYTES || attempt >= 4) break;
    console.log(`  ${(size / 1e6).toFixed(2)} MB is over the limit, re-encoding at a lower bitrate`);
    bitrate = Math.floor(bitrate * (TARGET_BYTES / size) * 0.95);
  }
  copyFileSync(tmpOut, OUT_MP4);
  if (!has('keep')) rmSync(rec.dir, { recursive: true, force: true }); else console.log(`frames kept in ${rec.dir}`);
  const size = statSync(OUT_MP4).size;
  const mmss = `${Math.floor(duration / 60000)}:${String(Math.round((duration % 60000) / 1000)).padStart(2, '0')}`;
  console.log(`\n${path.relative(ROOT, OUT_MP4)}  ${(size / 1e6).toFixed(2)} MB  ${mmss} (${(duration / 1000).toFixed(1)} s)  ${W}×${H} @ ${FPS} fps`);
  console.log(`${path.relative(ROOT, OUT_POSTER)}  ${Math.round(statSync(OUT_POSTER).size / 1024)} KB`);
  if (notes.length) console.log(`\nnotes:\n- ${notes.join('\n- ')}`);
}

main().catch((e) => { console.error(`\nrecord.mjs: ${e.message}`); cleanup(); process.exit(1); });
process.on('SIGINT', () => { cleanup(); process.exit(130); });
