# System Design — the reference

The whiteboard module for designing systems: HLD, LLD and database schemas, organised
as **projects → folders → boards**. This file is the single place that records *what
was decided, what is built, how it works and what comes next* — written for Aryan and
for any AI agent picking the work up later. Read [Rules for whoever works on this
next](#rules-for-whoever-works-on-this-next) before changing anything.

- [The idea](#the-idea)
- [Decisions](#decisions)
- [Roadmap and status](#roadmap-and-status)
- [Architecture](#architecture)
- [Where the code lives](#where-the-code-lives)
- [Data model](#data-model)
- [API](#api)
- [Saving and syncing](#saving-and-syncing)
- [The canvas engine](#the-canvas-engine)
- [Element types](#element-types)
- [Keyboard](#keyboard)
- [Styling](#styling)
- [Verifying it](#verifying-it)
- [Operating it](#operating-it)
- [Rules for whoever works on this next](#rules-for-whoever-works-on-this-next)
- [Future phases in detail](#future-phases-in-detail)

---

## The idea

In Aryan's words, condensed: *a digital big board with a marker to think and design.*
Figma / Google Stitch feel, dbdiagram.io for schemas, minimal, very smooth, high
resolution, free (no paid components or services), scalable, and built so that sharing
and contributions can be added later without a rewrite.

- A **project** is a system being designed ("WhatsApp").
- Inside it, **folders nest to any depth** ("HLD", "LLD", "Database", …).
- Folders hold **boards**. Two kinds:
  - **canvas** — containers/frames, boxes, circles, diamonds, cylinders, connectors
    with animated "running" flow, text, paragraphs, sticky notes, pen, highlighter,
    eraser; later images, videos, links, tables, tech icons (DB, Redis, Kafka, load
    balancer…).
  - **schema** — dbdiagram-style: DBML text on the left, a diagram on the right,
    synced both ways.
- Later: other people can view, propose changes that the owner approves, and edit live.
- Later still (Phase 4, Aryan's own idea): every tech component carries a description
  and specs, the board computes **scale** (DAU → QPS → load per node) and **detects
  bottlenecks**.

## Decisions

Agreed in planning (2026-09-14). Change them only deliberately.

| Topic | Decision | Why |
|---|---|---|
| Canvas engine | **Custom, no canvas/diagram libraries** (no React Flow, tldraw, Excalidraw) | Ember keeps ~5 runtime deps on purpose; tldraw needs a licence; full control over the Figma feel |
| Build order | P1 core canvas → P2 DB schema boards → P3 rich components → P4 design intelligence → Future collaboration | Schema boards run on the canvas engine |
| Schema language | **dbdiagram-compatible DBML**, text ⇄ diagram both ways | Paste to/from dbdiagram.io |
| Schema extras | Postgres/MySQL DDL export, SQL import, auto-arrange (positions only, tables stay draggable), "Try in SQL Lab" via sql.js | Asked for all four |
| Pen | Pen, highlighter, eraser in **Phase 1** | "marker to think" |
| Media | Images uploaded to the **existing S3** pipeline, resized to WebP in the browser; video and links are embeds | Pennies; reuses `File` + `s3.service.js` |
| Layout | Full-screen workspace **outside AppShell** (explorer · canvas · inspector); `/design` home stays inside the shell | Canvas wants the whole window |
| Visibility | Ships **hidden**; only the super admin previews it (`defaultHidden` module) | Built in `main`, released when ready |
| New project | Checkbox "Start with HLD / LLD / Database folders", one board each | Empty trees are the hardest start |
| Tech icons | Brand-coloured SVG (Simple Icons, CC0) + hand-drawn generic glyphs, monochrome toggle | Tell tech apart at a glance |
| Devices | Phones view-only; tablets full editor with stylus pressure | |
| Phase 3 extras | Version snapshots, templates, present mode, personal component library, link-to-board drill-down, quick actions | Asked for all; last two recommended |
| Phase 4 traffic | Source nodes (DAU × actions) → QPS propagates along arrows by % split, cache hit ratio cuts reads, node load ÷ capacity | Chosen over hand-typed QPS per arrow |
| Phase 4 checks | Over capacity, single point of failure, read-heavy path without cache, latency budget + queue backlog | All four |
| Build order, revised (2026-09-14) | Finish P1 → **component library pulled forward from P3** → P2 schema boards → rest of P3 → P4 | The library shows up on HLD/LLD boards soonest and reuses the finished engine |
| Data-structure blocks | Stack, queue, linked list, call stack, array, hash map… as **editable static blocks** (type into cells, add/remove items, orientation); no animated operations | Twice the work for animation; static blocks cover diagrams and explanations |
| SQL tables | In schema boards (DBML) **and** as a library component on canvas boards, columns edited in the inspector | Tables belong in HLD boards too |
| AI | **None for now** | |
| Realtime (future) | **SSE**, not WebSocket | Vercel's `/api` rewrite cannot proxy WebSocket upgrades; chat SSE already works through it |

## Roadmap and status

Legend: ✅ built and verified · 🟡 built, not yet verified in a browser · ⬜ not started.

### Phase 1 — core canvas

Browser-verified on 2026-09-15: four parallel QA passes (select & arrange; frames & drawing;
saving & syncing; explorer, shell, text & connectors) found ~30 bugs; every fix was re-verified
in the browser by the pass that found it.

| # | Step | Status |
|---|---|---|
| 1 | Server: models, fractional keys, validation, access, tree/board services, routes, limits, hidden-by-default module, purge script | ✅ 21 unit tests + 19 end-to-end API checks |
| 2 | Client scaffold: `designApi`, nav item, lazy routes, projects home (create with starter folders, edit, archive, trash, restore, purge), recent boards | ✅ |
| 3 | Pure foundations: ids, fractional keys (same vectors as server), geometry, camera math, spatial grid index | ✅ tests |
| 4 | Workspace shell: top bar, breadcrumb rename, explorer tree (keyboard, context menu, inline rename, create, duplicate, delete, copy link, drag-to-move), resizable panels, ⌘\ toggles the explorer | ✅ browser-verified |
| 5 | Store, registry, render pipeline, camera; spatial index for hit-testing, marquee and frame lookup; culling on boards of 300+ elements; `?sdperf` tooling (`__sd.stress(n)`, `__sd.measurePan()`) | ✅ 2,400 elements: 60fps pan at 100% (104 mounted), 0.5ms main-thread per camera frame, 1,000 hit-tests in 21ms · zoomed out to everything, painting bottlenecks on software-GPU headless Chrome (58fps with content hidden) — check on a real GPU |
| 6 | Autosave: op queue, status pill, per-tab crash copies + restore plan, keepalive flush, backoff, rejection handling; tab lock (BroadcastChannel) | ✅ browser-verified incl. offline, restore, retries under one batch id, close-then-reopen, two tabs, other devices |
| 7 | Select tool: click, shift-click (and Shift-drag), marquee, move (Alt duplicates), resize (rotated boxes, aspect, from-centre), rotate, connector end re-binding, Escape restores, undo/redo | ✅ browser-verified |
| 8 | Shapes (rect, ellipse, diamond, cylinder) + inspector (swatches, segmented, numbers with scrub, opacity, lock, arrange, align/distribute) | ✅ |
| 9 | Text (auto-width), paragraph (markdown), sticky note (fit-to-size font), shape labels, frame names — textarea overlay editing | ✅ browser-verified · paragraph height measures raw markdown (can be short by a line) |
| 10 | Arrange: snapping + guides, z-order, duplicate, clipboard (copy/cut/paste across boards and tabs), lock, align, distribute, canvas context menu, opacity keys | ✅ browser-verified (Mac Option shortcuts matched by physical key — simulated, not on a real Mac) |
| 11 | Frames: relative child coordinates (connector free points too), clip (also for hit-testing), drop-into, adopt on draw/click/⌘⌥G, nesting, remove frame, cascade delete, constant-size titles | ✅ browser-verified |
| 12 | Connectors: binding with side anchors, ends on other connectors' lines, parented to the deepest frame holding both ends, straight/elbow/curve, 12 caps incl. crow's feet, labels, animated flow | ✅ browser-verified; elbow router property-tested |
| 13 | Pen, highlighter, eraser (own freehand outline algorithm, RDP simplification, coalesced events; they stay on until another tool is picked) | ✅ browser-verified |
| 14 | Shortcuts dialog · LOD (CSS) · culling · perf pass | ✅ (memory: heap after 10 board switches not measured) |
| 15 | Docs: this file · README section · in-app `/docs` section (shown to accounts that can see the module) | ✅ |

Not yet built inside Phase 1: board-level settings in the inspector (background/grid/
snap toggle — the server's `meta` op is ready), equal-spacing snaps.

### Component library (pulled forward from Phase 3) ✅ built · browser QA done, fixes being re-verified

- **Panel** (`I`, or the toolbar's grid button): Tech / Data structures / Database tabs, search
  over names, keywords and descriptions, click to add at the nearest free spot in view, drag to
  drop anywhere (into frames too).
- **Tech** (`tech`): 173 catalogue entries in 16 categories — 111 brand logos from Simple Icons
  (CC0, generated into a lazily loaded chunk by `client/scripts/build-brand-icons.mjs`) and 53
  hand-drawn glyphs for generic parts (load balancer, cache, queue…) and brands Simple Icons no
  longer carries (AWS, Azure, Oracle, Memcached…). Each has a one-line "what it is and when to
  reach for it". Card or icon-only look, monochrome, hide name; colours too dark or light for a
  theme are mixed with the text colour.
- **Data structures** (`structure`): array, stack, queue, linked list, doubly linked list, call
  stack, hash map, binary tree (LeetCode level order), matrix, shards, hash ring — editable as
  text (one item per line, `*` highlights), auto-sized, S/M/L, direction for linear kinds, title.
- **SQL table** (`sqltable`): a DBML `Table` block as its text, rendered with key / reference
  markers, unique and enum badges, auto height, width that grows with its columns.

### Phase 2 — schema boards ✅ built · browser QA in progress

DBML text on the left, the diagram on the right, one source of truth — see
[Schema boards](#schema-boards). Parser with recovery, resolution and diagnostics, two-way
editing (text ⇄ diagram actions as precise text edits), positions that follow the text without
thrashing, crow's-foot relations, inspector column grid, auto-arrange, Postgres/MySQL/SQLite
export, SQL import, SQL Lab (SQLite in the browser, foreign keys enforced), three-way merge of
concurrent text saves.

**Building a schema without writing DBML** (`schema/assist.js`, pure and tested): the inspector's
column grid has a type picker — a combobox over the usual types, grouped, each with a line on what
it is for, the schema's own enums first, searchable by description ("money" finds `decimal`),
free text still allowed and half-typed types refused. Types follow the dialect: PostgreSQL by
default, MySQL's when `Project { database_type: 'MySQL' }`. Typing a new column's name guesses its
type and settings (`user_id` → the key type of `users` plus `ref: > users.id`, `created_at` →
`timestamptz [not null, default: now()]`, `status` → a matching enum); Enter adds it and keeps the
field for the next. Each row opens to default (with suggestions per type), auto-increment,
reference and note. One-click columns (id, uuid id, timestamps, deleted_at, email, name, status,
is_active), "Link to table" adds a foreign key to another table's key, a new table's name field is
focused with Enter moving on to its first column, "Add table" finds free space instead of stacking
tables, and an empty board offers an example schema (users, products, orders, order items).

**Seeing and changing connections**: selecting a table lights up its relations (blue, with dots
running from the referencing column to the referenced one), outlines the tables at their other ends,
highlights the joined columns in both, and fades every other line; hovering a table does the same
without the fade, and so does the table under the DBML caret (`relationHighlight` in `layout.js`,
shared per UI change by `schemaHighlight` in `useSchema.js`). On canvas boards the overlay does the
equivalent for arrows: a selected (or, with nothing selected, hovered) element's connectors run dots
and the elements at their other ends get a dashed outline. A table's header colour is a swatch or a
custom colour (`ui/ColorPopover.jsx`, positioned in the viewport — the native colour input opened off
screen) written as `[headercolor: #hex]` (`edits.setTableColor`, keeping the table's other settings;
a drag is one undo step). Deleting a table (button, Delete key, context menu), a column or a relation
asks first, saying what goes with it (`ui.confirm`, shown by `BoardEditor`); cut does not ask. The
relation kind, "References" and "Link to table" choices are `ui/PickList.jsx` lists in which every
option says what it does.

**Hover explains things**: every `title` in the workspace shows as a quick tooltip with its
shortcut (`ui/Tooltips.jsx`); on a schema board, resting on a column, table header or relation line
describes it (type meaning, keys, default, references both ways, note), and resting on a word in the
DBML text explains the keyword, setting, type or operator — or shows the error under a squiggle.

Not yet: dragging from a column to another to create a relation (relations come from the text
or the inspector), TableGroup rendering behind tables, enum lists on the diagram, virtualised
editor lines for very large schemas.

### Phase 3 — rich components ⬜ (the library above is already taken out of it)
### Phase 4 — design intelligence ⬜
### Future — collaboration ⬜

Details for all four in [Future phases in detail](#future-phases-in-detail).

---

## Architecture

```
/design (inside AppShell)          → DesignHome: project cards            [lazy chunk]
/design/:projectId/:boardId?       → DesignWorkspace, full screen          [lazy chunk]
   TopBar · Explorer · BoardEditor( Canvas + Toolbar + ZoomControls ) · Inspector

client/src/design/   pure JS engine (no React; node:test-able except files marked DOM)
client/src/components/design/   React views that subscribe to the engine
        │
        │  batched ops   POST /api/design/boards/:id/ops   {batchId, clientId, baseRev, ops}
        ▼
server  routes/design.routes.js → controllers/design/* → services/design/* → models/Design*
Mongo   DesignProject · DesignNode (tree) · DesignBoard (rev, DBML source) · DesignElement (1 doc/element)
```

Bundle cost: main JS +3.6 KB (+1.2 KB gzip) for the nav item, API client and lazy
routes; the workspace chunk is ~148 KB (52 KB gzip), home ~33 KB; styles ship in the
lazy chunk.

## Where the code lives

```
server/src/
  config/design.js              limits, role capabilities, element types, project templates
  config/modules.js             { key: 'design', …, defaultHidden: true }
  models/Setting.js             modules.decided — makes defaultHidden work
  services/settings.service.js  hidden = stored.hidden ∪ (defaultHidden − decided)
  controllers/admin/modules.controller.js   toggling a module adds it to `decided`
  utils/fractionalIndex.js      keyBetween / keysBetween / isOrderKey (CC0 algorithm)
  models/DesignProject.js  DesignNode.js  DesignBoard.js  DesignElement.js
  validation/designElements.js  strict envelope, passthrough per-type schemas, assertBoundedJson
  services/design/
    tx.js                inTransaction(fn) — the first Mongo transactions in the codebase
    access.service.js    projectAccess / nodeAccess / boardAccess, designAccess middleware
    tree.js              pure tree helpers (depth, height, isWithin, subtree, orderAmong)
    tree.service.js      create / rename / move / duplicate / trash / restore / purge nodes
    project.service.js   list / create (templates) / update / trash / restore / purge / recent
    ops.js               pure op folding + board limits + meta folding
    board.service.js     loadBoard, boardTag (ETag), changesSince, commitOps, compactTombstones
    __tests__/           ops.test.js, tree.test.js
  controllers/design/design.{project,node,board}.controller.js
  routes/design.routes.js       the route table (own limiters and body parsers)
  routes/index.js               mounted ABOVE writeLimiter
  app.js                        global JSON parser skips /api/design
  middleware/rateLimit.js       designSyncLimiter
  middleware/errorHandler.js    PAYLOAD_TOO_LARGE / BAD_JSON codes
server/scripts/design/
  purge-trash.js                npm run design:purge-trash -- --days=30 --dry-run [--files]
  e2e/design-api.test.mjs       19 end-to-end API checks on in-memory Mongo
  e2e/devserver.mjs             isolated API on :4100 with seeded data, for UI testing

client/src/
  App.jsx                       lazy DesignHome (in shell) + DesignWorkspace (outside shell)
  store/modules.js              nav item (IconShapes)
  api/index.js                  designApi
  pages/DesignHome.jsx  pages/DesignWorkspace.jsx
  styles/design.css             everything, scoped under .sd-*
  design/
    core/       ids.js  fractional.js  geometry.js  simplify.js  time.js  spatial.js (grid index)  color.js (hex ⇄ HSV)
    tree/       tree.js                    explorer tree helpers + resolveDrop
    engine/
      store.js       records, transactions, gestures, subscriptions
      history.js     undo/redo with mergeKey
      diff.js        commit → wire ops; recordFromWire
      uiState.js     selection, tool, hover, marquee, guides…
      camera.js      pure camera math
      editor.js      (DOM) the orchestrator: camera writes, input, hit-testing, geometry, actions
      handles.js     selection frame + handle positions/hit-testing (shared by overlay + select tool)
      snapping.js    alignment snapping (sorted candidates, binary search)
      clipboard.js   serialize / instantiate with id remapping
      commands.js    every named action (nudge, align, reorder, frame…)
      shortcuts.js   the shortcut table, matcher, display strings
      connectors/route.js   straight / elbow (candidate router) / curve
      tools/         select.js create.js connector.js draw.js eraser.js index.js
    shapes/     registry.js  shapes.js       type definitions (defaults, caps, inspector fields)
    draw/       freehand.js                  pressure-shaped stroke outline (own implementation)
    text/       measure.js (DOM)             auto-size text, sticky font fitting
    sync/       opQueue.js  autosave.js  mirror.js (crash copies + planRestore)  tabLock.js (DOM)
    library/    tech.js (catalogue: 173 entries)  brandPaths.generated.js (lazy, Simple Icons CC0)
                structures.js (data-structure block layouts)
    schema/     dbml.js (parser)  analyze.js (resolution, relations)  ddl.js (Postgres/MySQL/SQLite)
                sqlImport.js (DDL → DBML)  layout.js (table sizes, relation paths, auto-arrange)
                reconcile.js (positions follow the text, freeSpot)  assist.js (type catalogue, column
                guesses, presets, defaults, DBML word docs, example schema)
    __tests__/  fractional geometry tree engine route spatial structures dbml ddl sqlImport
                schemaLayout schemaAssist sync
  components/design/
    icons.jsx                   design-only glyphs
    ui/ActionMenu.jsx           portalled menu (cards, tree, canvas context menu)
    ui/Tooltips.jsx             TooltipLayer (every [title] in the workspace) + useTip for canvas/text hovers
    ui/PickList.jsx             dropdown whose options carry descriptions (native <select> cannot)
    ui/ColorPopover.jsx         saturation square + hue strip + hex, kept on screen
    home/  ProjectCard  ProjectModal  TrashModal
    workspace/  Workspace  TopBar (+ useEditorChrome)  Explorer  PanelSplitter
    canvas/  BoardEditor  Canvas  ElementHost(+ElementList)  OverlayLayer  TextEditor
             DraftStroke  Toolbar  ZoomControls  CanvasContextMenu  ShortcutsDialog  hooks.js
    shapes/  views.jsx  ConnectorView.jsx
    inspector/Inspector.jsx
    schema/  SchemaPanel  DbmlEditor (hover explanations)  SchemaInspector (column grid, add, quick add)
             TypeInput (type combobox)  SchemaHoverTips (canvas hovers)  DbTableView  SchemaRelations  SqlLabDrawer
    library/glyphs.jsx          generic tech glyphs (24-unit, currentColor)
client/scripts/build-brand-icons.mjs   regenerates brandPaths.generated.js from simple-icons
client/public/fonts/inter-latin-var.woff2 (+ Inter-LICENSE.txt, OFL)   the canvas font
```

## Data model

All `{ timestamps: true }`. Ids are ObjectIds except element `eid`s (client-minted).

**DesignProject** — `owner, name(120), description(1000), icon(emoji), hue (HUES), treeRev,
touchedAt, archivedAt, deletedAt/By`. Index `{owner, deletedAt, touchedAt:-1}`. Ownership is
`project.owner`; there are no member rows in v1.

**DesignNode** (folder or board) — `project, parent|null, kind: folder|board,
boardKind: canvas|schema (immutable), name(120), order (fractional key), createdBy/updatedBy,
deletedAt/By, deletedRoot`. No stored ancestors: trees are capped at 2,000 nodes and walked in
memory. `deletedRoot` = the node whose delete trashed this one, so restore brings back exactly
that delete.

**DesignBoard** (`_id` = node id) — `project, kind, rev, elementCount, bytes, meta(≤4KB),
source (DBML ≤200KB), sourceRev, batches[{id,rev,at}] (last 50), tombFloorRev, compactedAt,
lastWriteAt/By`. Separate from the node so tree reads never carry DBML and hot `rev` writes
never touch tree documents.

**DesignElement** — `board, project, eid, type, parent (frame eid|null), z (fractional key),
data (Mixed, flat), bytes, rev (board rev of last write), updatedBy, deletedAt (tombstone)`.
Indexes: unique `{board,eid}`, `{board,deletedAt}`, `{board,rev}`, `{project}`. One document
per element: no 16MB board ceiling, per-element saves, delta sync, future conflict checks.

**Element wire shape** — `{ eid, type, parent, z, data }` with `data` flat:
`{ x, y, w, h, rot, opacity, locked, …type fields }`. Nested values (`start`, `end`, `label`,
`flow`) are whole objects. Box positions **and free connector points** are **relative to the
parent frame** (world coordinates at the top level), so moving a frame by any means — drag, nudge,
align, the inspector, paste — carries everything inside it without special cases.

**Limits** (`config/design.js`): 100 projects and 1,000 boards per owner · 2,000 nodes, depth 12,
200MB assets per project · 5,000 live elements and 5MB per board · 64KB per element · 1,000 ops /
2MB per batch · DBML 200KB · trash 30 days · tombstones 14 days.

## API

Base `/api/design`. Every route is behind `requireAuth` → `requireModule('design')`.

| Method | Path | Access | Notes |
|---|---|---|---|
| POST | `/boards/:id/ops` | edit | **The save.** `designSyncLimiter` (240/min per user), 2MB body |
| GET | `/projects` | owner | `?archived=true|false`; each has `boardCount` |
| POST | `/projects` | — | `{id?, name, description?, icon?, hue?, template: blank|system}` → 201 `{project, nodes, treeRev}`; idempotent with `id` |
| GET | `/projects/:id` | read | `{project, role, treeRev, nodes}` |
| PATCH | `/projects/:id` | manage | name, description, icon, hue, archived |
| DELETE | `/projects/:id` | manage | to trash |
| POST | `/projects/:id/restore` | manage | |
| DELETE | `/projects/:id/permanent` | purge | must be in trash (`NOT_IN_TRASH`) |
| POST | `/projects/:id/nodes` | edit | `{id?, kind, boardKind?, name, parentId, after?}` |
| PATCH | `/nodes/:id` | edit | `{name}` |
| POST | `/nodes/:id/move` | edit | `{parentId, after}` — `after` absent appends, `null` first; `MOVE_INTO_SELF`, `TOO_DEEP` |
| POST | `/nodes/:id/duplicate` | edit | boards only |
| DELETE | `/nodes/:id` | edit | subtree to trash |
| POST | `/nodes/:id/restore` | edit | only a trash root (`NOT_TRASH_ROOT`); lands at root if its folder is gone |
| DELETE | `/nodes/:id/permanent` | purge | |
| GET | `/boards/:id` | read | `{node, board, elements, role}`, weak ETag on rev |
| GET | `/boards/:id/changes?since=R` | read | `{rev, meta, changes, reset, board?}` |
| GET | `/trash` | owner | trashed projects + trashed roots with `expiresAt` |
| GET | `/recent` | owner | `?limit` ≤ 20 |

Errors: 404 for anything the caller has no role on (never 403, so existence is not leaked);
410 `IN_TRASH`; 409 `PROJECT_ARCHIVED` (read-only); 413 `PAYLOAD_TOO_LARGE`; 400 `BAD_JSON` /
`VALIDATION` / `BAD_PARENT` / `MOVE_INTO_SELF` / `TOO_DEEP`; 409 `PROJECT_FULL` / `BOARD_LIMIT` /
`PROJECT_LIMIT`.

Capabilities (`DESIGN_CAPS`): viewer `read` · commenter `+comment, suggest` · editor `+edit` ·
owner `+manage, purge, share, merge`. v1 `roleFor` returns `owner` or null.

## Saving and syncing

**Wire contract** (client `engine/diff.js` ⇄ server `validation/designElements.js`):

```js
POST /api/design/boards/:id/ops
{ batchId /* fixed across retries */, clientId, baseRev,
  ops: [ {op:'put', el:{eid,type,parent,z,data}},
         {op:'patch', eid, parent?, z?, set?:{key:value}, unset?:[key]},   // shallow
         {op:'del', eid},
         {op:'meta', set},
         {op:'source', base: sourceRev, text} ] }                          // schema boards, compare-and-set
→ { rev, rejected:[{eid|op, code, current}], changes:[…], reset, board?, duplicate? }
```

**Server (`commitOps`)**, one transaction: `$inc board.rev` first (this serialises concurrent
batches per board) → a known `batchId` returns the earlier rev (retry-safe) → read touched
elements → fold ops (`ops.js`) → validate **per element** (a bad element is rejected with its
stored copy; the rest saves) → board limits refuse growth only → `bulkWrite` → counts, meta,
source, batch record (last 50 ids). After commit, if `baseRev` is stale the response carries the
other writers' changes **and the merged result of every element this batch touched that someone
else wrote after `baseRev`** (otherwise a field the other device changed would never reach this
client); more than 2,000 means `reset`. `GET /boards/:id` returns `board.recentBatches` — the ids of
the last 50 batches — so a reopening client can ask "did my last save land?".

**Client (`sync/autosave.js`)**: every local commit becomes ops, coalesced per element
(`opQueue.js`), sent 800ms after the last edit or every 3s at most, one request at a time.

- **A batch keeps its id until it is settled.** A failure with no clear answer (network, 5xx,
  429) may have been applied, so that exact batch — same id, same ops — is *held* and retried,
  and the server's duplicate check stops it being applied twice over someone's newer edit. Newer
  edits wait behind it in their own batch. 5xx/network back off to 30s; 429 waits
  `retryAfterSeconds`. 413 never reached the handler, so it splits the batch under new ids. 400
  stops that batch (a copy goes to `localStorage sd-failed:*`); 404/410/409 archived → read-only
  banner. Rejected elements are reverted locally with a toast.
- **Crash copies are per tab** (`sync/mirror.js`): `localStorage['sd-pending:<board>:<client>']` =
  `{v:2, clientId, baseRev, at, sent:[{batchId, ops}], ops}` — `sent` are batches that may have
  landed, `ops` were never sent. A tab refreshes `at` every 4s while anything is pending and only
  ever removes its own key.
- **Restoring** (`planRestore`, on open): copies refreshed within 12s belong to a live tab — left
  alone and looked at once more later. For the rest, sent batches whose id is in
  `recentBatches` are dropped; nothing left → removed silently; board rev = copy's `baseRev` +
  landed batches → restored silently; otherwise a Restore/Discard dialog (restoring would write
  over newer edits). Leaving with the dialog open loses nothing.
- **Closing the tab**: `visibilitychange`/`pagehide` send the pending batch as a `keepalive`
  fetch (≤60KB, once per batch) under the id it would be retried with, and the copy records it.

**Other tabs, other devices**: `sync/tabLock.js` — the newest tab on a board claims it over
BroadcastChannel; others flush, go read-only, mirror its commits live, and offer "Edit here".
Other devices: `GET /changes` on focus and every 20s while nothing is pending (a poll while edits
are pending would move `baseRev` past remote changes to those elements); elements with pending
local ops are not overwritten, and the save response brings their merged state back.

## The canvas engine

**Records** mirror the wire: `{ id, type, parent, z, data, rev }`, immutable.

**Store** (`engine/store.js`): `transact(fn, meta)` → one commit `{label, origin, changes:
Map<id,[before,after]>}`; `beginGesture()` → live `frame()` updates, one commit on `commit()`,
`cancel()` restores; `applyRemote()` (deferred while a gesture is live); `load()`; per-element and
per-parent subscriptions. Side effects run inside the transaction (deleting a frame deletes its
children; deleting a shape turns bound connector ends into free points).

**History** stores before/after record pairs; undo is an ordinary transaction tagged
`origin:'undo'`, so it re-renders and saves like any edit. `mergeKey` folds runs (text sessions,
nudges, scrubbing) within 1.5s.

**Camera**: `screen = world·z + (x,y)`. The editor writes `translate() scale()` to the world
layer in rAF, bypassing React. While moving: `translate3d` + `will-change`; 150ms after it stops
both come off and the translate is snapped to device pixels so text re-rasterises sharp. Zoom
0.05–8, persisted per board in `localStorage sd-cam:<id>`. React only hears zoom-bucket changes
(`far|mid|near`) for level of detail. `--sd-z` on the world layer keeps frame titles a constant
screen size.

**Input** (`editor.js`): native listeners on the viewport; pointer capture on the viewport, never
a shape; one tool update per animation frame; drawing tools receive coalesced samples; wheel is
non-passive (ctrl/⌘ or pinch zooms at the cursor, otherwise pans); Safari `gesture*`; two-finger
touch pinch+pan; Space / middle button / Hand tool pan; once a stylus is seen, fingers pan.
Events from textareas, inputs, buttons and `[data-sd-control]` are ignored by the canvas. Keys
reach the board only when nothing else owns them: not already `defaultPrevented`, not inside the
explorer, top bar, inspector, a `[role=tree|menu|dialog]`, and no menu is open (`sd-menu-open`).

**Hit-testing**: reverse paint order (siblings by z, a frame's children above it), per-type
geometry in the element's rotated local frame. Frames are hit by their title or edge only, so
their interior is empty canvas (click-through to children, marquee inside). Connectors by
distance to the routed polyline; strokes by distance to their points.

**Tools**: select (pointing → translating / resizing / rotating / dragging-end / brushing),
hand, create (rect, ellipse, diamond, cylinder, frame, text, paragraph, sticky: click for
default size, drag to size, Shift square; frames adopt what they enclose), connector (hover
shows anchors; ⌘/Ctrl refuses binding), pen/highlighter (draft outside the store, RDP on
release, 2,000-point chunks), eraser (marks, deletes on release, Escape restores; never frames).
Shape, text, frame and connector tools return to Select after one use unless the lock (Q) is on;
pen, highlighter and eraser stay on until another tool is picked, as a marker does.

**Connectors and frames**: a connector's `parent` is the deepest frame containing both ends (a
bound end is where its element is; a free end is `frameAt` its point), so it moves, clips and
copies with that frame. `editor.settleConnectors(tx, ids)` re-homes them after anything that can
change it: drawing a connector, dragging an end, moving elements, adopting, framing, unframing.
`reparent` converts free points like box positions. Removing a frame (⌘⇧G) re-homes its children at the frame's
place in the layer order and lets go of connectors bound to its edge.

**Connector routing** (`connectors/route.js`): bound ends store `{eid, anchor: auto|side}`,
never coordinates. Elbow routes try orthogonal candidates between side stubs (through the gap,
around either side), reject any that cut through either shape, score length + 40·bends, keep the
previous side pair unless a new one is 15% better (no flip-flop while dragging). That memory is
in-process, so after a reload an equally short route can come back different.

**Ends on other connectors**: dropping an end on a line (when no shape is under the pointer) stores
`{eid, t}` — `t` is the fraction along that connector's routed length (`closestOnPolyline`).
`editor.lookupTarget` resolves it to a point plus the line's axis there, and elbow/curve routes meet
an axis-aligned line square. Binding refuses a line that already depends on the connector being
bound (`lineBindingAt`), and resolving guards against a loop arriving from elsewhere (that end falls
back to a free point). A connector's view watches `editor.geometryDeps(record)` — its targets,
their frames, and transitively whatever a target connector depends on. Deleting a line lets its
attached ends go at the point they touched, like deleting a shape. Because `t` is by length, an
attached end slides along when its line's route changes shape.

**Selection overlay**: screen-space SVG — hover outline, selection box and handles (resize on
corners/edges, rotate in zones just outside corners), marquee, red snap guides, drop-target frame,
bind anchors, size badge.

**Text**: a `<textarea>` in world space over the element with identical metrics (IME,
spellcheck and selection work). Each change is a merged commit. Empty text elements are removed
when editing ends. Sizes come from a hidden measurer with the same class as the view.

**Clipboard**: native copy/cut/paste events; payload in a `text/html` marker; paste re-mints ids
and remaps parents and connector ends; visible originals paste offset by 24, others centred.

## Element types

Defined in `design/shapes/shapes.js`, drawn in `components/design/shapes/`.

| Type | Key data | Caps |
|---|---|---|
| rect / ellipse / diamond / cylinder | `color, fillStyle tint|solid|none, strokeStyle, strokeWidth s|m|l, label, fontSize, align, radius (rect)` | label, bindable |
| text | `text, color, fontSize, align, weight, autoWidth` | width-resize, auto height |
| paragraph | `text` (markdown via ChatMarkdown), `color, fontSize, align` | width-resize |
| sticky | `text, color (yellow…grey), align` | aspect resize, fitted font |
| frame | `name, color, fillStyle, clip` | container, no rotate, title-hit |
| connector | `start, end` (each `{eid, anchor}` on a shape, `{eid, t}` on another connector, or `{point}`), `route, startCap, endCap, color, strokeStyle, strokeWidth, label{text,t}, flow{on,speed,reverse}` | no box |
| stroke | `kind pen|highlighter, points [x,y,p…] relative, color, size, simulate` | scale on resize |

Colours are names rendered through the app's `[data-hue]` palette plus `ink`, so boards follow
dark/light theme. Unknown types (from a newer client) render a placeholder and are never re-sent.
Adding a type: server `ELEMENT_TYPES` + `TYPE_SCHEMAS` → **deploy server first** → client
`defineShape` + a view in `VIEWS`.

## Keyboard

The table is `design/engine/shortcuts.js` (also drives tooltips and the `?` dialog).
Tools: V select · H hand · F frame · R rect · O ellipse · D diamond · A/L connector · P pen ·
⇧P highlighter · E eraser · T text · ⇧T paragraph · S sticky · Q keep tool (C is reserved for
comments). Edit: ⌘Z / ⌘⇧Z · ⌘D duplicate · Del · ⌘A · Esc · Enter edit text · ⌘C/X/V · ⌘S save.
Arrange: arrows (⇧ ×10) · ⌘] ⌘[ · ] [ · ⌘⌥G frame · ⌘⇧G unframe · ⌘⇧L lock · ⌥A/D/W/S/H/V align ·
⌥⇧H/V distribute · 1–0 opacity. View: + − · ⇧0 100% · ⇧1 fit · ⇧2 selection · ? help. Space-drag pans.

## Styling

`client/src/styles/design.css`, imported by the two pages so it lives in the lazy chunk.
**Every rule is scoped under `.sd-*`** because the sheet stays loaded after leaving the module.
Panels use opaque tokens; selection uses `--focus`, active tool `--accent`; no
`backdrop-filter` (app-wide rule). Tooltips are `.sd-tip`, above dialogs (z-index 400). Canvas text uses the self-hosted Inter (`SD Inter`) so text
measures the same on every OS.

## Verifying it

```bash
cd client && npm test          # 88 tests: fractional keys, geometry, camera, tree, store, history, diff, queue,
                               # routing, spatial index, autosave retries + restore plans, structure layouts,
                               # DBML parser/analyzer, DDL export (SQLite run in sql.js), SQL import, schema layout,
                               # schema assist (every suggested type parses, guesses, presets, defaults round-trip),
                               # relation highlight, table colour edits, colour conversions
cd server && npm test          # 21 tests: fractional keys, op folding, validation, tree helpers
cd server && npm i --no-save mongodb-memory-server@10
cd server/scripts/design/e2e && node --test design-api.test.mjs   # 19 end-to-end API checks
```

UI without touching a real database: run `e2e/devserver.mjs` (API on :4100 with a seeded
`admin@test.local` / `password123` and a WhatsApp project), then
`cd client && PORT=3100 API_URL=http://localhost:4100 npx vite`. The browser-automation skill was
used against this to verify: login → home cards → open project → draw rect, ellipse, sticky,
connector → "Saved" → reload shows all four, zero console errors.

Manual checks still owed for Phase 1 (see 🟡 above): explorer drag, marquee, resize/rotate,
snapping, frames, pen/eraser, clipboard, offline + restore, two tabs, Safari/iPad, 2,000-element
performance.

## Operating it

- **Enable for everyone**: Admin → Modules → System Design. The first toggle is recorded in
  `Setting.modules.decided`, after which the default no longer applies.
- **Trash retention** is only real if `npm run design:purge-trash` runs daily (crontab on the API
  box). `--dry-run` first; `--files` also sweeps soft-deleted S3 uploads app-wide.
- **Body sizes**: nginx `client_max_body_size` and the Vercel rewrite must allow 2MB saves (and
  10MB images in Phase 3) — test through the production path.
- Transactions require a replica set (Atlas always is).

## Rules for whoever works on this next

1. **Never mount `/design` below `writeLimiter`** in `routes/index.js`; autosave would exhaust it.
   The design router applies `writeLimiter` itself for non-save writes and ends with a 404
   catch-all to avoid double counting.
2. **Inside `inTransaction`, every query passes `session`**, and nothing with outside effects
   (S3, events, responses) happens inside — the callback may run twice.
3. **Compare fractional keys with `<`**, never `localeCompare`; never add a collation. Client and
   server copies of `fractionalIndex` must stay identical (shared test vectors).
4. **Element `data` validation stays passthrough** (client and server deploy separately). Type
   only what the server relies on; bound everything with `assertBoundedJson`.
5. **Add element types server-first.**
6. **All parent-coordinate math goes through `editor.worldOrigin / reparent`**, and inside a
   transaction pass it: `worldOrigin(parent, tx)`. A frame created in the same transaction is
   invisible to the store, and reading the store there moved shapes on ⌘⌥G.
7. **`editor.setTool()` clears `editingId`** — set the tool first, then start editing (this bit
   the sticky note once).
8. **Hot reload does not refresh an open editor's tools** (they are closures created once per
   board) — reload the page after editing engine/tool files.
9. **Views never read the editor for data**, only records; geometry that depends on other
   elements subscribes with `useGeometryVersion`.
   Nor do they **change the board from an effect cleanup**: the app runs under StrictMode,
   which calls cleanups right after mount. Removing empty text on the TextEditor's unmount
   deleted every new text element before it could be typed in; that rule now lives in
   `editor.js`, keyed on `editingId` changing.
10. **Scope CSS under `.sd-`**, and do not reuse a class name between the home page and the
    canvas (`.sd-grid` vs `.sd-dots` was a real collision).
11. **Dialogs stack** (`components/ui/useDialog.js`): each checks it is the top one before
    handling Escape/Tab — `stopPropagation` does not stop listeners on the same node.
12. **A batch id is for life** (`sync/autosave.js`): never re-send ops that may have landed under a
    new id; hold the batch and retry it as is.
13. Keep this file, the README section and the in-app guide in step with the code.
14. **Say what a control is with `title`** (`"Label (shortcut)"` or `"Label — what it does"`); the
    workspace's `TooltipLayer` turns it into the styled tip. Anything that is not a DOM element under the
    pointer (a canvas row, a word in a textarea) uses `useTip`. Never hand-roll another tooltip.
15. **Choices that need explaining use `PickList`, colours use `ColorPopover`**, not `<select>` or
    `<input type="color">`: the native ones cannot describe an option, ignore the board's theme, and the
    colour popup opens wherever the OS puts it. Deletes that take other things with them ask through
    `ui.confirm`.

## Future phases in detail

### Phase 2 — schema boards

- **Storage**: DBML in `DesignBoard.source` via the `source` op (compare-and-set on `sourceRev`;
  on conflict try a line 3-way merge, else keep mine / take theirs). Table positions are
  `dbtable` elements (`eid` = stable table id, `data.name = schema.name`). Relations derived, never
  stored.
- **Parser** (`design/schema/`): hand-written recursive descent with spans and panic-mode recovery
  for Project, Table (alias, settings), columns (types with args and arrays; pk, null/not null,
  unique, increment, default, note, inline ref), indexes, Enum, Ref (`> < - <>`, composite,
  delete/update), TableGroup, Note, comments. `analyze.js` resolves and reports diagnostics; a
  broken table keeps its last good render.
- **Editor panel**: SqlEditor-style textarea over a highlighted `<pre>`, gutter, wavy
  diagnostics, virtualised lines, resizable 280–720px.
- **Two-way sync**: the text is the truth; every diagram action is a text-range edit (formatting
  and comments survive); unified undo; click a column → its source span; caret → diagram
  highlight; rename detection (one removed + one added, same position or ≥50% column overlap);
  position elements created 1.5s after a name is stable.
- **Diagram**: DOM-free geometry (header 36, rows 28), elbow relations with crow's-foot
  (bar = one, fan = many, circle = nullable), TableGroups behind tables.
- **Extras**: deterministic layered auto-arrange (positions only); Postgres/MySQL/DBML export;
  SQL import (CREATE TABLE / ALTER … ADD CONSTRAINT / CREATE INDEX / CREATE TYPE ENUM → DBML);
  Try in SQL Lab (SQLite DDL into the existing `sql/engine.worker.js`, scratch query panel reusing
  `SqlEditor` + `SqlResultGrid`, nothing sent to the server).
- Test with the `hms` schema from Aryan's dbdiagram screenshot.

### Phase 3 — rich components

Tech library (~60 entries: Simple Icons brand paths + generic glyphs; `{id, name, category,
color, path, description, whenToUse, tradeoffs, specs}`; `tech` element; quick-connect "+");
images (paste/drop/pick → ≤4096px WebP → `POST /boards/:id/assets` → `storeFile` linked to the
project; signed URLs via `/projects/:id/assets/sign`, re-signed at ~12min); embeds (YouTube via
`server/src/utils/links.js`, Loom, Vimeo, MP4, link cards; provider allowlist; sandboxed iframe,
poster until double-click); tables; export SVG (no foreignObject) / PNG 2× / JSON; minimap;
version snapshots (`DesignSnapshot` gzip JSON in S3, compare by eid diff, restore = batch of puts);
templates + component library (`DesignLibraryItem`); present mode (frames as slides);
link-to-board drill-down; quick actions (⌘/); groups; equal-spacing snaps; find on board;
read-only viewer route.

### Phase 4 — design intelligence

Catalogue specs (rule-of-thumb, editable: e.g. Redis ~100k ops/s per node, p99 ~1ms; Postgres
~5k writes/s, ~20k reads/s per node; Kafka ~100k msgs/s per broker). `design/intel/simulate.js`:
source nodes (`dau, actionsPerUser, readRatio, peakFactor` → avg/peak QPS), topological
propagation of read/write QPS along connectors (% split, LB even, cache passes `1 − hitRatio` of
reads, async connectors mark queues, cycles reported), utilisation = load ÷ (capacity ×
instances), longest sync p99 path, queue backlog growth. `checks.js`: over capacity (≥70% amber,
≥100% red, suggests instances), single point of failure, read-heavy without cache, latency budget
(board SLO, default 300ms), queue backlog. UI: Analyze toggle, node badges and rings, flow speed ∝
log(QPS), Issues panel (click to zoom), estimation sheet (DAU → QPS, storage/year, bandwidth).

### Future — collaboration (designed for, not built)

`DesignMember {project, user, role, status}` (only `roleFor` changes) · `DesignOp` (7-day TTL,
inverse ops) · `DesignChangeRequest {baseRev, ops, touched, status}` (conflicts = touched elements
with `rev > baseRev`; merge = `commitOps` with `batchId 'cr:<id>'`) · `DesignComment` anchored to an
eid or point (C shortcut reserved) · realtime over SSE `/boards/:id/events` with `Last-Event-ID` =
rev, in-process emitter then a Mongo change stream, presence drawn in the overlay layer.
