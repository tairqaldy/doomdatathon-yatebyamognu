// Voice latency bench for AIM: OpenAI speech-to-text and text-to-speech, cold vs cached.
//   node scripts/voice-bench.mjs --models                 direct API, compares ASR + TTS models (uncached on purpose: it measures cold calls)
//   node scripts/voice-bench.mjs --http http://localhost:3000   end to end through /api/speak and /api/agent-voice, cold then cached
// Both write eval/runs/voice-bench-<mode>-<timestamp>.json. Test audio is synthetic (TTS reads the client phrases with
// another voice), so no real client voice is used; the generated clips are cached in eval/cache/tts/ (gitignored).
// Cost of a full --models run ≈ $0.10 (12 phrases × 2 TTS models + 12 clips × 4 ASR models).
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const openai = await import('../lib/openai.js');
const { cached } = await import('../lib/cache.js');

const args = process.argv.slice(2);
const MODE = args.includes('--http') ? 'http' : 'models';
const BASE = MODE === 'http' ? (args[args.indexOf('--http') + 1] || 'http://localhost:3000').replace(/\/$/, '') : null;
const ASR_MODELS = (process.env.BENCH_ASR_MODELS || 'whisper-1,gpt-4o-mini-transcribe,gpt-4o-transcribe,gpt-transcribe').split(',');
const TTS_MODELS = (process.env.BENCH_TTS_MODELS || 'gpt-4o-mini-tts,tts-1').split(',');

// What AIM says (TTS) and what a client says (ASR), per language. Typical first sentences of real replies.
const REPLIES = {
  RU: ['Здравствуйте! Я AIM, помощник Freedom Broker.', 'Чтобы пополнить счёт, откройте раздел «Пополнение».',
    'Выберите способ оплаты и введите сумму в тенге.', 'Хотите, я открою нужный экран и заполню поля за вас?'],
  KZ: ['Сәлеметсіз бе! Мен AIM, Freedom Broker көмекшісімін.', 'Шотты толықтыру үшін «Толықтыру» бөлімін ашыңыз.',
    'Төлем тәсілін таңдап, соманы теңгемен енгізіңіз.', 'Қажетті экранды ашып, өрістерді толтырып берейін бе?'],
  EN: ['Hello! I am AIM, the Freedom Broker assistant.', 'To add funds, open the Deposit section.',
    'Choose a payment method and enter the amount in tenge.', 'Would you like me to open the right screen and fill in the fields for you?'],
};
const CLIENT = {
  RU: ['Как пополнить счёт на пятьдесят тысяч тенге?', 'Хочу вывести деньги на карту Каспи.', 'Какой у вас тариф на покупку облигаций?', 'Позовите, пожалуйста, живого специалиста.'],
  KZ: ['Шотты елу мың теңгеге қалай толықтырамын?', 'Ақшаны Каспи картасына шығарғым келеді.', 'Облигация сатып алу тарифі қандай?', 'Маманды шақырыңызшы.'],
  EN: ['How do I add fifty thousand tenge to my account?', 'I want to withdraw money to my card.', 'What is your fee for buying bonds?', 'Please connect me to a real person.'],
};
const LONG = {
  RU: 'Чтобы пополнить счёт, откройте раздел «Пополнение». Выберите способ оплаты и валюту. Затем введите сумму и подтвердите платёж в приложении банка.',
  KZ: 'Шотты толықтыру үшін «Толықтыру» бөлімін ашыңыз. Төлем тәсілі мен валютаны таңдаңыз. Содан кейін соманы енгізіп, банк қосымшасында растаңыз.',
  EN: 'To add funds, open the Deposit section. Choose a payment method and currency. Then enter the amount and confirm the payment in your banking app.',
};
const ISO = { RU: 'ru', KZ: 'kk', EN: 'en' };

