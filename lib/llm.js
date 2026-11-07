// Provider router for JSON chat calls. Callers wrap it with lib/cache.js (the model id is part of every cache key).
//   "openai:<model>"  → direct OpenAI API (lib/openai.js, OPENAI_API_KEY), e.g. openai:gpt-6-luna
//   anything else     → OpenRouter (lib/openrouter.js, OPENROUTER_API_KEY), e.g. anthropic/claude-haiku-5.5
// Voice (AIM agent):
//   transcribe() → OpenAI Whisper when OPENAI_API_KEY is set, else NVIDIA Nemotron via OpenRouter (needs WAV).
//   speak()      → OpenAI TTS when OPENAI_API_KEY is set, else 501 so the browser falls back to speechSynthesis.
// The 5 organizer calls (api/transcribe.js) keep Nemotron: they need segment timestamps for evidence.
import * as openrouter from './openrouter.js';
import * as openai from './openai.js';

export const MODELS = openrouter.MODELS;
const PREFIX = 'openai:';

export function providerOf(model) {
  return typeof model === 'string' && model.startsWith(PREFIX) ? 'openai' : 'openrouter';
}

export async function chatJSON(opts) {
  const model = opts.model || MODELS.eval;
  if (providerOf(model) === 'openai') {
    const id = model.slice(PREFIX.length);
    if (!process.env.OPENAI_API_KEY && process.env.OPENROUTER_API_KEY) {
      // Same model through OpenRouter's OpenAI pass-through, so a deploy without OPENAI_API_KEY still evaluates.
      const res = await openrouter.chatJSON({ ...opts, model: `openai/${id}` });
      return { ...res, model: `openrouter:${res.model}` };
    }
    const res = await openai.chatJSON({ ...opts, model: id });
    return { ...res, model: `${PREFIX}${res.model}` }; // keep the provider visible in logs and run files
  }
  return openrouter.chatJSON({ ...opts, model });
}

/** Audio-input JSON call (tone of voice on calls). Direct OpenAI only: gpt-audio-* is not routed through OpenRouter here. */
export async function chatAudioJSON(opts) {
  if (providerOf(opts.model) !== 'openai') throw Object.assign(new Error(`audio model must be openai:<id>, got ${opts.model}`), { status: 400 });
  const res = await openai.chatAudioJSON({ ...opts, model: opts.model.slice(PREFIX.length) });
  return { ...res, model: `${PREFIX}${res.model}` };
}

// ---------- voice ----------
// Whisper can echo its prompt on near-silent clips, so there is no default prompt; set CQA_ASR_PROMPT to bias vocabulary.
const ASR_PROMPT = process.env.CQA_ASR_PROMPT || undefined;
// Whisper's well-known inventions on silence (subtitle credits). Treated as "nothing was said".
const SILENCE_RE = /^(продолжение следует|субтитры (сделал|создавал|подготовил)|редактор субтитров|thank you for watching|thanks for watching|спасибо за просмотр)/i;
export const isSilenceText = (t) => !String(t || '').trim() || SILENCE_RE.test(String(t).trim());

/** Which providers serve voice right now (for /api/health and GET /api/speak). Never returns secrets. */
export function voiceConfig() {
  const direct = Boolean(process.env.OPENAI_API_KEY);
  return {
    asr: direct ? `openai:${openai.VOICE.asr()}` : process.env.OPENROUTER_API_KEY ? MODELS.transcribe : null,
    // Formats the active ASR accepts. Nemotron wants 16 kHz WAV, Whisper takes what the browser recorded (8x smaller).
    asr_formats: direct ? ['webm', 'mp4', 'm4a', 'ogg', 'mp3', 'wav'] : ['wav'],
    tts: direct ? `openai:${openai.VOICE.tts()}` : null, // null → the browser's speechSynthesis
    voice: direct ? openai.VOICE.voice() : null,
  };
}

/** Speech-to-text through the active provider. Whisper failures fall back to Nemotron when the audio is WAV. */
export async function transcribe({ base64, format = 'wav', language }) {
  if (process.env.OPENAI_API_KEY) {
    try {
      const r = await openai.transcribe({ base64, format, language, prompt: ASR_PROMPT });
      return { ...r, model: `openai:${r.model}`, provider: 'openai' };
    } catch (e) {
      const transient = !e.status || e.status === 429 || e.status >= 500;
      if (!(transient && format === 'wav' && process.env.OPENROUTER_API_KEY)) throw e;
      console.warn('[llm] Whisper failed, falling back to Nemotron:', e.message);
    }
  }
  const r = await openrouter.transcribe({ base64, format, language });
  return { ...r, provider: 'openrouter' };
}

/** Text-to-speech. Throws 501 { code: 'tts_unavailable' } without OPENAI_API_KEY, so clients use speechSynthesis. */
export async function speak({ text, format = 'mp3', voice, model }) {
  if (!process.env.OPENAI_API_KEY) throw Object.assign(new Error('No server voice configured: use the browser voice'), { status: 501, code: 'tts_unavailable' });
  const r = await openai.speak({ text, format, ...(voice ? { voice } : {}), ...(model ? { model } : {}) });
  return { ...r, model: `openai:${r.model}`, provider: 'openai' };
}
