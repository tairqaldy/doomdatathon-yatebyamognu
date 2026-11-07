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
