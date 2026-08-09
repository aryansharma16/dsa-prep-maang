import dotenv from 'dotenv';

dotenv.config();

const required = (key) => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var: ${key}`);
  return value;
};

/**
 * Cloudinary hands you one line on the API Keys screen:
 *
 *   CLOUDINARY_URL=cloudinary://<api_key>:<api_secret>@<cloud_name>
 *
 * so that is the form this accepts first — copy, paste, done. The three
 * separate vars are supported too, because some hosts make a URL-shaped secret
 * awkward to store.
 *
 * Credentials are never required to boot. Upload is one feature; a missing key
 * should fail that one request with a clear message, not stop the server and
 * take the roadmap down with it.
 */
function readCloudinary() {
  const url = process.env.CLOUDINARY_URL;
  if (url) {
    try {
      const parsed = new URL(url);
      return {
        cloudName: parsed.hostname,
        apiKey: decodeURIComponent(parsed.username),
        apiSecret: decodeURIComponent(parsed.password),
      };
    } catch {
      console.warn('[env] CLOUDINARY_URL is set but not parseable — uploads will be disabled');
      return {};
    }
  }
  return {
    cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    apiKey: process.env.CLOUDINARY_API_KEY,
    apiSecret: process.env.CLOUDINARY_API_SECRET,
  };
}

const cloudinary = readCloudinary();
const geminiApiKey = (process.env.GEMINI_API_KEY || '').trim();

/**
 * The three OpenAI-compatible chat providers.
 *
 * Same wire protocol, three different hosts, so they are configured as data
 * rather than written out three times. The base URL is overridable per provider
 * because these vendors move them — DeepSeek has already shipped one path
 * change — and a host that moves should be a dashboard edit on a running box,
 * not a redeploy.
 *
 * None of them is required. A key that is absent simply means that provider is
 * not a candidate; the chat falls through to the next one, the same way a
 * missing Cloudinary key costs you uploads and nothing else.
 */
function readAiProvider(keyVar, urlVar, fallbackUrl) {
  const apiKey = (process.env[keyVar] || '').trim();
  return {
    apiKey,
    baseUrl: (process.env[urlVar] || fallbackUrl).replace(/\/+$/, ''),
    configured: Boolean(apiKey),
  };
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  port: Number(process.env.PORT) || 4000,
  mongoUri: required('MONGO_URI'),
  clientUrl: process.env.CLIENT_URL || 'http://localhost:5173',
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: process.env.JWT_ACCESS_TTL || '15m',
    refreshTtl: process.env.JWT_REFRESH_TTL || '30d',
  },
  leetcodeApi: process.env.LEETCODE_API || 'https://leetcode-api-pied.vercel.app',
  /**
   * The one account that owns the site.
   *
   * Pinned here rather than stored as a mutable row: the API has no path that
   * can grant or revoke `super_admin`, so the role cannot be handed out by a
   * bug in the role endpoint or by someone who gets hold of an admin session.
   * Optional — leave it unset and the app simply has no super admin.
   */
  superAdminEmail: (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
  cloudinary: {
    ...cloudinary,
    configured: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
    // Everything this app uploads lives under one prefix, so a shared cloud
    // stays sorted and a bulk delete can be scoped without guessing.
    folder: process.env.CLOUDINARY_FOLDER || 'maang-prep',
  },
  /**
   * Google Gemini. Optional, like Cloudinary and for the same reason: a missing
   * key should cost you the one feature that wanted a model, not the server.
   *
   * The models are variables rather than constants because Google retires these
   * on a published schedule — `gemini-2.5-flash` shuts down in October 2026 —
   * and moving to the next one should be an environment change on a running
   * deployment, not a code change and a redeploy.
   *
   * There are two of them because the two things this app asks a model for have
   * opposite shapes, and one setting cannot serve both:
   *
   * `model` is the quality tier. Admin drafting runs it a handful of times when
   * someone clicks a button, and a human reads every line before it ships, so it
   * can afford the best model on the key. Free-tier quota on the newest Flash is
   * 20 requests per day per model — fine for something hand-triggered, and the
   * reason it must not be what the hot path uses.
   *
   * `fastModel` is what runs per learner per day. It scales with signups rather
   * than with admin clicks, so it needs headroom far more than it needs polish,
   * and the output is one sentence of already-constrained copy.
   *
   * Both fall back to the quality tier if unset, so a deployment that only knows
   * about `GEMINI_MODEL` keeps working exactly as it did.
   */
  gemini: {
    apiKey: geminiApiKey,
    model: process.env.GEMINI_MODEL || 'gemini-3.6-flash',
    /*
      Not flash-lite by default, though it is cheaper still. Lite was measured
      against this app's own prompt and got the arithmetic wrong roughly one
      time in four — "leaving 427 left in the 429 problem roadmap" after two
      solves today and twelve in total. That is the exact figure-merge failure
      promptFor() in motivation.ai.js was rewritten to prevent, and `clean()`
      cannot catch it: a false number is structurally a perfectly good sentence.
      Set GEMINI_MODEL_FAST=gemini-3.5-flash-lite to take that trade knowingly.
    */
    fastModel: process.env.GEMINI_MODEL_FAST || process.env.GEMINI_MODEL || 'gemini-3.5-flash',
    configured: Boolean(geminiApiKey),
  },
  /**
   * The chat assistant's providers, keyed by the id the registry uses.
   *
   * Gemini is deliberately not in here. It reaches the same registry through
   * `env.gemini` above, because it is the one provider that is not
   * OpenAI-compatible and the one that two features now share — putting it in
   * this map would imply it is interchangeable with the others at the config
   * level, and it is not.
   */
  ai: {
    cerebras: readAiProvider('CEREBRAS_API_KEY', 'CEREBRAS_BASE_URL', 'https://api.cerebras.ai/v1'),
    deepseek: readAiProvider('DEEPSEEK_API_KEY', 'DEEPSEEK_BASE_URL', 'https://api.deepseek.com/v1'),
    xai: readAiProvider('GROK_API_KEY', 'GROK_BASE_URL', 'https://api.x.ai/v1'),
  },
};
