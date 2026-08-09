import { env } from '../../config/env.js';
import { completeOpenAiCompatible, streamOpenAiCompatible } from './openaiCompatible.js';

/**
 * xAI (Grok) — built, ranked last, and expected to fail today.
 *
 * The key in this deployment authenticates and then answers
 * 403 "your team doesn't have any credits or licenses yet". That is a billing
 * state, not an outage, so nothing here retries around it: the registry gives a
 * 403 a fifteen-minute cooldown and the chain moves on. Adding credits makes
 * this provider start working with no code change, which is the reason to have
 * written it rather than waited.
 *
 * `supportsUsage` is off because xAI's handling of `stream_options` is
 * unverified against this account, and an unrecognised field is a 400 on some
 * hosts. Turning it on is a one-line change once someone can actually call it.
 */

const config = {
  id: 'xai',
  get baseUrl() {
    return env.ai.xai.baseUrl;
  },
  get apiKey() {
    return env.ai.xai.apiKey;
  },
  supportsUsage: false,
};

export const xai = {
  id: 'xai',
  label: 'Grok (xAI)',
  envKey: 'GROK_API_KEY',
  models: [
    { id: 'grok-4-fast-non-reasoning', label: 'Grok 4 Fast' },
    { id: 'grok-4', label: 'Grok 4' },
  ],
  defaultModel: 'grok-4-fast-non-reasoning',
  configured: () => env.ai.xai.configured,
  stream: (params) => streamOpenAiCompatible(config, params),
  complete: (params) => completeOpenAiCompatible(config, params),
};
