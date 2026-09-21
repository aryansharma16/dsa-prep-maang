import { asked, code, diagram, flow, h, js, links, p, quick, table, tip, warn, wiki } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '**Authentication is who you are. Authorization is what you may do.** They are different problems with different failure modes, they belong at different layers, and the most common security bug in any system is doing the first one well and the second one carelessly.',
    ),

    diagram(
      `
   request ──▶ ┌────────────────────────────────────────┐
               │ AUTHENTICATION      "who are you?"     │
               │ verify a credential ──▶ an identity    │
               │ edge / gateway. ONCE per request.      │
               └───────────────┬────────────────────────┘
                               ▼  identity: user 42, roles [...]
               ┌────────────────────────────────────────┐
               │ AUTHORIZATION       "may you do this?" │
               │ identity + resource + action ──▶ yes/no│
               │ IN THE SERVICE. per operation.         │
               └───────────────┬────────────────────────┘
                               ▼
                          the operation

   authn at the edge is fine — it is the same answer for
   every service.
   authz at the edge is NOT — only the service knows whether
   user 42 owns order 991.
`,
      'Two checks, two places',
    ),
    warn(
      '**A gateway cannot do authorization properly.** It can check "is this a valid token with the `orders:read` scope", which is coarse. It cannot check "does user 42 own order 991" — that requires the data, and only the service has it. Object-level checks must live in the service.',
    ),

    h('The vulnerability this causes'),
    code(
      js(`
// BROKEN — authenticated, but not authorized.
// The gateway confirmed a valid token. Nothing confirmed that
// THIS user owns THIS order.
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findById(req.params.id);
  res.json(order);                     // /orders/992 works too.
});

// CORRECT — ownership is part of the query, not a check after it.
app.get('/orders/:id', requireAuth, async (req, res) => {
  const order = await db.orders.findOne({
    id: req.params.id,
    userId: req.user.id,               // scoped at the source
  });
  if (!order) return res.sendStatus(404);   // 404, not 403 — do not
  res.json(order);                          // confirm it exists
});
`),
    ),
    tip(
      'Scoping the **query** rather than checking after the fetch is the pattern that scales. A check can be forgotten on the next endpoint; a repository that only ever returns rows the caller owns cannot leak one by omission.',
    ),

    h('RBAC versus ABAC'),
    table(
      ['', 'RBAC — roles', 'ABAC — attributes'],
      [
        ['Rule', '`admin` may delete users', '`dept == resource.dept && time < 18:00`'],
        ['Model', 'User → roles → permissions', 'A policy evaluated over attributes'],
        ['Simplicity', '**Simple, auditable**', 'Complex, hard to reason about'],
        ['Flexibility', 'Coarse — role explosion at the edges', '**Handles any condition**'],
        ['Answering "who can do X?"', '**Easy**', 'Hard — requires evaluating policies'],
        ['Good for', '**Most products**', 'Regulated, multi-tenant, context-dependent access'],
      ],
    ),
    p(
      'The usual end state is **RBAC with a few attribute rules bolted on** — roles for the broad strokes, plus ownership and tenant checks. Pure ABAC is powerful and produces a permission model nobody on the team can fully describe.',
    ),
    table(
      ['Model', 'Use for'],
      [
        ['**RBAC**', 'Admin panels, internal tools, most SaaS'],
        ['**ABAC**', 'Context-dependent rules — time, location, data classification'],
        ['**ReBAC** (relationship-based)', '"Anyone in the document\'s shared group" — Google Docs-shaped sharing'],
        ['**ACL**', 'Per-object permission lists; simple and does not scale to many objects'],
      ],
    ),

    h('Service-to-service'),
    flow(['Caller', 'mTLS or a service token', 'Callee verifies', 'Scoped call'], 'Internal is not trusted'),
    table(
      ['Approach', 'Note'],
      [
        ['**mTLS**', 'Both sides present certificates; identity is cryptographic. A mesh does this for you'],
        ['**Service tokens**', 'Short-lived, scoped, issued by an internal authority'],
        ['**Forwarded user context**', 'A signed internal header — **never trust an unsigned one**'],
        ['Network trust alone', '**Not sufficient.** "Inside the VPC" is not an identity'],
      ],
    ),
    warn(
      'Trusting an internal header like `X-User-Id` without a signature means **anything that reaches the service can impersonate any user** — one misconfigured route or SSRF bug and the whole authorization model is bypassed.',
    ),

    h('Common mistakes'),
    table(
      ['Mistake', 'Result'],
      [
        ['Authorizing only in the gateway', 'Object-level access is unchecked'],
        ['Checking on the UI only', 'The API is wide open'],
        ['Sequential integer ids', 'Enumeration is trivial once a check is missed'],
        ['Returning 403 for a resource that exists', 'Confirms existence to an attacker — use 404'],
        ['Roles checked per endpoint, ad hoc', 'One endpoint eventually forgets'],
        ['Trusting unsigned internal headers', 'Impersonation from inside'],
      ],
    ),
    tip(
      'Two cheap structural defences: **use non-sequential ids** so enumeration is not a starting point, and **return 404 rather than 403** for resources the caller may not see, so an attacker learns nothing from the difference.',
    ),

    h('Interview'),
    quick([
      ['What it is', 'Verifying identity, then verifying permission'],
      ['Why it matters', 'Broken object-level authorization is the most common serious API bug'],
      ['Use when', 'Every request, at two different layers'],
      ['Trade-off', 'RBAC is simple and coarse; ABAC is flexible and hard to audit'],
      [
        '30-second answer',
        '"Authentication is who you are and happens once at the edge; authorization is what you may do and has to happen in the service, because only it knows whether user 42 owns order 991. Scope the query rather than checking after the fetch, so an endpoint cannot leak by omission. RBAC for the broad strokes plus ownership checks covers most products. Between services use mTLS or signed short-lived tokens — being inside the network is not an identity."',
      ],
    ]),
    asked([
      ['Authentication versus authorization?', 'Who you are versus what you may do. Different layers, different failure modes.'],
      ['Can the gateway do authorization?', 'Only coarse scope checks. Object-level ownership requires the data, so it belongs in the service.'],
      ['RBAC or ABAC?', 'RBAC plus a few ownership and tenant rules for most products. Pure ABAC becomes unauditable.'],
      ['How do services authenticate each other?', 'mTLS or short-lived scoped tokens. Never network position alone, and never an unsigned header.'],
      ['Why return 404 instead of 403?', 'A 403 confirms the resource exists. A 404 tells an attacker nothing.'],
    ]),

    links(
      wiki('Role-based_access_control', 'RBAC'),
      wiki('Attribute-based_access_control', 'ABAC'),
    ),
  ],
};
