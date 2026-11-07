// Live support sessions shared by /support (customer) and /admin (operator console + analytics).
// localStorage + BroadcastChannel for same-browser demo; when DATABASE_URL is set, /api/sessions is source of truth.
const KEY = 'cqa-live-v1';
const API = '/api/sessions';
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cqa-live') : null;
const listeners = new Set();
let remote = false;
let pollTimer = null;

export function all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function saveAll(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch {} }
export function get(id) { return all().find((s) => s.id === id) || null; }
export function usingPostgres() { return remote; }

export function create({ language = 'RU' } = {}) {
  const s = { id: `live-${Date.now().toString(36)}`, started_at: new Date().toISOString(), language, channel: 'web chat', status: 'bot',
    messages: [], handoff: null, operator_name: null, csat: null, csat_comment: '', evaluation: null };
  save(s); return s;
}
export function save(s) {
  s.updated_at = new Date().toISOString();
  const list = all(); const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = s; else list.push(s);
  saveAll(list); chan?.postMessage({ type: 'update', session: s }); listeners.forEach((fn) => fn(s));
  push(s);
  return s;
}
const mmss = (ms) => { const t = Math.max(0, Math.floor(ms / 1000)); return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`; };
export function addMessage(id, speaker, text) {
  const s = get(id); if (!s) return null;
  const now = new Date();
  s.messages.push({ speaker, text, at: now.toISOString(), timestamp: mmss(now - new Date(s.started_at)) });
  return save(s);
}
export function update(id, patch) { const s = get(id); if (!s) return null; Object.assign(s, typeof patch === 'function' ? patch(s) : patch); return save(s); }
export function remove(id) {
  saveAll(all().filter((s) => s.id !== id));
  chan?.postMessage({ type: 'remove', id });
  listeners.forEach((fn) => fn(null));
  if (remote) fetch(`${API}?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
}

function newer(a, b) { return String(a?.updated_at || a?.started_at || '') > String(b?.updated_at || b?.started_at || ''); }
function mergeIn(remoteList) {
  const byId = new Map(all().map((s) => [s.id, s]));
  let changed = false;
  for (const s of remoteList || []) {
    if (!s?.id) continue;
    const cur = byId.get(s.id);
    if (!cur || newer(s, cur)) { byId.set(s.id, s); changed = true; }
  }
  if (changed) {
    saveAll([...byId.values()]);
    listeners.forEach((fn) => fn(null));
  }
  return changed;
}
function push(s) {
  if (!remote || !s?.id) return;
  fetch(API, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) }).catch(() => {});
}

export async function hydrate() {
  try {
    const r = await fetch(API, { cache: 'no-store' });
    if (!r.ok) return false;
    const j = await r.json();
    remote = j.postgres === true;
    if (!remote) return false;
    const remoteList = j.sessions || [];
    const local = all();
    mergeIn(remoteList);
    for (const s of local) {
      const o = remoteList.find((x) => x.id === s.id);
      if (!o || newer(s, o)) push(s);
    }
    startPoll();
    return true;
  } catch { return false; }
}

function startPoll() {
  if (pollTimer || typeof window === 'undefined') return;
  pollTimer = setInterval(async () => {
    if (document.hidden) return;
    try {
      const r = await fetch(API, { cache: 'no-store' });
      const j = await r.json();
      if (j.postgres) mergeIn(j.sessions);
    } catch {}
  }, 2000);
}

/** Subscribe to changes from this tab, other tabs/windows, and Postgres (when configured). Returns unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  const onMsg = (e) => { if (e.data?.type === 'update') fn(e.data.session); if (e.data?.type === 'remove') fn(null); };
  const onStorage = (e) => { if (e.key === KEY) fn(null); };
  chan?.addEventListener('message', onMsg);
  if (typeof addEventListener === 'function') addEventListener('storage', onStorage);
  return () => {
    listeners.delete(fn);
    chan?.removeEventListener('message', onMsg);
    if (typeof removeEventListener === 'function') removeEventListener('storage', onStorage);
  };
}

/** LiveSession → Conversation (CONTRACTS §1) for /api/evaluate. */
export function toConversation(s) {
  return { conversation_id: s.id, channel: 'agent chat', language: s.language, audio_url: null,
    transcript: s.messages.map((m) => ({ timestamp: m.timestamp, speaker: m.speaker, text: m.text })) };
}

if (typeof window !== 'undefined') hydrate();
