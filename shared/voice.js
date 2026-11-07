// AIM voice on the client, shared by /broker (broker/agent.js) and /support (support/support.js). No deps.
//   speak(text, lang)  → splits the reply into sentences, fetches POST /api/speak for all of them in parallel and plays
//                        them in order, so the first sentence starts as soon as it is ready. Text → blob-URL map: a
//                        repeated phrase plays at once with no request. No server voice (501) → speechSynthesis.
//   stop()             → stops playback and drops the queue (called when the client starts talking or sends).
//   prefetch(text)     → warms the map (greetings), ui: true marks fixed UI phrases the server may commit to its cache.
//   recorder({...})    → push-to-talk: tap to start / tap to stop, or hold and release. Stops playback on start.
//   transcribe(blob)   → POST /api/agent-voice; sends the browser's own webm/mp4 when the server's ASR takes it
//                        (Whisper), else 16 kHz mono WAV (Nemotron fallback).
// Safari only plays audio started from a user gesture: call unlock() inside a click/keydown handler once.

const SILENT_WAV = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
const MAP_MAX = 150;
const FIRST_MAX = 160; // first chunk: one sentence, so audio starts fast
const CHUNK_MAX = 260; // later chunks: a few sentences each, fetched in parallel while the first one plays

/** Split a reply into speakable chunks: first sentence alone, then sentences grouped up to CHUNK_MAX characters. */
export function chunksOf(text) {
  // Lines become sentences (AIM's numbered steps have no final period); list numbers and markup are not read out.
  const clean = String(text || '').split('\n')
    .map((l) => l.replace(/^\s*\d+[.)]\s+/, '').replace(/[«»"“”*_#>`]/g, '').trim()).filter(Boolean)
    .map((l) => (/[.!?…:;]$/.test(l) ? l : `${l}.`)).join(' ').replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?…]+(?:[.!?…]+|$)/g)?.map((s) => s.trim()).filter(Boolean) || [clean];
  const pieces = [];
  for (const s of sentences) { // over-long sentences: cut at a comma / semicolon / space
    let rest = s;
    while (rest.length > CHUNK_MAX) {
      const comma = Math.max(rest.lastIndexOf(', ', CHUNK_MAX), rest.lastIndexOf('; ', CHUNK_MAX));
      const space = rest.lastIndexOf(' ', CHUNK_MAX);
      const at = comma > 80 ? comma + 1 : space > 40 ? space + 1 : CHUNK_MAX; // prefer a pause at a comma
      pieces.push(rest.slice(0, at).trim()); rest = rest.slice(at).trim();
    }
    if (rest) pieces.push(rest);
  }
  // Chunk 0 is one sentence (it only grows while it is a tiny greeting like «Здравствуйте!»);
  // chunks 1+ group sentences up to CHUNK_MAX, so a long reply is a few requests, not one per sentence.
  const out = [];
  for (const p of pieces) {
    const last = out[out.length - 1];
    const cap = !out.length ? 0 : out.length === 1 ? (last.length < 25 ? FIRST_MAX : 0) : CHUNK_MAX;
    if (cap && `${last} ${p}`.length <= cap) out[out.length - 1] = `${last} ${p}`;
    else out.push(p);
  }
  return out;
}