const pct = (xs, p) => { const s = [...xs].filter(Number.isFinite).sort((a, b) => a - b); if (!s.length) return null; return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const stats = (xs) => ({ n: xs.length, p50: pct(xs, 50), p95: pct(xs, 95), min: pct(xs, 0.0001), max: pct(xs, 100) });
const norm = (s) => s.toLowerCase().replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim();
function cer(ref, hyp) {
  const a = [...norm(ref)], b = [...norm(hyp)];
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return a.length ? +(prev[b.length] / a.length).toFixed(3) : 0;
}

/** Client utterance as audio: TTS with a different voice, cached so reruns cost nothing. */
async function clip(text) {
  const r = await cached('tts', ['bench-client-clip', 'gpt-4o-mini-tts', 'ash', text], () =>
    openai.speak({ text, voice: 'ash', model: 'gpt-4o-mini-tts', instructions: 'Speak like an ordinary customer asking a question on the phone.' }));
  return r.value.audio;
}

const out = { mode: MODE, at: new Date().toISOString(), base: BASE, defaults: { asr: openai.VOICE.asr(), tts: openai.VOICE.tts(), voice: openai.VOICE.voice() } };

if (MODE === 'models') {
  out.tts = {};
  for (const model of TTS_MODELS) {
    const rows = [];
    for (const [lang, list] of Object.entries(REPLIES)) for (const text of list) {
      const r = await openai.speak({ text, model }).catch((e) => ({ error: e.message }));
      rows.push({ lang, chars: text.length, latency_ms: r.latency_ms ?? null, kb: r.audio ? Math.round((r.audio.length * 3) / 4 / 1024) : null, error: r.error });
      process.stdout.write('.');
    }
    // Time to first audio for a 3-sentence reply: the whole reply at once vs only its first sentence.
    const firstVsWhole = [];
    for (const [lang, text] of Object.entries(LONG)) {
      const whole = await openai.speak({ text, model }).catch(() => null);
      const first = await openai.speak({ text: text.split(/(?<=[.!?])\s+/)[0], model }).catch(() => null);
      firstVsWhole.push({ lang, whole_ms: whole?.latency_ms ?? null, first_sentence_ms: first?.latency_ms ?? null });
    }
    out.tts[model] = { latency: stats(rows.map((r) => r.latency_ms)), first_vs_whole: firstVsWhole, rows };
  }
  out.asr = {};
  const clips = [];
  for (const [lang, list] of Object.entries(CLIENT)) for (const text of list) clips.push({ lang, text, audio: await clip(text) });
  for (const model of ASR_MODELS) {
    const rows = [];
    for (const c of clips) {
      const r = await openai.transcribe({ base64: c.audio, format: 'mp3', language: ISO[c.lang], model }).catch((e) => ({ error: e.message }));
      rows.push({ lang: c.lang, ref: c.text, hyp: r.text ?? null, cer: r.text != null ? cer(c.text, r.text) : null, latency_ms: r.latency_ms ?? null, error: r.error });
      process.stdout.write('.');
    }
    const ok = rows.filter((r) => r.cer != null);
    const byLang = Object.fromEntries(Object.keys(CLIENT).map((l) => [l, +(ok.filter((r) => r.lang === l).reduce((s, r) => s + r.cer, 0) / Math.max(1, ok.filter((r) => r.lang === l).length)).toFixed(3)]));
    out.asr[model] = { latency: stats(rows.map((r) => r.latency_ms)), mean_cer: +(ok.reduce((s, r) => s + r.cer, 0) / Math.max(1, ok.length)).toFixed(3), cer_by_lang: byLang, errors: rows.filter((r) => r.error).length, rows };
  }
} else {
  const post = async (path, body) => {
    const t0 = performance.now();
    const r = await fetch(`${BASE}${path}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json().catch(() => ({}));
    return { status: r.status, wall_ms: Math.round(performance.now() - t0), server_ms: j.server_ms ?? null, cached: j.cached ?? null, tier: j.tier ?? null, error: j.error };
  };
  const ttsRows = [];
  for (const [lang, list] of Object.entries(REPLIES)) for (const text of list) {
    const cold = await post('/api/speak', { text, language: lang });
    const warm = await post('/api/speak', { text, language: lang });
    ttsRows.push({ lang, chars: text.length, cold, warm }); process.stdout.write('.');
  }
  const asrRows = [];
  for (const [lang, list] of Object.entries(CLIENT)) for (const text of list) {
    const audio = await clip(text);
    const cold = await post('/api/agent-voice', { audio, format: 'mp3', language: lang });
    const warm = await post('/api/agent-voice', { audio, format: 'mp3', language: lang });
    asrRows.push({ lang, cold, warm }); process.stdout.write('.');
  }
  const pick = (rows, k, f) => rows.filter((r) => k !== 'cold' || !r.cold.cached).map((r) => r[k][f]); // cold stats: only real misses
  out.tts = { cold_wall: stats(pick(ttsRows, 'cold', 'wall_ms')), cached_wall: stats(pick(ttsRows, 'warm', 'wall_ms')), cold_server: stats(pick(ttsRows, 'cold', 'server_ms')), cached_server: stats(pick(ttsRows, 'warm', 'server_ms')),
    cold_was_cached: ttsRows.filter((r) => r.cold.cached).length, warm_cached: ttsRows.filter((r) => r.warm.cached).length, rows: ttsRows };
  out.asr = { cold_wall: stats(pick(asrRows, 'cold', 'wall_ms')), cached_wall: stats(pick(asrRows, 'warm', 'wall_ms')), cold_server: stats(pick(asrRows, 'cold', 'server_ms')), cached_server: stats(pick(asrRows, 'warm', 'server_ms')),
    cold_was_cached: asrRows.filter((r) => r.cold.cached).length, warm_cached: asrRows.filter((r) => r.warm.cached).length, rows: asrRows };
}

await mkdir('eval/runs', { recursive: true });
const file = `eval/runs/voice-bench-${MODE}-${out.at.replace(/[:.]/g, '-')}.json`;
await writeFile(file, JSON.stringify(out, null, 1));
console.log(`\n${file}`);
const show = (o) => o && `p50 ${o.p50} ms · p95 ${o.p95} ms (n=${o.n})`;
if (MODE === 'models') {
  for (const [m, v] of Object.entries(out.tts)) console.log(`TTS ${m}: ${show(v.latency)} · 3-sentence reply ${v.first_vs_whole.map((x) => `${x.lang} whole ${x.whole_ms} / first ${x.first_sentence_ms}`).join(', ')}`);
  for (const [m, v] of Object.entries(out.asr)) console.log(`ASR ${m}: ${show(v.latency)} · CER ${v.mean_cer} ${JSON.stringify(v.cer_by_lang)} · errors ${v.errors}`);
} else {
  for (const k of ['tts', 'asr']) console.log(`${k.toUpperCase()} cold ${show(out[k].cold_wall)} | cached ${show(out[k].cached_wall)} | cached hits ${out[k].warm_cached}/${out[k].rows.length} (cold already cached: ${out[k].cold_was_cached})`);
}
