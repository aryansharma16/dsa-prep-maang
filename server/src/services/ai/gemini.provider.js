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

/**
 * Flash-class text models, best first, each with its own daily allowance.
 *
 * Confirmed live against this key. Deliberately excluded:
 *   gemini-2.5-flash, gemini-2.5-flash-lite   retired — 404 already, ahead of
 *                                             the October 2026 date Google
 *                                             published
 *   gemini-*-latest                           aliases sharing a listed model's
 *                                             bucket
 *   *-pro-*                                   5 requests/day and slow to the
 *                                             first token; wrong shape for this
 *   image / tts / audio / embedding / veo     not text chat
 *
 * A dead id costs one 404 and a fifteen-minute cooldown on that model alone —
 * `scope: 'model'` in errors.js is what keeps that from taking Gemini down.
 */
const FALLBACK_MODELS = [
  { id: 'gemini-3.6-flash', tier: 'balanced', strengths: ['code', 'general'] },
  { id: 'gemini-3.5-flash', tier: 'balanced', strengths: ['code', 'general'] },
  { id: 'gemini-3.5-flash-lite', tier: 'fast', strengths: ['general'] },
  { id: 'gemini-3-flash-preview', tier: 'balanced', strengths: ['general'] },
  { id: 'gemini-3.1-flash-lite', tier: 'fast', strengths: ['general'] },
  { id: 'gemini-2.0-flash', tier: 'fast', strengths: ['general'] },
  { id: 'gemini-2.0-flash-lite', tier: 'fast', strengths: ['general'] },
];

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
    /*
      Seven models, because the free allowance is twenty requests per model per
      day — so this list is not a menu, it is the size of the free tier. One
      model is twenty questions and then nothing until midnight; these seven are
      about a hundred and forty.

      Concrete ids only. The `-latest` aliases resolve to one of these and share
      its bucket, so including them would add names to the picker without adding
      a single request, and they move under you besides. Verified against this
      account: gemini-flash-latest reported spent at the same moment 3.6-flash
      did.

      GEMINI_MODEL_FAST is honoured by being first — whatever the environment
      names is what gets tried before any of the rest.
    */
    const configured = env.gemini.fastModel;
    const known = FALLBACK_MODELS.find((m) => m.id === configured);
    const rest = FALLBACK_MODELS.filter((m) => m.id !== configured);
    const ordered = [known || { id: configured, tier: 'balanced', strengths: ['general'] }, ...rest];
    return ordered.map((m) => ({ ...m, label: `${m.id} (Google)` }));
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
