// How good are the organizers' call transcripts? Compare them with three independent ASR engines.
//   node eval/asr-compare.mjs [--group DEV]   → eval/runs/asr-compare-<group>.json (metrics only, no transcript text)
// WER/CER between two systems is symmetric: a high number alone does not say which side is wrong. So we run
// gpt-4o-transcribe, whisper-1 and Nemotron 3.5 on the same recordings and measure two things for every system:
//   1. pairwise WER/CER (with substitutions / deletions / insertions) against every other system;
//   2. "outvoted" rate: share of a system's words where at least 2 of the 3 other systems agree on one different word.
// If the organizer text is the outlier, its outvoted rate is far above the engines'. Raw texts go to
// data/transcripts/ (gitignored: our ASR can hear names the organizers masked).
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from '../scripts/env.mjs';
loadEnv();
const { loadDataset } = await import('../lib/data.js');
const { resolveAudio, downloadBase64 } = await import('../lib/audio.js');
const openrouter = await import('../lib/openrouter.js');
const openai = await import('../lib/openai.js');
const { cached } = await import('../lib/cache.js');

const arg = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d);
const group = arg('--group', 'DEV');

const ENGINES = [
  { id: 'gpt-4o-transcribe', run: (a) => openai.transcribe({ ...a, model: 'gpt-4o-transcribe' }) },
  { id: 'whisper-1', run: (a) => openai.transcribe({ ...a, model: 'whisper-1' }) },
  { id: openrouter.MODELS.transcribe, run: (a) => openrouter.transcribe(a) },
];
const STRICT = ['organizer', 'gpt-4o-transcribe', openrouter.MODELS.transcribe];

// Normalization: lowercase, ё→е, drop [tags] and punctuation, collapse spaces. Digits stay as written.
const norm = (s) => s.toLowerCase().replace(/ё/g, 'е').replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
const words = (s) => norm(s).split(' ').filter(Boolean);

// Levenshtein with backtrace → { dist, S, D, I, align: [[refIdx|null, hypIdx|null], ...] }
function alignSeq(r, h) {
  const n = r.length, m = h.length, W = m + 1, d = new Int32Array((n + 1) * W);
  for (let j = 0; j <= m; j++) d[j] = j;
  for (let i = 1; i <= n; i++) {
    d[i * W] = i;
    for (let j = 1; j <= m; j++) {
      const sub = d[(i - 1) * W + j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1);
      d[i * W + j] = Math.min(sub, d[(i - 1) * W + j] + 1, d[i * W + j - 1] + 1);
    }
  }
  let i = n, j = m, S = 0, D = 0, I = 0; const align = [];
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && d[i * W + j] === d[(i - 1) * W + j - 1] + (r[i - 1] === h[j - 1] ? 0 : 1)) { if (r[i - 1] !== h[j - 1]) S++; align.push([i - 1, j - 1]); i--; j--; }
    else if (i > 0 && d[i * W + j] === d[(i - 1) * W + j] + 1) { D++; align.push([i - 1, null]); i--; }
    else { I++; align.push([null, j - 1]); j--; }
  }
  return { dist: d[n * W + m], S, D, I, align: align.reverse() };
}
// Character distance only (two rows; char sequences are ~4k long).
function charDist(a, b) {
  let prev = new Int32Array(b.length + 1).map((_, j) => j), cur = new Int32Array(b.length + 1);
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}
const chars = (s) => [...norm(s).replace(/ /g, '')];

const ds = await loadDataset(group);
const calls = ds.data.records.filter((c) => c.audio_url);
await mkdir('data/transcripts', { recursive: true });
const perCall = [];
let cost = 0;

