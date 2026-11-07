// Provider router for JSON chat calls. Callers wrap it with lib/cache.js (the model id is part of every cache key).
//   "openai:<model>"  → direct OpenAI API (lib/openai.js, OPENAI_API_KEY), e.g. openai:gpt-6-luna
//   anything else     → OpenRouter (lib/openrouter.js, OPENROUTER_API_KEY), e.g. anthropic/claude-haiku-5.5
// Transcription stays on OpenRouter (lib/openrouter.js transcribe()).
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
    const res = await openai.chatJSON({ ...opts, model: model.slice(PREFIX.length) });
    return { ...res, model: `${PREFIX}${res.model}` }; // keep the provider visible in logs and run files
  }
  return openrouter.chatJSON({ ...opts, model });
}
