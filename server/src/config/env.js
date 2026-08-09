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
};