export function createVoice({ apiBase = '', getLang = () => 'RU' } = {}) {
  const api = (p) => `${apiBase || ''}${p}`;
  const urls = new Map(); // chunk text → Promise<blob URL | null>
  const audio = typeof Audio !== 'undefined' ? new Audio() : null;
  if (audio) audio.preload = 'auto';
  let gen = 0; let unlocked = false; let serverTts = true; let speaking = false;
  const stats = { requests: 0, cached: 0, map_hits: 0, last: null };

  let cfgP = null;
  const config = () => (cfgP ||= fetch(api('/api/speak')).then((r) => (r.ok ? r.json() : null)).catch(() => null)
    .then((c) => c || { tts: null, asr_formats: ['wav'] }));

  function unlock() {
    if (unlocked || !audio) return;
    unlocked = true;
    try { audio.src = SILENT_WAV; const p = audio.play(); p?.catch?.(() => { unlocked = false; }); } catch { unlocked = false; }
    config(); // warm the config while we are here
  }

  async function fetchUrl(text, lang, ui) {
    stats.requests++;
    const r = await fetch(api('/api/speak'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text, language: lang, ...(ui ? { ui: true } : {}) }) });
    const data = await r.json().catch(() => ({}));
    if (r.status === 501 || data.code === 'tts_unavailable') { serverTts = false; return null; }
    if (!r.ok || !data.audio) throw new Error(data.error || `HTTP ${r.status}`);
    if (data.cached) stats.cached++;
    stats.last = { cached: data.cached, tier: data.tier, server_ms: data.server_ms, model: data.model, chars: data.chars };
    const bytes = Uint8Array.from(atob(data.audio), (c) => c.charCodeAt(0));
    return URL.createObjectURL(new Blob([bytes], { type: data.mime || 'audio/mpeg' }));
  }

  function urlFor(text, lang, ui) {
    if (urls.has(text)) { stats.map_hits++; const p = urls.get(text); urls.delete(text); urls.set(text, p); return p; } // LRU touch
    const p = fetchUrl(text, lang, ui).catch((e) => { console.warn('[voice] tts', e); urls.delete(text); return null; });
    urls.set(text, p);
    while (urls.size > MAP_MAX) {
      const [k, old] = urls.entries().next().value; urls.delete(k);
      old.then((u) => u && setTimeout(() => URL.revokeObjectURL(u), 60_000));
    }
    return p;
  }

  function play(url, my) {
    return new Promise((resolve) => {
      if (!audio || my !== gen) return resolve(false);
      const done = (ok) => { audio.onended = audio.onerror = null; resolve(ok); };
      audio.onended = () => done(true); audio.onerror = () => done(false);
      audio.src = url;
      audio.play().catch(() => done(false));
    });
  }

  function browserSpeak(text, lang) {
    if (!('speechSynthesis' in window) || !text) return false;
    const tag = { RU: 'ru', KZ: 'kk', EN: 'en' }[lang || getLang()] || 'ru';
    const v = speechSynthesis.getVoices().find((x) => x.lang?.toLowerCase().startsWith(tag));
    if (!v) return false; // no voice for this language (often Kazakh): stay silent rather than read it with a wrong accent
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text).replace(/[«»"]/g, '')); u.voice = v; u.lang = v.lang; u.rate = 1.02;
    speechSynthesis.speak(u);
    return true;
  }

  /** Speak a reply. Resolves when it finished, was stopped, or fell back to the browser voice. */
  async function speak(text, lang = getLang(), { ui = false } = {}) {
    stop();
    const my = gen; const t0 = performance.now();
    const parts = chunksOf(text);
    if (!parts.length) return;
    const cfg = await config();
    if (my !== gen) return;
    if (!cfg.tts || !serverTts) { browserSpeak(text, lang); return; }
    const jobs = parts.map((p) => urlFor(p, lang, ui)); // all in parallel; played strictly in order
    speaking = true;
    try {
      for (let i = 0; i < jobs.length; i++) {
        const url = await jobs[i];
        if (my !== gen) return;
        if (!url) { if (i === 0) browserSpeak(text, lang); return; } // server voice failed: the browser reads it instead
        if (i === 0) stats.first_audio_ms = Math.round(performance.now() - t0);
        await play(url, my);
      }
    } finally { if (my === gen) speaking = false; }
  }

  function stop() {
    gen++; speaking = false;
    if (audio && !audio.paused) audio.pause();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
  }

  async function prefetch(text, lang = getLang(), { ui = false } = {}) {
    const cfg = await config();
    if (!cfg.tts || !serverTts) return;
    await Promise.all(chunksOf(text).map((p) => urlFor(p, lang, ui)));
  }

  // ---------- speech-to-text ----------
  async function transcribe(blob, lang = getLang()) {
    const cfg = await config();
    const type = blob.type || 'audio/webm';
    const native = type.includes('mp4') ? 'mp4' : type.includes('ogg') ? 'ogg' : type.includes('mpeg') ? 'mp3' : type.includes('wav') ? 'wav' : 'webm';
    let send = blob; let format = native;
    if (!(cfg.asr_formats || ['wav']).includes(native)) { // Nemotron fallback wants 16 kHz mono WAV
      const wav = await toWav16k(blob).catch(() => null);
      if (wav) { send = wav; format = 'wav'; }
    }
    const b64 = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(',')[1]); fr.onerror = rej; fr.readAsDataURL(send); });
    const r = await fetch(api('/api/agent-voice'), { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ audio: b64, format, language: lang }) });
    const data = await r.json().catch(() => ({}));
    if (!r.ok || data.error) throw new Error(data.error || `HTTP ${r.status}`);
    return data; // { text, language, cached, latency_ms, model }
  }

  /**
   * Push-to-talk on a button: tap to start and tap again to stop, or hold and release. Keyboard Enter/Space toggles.
   * onState('starting' | 'recording' | 'transcribing' | 'idle' | 'denied' | 'error'), onText(text, data).
   */
  function recorder({ onState = () => {}, onText = () => {}, maxMs = 30_000, lang = getLang } = {}) {
    let rec = null; let starting = false; let pendingStop = false; let chunks = []; let timer = null;
    const pickMime = () => { for (const m of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) if (window.MediaRecorder?.isTypeSupported?.(m)) return m; return ''; };
    async function start() {
      if (rec || starting) return;
      stop(); unlock(); // the client starts talking: AIM stops
      if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) return onState('denied');
      starting = true; onState('starting');
      let stream;
      try { stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); } catch { starting = false; return onState('denied'); }
      const mime = pickMime(); chunks = [];
      const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
      r.onstop = async () => {
        clearTimeout(timer); stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunks, { type: r.mimeType || mime || 'audio/webm' }); rec = null;
        if (blob.size < 1200) return onState('idle');
        onState('transcribing');
        try {
          const data = await transcribe(blob, lang());
          onState('idle');
          if (data.text) onText(data.text, data); else onState('error');
        } catch (e) { console.warn('[voice] asr', e); onState('error'); }
      };
      rec = r; starting = false;
      r.start(); onState('recording');
      timer = setTimeout(() => r.state === 'recording' && r.stop(), maxMs);
      if (pendingStop) { pendingStop = false; r.stop(); }
    }
    function finish() { if (rec?.state === 'recording') rec.stop(); else if (starting) pendingStop = true; }
    const active = () => Boolean(rec) || starting;
    function bind(btn) {
      let downAt = 0; let startedHere = false;
      btn.addEventListener('pointerdown', (e) => {
        if (e.button) return;
        downAt = Date.now(); startedHere = !active();
        if (startedHere) start();
      });
      const release = () => { if (startedHere && Date.now() - downAt > 450 && active()) finish(); }; // held → release sends
      btn.addEventListener('pointerup', release);
      btn.addEventListener('pointercancel', release);
      btn.addEventListener('contextmenu', (e) => e.preventDefault()); // long-press on phones
      btn.addEventListener('click', (e) => {
        if (e.detail === 0) { active() ? finish() : start(); return; } // keyboard
        if (!startedHere && active()) finish(); // second tap stops
        startedHere = false;
      });
    }
    return { start, stop: finish, active, bind, recording: () => Boolean(rec) };
  }

  return { speak, stop, prefetch, unlock, transcribe, recorder, config, chunksOf, speaking: () => speaking, stats, browserSpeak };
}

/** Decode any recorded blob and re-encode it as 16 kHz mono 16-bit PCM WAV (≈ 32 KB per second). */
export async function toWav16k(blob) {
  const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx || !window.OfflineAudioContext) throw new Error('no WebAudio');
  const ctx = new Ctx(); const decoded = await ctx.decodeAudioData(await blob.arrayBuffer()); ctx.close?.();
  const rate = 16000; const frames = Math.ceil(decoded.duration * rate);
  const off = new OfflineAudioContext(1, frames, rate);
  const src = off.createBufferSource(); src.buffer = decoded; src.connect(off.destination); src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2); const v = new DataView(buf);
  const str = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  str(0, 'RIFF'); v.setUint32(4, 36 + pcm.length * 2, true); str(8, 'WAVE'); str(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, 'data'); v.setUint32(40, pcm.length * 2, true);
  for (let i = 0; i < pcm.length; i++) { const x = Math.max(-1, Math.min(1, pcm[i])); v.setInt16(44 + i * 2, x < 0 ? x * 0x8000 : x * 0x7fff, true); }
  return new Blob([buf], { type: 'audio/wav' });
}
