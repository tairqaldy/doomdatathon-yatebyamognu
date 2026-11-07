// Audio criteria (checklist criteria with input: "audio"), e.g. c09 «Тон и подача речи» on voice calls.
// The transcript cannot show intonation, so the model listens to the call recording itself.
// Same split as the text evaluator: the model picks the scale step + explanation + operator turns as evidence;
// prototype/scoring.js computes the points. Voice metrics below are plain arithmetic on transcript timestamps.
import { chatAudioJSON } from './llm.js';
import { cached } from './cache.js';
import { resolveAudio, downloadBase64 } from './audio.js';
import { normalize } from './evaluator.js';

export const TONE_PROMPT_VERSION = 'tone-v3';
export const TONE_MODEL = process.env.CQA_TONE_MODEL || 'openai:gpt-audio-mini';

export const isAudioCriterion = (c) => c?.input === 'audio';

/* Call timestamps mark when a segment ENDS (a 23-word bot greeting is stamped 1.7 s after the previous line), so
   turn i is spoken between ends[i-1] and ends[i]. Seconds from the first transcript event, like the card's player. */
function ends(conv) {
  const t0 = Date.parse(conv.transcript[0]?.timestamp);
  return conv.transcript.map((m) => { const t = Date.parse(m.timestamp); return Number.isFinite(t - t0) ? Math.max(0, (t - t0) / 1000) : null; });
}
const starts = (conv) => { const e = ends(conv); return e.map((x, i) => (i === 0 ? 0 : e[i - 1])); };
const mmss = (sec) => `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(Math.floor(sec % 60)).padStart(2, '0')}`;
const words = (s) => String(s || '').split(/\s+/).filter(Boolean).length;
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

/**
 * Deterministic voice metrics from the transcript timing (approximate: segment length = end − previous end).
 *  op_wpm_median: operator speaking rate, words per minute, over turns long enough to measure (≥ 5 words, 2–30 s).
 *  long_waits: operator turns preceded by ≥ 20 s that their own words don't explain (client left in silence).
 */
export function voiceMetrics(conv) {
  const t = conv.transcript, e = ends(conv);
  const rates = []; const segs = []; let opWords = 0, opTurns = 0;
  for (let i = 1; i < t.length; i++) {
    if (t[i].speaker !== 'operator' || e[i] == null || e[i - 1] == null) continue;
    opTurns++; const w = words(t[i].text); opWords += w;
    const dur = e[i] - e[i - 1]; segs.push({ i, w, dur });
    if (w >= 5 && dur >= 2 && dur <= 30) rates.push((w / dur) * 60);
  }
  const wpm = median(rates);
  const perSec = (wpm || 130) / 60;
  const longWaits = segs.filter((x) => x.dur - x.w / perSec >= 20)
    .map((x) => ({ turn_index: x.i, at: mmss(e[x.i - 1]), wait_s: Math.round(x.dur - x.w / perSec) }));
  return { op_turns: opTurns, op_words: opWords, op_wpm_median: wpm == null ? null : Math.round(wpm), measured_turns: rates.length, long_waits: longWaits };
}

const SYSTEM = `Ты — эксперт контроля качества звонков Freedom Broker. Ты СЛУШАЕШЬ запись звонка и оцениваешь, КАК говорит ОПЕРАТОР: тон, интонацию, темп, чёткость, паузы.
Правила:
1. Оценивай только голос оператора. Клиент, голосовой бот и системные сообщения — контекст. Голоса на одной дорожке: ориентируйся по таймкодам реплик оператора из списка.
2. Не оценивай содержание ответа (это делают другие критерии). Только подачу: вежливость и теплоту голоса, раздражение или холодность, перебивания, монотонность, слишком быстрый или невнятный темп, заминки, долгое молчание.
3. Шумная связь, акцент или ошибки распознавания — не вина оператора. Не снижай за них.
4. Если в записи оператора не слышно или записи нет — ответ "na" (если разрешён).
5. Ровный, спокойный, деловой тон без ярких эмоций — это НОРМА для поддержки и высший балл. Снижай только за конкретный момент, который ты СЛЫШИШЬ и можешь привязать к реплике: раздражённый вздох, повышение голоса, перебивание, резкий или пренебрежительный ответ, долгое молчание без «минуту, проверю». Если такого момента нет — ставь высший балл. Не придумывай «монотонность» или «заминки» для подстраховки.
6. Объяснение по-русски, 1–2 предложения, конкретно: что слышно и где. deduction_reason — одна фраза, за что снижено, или пустая строка.
7. Доказательства: номера реплик ОПЕРАТОРА [i] из списка, где это слышно (1–3 шт.), и короткая цитата из текста этой реплики.
8. Не считай баллы.
Ответ — ТОЛЬКО JSON без пояснений вокруг:
{"criteria":[{"criterion_id":"…","answer":"<ступень или na>","explanation":"…","deduction_reason":"…","evidence":[{"turn_index":<i>,"quote":"…"}]}]}`;

