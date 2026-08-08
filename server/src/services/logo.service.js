import { CompanyLogo } from '../models/CompanyLogo.js';

const TIMEOUT_MS = 8000;
// Below this it is a spacer or an error page, not a logo; above it something
// went wrong upstream and we do not want it in a Mongo document.
const MIN_BYTES = 300;
const MAX_BYTES = 64 * 1024;
// How long a remembered miss stands before we ask the providers again.
const RETRY_MISS_MS = 7 * 24 * 60 * 60 * 1000;

const UA = 'dsa-prep (+company logo cache)';

export const companySlug = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/**
 * Only the names where `<slug without dashes>.com` is wrong. Everything in the
 * seeded company list (google, amazon, adobe, goldmansachs, ...) already
 * resolves correctly from the slug, so listing them here would just be a second
 * copy to keep in sync.
 */
const DOMAIN_OVERRIDES = {
  twitter: 'x.com',
  x: 'x.com',
  snapchat: 'snap.com',
  snap: 'snap.com',
  ola: 'olacabs.com',
  alphabet: 'google.com',
  'jp-morgan': 'jpmorganchase.com',
  jpmorgan: 'jpmorganchase.com',
  'jane-street': 'janestreet.com',
  'two-sigma': 'twosigma.com',
  'de-shaw': 'deshaw.com',
  zs: 'zsassociates.com',
  ibm: 'ibm.com',
  sap: 'sap.com',
};

export const domainFor = (slug) => DOMAIN_OVERRIDES[slug] || `${slug.replace(/-/g, '')}.com`;

/**
 * Tried in order, first valid image wins. Both serve the brand mark a browser
 * shows in its tab, which is the logo at the size these chips render.
 *
 * Google goes first because it normalises everything to a PNG of up to 128px —
 * crisp on a retina screen and uniform across companies — and because it 404s
 * on a domain it has no icon for instead of quietly handing back a grey globe.
 * DuckDuckGo serves the site's raw .ico, so it covers a few domains Google
 * misses but the size is whatever the site happened to ship.
 *
 * Clearbit used to lead this list. Its free logo API was retired and the
 * hostname no longer resolves, so it was removed rather than left to burn a DNS
 * timeout on every lookup.
 */
const PROVIDERS = [
  { id: 'google', url: (d) => `https://www.google.com/s2/favicons?domain=${d}&sz=128` },
  { id: 'duckduckgo', url: (d) => `https://icons.duckduckgo.com/ip3/${d}.ico` },
];

async function download(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': UA } });
    if (!res.ok) return null;

    const contentType = (res.headers.get('content-type') || '').split(';')[0].trim();
    if (!contentType.startsWith('image/')) return null;

    const data = Buffer.from(await res.arrayBuffer());
    if (data.length < MIN_BYTES || data.length > MAX_BYTES) return null;

    return { data, contentType };
  } catch {
    // Every provider is best-effort — a dead one must not fail the request.
    return null;
  } finally {
    clearTimeout(timer);
  }
}

async function fetchAndStore(slug) {
  const domain = domainFor(slug);

  for (const provider of PROVIDERS) {
    const image = await download(provider.url(domain));
    if (!image) continue;

    return CompanyLogo.findOneAndUpdate(
      { slug },
      {
        $set: {
          domain,
          data: image.data,
          contentType: image.contentType,
          bytes: image.data.length,
          source: provider.id,
          fetchedAt: new Date(),
          failedAt: null,
        },
        $inc: { attempts: 1 },
      },
      { upsert: true, new: true },
    );
  }

  await CompanyLogo.findOneAndUpdate(
    { slug },
    { $set: { domain, failedAt: new Date() }, $inc: { attempts: 1 } },
    { upsert: true },
  );
  return null;
}

// Two rows asking for the same logo on first paint should cost one fetch, not
// one each. Holds promises only — the bytes are never parked in process memory,
// they go straight from the response to Mongo to the client.
const inflight = new Map();

/**
 * The cached logo document, or null when no provider has one. Fetches and
 * stores on first ask.
 */
export function ensureLogo(slug) {
  if (inflight.has(slug)) return inflight.get(slug);

  const pending = (async () => {
    const existing = await CompanyLogo.findOne({ slug });
    if (existing?.data?.length) return existing;
    if (existing?.failedAt && Date.now() - existing.failedAt.getTime() < RETRY_MISS_MS) return null;
    return fetchAndStore(slug);
  })().finally(() => inflight.delete(slug));

  inflight.set(slug, pending);
  return pending;
}
