import { env } from '../../config/env.js';
import { geminiClient } from '../gemini.service.js';

/**
 * Gemini — the same key the motivation line uses, wearing the chat interface.
 *
 * Third in the chain, not first, despite being the provider that was already
 * integrated. The free tier is 20 requests per day per model, which is roughly
 * seven learners before chat stops answering — and it stops by falling through
 * to the next provider, so nobody would notice it had happened.
 *
 * It runs on `aiFastModel()` (gemini-3.5-flash) rather than the quality tier
 * deliberately. Those 20/day are counted per model, so chat and the admin
 * drafting tool only compete for the same ceiling if someone points them at the
 * same model. Keep them apart.
 */

/**
 * Gemini's message shape, from ours.
 *
 * Two conversions and one merge. `assistant` is called `model` here, content is
 * a parts array rather than a string, and consecutive same-role turns have to
 * be merged — the API rejects two `user` turns in a row, which history trimming
 * can otherwise produce when it drops an assistant reply from the middle.
 */
function toContents(messages) {
  const out = [];
  for (const { role, content } of messages) {
    const geminiRole = role === 'assistant' ? 'model' : 'user';
    const last = out[out.length - 1];
    if (last && last.role === geminiRole) {
      last.parts[0].text += `\n\n${content}`;
      continue;
    }
    out.push({ role: geminiRole, parts: [{ text: content }] });
  }
  return out;
}

const baseConfig = ({ system, temperature, maxTokens }) => ({
  // Minimal, for the reason gemini.service.js already documents: 3.x spends
  // thinking tokens out of maxOutputTokens, and a 700-token ceiling gets eaten
  // by deliberation the answer never needed.
  thinkingConfig: { thinkingLevel: 'MINIMAL' },
  temperature,
  maxOutputTokens: maxTokens,
  ...(system ? { systemInstruction: system } : {}),
});

const config = {
  id: 'gemini',
  get model() {
    return env.gemini.fastModel;
  },
};

export const gemini = {
  id: 'gemini',
  label: 'Gemini',
  envKey: 'GEMINI_API_KEY',
  get models() {
    // Reported from config rather than hardcoded, because this is the one
    // provider whose model is already an environment variable — a catalogue
    // that disagreed with GEMINI_MODEL_FAST would be a lie in the model picker.
    return [{ id: env.gemini.fastModel, label: `${env.gemini.fastModel} (Google)` }];
  },
  get defaultModel() {
    return env.gemini.fastModel;
  },
  configured: () => env.gemini.configured,

  async *stream({ messages, system, model, temperature = 0.3, maxTokens = 700, signal }) {
    const ai = geminiClient();

    /*
      `generateContentStream` is an async *function* — it returns a promise of
      an iterator, not an iterator. `for await` on the un-awaited call iterates
      nothing at all, silently, and you get an empty answer with no error.
    */
    const iterator = await ai.models.generateContentStream({
      model: model || config.model,
      contents: toContents(messages),
      config: { ...baseConfig({ system, temperature, maxTokens }), abortSignal: signal },
    });

    let finish = 'stop';
    let usage = null;

    for await (const chunk of iterator) {
      // `.text` is a getter on the 2.x response, not a method.
      const text = chunk.text;
      const meta = chunk.usageMetadata;
      if (meta) usage = { in: meta.promptTokenCount ?? 0, out: meta.candidatesTokenCount ?? 0 };
      const reason = chunk.candidates?.[0]?.finishReason;
      if (reason) finish = reason === 'MAX_TOKENS' ? 'length' : String(reason).toLowerCase();
      if (typeof text === 'string' && text.length) yield { type: 'delta', text };
    }

    yield { type: 'done', finish, usage };
  },

  async complete({ messages, system, model, temperature = 0.3, maxTokens = 64, signal }) {
    const ai = geminiClient();
    const response = await ai.models.generateContent({
      model: model || config.model,
      contents: toContents(messages),
      config: { ...baseConfig({ system, temperature, maxTokens }), abortSignal: signal },
    });
    return response.text ?? '';
  },
};
