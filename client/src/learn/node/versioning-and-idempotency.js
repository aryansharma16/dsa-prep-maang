import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Two problems that appear the moment an API has real clients: **you need to change it without breaking them**, and **the network will deliver some of their requests twice**. Both have standard answers that are much cheaper to adopt early than to retrofit.',
    ),

    h('What actually breaks a client'),
    table(
      ['Breaking', 'Safe'],
      [
        ['Removing a field', 'Adding an **optional** field'],
        ['Renaming a field', 'Adding a new endpoint'],
        ['Changing a type — `"7"` to `7`', 'Adding a new optional query parameter'],
        ['Making an optional request field required', 'Adding a new value to a response enum *if clients were told to tolerate it*'],
        ['Tightening validation on existing input', 'Loosening validation'],
        ['Changing a status code', 'Adding a new error `code` for a new case'],
        ['Changing the meaning of a field', 'Fixing a genuine bug'],
      ],
    ),
    warn(
      'Adding a value to an enum is the one people get wrong. If a client has `switch (status)` with no default, a new `"archived"` breaks it. Document from day one that clients must tolerate unknown enum values — and then it is a safe change.',
    ),
    tip(
      'Most "we need v2" moments are one or two breaking changes. Adding a new field alongside the old one, and deprecating the old one on a schedule, avoids versioning entirely — and versioning is expensive, so avoid it when you can.',
    ),

    h('Where the version goes'),
    table(
      ['Style', 'Looks like', 'Trade-off'],
      [
        ['**URL path**', '`/v1/tasks`', 'Obvious, cacheable, easy to route and to test with curl. **The usual choice.**'],
        ['Header', '`Accept: application/vnd.api+json; version=1`', 'Purer — the URL still identifies the same resource. Harder to use and to cache.'],
        ['Query parameter', '`/tasks?version=1`', 'Easy to forget, easy to cache wrongly.'],
        ['Date-based', '`API-Version: 2026-08-24`', 'What Stripe does. Excellent for many small changes; more machinery.'],
      ],
    ),
    code(
      js(`
// URL versioning is a router mount — nothing more.
app.use('/v1', v1Routes);
app.use('/v2', v2Routes);
`),
    ),
    code(
      js(`
// And v2 usually reuses v1's service layer, differing only in the mapper.
// v2/tasks.controller.js
export const getOne = async (req, res) => {
  const task = await service.getForUser(req.params.id, req.user.id);
  res.json(toTaskV2(task));       // the only difference from v1
};
`),
    ),
    note(
      'This is where the layering earns itself. If your business rules were in the controller, v2 would be a copy of everything. With a service layer, a version is a routing prefix and a response mapper.',
    ),

    h('Deprecating'),
    code(
      js(`
// Tell clients in the response, not only in a changelog nobody reads.
res.set('Deprecation', 'true');
res.set('Sunset', 'Sat, 01 Aug 2026 00:00:00 GMT');
res.set('Link', '</v2/tasks>; rel="successor-version"');
`),
    ),
    p(
      'And log every call to a deprecated endpoint with the client id or API key. When you propose the removal date, you then know exactly who is still calling and can tell them — which is the difference between a planned removal and an incident.',
    ),

    h('Why idempotency matters'),
    p(
      'A client sends `POST /charges`. The server processes it, and the response is lost — a timeout, a dropped connection, a load balancer restart. The client cannot tell whether the charge happened. If it retries, the customer may be charged twice; if it does not, they may never be charged at all.',
    ),
    code(
      js(`
Client                                Server
  │──── POST /charges ─────────────────▶│
  │                                     │  charge created ✓
  │◀─── ✗ response lost ────────────────│
  │                                     │
  │  retry? -> double charge            │
  │  give up? -> unknown state          │
`),
    ),
    p(
      '`GET`, `PUT` and `DELETE` are idempotent by definition, so a retry is safe. `POST` is not — which is why it needs an explicit mechanism.',
    ),

    h('Idempotency keys'),
    code(
      js(`
// The client generates a key per logical operation and reuses it on retries.
POST /v1/charges
Idempotency-Key: 8f3a91c2-...
{ "amountMinor": 1250, "currency": "INR" }
`),
    ),
    code(
      js(`
// create table idempotency_keys (
//   key           text primary key,
//   user_id       uuid not null,
//   request_hash  text not null,
//   status_code   int,
//   response_body jsonb,
//   created_at    timestamptz not null default now()
// );

export const idempotent = () => async (req, res, next) => {
  const key = req.get('Idempotency-Key');
  if (!key) return next();                     // or require it on this route
  if (key.length > 255) return next(new ValidationError('Idempotency-Key too long'));

  const hash = crypto.createHash('sha256')
    .update(JSON.stringify(req.body)).digest('hex');

  // Claim the key. The unique index makes this the atomic step.
  const claim = await pool.query(
    \`insert into idempotency_keys (key, user_id, request_hash)
     values ($1, $2, $3)
     on conflict (key) do nothing
     returning key\`,
    [key, req.user.id, hash],
  );

  if (claim.rowCount === 0) {
    const { rows: [prior] } = await pool.query(
      'select * from idempotency_keys where key = $1 and user_id = $2',
      [key, req.user.id],
    );
    if (!prior) throw new ForbiddenError();          // someone else's key
    if (prior.request_hash !== hash) {
      throw new ConflictError('Idempotency-Key reused with a different body');
    }
    if (prior.status_code === null) {
      return res.status(409).json({ error: { message: 'Request in progress' } });
    }
    return res.status(prior.status_code).json(prior.response_body);   // replay
  }

  // First time through: capture the response so a retry can replay it.
  const json = res.json.bind(res);
  res.json = (body) => {
    pool.query(
      'update idempotency_keys set status_code = $2, response_body = $3 where key = $1',
      [key, res.statusCode, body],
    ).catch(err => log.error({ err }, 'failed to store idempotent response'));
    return json(body);
  };

  next();
};
`),
    ),
    table(
      ['Case', 'Response'],
      [
        ['First request with this key', 'Processed normally; the response is stored'],
        ['Retry, same key, same body', 'The stored response, replayed — no second charge'],
        ['Retry while the first is still running', '`409`, so the client backs off and retries'],
        ['Same key, **different** body', '`409` — the client has a bug'],
        ['Someone else\'s key', '`403` — keys are scoped per user'],
      ],
    ),
    tip(
      'The `on conflict do nothing … returning` is the whole design. It makes claiming the key a single atomic statement, so two concurrent retries cannot both decide they are first. Checking with a `SELECT` and then inserting is a race, and under retry storms it is a race you will lose.',
    ),
    warn(
      'Expire old keys — a `created_at` index and a nightly delete of anything older than 24 hours. An idempotency table that grows forever becomes the slowest lookup in your write path.',
    ),

    h('Cheaper alternatives'),
    code(
      js(`
// 1. A natural unique constraint. Free, and always correct.
// create unique index on invoices (order_id);
// A retry hits 23505, which you map to 409 or to "already done".

// 2. The client supplies the id, so a retry is a no-op PUT.
PUT /tasks/8f3a91c2-...      { "title": "Ship it" }

// 3. Deduplicate on business data within a window.
// create unique index on charges (user_id, amount_minor, date_trunc('minute', created_at));
`),
    ),
    note(
      'Option 1 is underrated. If the operation already has something naturally unique — an order id, an external reference, an email address — a unique index gives you idempotency with no extra table and no middleware.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Add a field', 'Just add it, optional — no version needed'],
      ['Remove or rename a field', 'A new version, or add-and-deprecate'],
      ['Version an API', 'A path prefix — `/v1`'],
      ['Keep versions cheap', 'Share the service layer; vary only the mapper'],
      ['Announce a removal', '`Deprecation` and `Sunset` headers, plus per-client logging'],
      ['Make a POST retry-safe', 'An `Idempotency-Key` header'],
      ['Claim a key atomically', '`insert … on conflict do nothing returning`'],
      ['Idempotency without a table', 'A unique index on the natural key'],
    ]),

    h('Interview'),
    asked([
      ['How do you version an API without breaking clients?', 'Add rather than change where possible; otherwise a `/v1` path prefix, with the service layer shared between versions.'],
      ['What counts as a breaking change?', 'Removing or renaming a field, changing a type or status code, or tightening validation.'],
      ['How do idempotency keys work?', 'The client sends a key; the server claims it atomically, stores the response, and replays it on any retry with the same key and body.'],
      ['Which methods are already idempotent?', '`GET`, `PUT`, `DELETE`, `HEAD` — `POST` is the one needing help.'],
      ['What if the same key arrives with a different body?', 'Return `409` — the client has a bug, and processing it would be worse.'],
      ['A cheaper way to get idempotency?', 'A unique constraint on a natural key, or let the client choose the id and use `PUT`.'],
    ]),

    links(
      link('Stripe — Idempotent requests', 'https://docs.stripe.com/api/idempotent_requests'),
      link('RFC 9110 — Idempotent methods', 'https://www.rfc-editor.org/rfc/rfc9110.html#name-idempotent-methods'),
      link('The Deprecation HTTP header', 'https://www.rfc-editor.org/rfc/rfc9745.html'),
    ),
  ],
};
