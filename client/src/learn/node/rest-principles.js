import { asked, cheat, code, h, js, link, links, mdn, note, p, table, tip, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      'REST is a set of constraints for designing an HTTP interface, described by Roy Fielding in 2000. Most APIs called RESTful follow perhaps half of them, and that is fine — but knowing which half you are keeping, and why, is what separates a considered design from cargo cult.',
    ),

    h('The idea'),
    p(
      'Model your API as **resources** — nouns with URLs — and use HTTP\'s existing verbs to act on them. The alternative, one endpoint per action, is what REST replaced.',
    ),
    code(
      js(`
// Not REST: the verb is in the URL, and every action is a new endpoint.
POST /getTasks
POST /createTask
POST /updateTaskTitle
POST /markTaskDone
POST /deleteTask

// REST: one resource, HTTP's verbs do the work.
GET    /tasks
POST   /tasks
GET    /tasks/7
PATCH  /tasks/7
DELETE /tasks/7
`),
    ),
    p(
      'The payoff is not aesthetic. Because the verbs are standard, everything in between already knows what they mean: a proxy can cache the `GET`, a client library can retry the `PUT`, a browser can prefetch, and a new developer can guess the endpoint without documentation.',
    ),

    h('The constraints'),
    table(
      ['Constraint', 'Means', 'In practice'],
      [
        ['**Client–server**', 'The two evolve separately', 'Universal'],
        ['**Stateless**', 'No per-client state on the server between requests', 'Followed — and required to scale horizontally'],
        ['**Cacheable**', 'Responses say whether they may be cached', 'Partly — most APIs send `no-store` and stop there'],
        ['**Uniform interface**', 'Resources, standard methods, self-describing messages', 'Mostly'],
        ['**Layered system**', 'A client cannot tell whether it is talking to a proxy', 'Universal — every load balancer'],
        ['**HATEOAS**', 'Responses link to what you can do next', '**Almost nobody.** See below'],
      ],
    ),
    note(
      'Strictly, an API without HATEOAS is not REST — Fielding has said so. In practice "REST" has come to mean resource-oriented HTTP with sensible verbs and status codes, and that is what an interviewer means by the word. Say so if asked; it is a good answer.',
    ),

    h('Statelessness'),
    p(
      'Each request carries everything needed to serve it. The server may have a database — that is application state — but it keeps nothing about *this client* between requests.',
    ),
    code(
      js(`
// Stateful — and broken the moment you run two instances.
const sessions = new Map();
app.post('/login', (req, res) => {
  const id = crypto.randomUUID();
  sessions.set(id, user);              // lives in THIS process's memory
  res.json({ sessionId: id });
});

// Stateless — the token carries the identity.
app.get('/tasks', requireAuth, (req, res) => res.json(service.list(req.user.id)));

// Also fine: sessions in Redis. The state is shared, not per-instance.
`),
    ),
    tip(
      'Server-side sessions are not "against REST" as long as the store is shared. The constraint that matters is that any instance can serve any request — that is what lets you scale out, deploy without draining, and lose an instance without losing users.',
    ),

    h('Naming resources'),
    table(
      ['Do', 'Not'],
      [
        ['`/tasks`', '`/getTasks`, `/task`'],
        ['`/tasks/7`', '`/tasks?id=7`'],
        ['`/users/42/tasks`', '`/getUserTasks?uid=42`'],
        ['`/task-templates`', '`/taskTemplates`, `/task_templates`'],
        ['`/tasks?status=open`', '`/tasks/open`'],
      ],
    ),
    p(
      'Plural nouns, lowercase, hyphen-separated. A collection is `/tasks`; a member is `/tasks/{id}`. Filters go in the query string, because `status=open` is a view of the collection, not a different collection.',
    ),

    h('Actions that are not CRUD'),
    p(
      'The honest hard case. "Publish", "cancel", "send a reminder" are verbs, and REST wants nouns. Three workable answers, in order of preference:',
    ),
    code(
      js(`
// 1. It is a state change on the resource. Best when true.
PATCH /orders/7        { "status": "cancelled" }

// 2. Model the action as its own sub-resource. Best when it has its own
//    record — a timestamp, a reason, an audit trail.
POST /orders/7/cancellation    { "reason": "duplicate" }
POST /tasks/7/reminders        { "at": "2026-09-01T10:00:00Z" }

// 3. A named action endpoint. Not REST, and sometimes the clearest option.
POST /orders/7/cancel
`),
    ),
    tip(
      'Prefer 2 when the action needs to be recorded, and do not agonise over 3. A pragmatic action endpoint that everyone understands beats a contorted noun nobody can guess.',
    ),

    h('The uniform interface in practice'),
    code(
      js(`
GET    /tasks           -> 200  { data: [...], meta: {...} }
POST   /tasks           -> 201  + Location: /tasks/7
GET    /tasks/7         -> 200  the resource
PUT    /tasks/7         -> 200  replaced
PATCH  /tasks/7         -> 200  updated
DELETE /tasks/7         -> 204  no body
GET    /tasks/nope      -> 404
POST   /tasks {}        -> 422  validation failed
`),
    ),

    h('When not to use REST'),
    table(
      ['Style', 'Better when'],
      [
        ['**REST**', 'Resource-shaped CRUD, public APIs, caching matters, many unknown clients'],
        ['**GraphQL**', 'Clients need wildly different field sets; one round trip over many resources'],
        ['**gRPC**', 'Service-to-service, high volume, strict schemas, streaming'],
        ['**RPC over HTTP**', 'The domain is genuinely actions, not resources'],
      ],
    ),
    warn(
      'Contorting a non-resource domain into REST produces worse APIs than admitting it is RPC. A payments system is mostly verbs — `authorize`, `capture`, `refund` — and modelling every one as a noun helps nobody.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Name a collection', 'A plural noun — `/tasks`'],
      ['Name a member', '`/tasks/{id}`'],
      ['Filter a collection', 'A query parameter, not a new path'],
      ['Express an action', 'A state `PATCH`, or a sub-resource `POST`'],
      ['Keep it stateless', 'Identity in the request; shared store if you need sessions'],
      ['Nest resources', 'At most one level'],
      ['Signal a creation', '`201` + `Location`'],
    ]),

    h('Interview'),
    asked([
      ['What is REST?', 'A set of architectural constraints for HTTP APIs — resources with URLs, standard verbs, stateless requests.'],
      ['What does stateless mean here?', 'The server keeps no per-client state between requests, so any instance can serve any request.'],
      ['Are server-side sessions un-RESTful?', 'Only if the state is per-instance. A shared store keeps the scaling property that matters.'],
      ['What is HATEOAS and do you use it?', 'Responses linking to available next actions — rarely implemented, and its absence is why most "REST" APIs are not strictly REST.'],
      ['How do you model an action like "cancel"?', 'A status `PATCH`, or a sub-resource `POST` when the action deserves its own record.'],
      ['When would you not choose REST?', 'Highly variable client field needs (GraphQL), internal high-volume RPC (gRPC), or a genuinely verb-shaped domain.'],
    ]),

    links(
      mdn('Glossary/REST', 'REST'),
      link('Fielding — Architectural Styles, Chapter 5', 'https://ics.uci.edu/~fielding/pubs/dissertation/rest_arch_style.htm'),
      link('Microsoft REST API guidelines', 'https://github.com/microsoft/api-guidelines'),
    ),
  ],
};
