import { env } from '../../config/env.js';
import { completeOpenAiCompatible, streamOpenAiCompatible } from './openaiCompatible.js';

/**
 * Cerebras — the default for chat.
 *
 * Chosen on time-to-first-token, which is the only speed a reader perceives:
 * a reply that starts in 200ms and finishes in three seconds feels faster than
 * one that appears whole after two. That is Cerebras' entire product, and it is
 * worth more here than a smarter model would be, because the questions this
 * assistant answers are not hard ones.
 */

const config = {
  id: 'cerebras',
  get baseUrl() {
    return env.ai.cerebras.baseUrl;
  },
  get apiKey() {
    return env.ai.cerebras.apiKey;
  },
  supportsUsage: true,
};

export const cerebras = {
  id: 'cerebras',
  label: 'Cerebras',
  envKey: 'CEREBRAS_API_KEY',
  models: [
    { id: 'zai-glm-4.7', label: 'GLM 4.7 (Cerebras)', tier: 'balanced', strengths: ['code', 'general'] },
    { id: 'gpt-oss-120b', label: 'GPT-OSS 120B (Cerebras)', tier: 'deep', strengths: ['code', 'reasoning'] },
    { id: 'gemma-4-31b', label: 'Gemma 4 31B (Cerebras)', tier: 'fast', strengths: ['general'] },
  ],
  defaultModel: 'zai-glm-4.7',
  configured: () => env.ai.cerebras.configured,
  stream: (params) => streamOpenAiCompatible(config, params),
  complete: (params) => completeOpenAiCompatible(config, params),
};
