import { asked, cheat, code, h, js, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Headers are the metadata channel of HTTP: content type, caching, authentication, and the proxy chain a request came through. Cookies are one header with rules of their own, and the flags on them are the difference between a session that is safe and one that is a vulnerability.',
    ),

    h('Content type'),
    code(
      js(`
res.setHeader('Content-Type', 'application/json; charset=utf-8');
res.setHeader('Content-Type', 'text/csv');
res.setHeader('Content-Type', 'application/octet-stream');   // unknown binary

// Force a download rather than rendering in the browser.
res.setHeader('Content-Disposition', 'attachment; filename="export.csv"');
`),
    ),
    warn(
      'Serving user-uploaded content with a guessed `Content-Type` — or none at all — lets an uploaded `.html` file execute as a page on your origin, with access to your cookies. Serve untrusted files as `application/octet-stream` with `X-Content-Type-Options: nosniff`, and ideally from a separate domain.',
    ),

    h('Caching'),
    table(
      ['Header', 'Says'],
      [
        ['`Cache-Control: no-store`', 'Never cache this. Anything user-specific or sensitive.'],
        ['`Cache-Control: no-cache`', 'Cache it, but revalidate before every use.'],
        ['`Cache-Control: private, max-age=60`', 'The browser may cache for 60 s; shared proxies may not.'],
        ['`Cache-Control: public, max-age=31536000, immutable`', 'A fingerprinted asset that never changes.'],
        ['`ETag`', 'A version tag for this exact body.'],
        ['`Last-Modified`', 'A weaker, timestamp-based version tag.'],
        ['`Vary: Accept-Encoding, Authorization`', 'The cache key must include these request headers.'],
      ],
    ),
    code(
      js(`
// A conditional GET: send a body only if the client's copy is stale.
app.get('/tasks/:id', async (req, res) => {
  const task = await service.findById(req.params.id);
  if (!task) return res.status(404).json({ error: 'Not found' });

  const etag = \`"\${task.updatedAt.getTime()}"\`;

  if (req.headers['if-none-match'] === etag) {
    return res.status(304).end();          // no body — the client reuses its copy
  }

  res.setHeader('ETag', etag);
  res.setHeader('Cache-Control', 'private, max-age=0, must-revalidate');
  res.json(task);
});
`),
    ),
    warn(
      'Forgetting `Vary: Authorization` on a cacheable authenticated response is how one user\'s data gets served to another from a shared cache. If a response depends on who is asking, it must be `private` — or better, `no-store`.',
    ),

    h('Proxy headers'),
    p(
      'Behind nginx, an ALB or Cloudflare, `req.socket.remoteAddress` is the **proxy\'s** IP, not the client\'s. The real one arrives in a header.',
    ),
    table(
      ['Header', 'Holds'],
      [
        ['`X-Forwarded-For`', 'A comma-separated chain — `client, proxy1, proxy2`'],
        ['`X-Forwarded-Proto`', '`http` or `https` as the client saw it'],
        ['`X-Forwarded-Host`', 'The host the client asked for'],
      ],
    ),
    code(
      js(`
// Tell Express to trust exactly the proxies in front of you.
app.set('trust proxy', 1);      // one hop — an ALB or a single nginx
// app.set('trust proxy', 'loopback, 10.0.0.0/8');   // by address

// Then these become correct:
req.ip;         // the client, not the proxy
req.protocol;   // 'https' even though the internal hop was http
req.secure;
`),
    ),
    warn(
      '`trust proxy: true` trusts the header from **anyone**. A client can then send `X-Forwarded-For: 1.2.3.4` and defeat your IP rate limiter, your audit log and any IP allowlist. Trust a specific hop count or a specific CIDR — never a blanket `true` on a public service.',
    ),

    h('Cookies'),
    code(
      js(`
res.setHeader(
  'Set-Cookie',
  'sid=abc123; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800',
);

// Several cookies: an array, not a joined string.
res.setHeader('Set-Cookie', ['sid=abc; HttpOnly', 'theme=dark; Path=/']);

// In Express, with cookie-parser:
res.cookie('sid', token, {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000,
  path: '/',
});
res.clearCookie('sid', { path: '/' });    // the options must MATCH to clear it
`),
    ),

    h('The flags'),
    table(
      ['Flag', 'Does', 'Set it?'],
      [
        ['`HttpOnly`', 'JavaScript cannot read it — `document.cookie` does not see it', '**Always**, for anything session-related'],
        ['`Secure`', 'Only sent over HTTPS', '**Always** in production'],
        ['`SameSite=Lax`', 'Not sent on cross-site requests, except top-level navigations', 'The sensible default'],
        ['`SameSite=Strict`', 'Never sent cross-site at all', 'When following a link from elsewhere should not log you in'],
        ['`SameSite=None`', 'Always sent — **requires `Secure`**', 'Only for a genuinely cross-origin API'],
        ['`Max-Age` / `Expires`', 'When it dies. Omit for a session cookie', 'Set it deliberately'],
        ['`Path` / `Domain`', 'Which URLs it is sent to', 'Keep as narrow as you can'],
      ],
    ),
    tip(
      '`HttpOnly` is the single most valuable one. It means an XSS bug on your site can no longer steal the session token — the attacker can still act as the user while the page is open, but they cannot exfiltrate the cookie and keep the session. That trade-off is the whole reason cookies beat `localStorage` for tokens.',
    ),
    warn(
      'Cookies have a practical size limit around 4 KB, and every cookie is sent on **every** request to that domain, including images and static assets. Storing anything but an opaque identifier there is paid for on every request.',
    ),

    h('Reading them'),
    code(
      js(`
// Raw Node — one header, semicolon-separated.
const cookies = Object.fromEntries(
  (req.headers.cookie ?? '')
    .split(';')
    .map(c => c.trim().split('='))
    .filter(([k]) => k)
    .map(([k, ...v]) => [k, decodeURIComponent(v.join('='))]),
);

// Express, since 4.16 — no cookie-parser needed for reading in newer versions,
// but cookie-parser is still the norm:
app.use(cookieParser());
req.cookies.sid;
req.signedCookies.sid;      // with cookieParser(secret) — tamper-evident
`),
    ),

    h('Security headers'),
    code(
      js(`
import helmet from 'helmet';
app.use(helmet());     // sets sensible defaults for all of the below
`),
    ),
    table(
      ['Header', 'Stops'],
      [
        ['`X-Content-Type-Options: nosniff`', 'The browser guessing a type you did not send'],
        ['`Strict-Transport-Security`', 'Any future plain-HTTP request to your domain'],
        ['`Content-Security-Policy`', 'Injected scripts from running — the strongest XSS defence'],
        ['`X-Frame-Options: DENY`', 'Your page being framed for clickjacking'],
        ['`Referrer-Policy`', 'Your URLs leaking to third parties'],
      ],
    ),
    note(
      'These are covered properly in the `cors-and-headers` topic at the end of this pass. Mentioned here because they are headers, and because `helmet()` is one line you should add on day one.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Send JSON', '`Content-Type: application/json; charset=utf-8`'],
      ['Force a download', '`Content-Disposition: attachment; filename="..."`'],
      ['Never cache a response', '`Cache-Control: no-store`'],
      ['Save bandwidth on unchanged data', '`ETag` + `304`'],
      ['Get the real client IP', '`app.set("trust proxy", 1)`, then `req.ip`'],
      ['Store a session token', 'A cookie with `HttpOnly; Secure; SameSite=Lax`'],
      ['Clear a cookie', '`res.clearCookie` with the **same** path and domain'],
      ['Add baseline security headers', '`app.use(helmet())`'],
    ]),

    h('Interview'),
    asked([
      ['What do `HttpOnly`, `Secure` and `SameSite` do?', 'Hide the cookie from JavaScript, restrict it to HTTPS, and control whether it is sent cross-site.'],
      ['Cookie or `localStorage` for a token?', 'An `HttpOnly` cookie — `localStorage` is readable by any XSS on the page.'],
      ['How do `ETag` and `If-None-Match` work?', 'The server tags the body; the client sends the tag back and gets a `304` with no body if it still matches.'],
      ['Why does `Vary` matter?', 'It tells caches which request headers change the response — without it, one user\'s response can be served to another.'],
      ['How do you get the client IP behind a proxy?', '`X-Forwarded-For`, trusted only from your own proxy via `trust proxy`.'],
      ['Why is `trust proxy: true` dangerous?', 'Any client can forge `X-Forwarded-For` and defeat IP-based limits and logging.'],
    ]),

    links(
      mdn('Web/HTTP/Cookies', 'HTTP cookies'),
      mdn('Web/HTTP/Headers/Set-Cookie', 'Set-Cookie'),
      mdn('Web/HTTP/Caching', 'HTTP caching'),
    ),
  ],
};
