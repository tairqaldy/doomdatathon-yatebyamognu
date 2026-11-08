#!/usr/bin/env node
// Soft UI sounds for the demo video, synthesized in code (no samples, no npm deps), mixed under the voiceover → WAV.
//   node scripts/demo/sfx.mjs --events /tmp/cqa-demo-events.json [--voice voice.wav] --out /tmp/mix.wav [--peak-db -20]
// events.json is written by `record.mjs --cut short`: { "duration_ms": 52350, "sfx": [{ "t": 1234, "s": "click" }, …] }
// (t = ms in the final video). Sounds:
//   click  ~30 ms: band-limited noise burst + a short 3.2 kHz tick (6 dB under the others)
//   done   gentle two-note chime A5 → E6 (sine + soft 2nd harmonic, bell-like decay): checklist saved, evaluation done, decision saved
//   alert  muted low two-note tone A3 → F3 (warm, low-passed): the gross-error banner
// SFX peak ≈ --peak-db (−20 dBFS). The voice (PCM WAV: 16/24-bit int or 32-bit float, any rate, mono/stereo) is
// converted to 48 kHz mono and stays on top; a soft limiter keeps the sum under 0 dBFS. Output: 48 kHz mono 16-bit WAV
// as long as the voice or the video, whichever is longer. Then: swift scripts/demo/mux.swift demo.mp4 mix.wav demo.mp4
import { readFileSync, writeFileSync } from 'node:fs';

const argv = process.argv.slice(2);
const opt = (n, d) => { const i = argv.indexOf(`--${n}`); return i >= 0 && argv[i + 1] ? argv[i + 1] : d; };
const EVENTS = opt('events', ''), VOICE = opt('voice', ''), OUT = opt('out', '');
const PEAK = 10 ** (Number(opt('peak-db', -20)) / 20);
if (!EVENTS || !OUT) { console.error('usage: node sfx.mjs --events events.json [--voice voice.wav] --out mix.wav [--peak-db -20]'); process.exit(2); }
const SR = 48000;

/* ── synthesis ── */
let seed = 12345; const noise = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x3fffffff) - 1;
function normalize(a, peak) { let m = 0; for (const v of a) m = Math.max(m, Math.abs(v)); return a.map((v) => (m ? (v / m) * peak : 0)); }
function click() {
  const n = Math.round(SR * 0.03); const a = new Float32Array(n); let lp = 0, hp = 0, prev = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; const x = noise();
    lp += 0.35 * (x - lp); hp = 0.85 * (hp + lp - prev); prev = lp;              // ~2–6 kHz band
    a[i] = hp * Math.exp(-t / 0.005) + 0.7 * Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t / 0.007);
    if (i < 48) a[i] *= i / 48;                                                    // 1 ms attack, no pop
  }
  return normalize(a, PEAK * 0.5);
}
function note(f, dur, tau, harm = 0.22) {
  const n = Math.round(SR * dur); const a = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR; const env = Math.min(1, t / 0.006) * Math.exp(-t / tau) * Math.min(1, (dur - t) / 0.02);
    a[i] = env * (Math.sin(2 * Math.PI * f * t) + harm * Math.sin(2 * Math.PI * 2 * f * t) + 0.06 * Math.sin(2 * Math.PI * 3 * f * t));
  }
  return a;
}
function seq(parts) { // [[startSec, Float32Array]]
  const n = Math.max(...parts.map(([s, a]) => Math.round(s * SR) + a.length)); const out = new Float32Array(n);
  for (const [s, a] of parts) { const o = Math.round(s * SR); for (let i = 0; i < a.length; i++) out[o + i] += a[i]; }
  return out;
}
const done = () => normalize(seq([[0, note(880, 0.55, 0.16)], [0.11, note(1318.5, 0.7, 0.22)]]), PEAK);
function alert() {
  const a = seq([[0, note(220, 0.32, 0.12, 0.35)], [0.2, note(174.6, 0.42, 0.16, 0.35)]]);
  let lp = 0; for (let i = 0; i < a.length; i++) { lp += 0.18 * (a[i] - lp); a[i] = lp; } // muted: one-pole low-pass
  return normalize(a, PEAK * 0.9);
}
const SOUNDS = { click: click(), done: done(), alert: alert() };

