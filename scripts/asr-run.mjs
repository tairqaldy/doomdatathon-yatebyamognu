// Transcribe the call recordings with Nemotron 3.5 Transcribe and compare with the organizers' transcripts.
//   node scripts/asr-run.mjs [--group DEV]   → eval/runs/<stamp>-asr.json (WER, CER, latency, cost) + data/transcripts/<id>.json
// Reference = organizer transcript text joined in order (all speakers). Normalization: lowercase, strip punctuation, collapse spaces.
import { writeFile, mkdir } from 'node:fs/promises';
import { loadEnv } from './env.mjs';
loadEnv();
const { loadDataset } = await import('../lib/data.js');
const { resolveAudio, downloadBase64 } = await import('../lib/audio.js');
const { transcribe, MODELS } = await import('../lib/openrouter.js');
const { cached } = await import('../lib/cache.js');

const group = process.argv.includes('--group') ? process.argv[process.argv.indexOf('--group') + 1] : 'DEV';
const norm = (s) => s.toLowerCase().replace(/\[[^\]]*\]/g, ' ').replace(/[^\p{L}\p{N}\s]/gu, ' ').replace(/\s+/g, ' ').trim();
function edit(a, b) { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; }
const wer = (ref, hyp) => { const r = norm(ref).split(' ').filter(Boolean), h = norm(hyp).split(' ').filter(Boolean); return r.length ? edit(r, h) / r.length : null; };
const cer = (ref, hyp) => { const r = [...norm(ref).replace(/ /g, '')], h = [...norm(hyp).replace(/ /g, '')]; return r.length ? edit(r, h) / r.length : null; };

const ds = await loadDataset(group); const calls = ds.data.records.filter((c) => c.audio_url);
const rows = [];
await mkdir('data/transcripts', { recursive: true });
for (const c of calls) {
  const lang = { RU: 'ru', KZ: 'kk', EN: 'en' }[c.language];
  try {
    const r = await cached('asr', [MODELS.transcribe, c.conversation_id, lang], async () => {
      const { base64, bytes } = await downloadBase64(await resolveAudio(c.audio_url));
      return { ...(await transcribe({ base64, format: 'mp3', language: lang })), bytes };
    });
    const ref = c.transcript.filter((t) => t.speaker !== 'system').map((t) => t.text).join(' ');
    const row = { id: c.conversation_id, cached: r.cached, latency_ms: r.value.latency_ms, cost: r.value.usage?.cost ?? null, wer: wer(ref, r.value.text), cer: cer(ref, r.value.text), ref_words: norm(ref).split(' ').length };
    rows.push(row); await writeFile(`data/transcripts/${c.conversation_id}.json`, JSON.stringify(r.value, null, 1));
    console.log(`${r.cached ? '·' : '✓'} ${c.conversation_id} WER ${(row.wer * 100).toFixed(1)}% CER ${(row.cer * 100).toFixed(1)}% ${row.latency_ms}ms`);
  } catch (e) { rows.push({ id: c.conversation_id, error: e.message }); console.log(`✗ ${c.conversation_id} ${e.message}`); }
}
const ok = rows.filter((r) => r.wer != null);
const avg = (k) => (ok.length ? ok.reduce((s, r) => s + r[k], 0) / ok.length : null);
const report = { model: MODELS.transcribe, at: new Date().toISOString(), n: rows.length, wer_mean: avg('wer'), cer_mean: avg('cer'), latency_ms_mean: avg('latency_ms'), cost_usd: rows.reduce((s, r) => s + (r.cost || 0), 0), note: 'Reference = organizer transcripts (themselves ASR output), so this measures agreement, not true accuracy. 5 calls only.', rows };
await mkdir('eval/runs', { recursive: true });
await writeFile(`eval/runs/${report.at.replace(/[:.]/g, '-')}-asr.json`, JSON.stringify(report, null, 2));
console.log(`\nWER ${(report.wer_mean * 100).toFixed(1)}% · CER ${(report.cer_mean * 100).toFixed(1)}% · ${report.cost_usd.toFixed(4)} USD`);
