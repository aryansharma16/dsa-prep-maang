import { env } from '../../config/env.js';
import { completeOpenAiCompatible, streamOpenAiCompatible } from './openaiCompatible.js';

/**
 * DeepSeek — the first fallback.
 *
 * Strong on code and cheap, but slower to the first token than Cerebras, which
 * is why it is second rather than first. Only the `flash` model is listed:
 * `deepseek-v4-pro` is a reasoning model, and its thinking tokens are both the
 * latency and the verbosity this feature is built to avoid. Anyone who wants it
 * can name it explicitly.
 */

const config = {
  id: 'deepseek',
  get baseUrl() {
    return env.ai.deepseek.baseUrl;
  },
  get apiKey() {
    return env.ai.deepseek.apiKey;
  },
  supportsUsage: true,
};

export const deepseek = {
  id: 'deepseek',
  label: 'DeepSeek',
  envKey: 'DEEPSEEK_API_KEY',
  models: [
    { id: 'deepseek-v4-flash', label: 'DeepSeek V4 Flash', tier: 'balanced', strengths: ['code', 'general'] },
    { id: 'deepseek-v4-pro', label: 'DeepSeek V4 Pro (slower)', tier: 'deep', strengths: ['code', 'reasoning'] },
  ],
  defaultModel: 'deepseek-v4-flash',
  configured: () => env.ai.deepseek.configured,
  stream: (params) => streamOpenAiCompatible(config, params),
  complete: (params) => completeOpenAiCompatible(config, params),
};
