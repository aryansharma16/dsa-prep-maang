import { asked, cheat, code, h, js, link, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Methods say what you want done; status codes say what happened. Both are small fixed vocabularies, and using them accurately is most of what makes an API feel well-designed — a client can then handle a response correctly without reading your documentation.',
    ),

    h('The methods'),
    table(
      ['Method', 'Does', 'Safe?', 'Idempotent?', 'Body?'],
      [
        ['`GET`', 'Read a resource', 'Yes', 'Yes', 'No'],
        ['`POST`', 'Create, or "do something"', 'No', '**No**', 'Yes'],
        ['`PUT`', 'Replace a resource entirely', 'No', 'Yes', 'Yes'],
        ['`PATCH`', 'Update part of a resource', 'No', 'Usually not', 'Yes'],
        ['`DELETE`', 'Remove a resource', 'No', 'Yes', 'No'],
        ['`HEAD`', 'Like `GET`, headers only', 'Yes', 'Yes', 'No'],
        ['`OPTIONS`', 'What is allowed here — used by CORS preflight', 'Yes', 'Yes', 'No'],
      ],
    ),
    p(
      '**Safe** means it changes nothing on the server. **Idempotent** means doing it five times leaves the same state as doing it once. These are not academic labels: they decide what a proxy may cache, what a client library may retry automatically, and what a browser may prefetch.',
    ),
    code(
      js(`
DELETE /tasks/7    // 204. Again: 404 (or 204). Either way the task is gone —
                   // the STATE is the same, so it is idempotent.

POST /tasks        // creates task 7. Again: creates task 8. Not idempotent —
                   // which is why a retried POST can double-charge a card.
`),
    ),
    tip(
      'To make a `POST` safely retryable, give it an identity the server can deduplicate on — an `Idempotency-Key` header. That is the `versioning-and-idempotency` topic.',
    ),

    h('PUT vs PATCH'),
    code(
      js(`
// PUT — send the WHOLE resource. Missing fields are cleared.
PUT /tasks/7
{ "title": "Ship it", "done": true, "tags": [] }

// PATCH — send only what changes. Everything else is untouched.
PATCH /tasks/7
{ "done": true }
`),
    ),
    warn(
      'Implementing `PUT` as a partial update is a very common bug. If a client sends `{"done": true}` to `PUT /tasks/7` and your handler merges it, you have built `PATCH` and named it `PUT` — and a client that legitimately omits a field to clear it will be surprised.',
    ),

    h('The status codes'),
    table(
      ['Class', 'Means'],
      [
        ['`1xx`', 'Informational. You will not send these.'],
        ['`2xx`', 'It worked.'],
        ['`3xx`', 'Look somewhere else, or use your cache.'],
        ['`4xx`', '**The client is wrong.** Retrying identically will not help.'],
        ['`5xx`', '**The server is wrong.** Retrying might help.'],
      ],
    ),
    p('That 4xx/5xx line is the one that matters: it tells the caller whether a retry is pointless or reasonable.'),

    h('The ones you will actually send'),
    table(
      ['Code', 'Name', 'Send it when'],
      [
        ['`200`', 'OK', 'A successful `GET`, `PATCH`, `PUT`, or a `POST` that is not a creation'],
        ['`201`', 'Created', 'A `POST` created something. **Include a `Location` header.**'],
        ['`202`', 'Accepted', 'You queued the work and will finish it later'],
        ['`204`', 'No Content', 'Success with nothing to return — usually `DELETE`'],
        ['`301` / `308`', 'Moved Permanently', 'The URL changed for good'],
        ['`302` / `307`', 'Found / Temporary Redirect', 'Go here for now'],
        ['`304`', 'Not Modified', 'The client\'s cached copy is still valid'],
        ['`400`', 'Bad Request', 'Malformed — unparseable JSON, missing required field'],
        ['`401`', 'Unauthorized', '**Not authenticated.** No or bad credentials'],
        ['`403`', 'Forbidden', '**Authenticated, but not allowed.** Re-logging in will not help'],
        ['`404`', 'Not Found', 'No such resource — or you are hiding one deliberately'],
        ['`405`', 'Method Not Allowed', 'The path exists, the verb does not'],
        ['`409`', 'Conflict', 'A duplicate, or a concurrent-edit conflict'],
        ['`410`', 'Gone', 'It existed and was deleted permanently'],
        ['`413`', 'Payload Too Large', 'The body exceeded your limit'],
        ['`415`', 'Unsupported Media Type', 'You cannot parse that `Content-Type`'],
        ['`422`', 'Unprocessable Content', 'Parsed fine, failed validation'],
        ['`429`', 'Too Many Requests', 'Rate limited. **Include `Retry-After`.**'],
        ['`500`', 'Internal Server Error', 'You threw and did not expect to'],
        ['`502` / `503` / `504`', 'Bad Gateway / Unavailable / Timeout', 'A dependency failed, you are down, or it took too long'],
      ],
    ),

    h('The three pairs people confuse'),
    code(
      js(`
// 401 vs 403
401  // "I do not know who you are."      -> log in
403  // "I know who you are. No."          -> logging in again changes nothing

// 400 vs 422
400  // The JSON did not parse, or a required field is absent
422  // The JSON parsed, but 'email' is not an email

// 404 vs 403 for someone else's resource
404  // Preferred. Do not confirm that task 7 exists to someone who cannot see it
403  // Leaks the existence of the resource
`),
    ),
    note(
      'Returning `404` instead of `403` for a resource the caller may not see is a deliberate information-leak defence. Which one you choose should be consistent across the API, because the inconsistency is itself the leak.',
    ),

    h('In Express'),
    code(
      js(`
res.status(201).location(\`/tasks/\${task.id}\`).json(task);
res.status(204).end();                        // no body — do NOT call .json()
res.status(429).set('Retry-After', '60').json({ error: 'Rate limited' });
res.sendStatus(404);                           // status + its text as the body
`),
    ),
    warn(
      'A `204` must have no body. `res.status(204).json({})` sends a body with a status that says there is none — some clients and proxies will treat that as a protocol error.',
    ),

    h('Choosing one'),
    code(
      js(`
POST /tasks        -> 201 + Location, or 400/422 if invalid
GET /tasks/7       -> 200, or 404
GET /tasks/7  (cached, unchanged) -> 304
PATCH /tasks/7     -> 200 with the updated resource, or 404/422
DELETE /tasks/7    -> 204, or 404
POST /tasks (duplicate title) -> 409
POST /reports      -> 202 + a status URL, because it takes 40 seconds
`),
    ),

    h('Cheatsheet'),
    cheat([
      ['Created something', '`201` + `Location`'],
      ['Deleted something', '`204`, no body'],
      ['Queued something slow', '`202` + a way to poll'],
      ['Bad input, unparseable', '`400`'],
      ['Bad input, failed validation', '`422`'],
      ['Not logged in', '`401`'],
      ['Logged in, not permitted', '`403`'],
      ['Duplicate or conflicting write', '`409`'],
      ['Rate limited', '`429` + `Retry-After`'],
      ['You crashed', '`500` — and never leak the stack'],
    ]),

    h('Interview'),
    asked([
      ['What does idempotent mean, and which methods are?', 'Repeating it leaves the same state. `GET`, `PUT`, `DELETE`, `HEAD` are; `POST` is not.'],
      ['`401` vs `403`?', 'Not authenticated versus authenticated but not permitted.'],
      ['`PUT` vs `PATCH`?', '`PUT` replaces the whole resource; `PATCH` applies a partial update.'],
      ['`400` vs `422`?', 'Malformed request versus a well-formed one that fails business validation.'],
      ['What do you return from a successful `DELETE`?', '`204` with no body — or `404` if it was not there.'],
      ['Which status codes are safe to retry?', '`5xx` and `429`; a `4xx` will fail identically until the request changes.'],
      ['Why might you return `404` instead of `403`?', 'So the response does not confirm that a resource exists to someone not allowed to see it.'],
    ]),

    links(
      mdn('Web/HTTP/Methods', 'HTTP request methods'),
      mdn('Web/HTTP/Status', 'HTTP response status codes'),
      link('RFC 9110 — HTTP Semantics', 'https://www.rfc-editor.org/rfc/rfc9110.html'),
    ),
  ],
};
