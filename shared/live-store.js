// Live support sessions shared by /support (customer) and /admin (operator console + analytics).
// Demo storage: localStorage "cqa-live-v1" + BroadcastChannel "cqa-live" (same browser, two windows). Contract: issue #10.
const KEY = 'cqa-live-v1';
const chan = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('cqa-live') : null;
const listeners = new Set();

export function all() { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } }
function saveAll(list) { try { localStorage.setItem(KEY, JSON.stringify(list.slice(-200))); } catch {} }
export function get(id) { return all().find((s) => s.id === id) || null; }

export function create({ language = 'RU' } = {}) {
  const s = { id: `live-${Date.now().toString(36)}`, started_at: new Date().toISOString(), language, channel: 'web chat', status: 'bot',
    messages: [], handoff: null, operator_name: null, csat: null, csat_comment: '', evaluation: null };
  save(s); return s;
}
export function save(s) {
  const list = all(); const i = list.findIndex((x) => x.id === s.id);
  if (i >= 0) list[i] = s; else list.push(s);
  saveAll(list); chan?.postMessage({ type: 'update', session: s }); listeners.forEach((fn) => fn(s));
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
export function remove(id) { saveAll(all().filter((s) => s.id !== id)); chan?.postMessage({ type: 'remove', id }); }

/** Subscribe to changes from this tab AND other tabs/windows. Returns unsubscribe. */
export function subscribe(fn) {
  listeners.add(fn);
  const onMsg = (e) => { if (e.data?.type === 'update') fn(e.data.session); if (e.data?.type === 'remove') fn(null); };
  const onStorage = (e) => { if (e.key === KEY) fn(null); };
  chan?.addEventListener('message', onMsg); addEventListener('storage', onStorage);
  return () => { listeners.delete(fn); chan?.removeEventListener('message', onMsg); removeEventListener('storage', onStorage); };
}

/** LiveSession → Conversation (CONTRACTS §1) for /api/evaluate. */
export function toConversation(s) {
  return { conversation_id: s.id, channel: 'agent chat', language: s.language, audio_url: null,
    transcript: s.messages.map((m) => ({ timestamp: m.timestamp, speaker: m.speaker, text: m.text })) };
}