/* ── WAV io ── */
function readWav(file) {
  const b = readFileSync(file);
  if (b.toString('ascii', 0, 4) !== 'RIFF' || b.toString('ascii', 8, 12) !== 'WAVE') throw new Error(`${file}: not a WAV file (convert it first, e.g. afconvert -f WAVE -d LEI16 in.m4a out.wav)`);
  let p = 12, fmt = null, data = null;
  while (p + 8 <= b.length) {
    const id = b.toString('ascii', p, p + 4), size = b.readUInt32LE(p + 4);
    if (id === 'fmt ') fmt = { format: b.readUInt16LE(p + 8), ch: b.readUInt16LE(p + 10), rate: b.readUInt32LE(p + 12), bits: b.readUInt16LE(p + 22) };
    // an unfinalized recorder leaves size 0 (or 0xFFFFFFFF) in the header: then the samples run to the end of the file
    if (id === 'data') { const rest = b.length - p - 8; data = b.subarray(p + 8, p + 8 + (size === 0 || size > rest ? rest : size)); break; }
    p += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error(`${file}: no fmt/data chunk`);
  const fmtCode = fmt.format === 0xfffe ? (fmt.bits === 32 ? 3 : 1) : fmt.format; // WAVE_FORMAT_EXTENSIBLE: guess from bits
  const bps = fmt.bits / 8, frames = Math.floor(data.length / (bps * fmt.ch)); const mono = new Float32Array(frames);
  const rd = (o) => (fmtCode === 3 ? data.readFloatLE(o) : bps === 2 ? data.readInt16LE(o) / 32768 : bps === 3 ? data.readIntLE(o, 3) / 8388608 : data.readInt32LE(o) / 2147483648);
  for (let i = 0; i < frames; i++) { let s = 0; for (let c = 0; c < fmt.ch; c++) s += rd((i * fmt.ch + c) * bps); mono[i] = s / fmt.ch; }
  if (fmt.rate === SR) return mono;
  const n = Math.floor((frames * SR) / fmt.rate); const out = new Float32Array(n); // linear resample
  for (let i = 0; i < n; i++) { const x = (i * fmt.rate) / SR, j = Math.floor(x), f = x - j; out[i] = (mono[j] || 0) * (1 - f) + (mono[j + 1] || 0) * f; }
  return out;
}
function writeWav(file, a) {
  const b = Buffer.alloc(44 + a.length * 2);
  b.write('RIFF', 0); b.writeUInt32LE(36 + a.length * 2, 4); b.write('WAVE', 8); b.write('fmt ', 12); b.writeUInt32LE(16, 16);
  b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22); b.writeUInt32LE(SR, 24); b.writeUInt32LE(SR * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34);
  b.write('data', 36); b.writeUInt32LE(a.length * 2, 40);
  for (let i = 0; i < a.length; i++) b.writeInt16LE(Math.round(Math.max(-1, Math.min(1, a[i])) * 32767), 44 + i * 2);
  writeFileSync(file, b);
}

/* ── mix ── */
const ev = JSON.parse(readFileSync(EVENTS, 'utf8'));
const voice = VOICE ? readWav(VOICE) : new Float32Array(0);
const n = Math.max(voice.length, Math.ceil(((ev.duration_ms || 0) / 1000) * SR));
const mix = new Float32Array(n); mix.set(voice);
const count = {};
for (const e of ev.sfx || []) {
  const s = SOUNDS[e.s]; if (!s) continue; count[e.s] = (count[e.s] || 0) + 1;
  const o = Math.round((e.t / 1000) * SR); for (let i = 0; i < s.length && o + i < n; i++) mix[o + i] += s[i];
}
let clipped = 0;
for (let i = 0; i < n; i++) { const v = mix[i], m = Math.abs(v); if (m > 0.9) { mix[i] = Math.sign(v) * (0.9 + 0.099 * Math.tanh((m - 0.9) / 0.099)); clipped++; } }
writeWav(OUT, mix);
console.log(`${OUT}: ${(n / SR).toFixed(2)} s, voice ${(voice.length / SR).toFixed(2)} s, video ${((ev.duration_ms || 0) / 1000).toFixed(2)} s, sounds ${JSON.stringify(count)}, peak ${(20 * Math.log10(PEAK)).toFixed(0)} dBFS${clipped ? `, ${clipped} samples soft-limited` : ''}`);