function renderCriteria(crits) {
  return crits.map((c) => [
    `- id: ${c.id} · «${c.title}» · ${c.type === 'scale' ? 'шкала' : 'да/нет'}`,
    `  Что проверить: ${c.description}`,
    c.type === 'scale' ? `  Ступени: ${c.scale.map((s) => `${s.value} = ${s.label}`).join(' | ')}` : '  Ответы: yes / no',
    c.na_allowed ? `  N/A только если: ${c.na_condition}` : '  N/A запрещён.',
  ].join('\n')).join('\n');
}

function buildMessages(conv, crits, metrics, audio) {
  const off = starts(conv);
  const lines = conv.transcript.map((m, i) => `${m.speaker === 'operator' ? `[${i}]` : `(${i})`} ${off[i] != null ? mmss(off[i]) : '--:--'} ${({ operator: 'ОПЕРАТОР', client: 'клиент', bot: 'бот', system: 'система' })[m.speaker] || m.speaker}: ${m.text}`);
  const waits = metrics.long_waits.map((w) => `[${w.turn_index}] ${w.at} — ${w.wait_s} с тишины`).join('; ') || 'нет';
  return [
    { role: 'system', content: SYSTEM },
    { role: 'user', content: [
      { type: 'text', text: `Язык: ${conv.language}. Время — начало реплики от начала записи (приблизительно).\n\nКРИТЕРИИ:\n${renderCriteria(crits)}\n\nЗАМЕРЫ ПО ТАЙМКОДАМ (приблизительно): темп оператора ≈ ${metrics.op_wpm_median ?? '—'} слов/мин; долгое молчание перед репликой оператора: ${waits}. Это подсказка, решай по тому, что слышно.\n\nРАСШИФРОВКА (реплики оператора — в квадратных скобках, текст распознан автоматически и может быть неточным):\n${lines.join('\n')}\n\nПрослушай запись и оцени ${crits.length === 1 ? 'критерий' : `каждый из ${crits.length} критериев`}.` },
      { type: 'input_audio', input_audio: { data: audio.base64, format: 'mp3' } },
    ] },
  ];
}

const naAnswer = (c, why) => ({ answer: 'na', explanation: why, deduction_reason: '', evidence: [{ kind: 'na_condition', quote: c.na_condition || why }] });

/**
 * Evaluate the audio criteria of one conversation. Never throws for a missing recording: chats get N/A
 * (or no answer when N/A is not allowed); a failed audio call returns its error in `problems`.
 * Returns { value: { answers, problems, model, prompt_version, usage, latency_ms, audio_metrics }, cached }.
 */
export async function evaluateTone(conv, crits, { model = TONE_MODEL, force = false } = {}) {
  if (!crits.length) return { value: { answers: {}, problems: [] }, cached: true };
  if (!conv.audio_url) {
    const answers = Object.fromEntries(crits.filter((c) => c.na_allowed).map((c) => [c.id, naAnswer(c, 'Записи разговора нет (чат), голос не оценивается.')]));
    return { value: { answers, problems: [] }, cached: true };
  }
  const metrics = voiceMetrics(conv);
  const keyParts = [TONE_PROMPT_VERSION, model, conv.conversation_id, conv.transcript, crits];
  const cl = { criteria: crits };
  const run = async () => {
    const audio = await downloadBase64(await resolveAudio(conv.audio_url));
    let last = null, cost = 0, latency = 0, promptTok = 0, audioTok = 0, complTok = 0;
    for (let attempt = 1; attempt <= 2; attempt++) {
      let res;
      try { res = await chatAudioJSON({ model, messages: buildMessages(conv, crits, metrics, audio) }); }
      catch (e) { if (e.status === 502 && attempt < 2) continue; throw e; }
      cost += res.usage.cost || 0; latency += res.latency_ms || 0;
      promptTok += res.usage.prompt_tokens || 0; audioTok += res.usage.audio_tokens || 0; complTok += res.usage.completion_tokens || 0;
      const raw = { criteria: (res.data?.criteria || []).map((r) => ({ ...r, evidence: (r.evidence || []).map((e) => ({ kind: 'message', turn_index: Number(e.turn_index), quote: e.quote || '' })) })) };
      const norm = normalize(raw, conv, cl);
      // evidence must point at the operator's own turns
      for (const [id, a] of Object.entries(norm.answers)) {
        const keep = a.evidence.filter((e) => e.kind !== 'message' || conv.transcript[e.turn_index]?.speaker === 'operator');
        if (keep.length < a.evidence.length) norm.problems.push(`${id}: dropped evidence outside operator turns`);
        a.evidence = keep.length || a.answer === 'na' ? keep : a.evidence;
        a.audio_metrics = metrics;
      }
      last = { answers: norm.answers, problems: norm.problems, model: res.model, prompt_version: TONE_PROMPT_VERSION, attempts: attempt,
        latency_ms: latency, audio_bytes: audio.bytes, usage: { prompt_tokens: promptTok, audio_tokens: audioTok, completion_tokens: complTok, cost: +cost.toFixed(6) } };
      if (Object.keys(norm.answers).length === crits.length && !norm.problems.some((p) => /missing|invalid answer/.test(p))) break;
    }
    if (!last || !Object.keys(last.answers).length) throw Object.assign(new Error(`tone evaluation failed: ${last?.problems.join('; ') || 'no answer'}`), { status: 502 });
    return last;
  };
  if (force) return { value: await run(), cached: false };
  return cached('tone', keyParts, run);
}
