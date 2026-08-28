import { asked, cheat, code, h, js, link, links, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'Everything arriving from a client is a string of unknown shape written by someone who may be hostile. Validation at the edge turns that into typed, bounded data — and it is the single highest-value habit in this whole track, because it removes an entire category of bug and an entire category of vulnerability at once.',
    ),

    h('What can arrive'),
    code(
      js(`
// You expect: { page: 2, tags: ['api'] }
// A client can send any of these, and Express will hand them to you:
req.query.page     // '2'  |  ['2','3']  |  { evil: '1' }  |  undefined
req.body           // null | 'a string' | [] | { __proto__: { admin: true } }
req.params.id      // any string at all, including '../../etc/passwd'
`),
    ),
    warn(
      'Code that assumes a shape crashes or misbehaves on a crafted request. `req.query.page.trim()` throws when `page` is an array; `Number(req.query.limit)` is `NaN` when it is an object; a mass assignment turns `{ role: "admin" }` into a privilege escalation. Every one of those is prevented by a schema.',
    ),

    h('Zod'),
    code(
      js(`
import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, 'must not be empty').max(200),
  done: z.boolean().default(false),
  dueAt: z.coerce.date().optional(),
  priority: z.enum(['low', 'medium', 'high']).default('medium'),
  tags: z.array(z.string().trim().min(1)).max(10).default([]),
  assigneeId: z.string().uuid().optional(),
}).strict();          // reject unknown keys instead of silently dropping them
`),
    ),
    table(
      ['Piece', 'Does'],
      [
        ['`.trim()`', 'Cleans before validating, so `"  "` fails `min(1)`'],
        ['`.max(200)`', 'A bound. Every string and array needs one'],
        ['`.coerce.date()`', 'Turns the ISO string into a real `Date`'],
        ['`.default(...)`', 'Fills the field so downstream code has no `undefined`'],
        ['`.strict()`', '**Rejects** unknown keys — the anti-mass-assignment lever'],
        ['`.uuid()`', 'Format check, so a malformed id never reaches the database'],
      ],
    ),
    tip(
      '`.strict()` versus the default `.strip()` is a real decision. `.strip()` silently discards unknown fields, which is forgiving for clients; `.strict()` errors, which catches a client sending `titel` instead of `title`. For an internal API, strict is more useful; for a public one, stripping is kinder.',
    ),

    h('The middleware'),
    code(
      js(`
// middleware/validate.js
export const validate = (schema, source = 'body') => (req, res, next) => {
  const result = schema.safeParse(req[source]);
  if (!result.success) {
    return next(new ValidationError(
      result.error.issues.map(i => ({
        field: i.path.join('.'),
        message: i.message,
      })),
    ));
  }
  req[source] = result.data;      // <- the important line
  next();
};
`),
    ),
    code(
      js(`
router.post('/', validate(createTaskSchema), controller.create);
router.get('/', validate(listTasksQuery, 'query'), controller.list);
router.get('/:id', validate(idParamSchema, 'params'), controller.getOne);
`),
    ),
    note(
      'Assigning `result.data` back over `req.body` is what makes this worth doing. Downstream code then receives a real `Date`, a real `number` and a guaranteed-present `tags` array — so no handler ever re-checks or re-converts anything.',
    ),

    h('Validate all three sources'),
    code(
      js(`
export const idParamSchema = z.object({ id: z.string().uuid() });

export const listTasksQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().max(500).optional(),
  status: z.enum(['open', 'done']).optional(),
  sort: z.enum(['createdAt', 'title']).default('createdAt'),
});
`),
    ),
    p(
      'The query schema is doing double duty: it validates, and by using enums it **allowlists** the sortable columns — which is exactly the defence the `pagination` topic needed for its `ORDER BY`.',
    ),

    h('Mass assignment'),
    code(
      js(`
// The vulnerability: whatever the client sends becomes columns.
await db.query('update users set … ', req.body);
// POST { "name": "x", "role": "admin", "credits": 999999 }

// The fix is the schema — it can only produce the fields you declared.
const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  bio: z.string().max(500).optional(),
}).strict();

// req.body after validation contains name and bio. Nothing else. Ever.
`),
    ),
    tip(
      'Have a separate schema per operation, not one per table. `createUser` accepts a password; `updateProfile` does not; `adminUpdateUser` accepts a role. One shared "User" schema forces you to make fields optional and loses exactly the property you wanted.',
    ),

    h('400 or 422'),
    table(
      ['Status', 'For', 'Example'],
      [
        ['`400`', 'The request itself is malformed', 'Unparseable JSON, wrong `Content-Type`, missing body'],
        ['`422`', 'It parsed, but the content is wrong', '`title` empty, `email` not an email, `limit` over 100'],
      ],
    ),
    code(
      js(`
// 422
{ "error": { "message": "Validation failed", "code": "validation_failed",
  "issues": [ { "field": "title", "message": "must not be empty" },
              { "field": "tags.3", "message": "must not be empty" } ] } }
`),
    ),
    p(
      'Return **all** the issues, not just the first. A form that reveals one error at a time makes the user submit five times to find out about five problems. `safeParse` collects them for you.',
    ),
    warn(
      'Not everyone distinguishes 400 from 422, and plenty of good APIs return 400 for both. Choose one convention and apply it everywhere — inconsistency costs the client more than either choice does.',
    ),

    h('Validation is not authorisation'),
    code(
      js(`
// The schema proves the shape is valid. It says nothing about permission.
const { assigneeId } = createTaskSchema.parse(req.body);

// This still has to happen, in the service:
if (!await service.canAssignTo(req.user, assigneeId)) throw new ForbiddenError();
`),
    ),
    warn(
      'A valid UUID belonging to someone else is still a valid UUID. Schemas answer "is this well-formed?"; only your service can answer "is this caller allowed to reference it?". Conflating the two is how IDOR vulnerabilities happen — see `authorization-rbac`.',
    ),

    h('Sanitisation'),
    p(
      'Validation rejects; sanitisation transforms. Do as little of the second as you can — silently changing what a client sent hides bugs.',
    ),
    table(
      ['Do', 'Do not'],
      [
        ['`.trim()` whitespace', 'Strip characters to "make it safe"'],
        ['Normalise an email to lowercase', 'Strip quotes from strings before a SQL query — parameterise instead'],
        ['Cap a length', 'HTML-escape on input — escape on **output**, where you know the context'],
        ['Coerce `"2"` to `2` via a schema', 'Silently accept `"two"` as `0`'],
      ],
    ),
    note(
      'Escaping on input is a classic mistake: the correct escaping depends on where the value ends up — HTML, an attribute, a URL, SQL, a shell. Store what the user typed; escape at each output, using the escaper for that context.',
    ),

    h('Alternatives'),
    table(
      ['Library', 'Notes'],
      [
        ['**Zod**', 'The default choice now. TypeScript types inferred from the schema; also generates OpenAPI.'],
        ['**Joi**', 'Older, very mature, no type inference. Common in existing codebases.'],
        ['**Yup**', 'Popular on the front end; usable server-side.'],
        ['**AJV**', 'JSON Schema. Fastest, and the right pick if you already publish JSON Schema.'],
        ['`express-validator`', 'Chained middleware style; less composable than a schema object.'],
      ],
    ),

    h('Cheatsheet'),
    cheat([
      ['Validate a body', '`validate(schema)` before the handler'],
      ['Validate a query', '`validate(schema, "query")`'],
      ['Validate a path param', '`z.string().uuid()`'],
      ['Prevent mass assignment', '`.strict()` plus a per-operation schema'],
      ['Convert types safely', '`z.coerce.number()`, `z.coerce.date()`'],
      ['Cap a collection or string', '`.max(n)` on everything'],
      ['Return every error at once', '`safeParse` and map `error.issues`'],
      ['Not covered by validation', 'Ownership and permission — that is the service'],
    ]),

    h('Interview'),
    asked([
      ['Where do you validate?', 'At the edge, in middleware, before any handler or service sees the data.'],
      ['What is mass assignment and how do you stop it?', 'Letting client fields become columns — stopped by a strict per-operation schema.'],
      ['`400` or `422`?', '`400` for a malformed request, `422` for one that parsed but failed the rules — applied consistently.'],
      ['Why replace `req.body` with the parsed result?', 'Downstream code gets typed, defaulted values and never re-checks anything.'],
      ['Does validation give you authorisation?', 'No — a well-formed id can still belong to another user.'],
      ['Why not escape input?', 'Escaping depends on the output context; escape at output, store what was sent.'],
    ]),

    links(
      link('Zod', 'https://zod.dev'),
      link('OWASP — Input Validation Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Input_Validation_Cheat_Sheet.html'),
      link('OWASP — Mass Assignment Cheat Sheet', 'https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html'),
    ),
  ],
};
