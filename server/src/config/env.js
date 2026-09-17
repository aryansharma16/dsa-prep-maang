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

const smtpHost = (process.env.SMTP_HOST || '').trim();
const smtpUser = (process.env.SMTP_USER || '').trim();
const smtpPass = process.env.SMTP_PASS || '';
const sendgridKey = (process.env.SENDGRID_API_KEY || '').trim();

const s3Region = (process.env.AWS_REGION || '').trim();
const s3Bucket = (process.env.AWS_S3_BUCKET || '').trim();

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
  /**
   * Outgoing mail: who it is from, and who hears about a signup.
   *
   * Two backends, neither of which costs anything at this volume, and the
   * provider is chosen by which credential is present rather than by a switch
   * somebody has to keep in step with the credentials:
   *
   *   SENDGRID_API_KEY set → SendGrid's HTTPS API (100 messages a day, free)
   *   SMTP_* set          → plain SMTP, e.g. a Gmail app password (500 a day)
   *   neither             → nothing is sent, and each message is logged instead
   *
   * SendGrid wins when both are set, because a host that blocks outbound SMTP
   * ports — which many do — is exactly the deployment that configured both.
   *
   * Optional to boot, like Cloudinary and Gemini and for the same reason: mail
   * that is not configured should cost you the notifications, not the server.
   * With neither set, signup requests still queue and approvals still create
   * accounts; the panel is how the owner finds out either way.
   */
  mail: {
    /*
      Who the mail says it is from, and the one setting that silently breaks
      everything if it is wrong. SendGrid refuses a From it has not verified
      (403 "does not match a verified Sender Identity"), and an SMTP server
      refuses a From its account may not use — often by filing it as spam
      rather than bouncing it. Defaults to the SMTP mailbox, which is always a
      legitimate sender for that account; a SendGrid deployment has to set it.
    */
    from: (process.env.MAIL_FROM || '').trim() || smtpUser,
    /*
      Where "somebody wants in" goes. The super admin's own address unless it is
      set — one fewer thing to configure for the deployment that has exactly one
      owner, and an override for the one that wants a shared inbox.
    */
    adminTo:
      (process.env.MAIL_ADMIN_TO || '').trim().toLowerCase() ||
      (process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase(),
  },
  /**
   * SendGrid, over its HTTPS API rather than its SMTP relay.
   *
   * Same credential either way — the SMTP relay takes the literal username
   * `apikey` and the key as the password — but the API is a normal outbound
   * HTTPS request, so it works on hosts that block port 587, gives a real
   * status code and message when a send is refused, and needs no dependency
   * beyond `fetch`. The SMTP relay's failures arrive as timeouts.
   */
  sendgrid: {
    apiKey: sendgridKey,
    configured: Boolean(sendgridKey),
  },
  /**
   * Plain SMTP: any mailbox you already own, no vendor account.
   *
   * `secure` is the implicit-TLS switch, and it follows the port unless stated:
   * 465 is TLS from the first byte, 587 starts plain and upgrades with STARTTLS.
   * Getting this pair wrong is the one configuration mistake that hangs rather
   * than erroring, so it is derived rather than left to be remembered.
   */
  smtp: {
    host: smtpHost,
    port: Number(process.env.SMTP_PORT) || 465,
    secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : Number(process.env.SMTP_PORT) !== 587,
    user: smtpUser,
    pass: smtpPass,
    configured: Boolean(smtpHost && smtpUser && smtpPass),
  },
  /**
   * Request ceilings. The limits themselves live in middleware/rateLimit.js,
   * next to the reasoning that picked them; only the two worth changing on a
   * running box without a redeploy are here.
   *
   * `enabled` is the escape hatch, and it is a kill switch rather than an
   * environment test on purpose: the limits stay on in development so they are
   * exercised by ordinary use rather than discovered in production, and the one
   * time you genuinely want them off — a load test you are running yourself — is
   * a decision to state out loud.
   *
   * `globalPerMinute` is the backstop that covers every route, keyed by address.
   * Raise it if a shared network — a college, an office, one carrier's CGNAT —
   * ever puts enough real learners behind one address to trip it; the tight
   * limits that actually matter are keyed per account and are unaffected.
   */
  rateLimit: {
    enabled: process.env.RATE_LIMIT_DISABLED !== 'true',
    globalPerMinute: Number(process.env.RATE_LIMIT_GLOBAL_PER_MINUTE) || 300,
  },
  cloudinary: {
    ...cloudinary,
    configured: Boolean(cloudinary.cloudName && cloudinary.apiKey && cloudinary.apiSecret),
    // Everything this app uploads lives under one prefix, so a shared cloud
    // stays sorted and a bulk delete can be scoped without guessing.
    folder: process.env.CLOUDINARY_FOLDER || 'maang-prep',
  },
  /**
   * S3. Optional to boot, for the reason Cloudinary is: a bucket that is not
   * configured should cost you the endpoints that store files, not the server.
   *
   * Region and bucket are the *only* two settings, and there is deliberately no
   * credential here. On EC2 the instance role (MAANGPrepEC2S3Role) supplies
   * them: the SDK's default provider chain reads short-lived credentials from
   * the instance metadata service and rotates them before they expire. There is
   * no key in this file to leak, to rotate by hand, or to commit by accident.
   *
   * Reading them here would be worse than redundant. The chain already checks
   * AWS_ACCESS_KEY_ID/AWS_SECRET_ACCESS_KEY first, then SSO, then
   * `~/.aws/credentials`, then the instance role — so a laptop is covered by
   * `aws configure` or AWS_PROFILE without a line of code, and parsing them
   * ourselves would only add a way to get it wrong.
   *
   * `configured` is therefore region-and-bucket only. Credentials cannot be
   * part of that test because the deployment that matters has none to inspect,
   * and pretending otherwise would disable uploads on exactly the box where
   * they work. A genuinely missing or misscoped role surfaces as a 502 on the
   * first call with the SDK's own message, which is the honest failure.
   */
  s3: {
    region: s3Region,
    bucket: s3Bucket,
    configured: Boolean(s3Region && s3Bucket),
    // Every key this app writes lives under one prefix, so a shared bucket
    // stays sorted and `deletePrefix` can be scoped without guessing.
    prefix: (process.env.AWS_S3_PREFIX || 'maang-prep').replace(/^\/+|\/+$/g, ''),
    /*
      Set only for a bucket fronted by CloudFront or made public. Its presence
      is what makes `publicUrl()` return something — without it every read goes
      through a signed URL, which is the correct default for a private bucket
      and the one the console gives you unless you go out of your way.
    */
    publicBaseUrl: (process.env.AWS_S3_PUBLIC_URL || '').trim().replace(/\/+$/, ''),
    // How long a signed link stays good. Long enough to load a page and click
    // through, short enough that a copied URL in a chat log goes stale.
    signedUrlTtl: Number(process.env.AWS_S3_URL_TTL) || 900,
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
