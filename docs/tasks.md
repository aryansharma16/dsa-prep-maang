# Tasks — the reference

The prose version, with the reasoning, is [**Tasks** in the README](../README.md#tasks).
This is the part that would clutter it: every field, every endpoint, every error
code, and how to prove the thing works.

- [Where the code lives](#where-the-code-lives)
- [Data model](#data-model)
- [API](#api)
- [Errors](#errors)
- [Limits](#limits)
- [Client](#client)
- [Verifying it](#verifying-it)
- [Operating it](#operating-it)

---

## Where the code lives

```
server/src/
  models/Task.js            the task, its subtasks, questions, attachments, sessions
  models/TaskBoard.js       one board per account, holding the ordered columns
  services/task.service.js  the board, the clock, moves, questions, attachments
  controllers/task.controller.js   handlers + the exported zod schemas
  routes/task.routes.js     the route table
  config/modules.js         `{ key: 'tasks', label: 'Tasks', path: '/tasks' }`
  config/viewScopes.js      `'tasks'` in the allowlist
  routes/index.js           router.use('/tasks', requireModule('tasks'), taskRouter)

client/src/
  pages/Tasks.jsx           the page: state, writes, which view is on screen
  store/TasksContext.jsx    the one running clock, app-wide
  hooks/useBoardDrag.js     cross-column card dragging
  filters/tasks.js          what the board can be narrowed by
  components/tasks/
    BoardView  ListView  TableView  CalendarView    the four views
    StatusColumn  TaskCard  TaskMenu  ProgressRing  the board's pieces
    TaskDrawer  SubtaskList  QuestionPicker         the detail panel
    AttachmentGrid  DeadlineField  SessionList
    TimerButton  TimerPill                          the clock
    StatusModal  DeleteStatusModal                  column editing
    time.js  progress.js  hues.js                   pure helpers
```

`route → controller → service`, models alongside. No repository layer, no DI —
the same shape as every other module.

---

## Data model

Two collections. Both carry `user`, a `deletedAt` soft delete where it matters,
and `timestamps: true`.

### `TaskBoard`

One document per account, created on first read of `GET /api/tasks`. Never
created at registration, so the collection only holds boards for people who
opened the page — and so the module can be switched on for an existing
deployment with no backfill.

| field | type | |
|---|---|---|
| `user` | ObjectId → User | **unique.** Dropping this index is the whole of the migration to several boards |
| `statuses[]` | subdocument | the columns, `_id` kept because tasks point at them |
| `statuses[]._id` | ObjectId | survives a rename, a recolour and a move |
| `statuses[].name` | String ≤ 40 | |
| `statuses[].hue` | enum, 13 values | a *name*, not a colour — see [Hues](#hues) |
| `statuses[].kind` | `open` \| `active` \| `done` | what the column **means**. Behaviour reads this, never the name |
| `statuses[].order` | Number | draw order |

Seeded on creation: **Planned** (open/slate), **In Progress** (active/amber),
**Done** (done/green), **On Hold** (open/orange).

#### Hues

```
slate  amber  orange  red  pink  fuchsia  violet
indigo  blue  sky  teal  green  lime
```

Declared in three places that have to agree, and each owns a different half of
the question: `STATUS_HUES` in `models/TaskBoard.js` is the enum the server
enforces, `components/tasks/hues.js` is the order the picker draws them in, and
the `[data-hue='…']` rules at the foot of `styles/tokens.css` are what turn a
name into a colour. **A name missing from the third resolves to no colour at
all** — which is why `cyan` is in the accent palette but not here: the accents
have it, the block hues do not.

### `Task`

| field | type | |
|---|---|---|
| `user` | ObjectId → User | no bare index — the compound ones below cover every query |
| `board` | ObjectId → TaskBoard | |
| `status` | ObjectId | a `board.statuses[]._id`, validated on every write |
| `order` | Number | position in its column. Gaps are expected and harmless |
| `title` | String ≤ 200 | required |
| `notes` | String ≤ 4000 | |
| `dueAt` | Date \| **null** | null means unlimited, and is the default |
| `priority` | `none` \| `low` \| `med` \| `high` | |
| `tags[]` | String ≤ 40 | |
| `subtasks[]` | `{ _id, title ≤ 200, done, doneAt, order }` | one level, by schema |
| `questions[]` | `{ problem, slug, title, difficulty, patternSlug, addedAt }` | ref **and** snapshot |
| `attachments[]` | `{ fileId, key, name, contentType, kind, bytes, width, height, url, addedAt }` | `url` is null at rest |
| `sessions[]` | `{ _id, startedAt, endedAt, seconds, manual, truncated }` | closed runs only |
| `trackedSeconds` | Number | sum of `sessions[].seconds`, recomputed by a pre-save hook |
| `runningSince` | Date \| null | non-null means the clock is running |
| `completedAt` | Date \| null | set in a `done` column, cleared on the way out |
| `deletedAt` / `deletedBy` | | soft delete — the row owns S3 objects |

#### Indexes

```js
{ user: 1, deletedAt: 1, status: 1, order: 1 }   // the board read
{ user: 1, deletedAt: 1, dueAt: 1 }              // calendar, and what is overdue
{ board: 1 }
{ user: 1 }  unique, partialFilterExpression: { runningSince: { $gt: new Date(0) } }
```

That last one is what makes "one running clock per account" a property of the
database rather than of a check that two tabs can both pass. `$gt` rather than
`$ne: null` because partial filters accept only a few operators and `$ne` is not
among them; it selects the same rows, since BSON orders null below Date so a
task that has never run is not in the index at all.

There is deliberately **no** bare `{ user: 1 }` index. Every query is
`user`-prefixed and served by one of the compound indexes, and a fourth would
also collide by key with the partial unique one — which is what Mongoose's
duplicate-index warning was pointing at.

#### Why a question stores both a ref and a snapshot

Neither alone works.

- A **slug** is ambiguous: `Problem` is uniquely indexed on `{ slug, owner }`, so
  an unscoped lookup can match a stranger's custom problem.
- A bare **ObjectId** dangles: you can delete a problem you added while a task
  still names it, and a dangling id renders as a blank row — which reads as
  corruption, where a dangling title reads as history.

So the ref finds live progress, and the snapshot is what is drawn when the ref
no longer resolves. The snapshot is written **server-side from the problem row**
and never echoed from the request, the same rule `resolveAssets` applies to
attachments: a client cannot name a problem it cannot see.

---

## API

All under `/api/tasks`, all behind `requireAuth`, `writeLimiter` and
`requireModule('tasks')`. Nothing here has a public surface.

`:id` is a task, `:statusId` a column, `:subtaskId` / `:sessionId` a subdocument,
`:problemId` a `Problem`, `:fileId` a `File`.

### The page

| | |
|---|---|
| `GET /api/tasks` | → `{ board, tasks }` |

One response, unpaged. The board is a dozen short subdocuments and is never
wanted without its cards; the collection is bounded at 500 and every view needs
the whole set to group and count.

```jsonc
{
  "board": {
    "id": "…",
    "statuses": [{ "id": "…", "name": "Planned", "hue": "slate", "kind": "open", "order": 0 }],
    "updatedAt": "…"
  },
  "tasks": [{
    "id": "…", "status": "…", "order": 0,
    "title": "Finish sliding window", "notes": "…",
    "dueAt": null, "priority": "high", "tags": ["patterns"],
    "subtasks": [{ "id": "…", "title": "…", "done": false, "doneAt": null, "order": 0 }],
    "questions": [{ "problemId": "…", "slug": "…", "title": "…", "difficulty": "Medium", "patternSlug": "…", "addedAt": "…" }],
    "attachments": [{ "id": "…", "url": "https://…signed…", "name": "…", "contentType": "image/png", "kind": "image", "bytes": 0, "width": null, "height": null, "addedAt": "…" }],
    "sessions": [{ "id": "…", "startedAt": "…", "endedAt": "…", "seconds": 3120, "manual": true, "truncated": false }],
    "trackedSeconds": 3120, "runningSince": null, "completedAt": null,
    "createdAt": "…", "updatedAt": "…"
  }]
}
```

`elapsedSeconds` is deliberately absent — the client computes it from
`runningSince`, so a number that changes every second is never baked into a
response that could be cached or replayed.

Attachment `url`s are signed and expire in 15 minutes. They are re-signed on
every read, deduplicated by key across the whole page, so a board of forty tasks
costs one signature per distinct file.

### Tasks

| | body | → |
|---|---|---|
| `POST /api/tasks` | `{ title, status?, notes?, dueAt?, priority?, tags? }` | `201 { task }` |
| `GET /api/tasks/:id` | | `{ task }` |
| `PATCH /api/tasks/:id` | any of `{ title, status, notes, dueAt, priority, tags }` | `{ task }` |
| `DELETE /api/tasks/:id` | | `{ ok, id }` — soft, and stops the clock |
| `POST /api/tasks/:id/restore` | | `{ task }` |
| `DELETE /api/tasks/:id/permanent` | | `{ ok, id, filesReleased }` |

Schemas are `.strict()`, so an unknown key is a 400 rather than a silent drop.
`status` omitted on create means the leftmost column.

**`dueAt: null` is a real edit** — it is how "remove the deadline" is said. An
absent key means leave it alone; the patch loop skips `undefined` and applies
`null`.

Restoring a task whose column was deleted while it was gone moves it to the
leftmost one rather than leaving it pointing at nothing.

### Moving

| | body | → |
|---|---|---|
| `POST /api/tasks/move` | `{ id, status, ids[] }` | `{ task }` |

`ids` is the **destination column in full**, in the order the client drew it.
Within-column reordering and cross-column moves are therefore one operation, and
the server never reconstructs what the board looked like. Every id is verified
against the caller before anything is written; one that is not theirs makes the
whole call a 404.

The source column is left with gaps in `order`. Nothing reads the numbers, only
their sort.

Not fractional indices: a personal board has tens of cards per column, a
full-column write is one round trip and cannot drift, and the fractional scheme
buys a smaller write in exchange for rebalancing logic that is only ever
exercised in the rare case — which is where it breaks.

### Columns

| | |
|---|---|
| `POST /api/tasks/board/statuses` | `{ name, hue?, kind? }` → `201 { status, board }` |
| `PATCH /api/tasks/board/statuses/:statusId` | `{ name?, hue?, kind? }` → `{ status, board }` |
| `PUT /api/tasks/board/statuses` | `{ ids[] }` → `{ board }` — reorder |
| `DELETE /api/tasks/board/statuses/:statusId?moveTo=<id>` | → `{ ok, moved, board }` |

Three rules the server holds:

- **One `done` column.** A second is `DONE_EXISTS`.
- **Changing a column's kind re-completes what is in it.** To `done`: everything
  gets a `completedAt` and any running clock among them stops. Away from `done`:
  every `completedAt` is cleared. So the field means the same thing however it
  was set.
- **A column holding tasks needs `?moveTo=`.** Without it, `STATUS_NOT_EMPTY`
  with `meta.tasks` — the count the dialog turns into "these six go to —". The
  last column cannot be deleted at all.

Reorder takes a full list of ids. An id missing from it keeps its place after
the ones that were named, which makes a stale client harmless rather than
destructive.

### Subtasks, questions, sessions, files

Every one of these returns the whole updated `{ task }`, so the caller replaces
its copy rather than patching a field in and hoping the two stay in step.

| | |
|---|---|
| `POST /api/tasks/:id/subtasks` | `{ title }` → `201 { task }` |
| `PATCH /api/tasks/:id/subtasks/:subtaskId` | `{ title?, done? }` → `{ task }` |
| `DELETE /api/tasks/:id/subtasks/:subtaskId` | → `{ task }` |
| `POST /api/tasks/:id/questions` | `{ problemIds[] }` → `{ task }` |
| `DELETE /api/tasks/:id/questions/:problemId` | → `{ task }` |
| `POST /api/tasks/:id/sessions` | `{ minutes, endedAt? }` → `201 { task }` |
| `DELETE /api/tasks/:id/sessions/:sessionId` | → `{ task }` |
| `POST /api/tasks/:id/attachments` | multipart `files` → `201 { attachments, failed, total, task }` |
| `DELETE /api/tasks/:id/attachments/:fileId` | → `{ ok, task }` |

`done` on a subtask stamps `doneAt` on the way in and clears it on the way out,
so a re-ticked item reads as done *now* rather than whenever it first was.

`problemIds` takes a list, because "I'll do these three today" is the sentence
the feature exists for and three round trips to say it would be three chances to
half-succeed. Re-attaching something already attached is a no-op, not an error —
the picker is multi-select and re-picking a row is normal. An id that does not
resolve **is** an error: the client picks these from the roadmap it was handed,
so an unresolvable id is a bug or a probe, and quietly attaching four of five is
not the right answer to either.

Attachments report **per file**. Nine good screenshots are not lost to one
rejected PDF, so a rejection lands in `failed` and the response is still a 201:

```jsonc
{
  "attachments": [ /* the ones that landed */ ],
  "failed": [{ "originalName": "evil.png", "index": 0,
               "error": "That file is not a type this endpoint accepts",
               "code": "BAD_FILE_TYPE" }],
  "total": 2,
  "task": { /* … */ }
}
```

Types are sniffed from the leading bytes and never taken from the request.
Detaching is scoped by `linkedTo` as well as by owner, so a file id belonging to
your avatar cannot be deleted through a tasks route.

### The clock

| | |
|---|---|
| `POST /api/tasks/:id/timer/start` | → `{ task, now }` |
| `POST /api/tasks/:id/timer/stop` | → `{ task, now }` |
| `GET /api/tasks/timer` | → `{ task \| null, now }` |

`now` is the server's own instant, and the client keeps the offset so a browser
whose clock is four minutes fast does not show four extra minutes.

`GET /tasks/timer` answers `{ task: null }` rather than 404 when nothing is
running — that is not a missing resource, it is the ordinary answer. It exists
as its own endpoint because the pill is drawn on every page and the session is
only fetched once; a field on `/auth/me` would not update until the next sign-in.

Starting a timer stops whatever else was running and banks it as a session,
enforced twice — in the service and by the partial unique index. Stopping a task
that was not running is a no-op, not an error.

A run is **capped at 12 hours** and flagged `truncated`. A run **under 5 seconds
is discarded**: that is a misclick, not a sitting.

---

## Errors

The shape every other route uses — `{ error: { message, code, meta? } }`.

| code | status | |
|---|---|---|
| `VALIDATION` | 400 | zod, naming the field |
| `NO_SUCH_STATUS` | 400 | a column id that is not on this board |
| `DONE_EXISTS` | 400 | a second `done` column |
| `LAST_STATUS` | 400 | deleting the only column |
| `STATUS_NOT_EMPTY` | 400 | `meta.tasks` is the count; pass `?moveTo=` |
| `BAD_DESTINATION` | 400 | `moveTo` is the column being deleted |
| `TOO_MANY_STATUSES` | 400 | 12 |
| `TOO_MANY_TASKS` | 400 | `meta: { tasks, limit }` |
| `NO_FILES` | 400 | multipart with nothing in it |
| `BAD_FILE_TYPE` | 400 | per file, inside `failed` |
| — | 404 | any task, subtask, session, question or problem you cannot see |
| `STORAGE_DISABLED` | 503 → `failed` | no bucket configured on this deployment |
| `STORAGE_FAILED` / `STORAGE_FORBIDDEN` | 502 → `failed` | S3 said no |
| `RATE_LIMITED` | 429 | `meta.retryAfterSeconds` |

**404, never 403,** for something belonging to someone else — the response does
not confirm that the id exists. Same rule `visibleProblem` follows.

A hidden module answers 404 too, worded identically to the `notFound`
middleware, because a 403 would announce that the feature exists.

---

## Limits

| | |
|---|---|
| live tasks per account | 500 (`MAX_TASKS`) |
| columns per board | 12 (`MAX_STATUSES`) |
| `done` columns | 1 |
| title / notes / column name | 200 / 4,000 / 40 characters |
| tags | 20 per task, 40 characters each |
| `problemIds` per call | 50 |
| attachments | 10 per request, 25MB each; images and PDFs |
| session | 12h measured, 12h typed, ≥ 5s |
| uploads | 30/hour per account (`uploadLimiter`) |
| every other write | 120 per 5 min per account (`writeLimiter`) |

---

## Client

### State

The page owns the board and the tasks; **`TasksContext` owns only the running
clock**. That split is because of where each is needed: the pill is drawn on
every page, so its state cannot live on the tasks route — but hoisting the whole
board would make every route pay for a request only one of them renders.

`TasksProvider` is mounted unconditionally in `App.jsx`, not behind
`has('tasks')`. `AppShell` calls `useTasks()` without knowing whether the module
is on, and the provider reads that itself and never fetches when it is off; a
conditional provider would make the hook throw on every page the moment the
module was hidden.

One `setInterval` is shared by every consumer, so N timers on screen tick once.

Writes are optimistic with rollback where the answer is obvious and being wrong
costs a card in the wrong place for a moment — moving, ticking, scheduling,
reordering columns. They are **not** optimistic where the server decides
something the client cannot know, which is anything touching a column's `kind`:
those refetch.

### Which view

`useLocalState('tasks:view')` — a device preference, not an account one, because
which view suits you depends on the screen you are at. Below 760px
(`NARROW` in `useMediaQuery.js`, mirrored by the `max-width: 760px` block in
`app.css`) the board falls back to List and the Board tab is disabled; the
stored choice is left alone so it comes back on a wide screen.

### Progress

Derived on every render, never stored, because half of what it counts lives on
the roadmap:

```
done  = subtasks ticked + linked questions solved
total = subtasks + linked questions
```

`solvedIndex(groups)` builds a `Set` of solved problem ids once per render pass
from `useRoadmap()`, so a board of forty cards does not walk 429 problems forty
times. A task in a `done` column reads 100% regardless. `total: 0` draws no ring
at all — nothing to count and no progress are different states, and only one of
them should look like failure.

### Dragging

`useBoardDrag` holds `{ dragging: {id, status}, dropAt: {status, index} }` and
nothing else; the page owns the tasks and does the write. Nothing moves until
the drop, and a line shows where the card will land.

Within one column the measured index is off by one once the card is lifted out,
because it was measured against a list that still contained it — the same
correction `BlockList` makes.

Cards `stopPropagation` on drag-over so the column's own handler does not
overwrite the precise index with "the end of the list". Column reordering is a
separate, much simpler drag on the header: at most twelve targets, each 288px
wide, so a swap on drop is unambiguous and the gap machinery is not worth it.

### Stacking

Layer order matters here and was got wrong once:

| | |
|---|---|
| `.tk-drawer-scrim` / `.tk-drawer` | 40 / 41 |
| `.tk-menu` (portalled card menu) | 45 |
| `.overlay` — every Modal | 50 |
| `.dd-menu` — every Dropdown, portalled | 60 |
| toasts | 100 |

The drawer is a **base surface**, not something above dialogs, so it sits below
the modal layer. At 60 its full-viewport scrim covered the question picker it
had itself opened: the modal was visible through a 32% wash and every click on a
problem row hit the scrim, which is wired to close the drawer.

The Dropdowns inside the drawer still work because `Dropdown` portals to `<body>`
at 60 — above both the drawer and any modal. That is what lets the drawer sit
low without trapping its own controls under the page. The card menu is portalled
for the same class of reason: `.tk-col-body` scrolls, and an absolutely
positioned menu is clipped by it.

---

## Verifying it

No test runner in this repo, so this is the by-hand pass. It is the one that
found both bugs worth finding.

```bash
cd server && npm run dev      # :4000
cd client && npm run dev      # :5173
```

**The module gate.** As the super admin, Tasks shows in the sidebar with a
**Dev** badge. Admin → Modules → hide it, then check all three halves: the nav
item is gone, `/tasks` falls through to the roadmap, and `GET /api/tasks`
answers **404** — not 403. Settings are cached for 30s, so allow for that.

**The board.** Add a column, rename it, recolour it, drag it left. Delete an
empty one (it just goes) and one holding tasks (it asks where they go, with a
count). Confirm the last column cannot be deleted. Drag a card across columns
and within one, reload, confirm the order survived. Move a card with the `⋯`
menu and with `[` / `]`.

**The clock.** Start on A, then start on B — A must stop and gain a session.
Reload mid-run: the pill is still counting and continuous. Drag a running task
into the done column: the clock stops and `completedAt` is set. Rename that
column and confirm it still does. Add and delete a session by hand.

**Questions.** Attach three. Mark one solved on the roadmap in another tab and
come back — the ring moves with no refetch. Delete a custom problem a task links
to and confirm the task still renders it as history.

**Files.** Drop a PNG and a PDF, then paste a screenshot into the drawer. Reload
after 15 minutes and confirm the URLs re-sign. Rename an `.exe` to `.png` and
confirm `sniffType` refuses it while the good files still land. If nothing
uploads at all, run `npm run s3:probe` from `server/` before debugging anything
else.

**Everything else.** All four views over the same data; the view choice
surviving a reload; the board falling back to List below 760px; filters
surviving a reload and following the account to another browser; light and dark
on at least two accent palettes, since the column hues must not collide with a
chosen accent.

---

## Operating it

**No migration.** Both collections are created on first use and
`config/modules.js` ships a module visible, so there is no row to write and
nothing to backfill. Switching the feature on for an existing deployment is a
deploy.

**Verify the partial unique index built.** It is the backstop for two tabs
starting a timer at the same instant, and it is the one thing here that depends
on the MongoDB version:

```js
db.tasks.getIndexes()
// { key: { user: 1 }, unique: true,
//   partialFilterExpression: { runningSince: { $gt: ISODate("1970-01-01T00:00:00Z") } } }
```

Verified against MongoDB 7. If it does not build, drop it — the service's
stop-then-start is the real guarantee and this only closes the race.

**Soft-deleted attachments linger.** `purgeDeleted` and `findOrphans` in
`file.service.js` are wired to no route and no cron, so deleting a task marks
its files and leaves the bytes in the bucket. This is pre-existing — note
attachments already behave this way — but tasks are now a second caller of the
same unswept path. `npm run s3:probe` from `server/` proves the storage path
end to end.

**Hiding the module does not delete anything.** Boards and tasks stay; the API
answers 404 and the nav item goes. Unhiding brings it all back.