for (const c of calls) {
  const lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[c.language];
  let audio = null; // download once per call, only if some engine misses the cache
  const getAudio = async () => (audio ||= downloadBase64(await resolveAudio(c.audio_url)));
  const texts = { organizer: c.transcript.filter((t) => t.speaker !== 'system').map((t) => t.text).join(' ') };
  const meta = {};
  await Promise.all(ENGINES.map(async (e) => {
    try {
      const r = await cached('asr', [e.id, c.conversation_id, lang], async () => {
        const { base64, bytes } = await getAudio();
        return { ...(await e.run({ base64, format: 'mp3', language: lang })), bytes };
      });
      texts[e.id] = r.value.text;
      const ecost = r.value.usage?.cost ?? 0;
      meta[e.id] = { cached: r.cached, latency_ms: r.value.latency_ms, duration_s: r.value.duration ?? null, cost: ecost };
      if (!r.cached) cost += ecost;
    } catch (err) { meta[e.id] = { error: err.message }; console.log(`✗ ${c.conversation_id} ${e.id}: ${err.message}`); }
  }));
  await writeFile(`data/transcripts/${c.conversation_id}.compare.json`, JSON.stringify({ texts, meta }, null, 1));

  const sys = Object.keys(texts), W = Object.fromEntries(sys.map((s) => [s, words(texts[s])])), C = Object.fromEntries(sys.map((s) => [s, chars(texts[s])]));
  const pairs = {};
  for (const a of sys) for (const b of sys) if (a !== b) {
    const al = alignSeq(W[a], W[b]);
    pairs[`${a}|${b}`] = { ref: a, hyp: b, ref_words: W[a].length, wer: al.dist / W[a].length, S: al.S, D: al.D, I: al.I, cer: charDist(C[a], C[b]) / C[a].length, _align: al.align };
  }
  // Outvoted rate: for each word of X, the aligned token of every other system in the subset (null = deleted there).
  const outvotedIn = (subset) => Object.fromEntries(subset.filter((s) => W[s]).map((x) => {
    const others = subset.filter((s) => s !== x && W[s]), at = others.map(() => new Array(W[x].length).fill(null));
    others.forEach((o, k) => { for (const [ri, hi] of pairs[`${x}|${o}`]._align) if (ri !== null) at[k][ri] = hi === null ? null : W[o][hi]; });
    let n = 0;
    for (let i = 0; i < W[x].length; i++) {
      const votes = {}; for (let k = 0; k < others.length; k++) { const t = at[k][i]; if (t !== null && t !== W[x][i]) votes[t] = (votes[t] || 0) + 1; }
      if (Object.values(votes).some((v) => v >= 2)) n++;
    }
    return [x, { words: W[x].length, outvoted: n, rate: W[x].length ? n / W[x].length : null }];
  }));
  const outvoted = outvotedIn(sys);
  // whisper-1 loops and truncates on these recordings, so the strict test leaves it out: a word of X counts
  // only when BOTH remaining systems agree with each other on the same different word.
  const outvoted_strict = outvotedIn(STRICT);
  // Local-only list of organizer words both strong engines overrule, with context (gitignored folder).
  if (W[STRICT[1]] && W[STRICT[2]]) {
    const map = (o) => { const m = new Array(W.organizer.length).fill(null); for (const [ri, hi] of pairs[`organizer|${o}`]._align) if (ri !== null && hi !== null) m[ri] = W[o][hi]; return m; };
    const a = map(STRICT[1]), b = map(STRICT[2]), lines = [];
    for (let i = 0; i < W.organizer.length; i++) if (a[i] && a[i] === b[i] && a[i] !== W.organizer[i]) lines.push(`${W.organizer[i]} → ${a[i]}   | ${W.organizer.slice(Math.max(0, i - 4), i + 5).join(' ')}`);
    await writeFile(`data/transcripts/${c.conversation_id}.organizer-outvoted.txt`, lines.join('\n'));
  }
  for (const p of Object.values(pairs)) delete p._align;
  perCall.push({ id: c.conversation_id, language: c.language, engines: meta, words: Object.fromEntries(sys.map((s) => [s, W[s].length])), pairs, outvoted, outvoted_strict });
  console.log(`${c.conversation_id}  outvoted: ${sys.map((s) => `${s} ${(outvoted[s].rate * 100).toFixed(1)}%`).join(' · ')}`);
}

