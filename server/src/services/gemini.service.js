import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

/**
 * Everything this app asks a language model goes through here.
 *
 * The point of the indirection is the same one `media.service.js` makes about
 * Cloudinary: callers hand over a prompt and get back text or a parsed object,
 * and never touch the SDK. That matters more here than it does for uploads,
 * because Google has moved this surface twice already — `@google/generative-ai`
 * was retired in November 2025, and the docs for the unreleased 3.x line
 * describe a different call shape again (`interactions.create`) from the
 * `models.generateContent` that 2.x actually ships. When that lands, one
 * function in this file changes and nothing else does.
 *
 * Nothing here is required to boot. A missing key fails the one request that
 * wanted a model, with `503 AI_DISABLED`, exactly as a missing Cloudinary key
 * fails an upload — every feature built on this must have an answer for the
 * model being unavailable.
 */

/**
 * Twenty seconds. Long enough for a structured draft of ten lines, short enough
 * that a hung request cannot pin a connection open for a minute. Callers that
 * sit in front of a page render pass something far tighter.
 */
const DEFAULT_TIMEOUT_MS = 20000;

/**
 * Gemini 3.x reasons before it answers, and its thinking tokens are spent out
 * of `maxOutputTokens`. For the short copy this app asks for that is not a
 * tuning preference, it is a correctness bug: with thinking on, a 200-token cap
 * was consumed entirely by reasoning and the answer arrived truncated
 * mid-word — "Your 7-day" — which then failed validation and fell back every
 * time. Minimal thinking returns zero thought tokens, a whole sentence, and
 * does it in two seconds instead of twenty.
 *
 * A default, not a rule. Anything that genuinely needs reasoning — explaining a
 * problem, answering a question about a pattern — passes its own
 * `thinkingConfig` and gets it.
 */
const DEFAULT_THINKING = { thinkingLevel: 'MINIMAL' };

let client = null;

/**
 * Constructs the client once, lazily — importing this module must have no effect.
 *
 * Exported because the chat provider in `ai/gemini.provider.js` needs the same
 * instance to call `generateContentStream`, which this file has no other reason
 * to know about. Sharing the constructor rather than the call is what keeps the
 * promise at the top of this file honest: SDK construction and error mapping
 * still live in exactly one place, and a chat feature that streams did not
 * require a second copy of either.
 */
export function geminiClient() {
  if (!env.gemini.configured) {
    throw new ApiError(503, 'AI is not configured on this server', 'AI_DISABLED');
  }
  if (!client) client = new GoogleGenAI({ apiKey: env.gemini.apiKey });
  return client;
}

export const aiEnabled = () => env.gemini.configured;

/** The model these calls used, for logging and for the admin panel to show. */
export const aiModel = () => env.gemini.model;

/**
 * The cheap tier, for callers that run once per learner rather than once per
 * admin click. Read through a function rather than imported as a constant for
 * the same reason `aiModel` is: whatever records which model wrote a line has
 * to name the model that actually ran, and a caller passing `model:` and then
 * logging `aiModel()` is how a row ends up attributing itself to the wrong one.
 */
export const aiFastModel = () => env.gemini.fastModel;

/**
 * Google's errors carry an HTTP-shaped `status`, so they map the way
 * Cloudinary's do: a 4xx is something about our request and the client can be
 * told, anything else is the upstream's problem and becomes a 502. The vendor's
 * own message is kept — "API key not valid" is the useful part, and no wording
 * of ours improves on it.
 */
function asApiError(error) {
  if (error instanceof ApiError) return error;
  if (error?.name === 'AbortError') {
    return new ApiError(504, 'The model took too long to answer', 'AI_TIMEOUT');
  }

  const status = Number(error?.status);
  const message = error?.message || 'The model could not answer';
  return new ApiError(status >= 400 && status < 500 ? 400 : 502, message, 'AI_FAILED');
}

/**
 * One call, one string back.
 *
 * `response.text` is a getter on the 2.x response object, not a method — worth
 * saying, because calling it is a `TypeError` that only shows up at runtime.
 */
async function generate(prompt, { system, model, timeoutMs = DEFAULT_TIMEOUT_MS, ...config } = {}) {
  const ai = geminiClient();

  // The SDK takes an AbortSignal, so this is a real cancellation rather than a
  // promise race that leaves the request running.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await ai.models.generateContent({
      model: model || env.gemini.model,
      contents: prompt,
      config: {
        abortSignal: controller.signal,
        thinkingConfig: DEFAULT_THINKING,
        ...(system ? { systemInstruction: system } : {}),
        // Spread last, so a caller that wants reasoning can replace the default.
        ...config,
      },
    });
    return response.text ?? '';
  } catch (error) {
    throw asApiError(error);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Plain text out.
 *
 * @param {string} prompt
 * @param {object} [options]
 * @param {string} [options.system]           system instruction
 * @param {string} [options.model]            defaults to GEMINI_MODEL
 * @param {number} [options.temperature]
 * @param {number} [options.maxOutputTokens]
 * @param {number} [options.timeoutMs]
 */
export const generateText = (prompt, options) => generate(prompt, options);

/**
 * Structured output, already parsed.
 *
 * `responseSchema` is what makes this worth having over "asking nicely for
 * JSON" — the model is constrained at decode time, so the shape is a guarantee
 * rather than a hope. A response that still will not parse is the upstream's
 * fault, not the caller's, hence 502.
 */
export async function generateJson(prompt, { schema, ...options } = {}) {
  const text = await generate(prompt, {
    ...options,
    responseMimeType: 'application/json',
    ...(schema ? { responseSchema: schema } : {}),
  });

  try {
    return JSON.parse(text);
  } catch {
    throw new ApiError(502, 'The model did not return valid JSON', 'AI_BAD_JSON');
  }
}
