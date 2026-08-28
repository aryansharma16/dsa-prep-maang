import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Once the resources are named, the remaining decisions are about consistency: the same response envelope everywhere, the same error shape everywhere, the same field naming everywhere. Consistency is worth more than any individual choice here — a client can write one response handler instead of one per endpoint.',
    ),

    h('The response envelope'),
    code(
      js(`
// A collection.
{
  "data": [ { "id": "…", "title": "Ship it" } ],
  "meta": { "total": 143, "page": 2, "perPage": 20 }
}

// A single resource — the object itself, not wrapped.
{ "id": "…", "title": "Ship it", "done": false, "createdAt": "2026-08-24T…" }

// An error.
{ "error": { "message": "Task not found", "code": "not_found", "requestId": "8f3a…" } }
`),
    ),
    p(
      'Whether you wrap single resources is genuinely a matter of taste. What matters is that you make one choice: a client should never have to remember which endpoints wrap and which do not.',
    ),
    tip(
      'A collection needs an envelope even if a member does not, because pagination metadata has nowhere else to go. Returning a bare array leaves you no room to add a total later without a breaking change.',
    ),

    h('The error shape'),
    code(
      js(`
// 422 — validation, with enough detail to highlight the right field
{
  "error": {
    "message": "Validation failed",
    "code": "validation_failed",
    "issues": [
      { "field": "title", "message": "must not be empty" },
      { "field": "dueAt", "message": "must be a valid ISO 8601 date" }
    ],
    "requestId": "8f3a…"
  }
}

// 500 — no detail whatsoever
{ "error": { "message": "Internal server error", "requestId": "8f3a…" } }
`),
    ),
    table(
      ['Field', 'For'],
      [
        ['`message`', 'A human reading a log or a support ticket. Not for display to end users.'],
        ['`code`', 'The **client** branching on it. A stable string that never changes.'],
        ['`issues`', 'Per-field validation detail, so a form can highlight the right input.'],
        ['`requestId`', 'Correlating with your logs. Return it on every error.'],
      ],
    ),
    warn(
      'Clients will branch on whatever you give them. If they only have `message`, they will string-match it — and your next copy edit becomes a breaking change. A stable `code` is what stops that.',
    ),
    note(
      'RFC 9457 (`application/problem+json`) standardises this with `type`, `title`, `status`, `detail` and `instance`. Worth adopting for a public API; a consistent house shape is fine for an internal one.',
    ),

    h('Field naming'),
    table(
      ['Rule', 'Example'],
      [
        ['One case convention throughout', '`camelCase` in JSON, even over a `snake_case` database'],
        ['ISO 8601 UTC for timestamps', '`"2026-08-24T14:30:00.000Z"` — never a Unix number, never a local time'],
        ['`booleanish` names read as questions', '`done`, `isActive` — not `status: 1`'],
        ['Ids are strings', '`"7"` or a UUID — a JSON number loses precision past 2^53'],
        ['Money is an integer minor unit, plus a currency', '`{ "amountMinor": 1250, "currency": "INR" }`'],
        ['Enums are lowercase strings', '`"open"`, not `0`'],
      ],
    ),
    code(
      js(`
// The mapper at the repository boundary is what enforces this — and what
// stops a column you forgot about from reaching the client.
const toTask = (row) => ({
  id: row.id,
  title: row.title,
  done: row.done,
  createdAt: row.created_at.toISOString(),
  // row.internal_notes and row.owner_email simply never appear
});
`),
    ),
    warn(
      '`res.json(row)` is how private columns leak. A `SELECT *` plus a direct serialisation ships `password_hash`, `stripe_customer_id` and `internal_score` to the client the day someone adds them. An explicit mapper is an allowlist.',
    ),

    h('Nulls, absence and empties'),
    code(
      js(`
{ "dueAt": null }        // known to have no due date
{ }                      // the field was not returned — say why, or do not do this
{ "tags": [] }           // no tags. NOT null — a list is always a list
`),
    ),
    tip(
      'Pick one and stick to it: either optional fields are always present as `null`, or they are omitted when absent. Mixing the two forces every client to check both. Returning `[]` rather than `null` for empty collections is worth doing unconditionally — it removes a null check from every consumer.',
    ),

    h('Partial responses'),
    code(
      js(`
GET /tasks?fields=id,title           // only these fields
GET /tasks?include=assignee,project  // expand these relations
`),
    ),
    warn(
      'Both are easy to add and hard to make safe. `fields` must be validated against an allowlist — otherwise it becomes a column-selection injection — and `include` needs a depth limit, or a client can request `include=assignee.tasks.assignee.tasks` and hand you an N+1 storm.',
    ),

    h('Bulk operations'),
    code(
      js(`
// 207 Multi-Status: some worked, some did not.
POST /tasks/bulk
{ "items": [ { "title": "a" }, { "title": "" } ] }

-> 207
{
  "results": [
    { "index": 0, "status": 201, "data": { "id": "…" } },
    { "index": 1, "status": 422, "error": { "message": "title required" } }
  ]
}
`),
    ),
    p(
      'Decide up front whether a bulk endpoint is all-or-nothing (one transaction, one status code) or best-effort (per-item results). Both are defensible; silently doing one while documenting the other is not.',
    ),

    h('Documenting it'),
    code(
      js(`
// Generate OpenAPI from the Zod schemas you already validate with, so the
// documentation cannot drift from the implementation.
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';
`),
    ),
    tip(
      'Hand-written API documentation is wrong within a month. Anything generated from the same schemas the code enforces stays true by construction — that is the strongest argument for schema-first validation, beyond the validation itself.',
    ),

    h('Checklist for a new endpoint'),
    table(
      ['Question', 'Default answer'],
      [
        ['Right method and status?', '`POST` → `201` + `Location`; `DELETE` → `204`'],
        ['Input validated?', 'A schema on body, query and params'],
        ['Ownership checked?', 'In the service, not the controller'],
        ['Paginated?', 'Every collection, with a maximum page size'],
        ['Errors typed?', 'Thrown as `AppError` subclasses'],
        ['Response mapped?', 'Through an explicit field mapper'],
        ['Rate limited?', 'Anything unauthenticated or expensive'],
        ['Logged?', 'Method, path, status, duration, request id, user id'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Return a collection', '`{ data: [...], meta: {...} }`'],
      ['Return an error', '`{ error: { message, code, requestId } }`'],
      ['Let clients branch on errors', 'A stable `code` string'],
      ['Send a timestamp', 'ISO 8601 UTC'],
      ['Send an id', 'A string, always'],
      ['Send money', 'Integer minor units + currency'],
      ['Avoid leaking columns', 'An explicit row → object mapper'],
      ['Keep docs true', 'Generate OpenAPI from the validation schemas'],
    ]),

    h('Interview'),
    asked([
      ['What should an API error response contain?', 'A message, a stable machine-readable code, per-field issues where relevant, and a request id.'],
      ['Why a `code` as well as a `message`?', 'Clients branch on it; without one they string-match the message and your copy edits break them.'],
      ['Why send ids as strings?', 'JSON numbers lose precision above 2^53, and it keeps UUIDs and integers interchangeable.'],
      ['How do you avoid leaking database columns?', 'Map rows to response objects explicitly — never serialise a row directly.'],
      ['Null or omitted for an absent field?', 'Either, consistently. Empty collections should always be `[]`, not `null`.'],
      ['How do you keep documentation accurate?', 'Generate it from the same schemas that validate requests.'],
    ]),

    links(
      link('RFC 9457 — Problem Details for HTTP APIs', 'https://www.rfc-editor.org/rfc/rfc9457.html'),
      link('Google API design guide', 'https://cloud.google.com/apis/design'),
      link('OpenAPI Specification', 'https://spec.openapis.org/oas/latest.html'),
    ),
  ],
};