// Pooled over calls (sum of edits / sum of reference words), the standard way to report WER on a set.
const systems = [...new Set(perCall.flatMap((c) => Object.keys(c.words)))];
const pooled = {};
for (const a of systems) for (const b of systems) if (a !== b) {
  const ps = perCall.map((c) => c.pairs[`${a}|${b}`]).filter(Boolean);
  const rw = ps.reduce((s, p) => s + p.ref_words, 0), sum = (k) => ps.reduce((s, p) => s + p[k], 0);
  pooled[`${a}|${b}`] = { wer: (sum('S') + sum('D') + sum('I')) / rw, sub_rate: sum('S') / rw, del_rate: sum('D') / rw, ins_rate: sum('I') / rw, cer_mean: sum('cer') / ps.length, ref_words: rw };
}
const poolOutvoted = (key, list) => Object.fromEntries(list.map((s) => {
  const o = perCall.map((c) => c[key][s]).filter(Boolean), w = o.reduce((t, x) => t + x.words, 0), n = o.reduce((t, x) => t + x.outvoted, 0);
  return [s, { words: w, outvoted: n, rate: n / w }];
}));
const outvotedPooled = poolOutvoted('outvoted', systems), outvotedStrict = poolOutvoted('outvoted_strict', STRICT);
// Mean WER of each system against the three others (lower = closer to the consensus).
const meanToOthers = Object.fromEntries(systems.map((s) => {
  const xs = systems.filter((o) => o !== s).map((o) => pooled[`${o}|${s}`].wer);
  return [s, xs.reduce((a, b) => a + b, 0) / xs.length];
}));

const report = {
  at: new Date().toISOString(), group, calls: perCall.length, systems,
  method: 'Normalized text (lowercase, ё→е, no punctuation). Organizer text = all bot/client/operator turns joined in order, system events dropped. Pooled WER = (S+D+I)/reference words. Outvoted = word of system X where ≥2 of the 3 other systems agree on the same different word.',
  caveats: [
    'No human reference: this measures disagreement, plus who is outvoted by independent engines; it is not ground-truth WER.',
    'Organizer transcription pauses during transfer/hold ("Запись и транскрибирование приостановлены"), so engines hear speech the organizer text never covers: this shows as insertions, not as organizer mistakes. Substitutions and the outvoted rate are the fair signals.',
    'Digits vs words (2 vs два) and spelling of brand names count as errors for every system alike.',
  ],
  outvoted_strict: { systems: STRICT, note: 'whisper-1 left out (repetition loops, truncation). Word of X counted when both other systems agree on one different word.', ...outvotedStrict },
  outvoted: outvotedPooled, mean_wer_to_others: meanToOthers, pooled, new_cost_usd: +cost.toFixed(4), per_call: perCall,
};
await mkdir('eval/runs', { recursive: true });
await writeFile(`eval/runs/asr-compare-${group}.json`, JSON.stringify(report, null, 2));
const pct = (x) => `${(x * 100).toFixed(1)}%`;
console.log('\nStrict outvoted rate (both other systems agree on a different word):');
for (const s of STRICT) console.log(`  ${s.padEnd(32)} ${pct(outvotedStrict[s].rate)}  (${outvotedStrict[s].outvoted}/${outvotedStrict[s].words})`);
console.log('\nOutvoted rate (share of words the other systems overrule):');
for (const s of systems) console.log(`  ${s.padEnd(32)} ${pct(outvotedPooled[s].rate)}  (${outvotedPooled[s].outvoted}/${outvotedPooled[s].words})   mean WER to others ${pct(meanToOthers[s])}`);
console.log('\nOrganizer as hypothesis vs each engine as reference (WER · sub · del · ins · CER):');
for (const s of systems.filter((x) => x !== 'organizer')) { const p = pooled[`${s}|organizer`]; console.log(`  ref ${s.padEnd(28)} ${pct(p.wer)} · S ${pct(p.sub_rate)} · D ${pct(p.del_rate)} · I ${pct(p.ins_rate)} · CER ${pct(p.cer_mean)}`); }
console.log('\nEngine vs engine:');
for (const a of systems.filter((x) => x !== 'organizer')) for (const b of systems.filter((x) => x !== 'organizer' && x !== a)) { const p = pooled[`${a}|${b}`]; console.log(`  ${a} → ${b}: WER ${pct(p.wer)} · S ${pct(p.sub_rate)} · CER ${pct(p.cer_mean)}`); }
console.log(`\nNew spend: $${report.new_cost_usd}`);
