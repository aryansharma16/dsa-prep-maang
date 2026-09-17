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
- [The home page](#the-home-page)
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
- [Component glossary](#component-glossary) — what every library component is, for quick knowledge

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
| 2 | Client scaffold: `designApi`, nav item, lazy routes, projects home (create with starter folders, edit, archive, trash, restore, purge), recent boards | ✅ · reworked 2026-09-15, see [The home page](#the-home-page) |
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
| 15 | Docs: this file · README section · in-app `/docs` section (shown to accounts that can see the module), ending in the [Component glossary](#component-glossary) generated out of this file | ✅ browser-verified 2026-09-18 (search across tabs, category chips, 196 entries, no markdown left on the page, phone width) |

Not yet built inside Phase 1: board-level settings in the inspector (background/grid/
snap toggle — the server's `meta` op is ready), equal-spacing snaps.

### Component library (pulled forward from Phase 3) ✅ built · browser QA done, fixes being re-verified

- **Panel** (`I`, or the toolbar's grid button): Tech / Data structures / Database tabs, click to
  add at the nearest free spot in view, drag to drop anywhere (into frames too). **Search looks in
  all three tabs at once** (`library/search.js`, `searchLibrary`): names, keywords and descriptions,
  scored the same way for every catalogue (`matchScore` in `tech.js`), one section per tab with its
  count, the best-matching section first and ties going to the open tab. So "stack" finds the block
  with Tech open, and "many to many" finds the join table. While a query is typed no tab is
  highlighted; Escape clears it (keeping focus in the panel), clicking a tab clears it and shows that
  tab. Structures and table templates carry their own `keywords` ("lifo", "sharding", "junction").
- **What each component is**: [Component glossary](#component-glossary), a definition for every
  entry, linked to the official docs it is condensed from. It is also the app's own reference:
  the System Design section of `/docs` renders all 196 entries, searchable across every category,
  from data generated out of this file (see [Where the code lives](#where-the-code-lives)).
- **Tech** (`tech`): 173 catalogue entries in 16 categories — 111 brand logos from Simple Icons
  (CC0, generated into a lazily loaded chunk by `client/scripts/build-brand-icons.mjs`) and 53
  hand-drawn glyphs for generic parts (load balancer, cache, queue…) and brands Simple Icons no
  longer carries (AWS, Azure, Oracle, Memcached…). Each has a one-line "what it is and when to
  reach for it". Card or icon-only look, monochrome, hide name; colours too dark or light for a
  theme are mixed with the text colour. The inspector's **Technology** field swaps one component for
  another through a `PickList` with the same 173 entries — logo, name and that line each, grouped by
  category, with a search box (`searchTech`, so it matches keywords and descriptions too) that ranks
  matches across categories and labels each with the category it came from.
- **Data structures** (`structure`): array, stack, queue, linked list, doubly linked list, call
  stack, hash map, binary tree (LeetCode level order), matrix, shards, hash ring — editable as
  text (one item per line, `*` highlights), auto-sized, S/M/L, direction for linear kinds, title.
  The Kind picker says what each structure is and what it costs ("LIFO — push and pop at the top in
  O(1)"), so the block can be chosen from the panel without knowing the names.
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

## The home page

`/design` is the module's front door and the one screen in it with nothing drawn on it,
so it does the work a list cannot (reworked 2026-09-15, browser-verified):

- **Hero** (`.sd-hero`) — the canvas's own dot grid in the accent colour, a diagram of
  boxes and connectors with the same running flow a board has, and three counts: projects,
  boards, when anything was last edited. Hidden below 820px, where the space is the text's.
- **Finding a project** — search over name and description (`PageSearch`, so `/` focuses it
  like every other list page), sort by recent, name or board count, and a cards ⇄ list
  switch. Sort and view are `useLocalState` per device; the query is not. All client-side:
  the whole list is already loaded, capped at 100 projects by the server.
- **Cards** — each project's diagram is picked from its id (`home/blueprints.js`, six
  architectures), so a project is recognised by silhouette as well as by colour and icon.
  Hover runs the connectors and shows an "Open" chip; the description (new in the project
  dialog, ≤160 chars) sits above the meta line.
- **List** (`.sd-prow`) — the same projects one line each, for scanning twenty of them.
- **Jump back in** — recent boards now say whether each is a canvas or a schema.
- **Empty state** — "or start from" chips (WhatsApp, URL shortener, Rate limiter, News
  feed) open the new-project dialog with the name filled in; the dialog still opens,
  because the colour and the starter folders are part of the decision.

**Theme and accent from inside a board**: the workspace's top bar renders the app shell's
own `AppearancePicker` (`triggerClassName="sd-icon-btn"`), not a copy — the full menu, theme
*and* accent, because a board is drawn in both. The workspace owns the whole window, so
without it there is no way to change either until you leave the module. Its menu is lifted to
`z-index: 210` under `.sd-topbar` (its own 20 is measured against the shell, where nothing
else is layered; the stage below has panels at 25 and 26).

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
    library/    tech.js (catalogue: 173 entries, matchScore/rankMatches)  brandPaths.generated.js (lazy, Simple Icons CC0)
                structures.js (block layouts; each kind carries its own one-line `about` and search keywords)
                sqlTable.js (DBML table parse + size, the Database tab's templates)
                search.js (searchLibrary: one search over all three tabs)
    schema/     dbml.js (parser)  analyze.js (resolution, relations)  ddl.js (Postgres/MySQL/SQLite)
                sqlImport.js (DDL → DBML)  layout.js (table sizes, relation paths, auto-arrange)
                reconcile.js (positions follow the text, freeSpot)  assist.js (type catalogue, column
                guesses, presets, defaults, DBML word docs, example schema)
    __tests__/  fractional geometry tree engine route spatial structures librarySearch dbml ddl sqlImport
                schemaLayout schemaAssist sync
  components/design/
    icons.jsx                   design-only glyphs
    ui/ActionMenu.jsx           portalled menu (cards, tree, canvas context menu)
    ui/Tooltips.jsx             TooltipLayer (every [title] in the workspace) + useTip for canvas/text hovers
    ui/PickList.jsx             dropdown whose options carry descriptions and icons, searchable when long
    ui/ColorPopover.jsx         saturation square + hue strip + hex, kept on screen
    home/  ProjectCard (card + list row)  ProjectModal  TrashModal  blueprints.js (card diagrams)
    workspace/  Workspace  TopBar (+ useEditorChrome, the shared AppearancePicker)  Explorer  PanelSplitter
    canvas/  BoardEditor  Canvas  ElementHost(+ElementList)  OverlayLayer  TextEditor
             DraftStroke  Toolbar  ZoomControls  CanvasContextMenu  ShortcutsDialog  hooks.js
    shapes/  views.jsx  ConnectorView.jsx
    inspector/Inspector.jsx
    schema/  SchemaPanel  DbmlEditor (hover explanations)  SchemaInspector (column grid, add, quick add)
             TypeInput (type combobox)  SchemaHoverTips (canvas hovers)  DbTableView  SchemaRelations  SqlLabDrawer
    library/glyphs.jsx          generic tech glyphs (24-unit, currentColor)
  components/docs/
    DesignGlossary.jsx          the /docs reference: search across categories, chips, inline markdown
    designGlossary.generated.js the glossary as data (generated — do not edit)
  pages/Docs.jsx                the guide; its System Design section lazy-loads the two files above
client/scripts/build-brand-icons.mjs   regenerates brandPaths.generated.js from simple-icons
client/scripts/build-docs-glossary.mjs regenerates designGlossary.generated.js from the
                                       Component glossary below; fails if a library component
                                       has no entry, or if Docs.jsx promises the wrong count
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
`backdrop-filter` (app-wide rule). A component borrowed from the shell keeps its own
classes and is adjusted from here through an `.sd-` ancestor
(`.sd-topbar .appearance-menu`), never by restyling the bare class. Tooltips are `.sd-tip`, above dialogs (z-index 400). Canvas text uses the self-hosted Inter (`SD Inter`) so text
measures the same on every OS.

## Verifying it

```bash
cd client && npm test          # 92 tests: fractional keys, geometry, camera, tree, store, history, diff, queue,
                               # routing, spatial index, autosave retries + restore plans, structure layouts,
                               # library search across tabs (section order, ties to the open tab),
                               # DBML parser/analyzer, DDL export (SQLite run in sql.js), SQL import, schema layout,
                               # schema assist (every suggested type parses, guesses, presets, defaults round-trip),
                               # relation highlight, table colour edits, colour conversions
cd server && npm test          # 21 tests: fractional keys, op folding, validation, tree helpers
cd server && npm i --no-save mongodb-memory-server@10
cd server/scripts/design/e2e && node --test design-api.test.mjs   # 19 end-to-end API checks
cd client && node scripts/build-docs-glossary.mjs   # the /docs reference: regenerates it, and
                                                    # fails if a library component has no entry
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
    colour popup opens wherever the OS puts it. **No native `<select>` is left in the workspace** — keep
    it that way; a list long enough to need one (the 173 components) gets `PickList`'s `search` and a
    `filter` that ranks matches, not a plain `<select>`. Deletes that take other things with them ask
    through `ui.confirm`.
16. **A new library entry gets a glossary entry** — tech, structure kind or table template, under its
    exact catalogue name (bold, linked to its official docs) in [Component glossary](#component-glossary),
    in the same change. Its `keywords` are what search finds it by from any tab. Then run
    `cd client && node scripts/build-docs-glossary.mjs`: the glossary is also the app's reference,
    and the script refuses to generate one that is missing a component. Keep the bullets in the
    shape it parses — `- **[Name](url)** — what it is`, wrapped lines indented by two spaces — and
    update the entry count in `Docs.jsx` when it moves.

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

---

## Component glossary

What every item in the component library is, for quick knowledge while drawing, in the panel's
order: all 173 technologies, the 11 data structures and the SQL tables. Each entry says what the
thing is, how it works in a line, and when it is used, with the traps that tend to come up in design
interviews. A name links to where the definition comes from: the project's own documentation for a
product, or a standard reference for a general idea (the Cloudflare Learning Center, AWS, Google's
SRE books, microservices.io, MDN, Wikipedia). The one-line `about` the panel and the inspector show
is the short version of these (`library/tech.js`, `library/structures.js`). The entries are written
from those sources, not quoted, and are kept short: follow the link for the full story.

**This section is a source file.** `client/scripts/build-docs-glossary.mjs` parses it into
`components/docs/designGlossary.generated.js`, which the System Design section of `/docs` renders
as the app's own reference — so these words are written once and cannot drift from what a reader
sees. Edit them here, never there, and re-run the script (rule 16).

**Going deeper**, best first: Martin Kleppmann's
*[Designing Data-Intensive Applications](https://dataintensive.net/)* (replication, partitioning,
transactions, batch and streams: the reasoning behind most choices below) ·
[The System Design Primer](https://github.com/donnemartin/system-design-primer) ·
[Cloudflare Learning Center](https://www.cloudflare.com/learning/) (networking, DNS, CDN,
security) · [Amazon Builders' Library](https://aws.amazon.com/builders-library/) (how AWS runs these
at scale) · [Google SRE books](https://sre.google/books/) (monitoring, alerting, reliability) ·
[microservices.io](https://microservices.io/) (gateway, saga, outbox patterns).

### Clients

- **User** — the person, or another system, that starts a request. On a board it is where the
  traffic numbers (daily active users × actions per user) and the latency budget begin.
- **[Web browser](https://en.wikipedia.org/wiki/Web_browser)** — runs your HTML, CSS and JavaScript
  and talks to the backend over HTTP(S), WebSocket or SSE. Its rules shape the design: same-origin
  and CORS, a cap on connections per host, and nothing secret can live in code the browser
  downloads.
- **Mobile app** — a native iOS or Android (or cross-platform) client. Networks are slow and drop,
  so retry writes with idempotency keys, keep an offline cache that syncs later, use push
  notifications (APNs, FCM) instead of polling, and keep the API backward compatible, because old
  app versions stay installed for years.
- **Desktop app** — a native, Electron or Tauri client installed on a computer. Like mobile, you do
  not control when users update, so old versions keep calling your API.
- **IoT device** — small, often battery-powered hardware (sensors, meters, trackers) sending
  telemetry. Millions of devices mean many long-lived connections and bursty, write-heavy traffic;
  [MQTT](https://mqtt.org/), a lightweight publish/subscribe protocol, is the usual transport.

### Network & edge

- **[DNS](https://www.cloudflare.com/learning/dns/what-is-dns/)** — the Domain Name System, the
  internet's phone book: turns `api.example.com` into an IP address through resolvers, the root, TLD
  and authoritative name servers, each answer cached for its TTL. It also steers traffic (weighted,
  latency-based and geo records send users to a region), but changes spread only as TTLs expire, so
  DNS failover is slow.
- **[CDN](https://www.cloudflare.com/learning/cdn/what-is-a-cdn/)** — a Content Delivery Network:
  servers in many cities (points of presence) that cache static files and cacheable responses close
  to users, cutting latency and taking load and DDoS traffic off your origin. For images, video,
  JS/CSS and downloads. Watch cache keys and invalidation: versioned file names (`app.3f9a.js`) beat
  purging.
- **[Load balancer](https://www.cloudflare.com/learning/performance/what-is-load-balancing/)** —
  spreads incoming requests across a pool of servers and stops sending to any that fail health
  checks. **L4** balances TCP/UDP connections by IP and port (fast, cannot see the request); **L7**
  reads HTTP, so it can route by path, header or cookie and terminate TLS. Algorithms: round robin,
  least connections, IP or consistent hash (sticky). Run two, or it is a single point of failure.
- **[API gateway](https://microservices.io/patterns/apigateway.html)** — the single entry point in
  front of many backend services: routes each request to the right one and does the cross-cutting
  work once (authentication, rate limiting, API keys, request and response shaping, metrics). A
  *backend for frontend* (BFF) is a gateway shaped for one client. It is on every request, so keep
  business logic out of it.
- **[Reverse proxy](https://www.cloudflare.com/learning/cdn/glossary/reverse-proxy/)** — a server in
  front of your servers that forwards client requests to them; clients only ever talk to the proxy.
  Used for TLS termination, compression, caching, load balancing and hiding the origin. A *forward*
  proxy is the opposite, in front of clients. Load balancers and API gateways are specialised
  reverse proxies.
- **[Firewall / WAF](https://www.cloudflare.com/learning/ddos/glossary/web-application-firewall-waf/)** — a
  network firewall allows or blocks packets by IP, port and protocol; a Web Application Firewall
  reads HTTP requests and blocks application-layer attacks (SQL injection, XSS, bad bots, L7 floods)
  by rules. Sits at the edge, often inside the CDN.
- **[Rate limiter](https://www.cloudflare.com/learning/bots/what-is-rate-limiting/)** — caps how
  many requests a client (user, API key, IP) can make in a time window and answers the rest with
  `429 Too Many Requests`, protecting the backend from abuse and overload. Algorithms: **token
  bucket** (allows bursts up to the bucket size), **leaky bucket** (smooth outflow), **fixed
  window** counter (cheap, lets double bursts through at window edges), **sliding window** log or
  counter (accurate). Limits shared by many servers keep their counters in Redis.
- **[NGINX](https://nginx.org/)** — open-source HTTP web server, reverse proxy, content cache, load
  balancer and TCP/UDP proxy. Its event-driven, asynchronous design holds many thousands of
  connections in little memory; the usual front door for static files and for proxying to app
  servers.
- **[HAProxy](https://www.haproxy.org/)** — open-source, high-performance TCP (L4) and HTTP (L7)
  load balancer and proxy, known for reliability, fine-grained health checks and detailed
  statistics.
- **[Envoy](https://www.envoyproxy.io/)** — open-source L7 proxy built at Lyft for cloud-native
  services (CNCF graduated). Configured live through APIs (xDS), with retries, circuit breaking,
  HTTP/2 and gRPC, and rich metrics; the data plane of Istio and many other meshes and gateways.
- **[Traefik](https://traefik.io/traefik/)** — open-source reverse proxy and ingress controller that
  discovers services and builds its routes by itself from Docker, Kubernetes and other providers,
  with automatic Let's Encrypt certificates.
- **[Caddy](https://caddyserver.com/)** — open-source web server and reverse proxy written in Go
  that uses HTTPS by default, obtaining and renewing certificates automatically; configured with a
  short Caddyfile.
- **[Cloudflare](https://www.cloudflare.com/)** — a global edge network in front of your origin:
  CDN, authoritative DNS, DDoS protection, WAF, zero-trust access, and Workers (serverless code
  running at the edge).
- **[Kong](https://konghq.com/)** — API gateway built on NGINX (OpenResty): routes to upstream
  services and adds authentication, rate limiting, logging and transformations as plugins.

### Compute

- **[Server](https://en.wikipedia.org/wiki/Server_(computing))** — a machine or VM (an *instance*)
  running your application code. Keep it **stateless** (sessions and uploads live in shared stores)
  so any instance can serve any request; then you scale *horizontally* by adding instances behind a
  load balancer instead of *vertically* by buying a bigger machine.
- **[Microservice](https://martinfowler.com/articles/microservices.html)** — an architecture where
  the application is a set of small services, each owning one business capability and its own data,
  deployed independently and talking over APIs or events. Buys independent scaling and team
  autonomy; costs network calls that fail, no cross-service transactions (use sagas), and harder
  debugging (use tracing). A modular monolith is usually the right start for a small team.
- **[Worker](https://en.wikipedia.org/wiki/Job_queue)** — a background process that takes jobs from
  a queue and does work that must not hold up a request: sending email, resizing images, building
  reports. Scale by adding workers; make jobs idempotent, because at-least-once delivery means a job
  can run twice.
- **[Serverless function](https://en.wikipedia.org/wiki/Function_as_a_service)** — code the cloud
  runs per event (an HTTP request, a queue message, an upload, a schedule) with no servers to
  manage; it scales out on its own, down to zero, and bills per invocation and run time. Watch cold
  starts, execution time limits, and hundreds of instances each opening a database connection.
- **[AWS Lambda](https://aws.amazon.com/lambda/)** — AWS's serverless functions, triggered by API
  Gateway, SQS, Kinesis or DynamoDB streams, S3 events or schedules; up to 15 minutes per
  invocation, billed per request and per GB-second.
- **[Container](https://www.docker.com/resources/what-container/)** — a process packaged with its
  code, runtime and libraries into an image that runs the same everywhere, isolated by Linux
  namespaces and cgroups. Unlike a VM it shares the host's kernel, so it is small and starts in
  about a second.
- **[Scheduler / cron](https://en.wikipedia.org/wiki/Cron)** — runs jobs at set times or intervals
  (`0 2 * * *` is daily at 02:00). With many instances, make sure only one fires each run (a lock,
  or a managed scheduler), and make jobs idempotent, because runs get missed and repeated.
- **[Docker](https://docs.docker.com/get-started/docker-overview/)** — the platform that made
  containers mainstream: a `Dockerfile` builds an image, the Docker engine runs it as a container,
  and registries (Docker Hub) store and share images.
- **[Kubernetes](https://kubernetes.io/docs/concepts/overview/)** — open-source system for
  automating deployment, scaling and management of containerised applications (from Google, CNCF).
  You declare the desired state (Deployments of Pods, Services, autoscaling rules) and its control
  loops keep reality matching it: restarting failed pods, rolling out new versions, scaling with
  load.

### SQL databases

Start relational when the data is related and you need transactions and queries you cannot predict
yet; pick a NoSQL store when one access pattern at a scale or shape SQL handles badly dominates.

- **[Database](https://en.wikipedia.org/wiki/Relational_database)** (relational) — data in tables of
  rows and columns with a fixed schema, related through keys and queried with SQL. Gives **ACID**
  transactions (atomic, consistent, isolated, durable), joins, constraints and indexes. Reads scale
  with replicas; writes past one machine need sharding, which is the hard part.
- **[Read replica](https://aws.amazon.com/rds/features/read-replicas/)** — a copy of the primary
  database that applies its change log and serves read queries, taking load off the primary and
  standing by for failover. Replication is usually asynchronous, so a replica lags: a user may not
  see their own write. Send read-your-own-writes queries to the primary.
- **[PostgreSQL](https://www.postgresql.org/about/)** — open-source object-relational database with
  40 years of development: strict SQL, MVCC concurrency, JSONB documents, full-text search, many
  index types (B-tree, GIN, GiST, BRIN) and extensions (PostGIS, pgvector). The safe default for a
  new system.
- **[MySQL](https://dev.mysql.com/doc/)** — the open-source relational database long billed as the
  world's most popular, developed by Oracle; the InnoDB engine gives transactions and row-level
  locking. Simple, fast reads and mature replication; runs much of the web, often sharded.
- **[MariaDB](https://mariadb.org/)** — community-developed fork of MySQL, started in 2009 by
  MySQL's original developers over Oracle's acquisition of it; largely a drop-in replacement, with
  its own storage engines and features.
- **[SQLite](https://sqlite.org/about.html)** — a self-contained, serverless, zero-configuration SQL
  database engine: a library inside your process that keeps the whole database in one file, and the
  most widely deployed database there is (every phone and browser). For devices, tests and small
  read-heavy services; one writer at a time. The SQL Lab in this app runs it in the browser.
- **[Oracle Database](https://www.oracle.com/database/)** — Oracle's commercial relational database,
  the long-standing enterprise choice in banks and large companies: PL/SQL, RAC clustering, and
  expensive licences.
- **[SQL Server](https://www.microsoft.com/en-us/sql-server)** — Microsoft's relational database,
  queried with T-SQL; common in .NET shops, also runs on Linux and as Azure SQL.
- **[CockroachDB](https://www.cockroachlabs.com/docs/stable/)** — distributed SQL database that
  speaks the PostgreSQL wire protocol: data is split into ranges replicated with Raft across nodes
  and regions, giving serializable transactions that survive node, zone or region failures and scale
  horizontally. Modelled on Google Spanner.
- **[TiDB](https://docs.pingcap.com/tidb/stable/overview)** — PingCAP's distributed SQL database,
  compatible with the MySQL protocol: TiKV stores rows replicated with Raft, TiFlash keeps a
  columnar copy, so one system serves both transactions and analytics (HTAP).
- **[Vitess](https://vitess.io/docs/overview/whatisvitess/)** — clustering system for scaling MySQL
  horizontally (built at YouTube, CNCF graduated): shards tables across many MySQL instances behind
  a routing proxy (VTGate), so the application sees one database. Used by Slack, GitHub and
  PlanetScale.
- **[PlanetScale](https://planetscale.com/)** — managed databases: MySQL on Vitess, with
  non-blocking schema changes and branches of a database, and now Postgres as well.
- **[Neon](https://neon.com/)** — serverless PostgreSQL that separates storage from compute: compute
  scales to zero when idle and autoscales under load, and copy-on-write storage lets you branch a
  database like code.
- **[Supabase](https://supabase.com/docs)** — open-source backend platform built around a full
  Postgres database: generated REST and GraphQL APIs, auth, file storage, realtime subscriptions and
  edge functions. Firebase-like, but SQL.

### NoSQL databases

- **[Key-value store](https://en.wikipedia.org/wiki/Key%E2%80%93value_database)** — the simplest
  model: store and fetch a value by its unique key, like a hash map spread over machines. Very fast
  and easy to partition, but you can only look things up by key (no joins, no ad-hoc queries), so
  design the keys around your access patterns. Redis, DynamoDB, etcd.
- **[Document database](https://en.wikipedia.org/wiki/Document-oriented_database)** — stores
  self-describing JSON-like documents in collections; each can have its own shape and nests related
  data, so one read fetches a whole object without joins. Good for evolving schemas and
  aggregate-shaped data (a product with its variants); weak at many-to-many relationships. MongoDB,
  Couchbase, Firestore.
- **[Wide-column store](https://en.wikipedia.org/wiki/Wide-column_store)** — rows found by a
  **partition key** (which decides the node) and kept sorted inside the partition by a **clustering
  key**, with sparse, flexible columns. Built for huge write throughput and queries known in advance
  ("messages in chat X, newest first"). Cassandra, ScyllaDB, HBase, Bigtable.
- **[Graph database](https://en.wikipedia.org/wiki/Graph_database)** — data as nodes and
  relationships (edges), both with properties; queries follow relationships directly instead of
  joining tables, so multi-hop questions ("friends of friends who like X") stay fast. Social graphs,
  recommendations, fraud rings, knowledge graphs. Neo4j, Amazon Neptune.
- **[Time-series database](https://en.wikipedia.org/wiki/Time_series_database)** — built for
  timestamped measurements arriving in order (metrics, sensor readings, prices): fast appends, heavy
  compression, aggregation over time windows, downsampling, and retention policies that drop old
  data. InfluxDB, TimescaleDB, Prometheus.
- **[MongoDB](https://www.mongodb.com/docs/manual/introduction/)** — the most widely used document
  database: BSON documents in collections, a rich query language and aggregation pipeline, secondary
  indexes and multi-document ACID transactions; replica sets for failover, sharding for horizontal
  scale.
- **[Apache Cassandra](https://cassandra.apache.org/_/cassandra-basics.html)** — open-source
  distributed wide-column database (born at Facebook) with no leader: every node is equal, data sits
  on a consistent-hash ring with replicas, and each query picks its consistency level (ONE, QUORUM,
  ALL). Writes scale linearly and it survives losing a datacenter; every query must follow the
  partition key.
- **[ScyllaDB](https://www.scylladb.com/)** — a Cassandra-compatible (and DynamoDB-compatible)
  database rewritten in C++ with a shard-per-core design, for lower, steadier latency on fewer
  nodes.
- **[DynamoDB](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html)**
  — AWS's fully managed, serverless key-value and document database with single-digit-millisecond
  latency at any scale. Items are addressed by a partition key (plus an optional sort key); tables
  are modelled around access patterns, often as one table, with global secondary indexes for other
  lookups. On-demand or provisioned capacity; Streams emit every change.
- **[Couchbase](https://www.couchbase.com/)** — distributed JSON document database with a built-in
  memory-first cache, SQL++ queries, full-text search and sync to mobile devices.
- **[Apache CouchDB](https://couchdb.apache.org/)** — document database that speaks JSON over HTTP
  and replicates multi-master: any copy accepts writes and syncs later, keeping conflicts for the
  app to resolve. Made for offline-first apps (PouchDB in the browser).
- **[Apache HBase](https://hbase.apache.org/)** — the Hadoop database: a distributed, versioned
  wide-column store modelled on Google's Bigtable and running on HDFS, for random, real-time reads
  and writes over billions of rows.
- **[Neo4j](https://neo4j.com/docs/getting-started/)** — the best-known native graph database, with
  ACID transactions, queried with Cypher, a pattern language: `(a:Person)-[:FOLLOWS]->(b)`.
- **[ArangoDB](https://arangodb.com/)** — multi-model database: documents, graphs and key-value in
  one engine, with one query language (AQL).
- **[Firebase](https://firebase.google.com/docs)** — Google's app platform: Cloud Firestore (a
  document database with realtime listeners and offline sync) and the older Realtime Database, plus
  Authentication, Hosting, Cloud Functions and Cloud Messaging. Apps talk to it directly, guarded by
  security rules.
- **[InfluxDB](https://www.influxdata.com/)** — time-series database for metrics, events and IoT
  data: high-rate ingest, SQL and InfluxQL queries, retention policies.
- **[TimescaleDB](https://github.com/timescale/timescaledb)** — a PostgreSQL extension for time
  series: *hypertables* partition by time into chunks automatically, with compression, continuous
  aggregates and retention, while keeping full SQL and joins.

### Caches

- **[Cache](https://aws.amazon.com/caching/)** — a small, fast store (usually memory) holding copies
  of data that is slow to compute or fetch, so repeat reads skip the slow path. Patterns:
  **cache-aside** (the app reads the cache, on a miss loads from the database and fills it; the most
  common), **read/write-through** (the cache layer talks to the database), **write-behind** (write
  to the cache, database later). Decide **eviction** (LRU, LFU, TTL) and **invalidation** (delete on
  write, short TTLs), and protect against a **stampede** when a hot key expires and every request
  hits the database at once.
- **[Redis](https://redis.io/docs/latest/)** — in-memory data structure store (strings, hashes,
  lists, sets, sorted sets, streams, geospatial indexes, vectors) with sub-millisecond latency. Used
  as cache, session store, rate-limit counters, leaderboards (sorted sets), distributed locks,
  pub/sub and lightweight queues; optional persistence (RDB snapshots, AOF), replication and Redis
  Cluster sharding. Commands run one at a time, so one slow command stalls the rest. Valkey is the
  Linux Foundation's fork of it (2024).
- **[Memcached](https://memcached.org/)** — free, open-source, high-performance distributed memory
  caching: a simple multi-threaded key-value cache with LRU eviction and no persistence or
  replication; clients spread keys across servers by hashing. Pick it for plain caching; pick Redis
  when you need data structures or persistence.
- **[Upstash](https://upstash.com/)** — serverless Redis billed per request, reachable over HTTP (so
  it works from edge functions), plus QStash for HTTP messaging and schedules and a vector database.

### Queues & streams

| | Message queue | Pub/sub topic | Event stream (log) |
|---|---|---|---|
| Who gets a message | one consumer from the pool | every subscriber | every consumer group, each at its own offset |
| Once consumed | acknowledged and deleted | delivered, no replay | kept for the retention period, replayable |
| Order | roughly first in, first out | not guaranteed | strict within a partition |
| Typical use | jobs, task distribution | notifications, cache invalidation | event pipelines, analytics, change data capture |
| Examples | RabbitMQ, SQS, Celery | SNS, Redis pub/sub, NATS | Kafka, Pulsar, Kinesis |

**Kafka or RabbitMQ?** RabbitMQ is a *smart broker*: exchanges route each message into queues,
consumers acknowledge it, the broker deletes it, and per-message retries, priorities and dead-letter
queues are built in; reach for it to hand out tasks and for rich routing. Kafka is a *durable log*:
messages stay after they are read, each consumer group keeps its own offset, order holds within a
partition, and throughput scales with partitions; reach for it when many systems consume the same
events, need to replay them, or the volume is very high.

- **[Message queue](https://aws.amazon.com/message-queue/)** — a buffer between producers and
  consumers: the producer sends and moves on; a consumer takes the message when ready, processes it
  and acknowledges it, and the queue deletes it. Decouples services, absorbs traffic spikes and
  moves slow work off the request. Delivery is usually **at-least-once**, so consumers must be
  idempotent; messages that keep failing go to a **dead-letter queue**.
- **[Pub/sub topic](https://en.wikipedia.org/wiki/Publish%E2%80%93subscribe_pattern)** —
  publish-subscribe: a publisher sends a message to a topic without knowing who listens, and every
  subscriber gets its own copy (fan-out). Broadcasts events: "order placed" reaches email, analytics
  and inventory, each reacting on its own.
- **[Event stream](https://kafka.apache.org/intro)** — an append-only, ordered log of events,
  partitioned by a key such as the user id and kept for a retention period. Consumers read from an
  offset and can read history again, so a new service can replay the past and several consumers
  process the same events independently. The base of event-driven architecture, change data capture
  and event sourcing.
- **[Apache Kafka](https://kafka.apache.org/intro)** — open-source distributed event-streaming
  platform (from LinkedIn). Producers append records to **topics** split into **partitions**; each
  partition is an ordered log replicated across brokers and kept for a set time. Consumers in a
  **consumer group** split the partitions between them (one consumer per partition) and commit
  offsets, so throughput scales with partitions and data can be replayed. Order holds only inside a
  partition, so choose the message key with that in mind. Kafka 4.0 runs on KRaft, without
  ZooKeeper.
- **[RabbitMQ](https://www.rabbitmq.com/tutorials/amqp-concepts)** — open-source message broker
  speaking AMQP (and MQTT, STOMP). Producers publish to an **exchange** (direct, topic, fanout or
  headers) that routes by **routing key** and bindings into **queues**; consumers acknowledge each
  message, unacknowledged ones are redelivered, rejected ones can go to a dead-letter exchange.
  Quorum queues replicate with Raft; streams add a Kafka-like replayable log.
- **[Apache Pulsar](https://pulsar.apache.org/)** — distributed messaging and streaming (from Yahoo)
  that does both queues and streams: stateless brokers serve, Apache BookKeeper stores, so storage
  and compute scale separately; multi-tenancy, geo-replication and tiered storage to S3 are built
  in.
- **[NATS](https://docs.nats.io/)** — lightweight, high-performance messaging (CNCF): subject-based
  pub/sub, request-reply and queue groups in one small binary. Core NATS is in-memory and
  at-most-once; **JetStream** adds persistence, replay and key-value and object stores.
- **[Amazon SQS](https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html)** —
  AWS's fully managed message queue. **Standard** queues: nearly unlimited throughput, at-least-once
  delivery, best-effort order. **FIFO** queues: strict order per message group and exactly-once
  processing, at lower throughput. A received message is hidden for the **visibility timeout** and
  comes back if it is not deleted in time; long polling and dead-letter queues are built in. Paired
  with SNS for fan-out.
- **[Celery](https://docs.celeryq.dev/)** — Python distributed task queue: code calls
  `task.delay()`, a broker (RabbitMQ or Redis) carries the job, Celery workers run it, with retries,
  schedules (celery beat) and stored results.
- **[Temporal](https://temporal.io/)** — open-source durable execution: workflows are ordinary code,
  and Temporal records every step, so a workflow survives crashes, retries its activities, can wait
  for days and resumes exactly where it stopped. For sagas, payments and onboarding flows that would
  otherwise be a state machine plus queues plus cron. A fork of Uber's Cadence.

### Storage & analytics

**OLTP or OLAP?** Transactional databases (Postgres, MySQL) serve many small reads and writes of
current rows; analytical systems (warehouses, ClickHouse) scan billions of rows across a few columns
for reports, using columnar storage, compression and bulk loads.

- **[Object storage](https://aws.amazon.com/what-is/object-storage/)** — files stored as objects
  (bytes plus metadata) under keys in flat buckets and reached over HTTP. Practically unlimited,
  very durable and cheap, but objects are replaced whole, never edited in place. The home for
  images, video, backups, logs and data lakes: serve it through a CDN, and let clients upload
  straight to it with pre-signed URLs.
- **[Amazon S3](https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html)** — AWS's object
  storage: buckets of objects, designed for 99.999999999% (eleven nines) durability, with strong
  read-after-write consistency, storage classes down to Glacier for cold data, lifecycle rules,
  versioning and event notifications. Its API is the one everyone else copies. This app stores
  uploads in it.
- **[Data warehouse](https://en.wikipedia.org/wiki/Data_warehouse)** — a central analytical database
  that gathers data from many sources (ETL/ELT) for reporting and BI. Stores data by column, so
  scanning and aggregating a few columns over billions of rows is fast; not for serving an app's
  live transactions.
- **[MinIO](https://min.io/)** — high-performance, S3-compatible object storage you run yourself, on
  your own servers or on Kubernetes.
- **[Ceph](https://ceph.io/)** — open-source distributed storage that serves object (S3-compatible),
  block (RBD) and file (CephFS) storage from one cluster; its CRUSH algorithm computes where data
  lives, so there is no central lookup table.
- **[Snowflake](https://docs.snowflake.com/)** — cloud data warehouse that separates storage from
  compute: data is stored once, and independent *virtual warehouses* (compute clusters) query it,
  each scaling and suspending on its own, billed per second.
- **[BigQuery](https://cloud.google.com/bigquery/docs/introduction)** — Google Cloud's serverless
  data warehouse: no clusters to run, standard SQL over columnar storage, billed by data scanned or
  by reserved capacity.
- **[ClickHouse](https://clickhouse.com/docs)** — open-source column-oriented database for real-time
  analytics (from Yandex): vectorised execution and MergeTree tables aggregate billions of rows in
  under a second. For logs, events, metrics and user-facing dashboards; not for frequent single-row
  updates.
- **[Databricks](https://www.databricks.com/)** — data and AI platform from the creators of Apache
  Spark, built on the **lakehouse** idea: open table files (Delta Lake) in cloud object storage,
  with warehouse-style SQL, governance (Unity Catalog) and machine learning on top.
- **[DuckDB](https://duckdb.org/)** — in-process analytical SQL database, "SQLite for analytics": a
  library with no server that runs fast columnar queries over local files, Parquet, CSV and
  dataframes.

### Search & vectors

- **[Search index](https://en.wikipedia.org/wiki/Inverted_index)** — usually an **inverted index**:
  a map from each term to the documents that contain it, like the index at the back of a book, built
  after the text is analysed (split into tokens, lower-cased, stemmed). Answers full-text queries
  with typo tolerance, filters and facets, ranked by relevance (BM25). Normally a secondary copy fed
  from the main database, so it runs slightly behind it.
- **[Vector database](https://en.wikipedia.org/wiki/Vector_database)** — stores embeddings (lists of
  numbers an ML model produces to capture meaning) and finds the ones nearest a query vector, using
  approximate-nearest-neighbour indexes such as HNSW or IVF. Powers semantic search,
  recommendations, image similarity and retrieval for LLM apps (RAG). pgvector adds this to
  Postgres.
- **[Elasticsearch](https://www.elastic.co/elasticsearch)** — distributed search and analytics
  engine on Apache Lucene: JSON documents over a REST API, indexes split into shards with replicas,
  full-text relevance, aggregations and vector search. The E in the ELK stack.
- **[OpenSearch](https://opensearch.org/)** — Apache-2.0 search and analytics suite forked from
  Elasticsearch 7.10 in 2021 after Elastic's licence change; started by AWS, now governed under the
  Linux Foundation. Ships OpenSearch Dashboards, its fork of Kibana.
- **[Apache Solr](https://solr.apache.org/)** — open-source enterprise search platform on Lucene,
  with faceting and SolrCloud for distributed indexes; long used for e-commerce and site search.
- **[Algolia](https://www.algolia.com/)** — hosted search as a service: send your records to its API
  and get instant, typo-tolerant search-as-you-type with ranking rules, analytics and front-end
  widgets, with no cluster to run.
- **[Meilisearch](https://www.meilisearch.com/)** — open-source search engine written in Rust for
  fast, typo-tolerant search-as-you-type that works well with little configuration.
- **[Qdrant](https://qdrant.tech/)** — open-source vector database and similarity search engine
  written in Rust, with filtering on each vector's payload.
- **[Milvus](https://milvus.io/)** — open-source vector database built for billions of vectors with
  a distributed, cloud-native architecture; created by Zilliz, an LF AI & Data Foundation project.

### Data processing

**Batch or stream?** Batch processes a bounded set of data on a schedule (results hours old, simple
and cheap); stream processing handles an unbounded flow as it arrives (results seconds old, but it
needs windows, state and a plan for events that arrive late).

- **[Batch job](https://en.wikipedia.org/wiki/Batch_processing)** — processes a large, bounded set
  of data in one run, usually on a schedule: nightly ETL into a warehouse, billing runs, reports,
  re-indexing search, training models. Throughput matters more than latency; make it restartable
  from where it failed.
- **[Stream processor](https://en.wikipedia.org/wiki/Stream_processing)** — continuously processes
  events as they arrive: filters, enriches, joins streams and aggregates over **windows** (tumbling,
  sliding, session), keeping state that is checkpointed so it survives failures. For fraud
  detection, live metrics and real-time recommendations.
- **[Apache Spark](https://spark.apache.org/)** — unified engine for large-scale data processing:
  batch jobs, SQL, machine learning (MLlib) and Structured Streaming across a cluster, keeping
  intermediate data in memory, which made it far faster than Hadoop MapReduce. APIs in Python
  (PySpark), Scala, Java and SQL.
- **[Apache Flink](https://flink.apache.org/)** — framework and distributed engine for stateful
  computations over unbounded and bounded streams: event-time processing with watermarks, large
  managed state, exactly-once state consistency through checkpoints, low latency. The usual choice
  for true real-time streaming.
- **[Apache Hadoop](https://hadoop.apache.org/)** — framework for distributed storage and processing
  of huge data sets on commodity machines: **HDFS** (distributed file system), **YARN** (resource
  manager) and **MapReduce** (batch programming model). Mostly replaced by Spark and cloud object
  storage, whose ideas it started.
- **[Apache Airflow](https://airflow.apache.org/)** — platform to author, schedule and monitor
  workflows as code (from Airbnb): pipelines are Python-defined DAGs of tasks with dependencies,
  retries and backfills. It orchestrates; the heavy work runs elsewhere.
- **[Apache Druid](https://druid.apache.org/)** — real-time analytics database for sub-second
  queries over high-volume event data, ingesting from Kafka as it arrives; built for interactive,
  user-facing dashboards.
- **[Trino](https://trino.io/)** — distributed SQL query engine (the fork of Facebook's Presto, once
  PrestoSQL) that queries data where it lives (S3 and data lakes, Hive, Postgres, Kafka,
  Elasticsearch) and joins across them in one query; it stores nothing itself.

### Observability

Metrics tell you *that* something is wrong, traces *where*, logs *why*.

- **[Metrics](https://sre.google/sre-book/monitoring-distributed-systems/)** — numeric measurements
  over time, cheap to store and aggregate: **counters** (requests served), **gauges** (queue
  length), **histograms** (latency percentiles). Watch the four golden signals (latency, traffic,
  errors, saturation), **RED** for services (rate, errors, duration) and **USE** for resources
  (utilisation, saturation, errors).
- **[Logs](https://12factor.net/logs)** — timestamped records of individual events (a request, an
  error with its stack trace). Write them structured (JSON carrying a request id and user id), ship
  them to a central store and search them while debugging; the most detailed signal and the most
  expensive to keep.
- **[Tracing](https://opentelemetry.io/docs/concepts/signals/traces/)** — distributed tracing
  follows one request across every service it touches: a **trace** is a tree of **spans** (one per
  operation, with timings) tied together by a trace id passed along in headers, showing where the
  latency and the errors come from.
- **[Alerting](https://sre.google/workbook/alerting-on-slos/)** — rules that page a human when
  something needs action now, best based on what users feel (SLO burn rate, error rate, latency)
  rather than every possible cause. Alerts that fire without needing action teach people to ignore
  alerts.
- **[Prometheus](https://prometheus.io/docs/introduction/overview/)** — open-source monitoring and
  alerting toolkit (from SoundCloud, CNCF graduated): it **pulls** (scrapes) metrics from `/metrics`
  endpoints, stores them as labelled time series, queries them with PromQL and sends alerts through
  Alertmanager.
- **[Grafana](https://grafana.com/docs/grafana/latest/)** — open-source visualisation platform:
  dashboards and alerts over many data sources (Prometheus, Loki, Tempo, Elasticsearch, SQL
  databases) without storing the data itself.
- **[Datadog](https://www.datadoghq.com/)** — hosted observability platform: infrastructure metrics,
  APM traces, logs, real-user monitoring and alerting in one product, collected by an agent on each
  host. Broad and quick to adopt; the bill grows fast with volume.
- **[Jaeger](https://www.jaegertracing.io/)** — open-source distributed tracing platform (from Uber,
  CNCF graduated) for collecting, storing and exploring traces; version 2 is built on the
  OpenTelemetry Collector.
- **[OpenTelemetry](https://opentelemetry.io/docs/what-is-opentelemetry/)** — vendor-neutral
  standard, SDKs and Collector (CNCF) for producing and exporting traces, metrics and logs:
  instrument once, send anywhere (Jaeger, Prometheus, Datadog…). Formed by merging OpenTracing and
  OpenCensus.
- **[Kibana](https://www.elastic.co/kibana)** — the interface to Elasticsearch: search logs, build
  dashboards and visualisations, manage the stack. The K in ELK.
- **[Logstash](https://www.elastic.co/logstash)** — server-side pipeline that ingests data from many
  sources, parses and transforms it (grok filters) and sends it to Elasticsearch or elsewhere. The L
  in ELK; lighter shippers (Beats, Elastic Agent) often do the collecting.
- **[Fluentd](https://www.fluentd.org/)** — open-source data collector for a unified logging layer
  (CNCF graduated): gathers logs from many sources and routes them to many outputs through plugins.
  Fluent Bit is its lightweight sibling, common as the log agent on Kubernetes nodes.
- **[Sentry](https://sentry.io/)** — error tracking and performance monitoring for applications:
  SDKs capture exceptions with stack traces, breadcrumbs, release and user context, group them into
  issues and alert the team.
- **[New Relic](https://newrelic.com/)** — hosted observability platform: APM, infrastructure, logs,
  browser and mobile monitoring, queried with NRQL.
- **[PagerDuty](https://www.pagerduty.com/)** — incident response platform: on-call schedules and
  escalation policies turn alerts from monitoring tools into calls, texts and push notifications for
  the right person, and track the incident to resolution.

### Cloud & platform

- **[AWS](https://aws.amazon.com/what-is-aws/)** — Amazon Web Services, the largest public cloud:
  hundreds of services (EC2 virtual machines, S3, RDS, DynamoDB, Lambda, SQS and SNS, CloudFront) in
  regions worldwide, paid for as you use them.
- **[Azure](https://azure.microsoft.com/)** — Microsoft's public cloud, strongest in companies
  already on Microsoft: virtual machines, Azure SQL, Cosmos DB, Functions, AKS (Kubernetes), Entra
  ID for identity.
- **[Google Cloud](https://cloud.google.com/)** — Google's public cloud: Compute Engine, GKE
  (Kubernetes), BigQuery, Spanner, Pub/Sub, Cloud Run, Vertex AI, on Google's own global network.
- **[DigitalOcean](https://www.digitalocean.com/)** — developer-friendly cloud with simple,
  predictable pricing: Droplets (VMs), managed databases, Kubernetes, Spaces (S3-compatible storage)
  and App Platform.
- **[Vercel](https://vercel.com/docs)** — frontend cloud from the makers of Next.js: deploys on git
  push, a preview URL per branch, a global CDN, serverless and edge functions. This app's client is
  deployed there.
- **[Netlify](https://www.netlify.com/)** — platform for deploying websites and web apps from git:
  CDN hosting for static sites, serverless and edge functions, forms and deploy previews.
- **[Region / zone](https://aws.amazon.com/about-aws/global-infrastructure/regions_az/)** — a
  **region** is a geographic area of a cloud (Mumbai, Frankfurt); each holds several **availability
  zones**, separate datacenters with their own power and network, close enough for fast synchronous
  replication. Spread across zones to survive a datacenter failure, across regions to survive a
  regional outage or to be near users, at the cost of latency and harder consistency.
- **[Terraform](https://developer.hashicorp.com/terraform/intro)** — infrastructure as code from
  HashiCorp: describe servers, networks and databases in HCL, `terraform plan` shows the difference
  from the recorded state, `apply` makes it so, across AWS, GCP, Azure and hundreds of other
  providers. OpenTofu is the open-source fork made after its 2023 licence change.
- **[Helm](https://helm.sh/)** — the package manager for Kubernetes: a **chart** bundles templated
  manifests with configurable values, so an app (or Postgres, or Redis) installs, upgrades and rolls
  back as one release.
- **[Istio](https://istio.io/latest/about/service-mesh/)** — service mesh (CNCF graduated) that adds
  mutual TLS, traffic management (retries, timeouts, canary splits) and telemetry to
  service-to-service calls without code changes, through Envoy proxies, either as sidecars or in its
  sidecar-less ambient mode.
- **[Linkerd](https://linkerd.io/)** — lightweight, security-first service mesh for Kubernetes (CNCF
  graduated) with a small proxy written in Rust: automatic mTLS, retries and golden metrics, simpler
  to run than Istio.
- **[ZooKeeper](https://zookeeper.apache.org/)** — Apache's coordination service for distributed
  systems: a small replicated tree of data nodes (znodes), kept strongly consistent by the ZAB
  consensus protocol, used for configuration, leader election, locks and group membership (HBase,
  older Kafka).
- **[etcd](https://etcd.io/docs/)** — strongly consistent, distributed key-value store (CNCF
  graduated) built on the Raft consensus algorithm; holds all of Kubernetes' cluster state and is
  used for configuration, service discovery and leader election, with watches that report changes.
- **[Consul](https://developer.hashicorp.com/consul/docs/intro)** — HashiCorp's service networking
  tool: service registry and discovery over DNS or HTTP, health checks, a key-value store for
  configuration, and a service mesh.
- **[Vault](https://developer.hashicorp.com/vault/docs/what-is-vault)** — HashiCorp's secrets
  manager: stores and tightly controls access to tokens, passwords, certificates and encryption
  keys, issues short-lived **dynamic secrets** (a database login that expires) and offers encryption
  as a service.

### Identity & security

**Authentication** proves who you are (login, token); **authorisation** decides what you may do
(roles, permissions). OAuth 2.0 is delegated authorisation, OpenID Connect adds identity on top of it,
and a JWT is a token format, not a protocol.

- **[Auth service](https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html)**
  — authenticates users (password, OTP, social login, SSO), issues **sessions** or **tokens** (a
  short-lived JWT access token plus a refresh token) and lets other services check them. A JWT is
  verified locally without a network call but cannot be revoked before it expires; a server-side
  session can be revoked but needs a lookup, usually in Redis.
- **[Auth0](https://auth0.com/docs)** — hosted identity platform, part of Okta since 2021:
  ready-made login, social and enterprise connections, MFA, and OAuth 2.0 / OpenID Connect tokens
  for apps and APIs.
- **[Okta](https://www.okta.com/)** — enterprise identity provider: single sign-on for employees
  across SaaS apps, MFA and user lifecycle management over SAML and OpenID Connect.
- **[Keycloak](https://www.keycloak.org/)** — open-source identity and access management (CNCF):
  self-hosted single sign-on with OpenID Connect, OAuth 2.0 and SAML, user federation (LDAP), social
  login and fine-grained authorisation.
- **[Secrets manager](https://aws.amazon.com/secrets-manager/)** — a secure store for credentials
  (database passwords, API keys, certificates): encrypted at rest, fetched by services at runtime
  under audited, role-based access, and **rotated** on a schedule without redeploying. Keeps secrets
  out of code, images and plain environment files. AWS Secrets Manager, Vault.

### Third-party services

- **[Payment gateway](https://en.wikipedia.org/wiki/Payment_gateway)** — the service that securely
  takes a customer's payment details and moves the money through card networks, UPI or banks,
  reporting success or failure. Payments are asynchronous and must never charge twice: send an
  **idempotency key** with each request, record the payment as pending, treat the gateway's signed
  **webhook** as the final word, and reconcile against its reports daily.
- **[Stripe](https://docs.stripe.com/)** — global payments platform with developer-first APIs:
  PaymentIntents for card and wallet payments, Billing for subscriptions, Connect for marketplaces,
  with idempotency keys and webhooks as core concepts.
- **[Razorpay](https://razorpay.com/docs/)** — Indian payments platform for UPI, cards, netbanking
  and wallets. The standard flow: the server creates an **Order**, Checkout collects the payment,
  the server verifies the returned signature (HMAC-SHA256 of order id and payment id), and a webhook
  confirms capture. Also payouts, subscriptions and payment links.
- **Notification service** — decides what to tell users and delivers it by push (APNs, FCM), email,
  SMS or in-app, respecting preferences, quiet hours and rate limits. Events arrive through a queue,
  fan out to a worker per channel, retry with backoff, and are deduplicated so nobody gets the same
  message twice.
- **[Email service](https://aws.amazon.com/ses/)** — sends transactional email (password resets,
  receipts, OTPs) through a provider such as Amazon SES, SendGrid or Postmark, which handles
  deliverability: SPF, DKIM and DMARC records on your domain, bounces, complaints and sender
  reputation. Send from a queue, not inside the request.
- **[SMS gateway](https://www.twilio.com/docs/messaging)** — a provider API (Twilio, MSG91, Amazon
  SNS) that delivers text messages to phone networks, for OTPs and alerts. Priced per message and by
  country; in India, sender IDs and message templates must be registered under TRAI's DLT rules.
  Rate-limit OTP requests, or attackers will pump messages to premium numbers at your cost.
- **[Maps / geo service](https://en.wikipedia.org/wiki/Geohash)** — geocoding (address to
  coordinates) and back, routing and ETAs, and "what is near me" queries. Nearby search needs a
  spatial index: **geohash** (latitude and longitude encoded into a string whose shared prefix means
  nearby), **quadtree** (split dense areas recursively), Uber's **H3** hexagons, or PostGIS and
  Redis GEO.

### Languages & frameworks

- **[Node.js](https://nodejs.org/en/about)** — JavaScript runtime on Chrome's V8 engine: one event
  loop with non-blocking I/O serves many concurrent connections on one thread, which suits I/O-heavy
  APIs and realtime servers; CPU-heavy work blocks it (move it to worker threads or another
  service). This app's server runs on it.
- **[Go](https://go.dev/)** — Google's statically typed, compiled language with goroutines and
  channels for cheap concurrency, fast builds and single-binary deploys; the language of Docker,
  Kubernetes, etcd and much cloud infrastructure.
- **[Java](https://openjdk.org/)** — statically typed, object-oriented language on the JVM, whose
  JIT compiler and garbage collectors give high throughput for long-running servers, with an
  enormous ecosystem (Spring; Kafka, Cassandra and Elasticsearch run on the JVM). OpenJDK is the
  open-source reference implementation; virtual threads (Java 21) let blocking-style code scale.
- **[Python](https://www.python.org/)** — readable, dynamically typed language that dominates data,
  ML and scripting, with Django and FastAPI for web backends. The GIL stops threads running Python
  code in parallel (optional free-threaded builds, 3.13 onward, lift it), so CPU work scales with
  processes, I/O with async.
- **[Rust](https://www.rust-lang.org/)** — systems language with memory safety and no garbage
  collector, enforced at compile time by ownership and borrowing: C/C++ speed without data races.
  Used for proxies, databases and performance-critical services.
- **[Kotlin](https://kotlinlang.org/)** — concise, null-safe JVM language from JetBrains, fully
  interoperable with Java; Google's preferred language for Android and also used with Spring on
  servers, with coroutines for async code.
- **[PHP](https://www.php.net/)** — server-side scripting language behind a large share of the web
  (WordPress, Laravel apps); each request starts from a clean slate (shared-nothing).
- **[Ruby](https://www.ruby-lang.org/en/)** — dynamic, expressive language designed for programmer
  happiness, best known through Ruby on Rails (GitHub, Shopify).
- **[Spring](https://spring.io/)** — the dominant Java application framework, built on dependency
  injection; **Spring Boot** makes production-ready services with auto-configuration and an embedded
  server.
- **[Django](https://www.djangoproject.com/)** — "batteries included" Python web framework: ORM,
  migrations, admin panel, authentication and forms out of the box.
- **[FastAPI](https://fastapi.tiangolo.com/)** — modern, high-performance Python framework for APIs
  based on type hints: validation through Pydantic, async support and automatic OpenAPI docs.
- **[Express](https://expressjs.com/)** — fast, unopinionated, minimalist web framework for Node.js:
  routing and middleware, with everything else chosen by you. This app's API is built on it.
- **[NestJS](https://nestjs.com/)** — structured Node.js framework in TypeScript, organised
  Angular-style into modules, controllers and providers with dependency injection.
- **[React](https://react.dev/)** — library for building user interfaces from components: you
  describe the UI for a state, and React updates the page when the state changes. This app's client
  is built with it.
- **[Next.js](https://nextjs.org/docs)** — React framework from Vercel: file-based routing,
  server-side rendering, static generation, React Server Components and API routes in one project.
- **[Android](https://developer.android.com/)** — Google's mobile operating system; apps in Kotlin
  (or Java) with Jetpack Compose, push through Firebase Cloud Messaging.
- **[iOS](https://developer.apple.com/)** — Apple's mobile operating system; apps in Swift with
  SwiftUI or UIKit, push through APNs, and strict limits on work in the background.
- **[Linux](https://www.kernel.org/)** — the open-source kernel, and the distributions built on it
  (Ubuntu, Debian, RHEL, Alpine), under nearly every server, container and cloud VM.

### APIs & DevOps

| | REST | GraphQL | gRPC |
|---|---|---|---|
| Shape | resources at URLs, HTTP methods | one endpoint, the client writes the query | procedure calls from a `.proto` contract |
| Payload | usually JSON | JSON | Protocol Buffers (binary) |
| Caching | HTTP caching just works | harder: one URL, mostly POST | none built in |
| Best for | public APIs | many clients needing different fields | calls between services, streaming |

- **[REST API](https://developer.mozilla.org/en-US/docs/Glossary/REST)** — an architectural style
  for HTTP APIs (Roy Fielding, 2000): **resources** at URLs (`/users/42/orders`) acted on with HTTP
  methods (GET reads, POST creates, PUT and PATCH update, DELETE removes), stateless requests,
  status codes and cacheable responses. Design points: nouns in paths, cursor pagination for big
  lists, versioning, and idempotency keys on POSTs that must not run twice.
- **[GraphQL](https://graphql.org/learn/)** — a query language for APIs and a runtime that answers
  those queries (from Facebook, 2015): one endpoint and a typed schema; the client asks for exactly
  the fields it needs, across related objects, in one request. Watch for N+1 resolver queries (batch
  them with DataLoader), expensive queries (limit depth and cost) and harder HTTP caching.
- **[gRPC](https://grpc.io/docs/what-is-grpc/introduction/)** — high-performance, open-source RPC
  framework (from Google, CNCF): define services and messages in Protocol Buffers, generate typed
  clients and servers in many languages, and call them over HTTP/2 with binary payloads, as single
  calls or client, server and bidirectional streams. Fast between services; browsers need gRPC-Web.
- **[WebSocket](https://developer.mozilla.org/en-US/docs/Web/API/WebSockets_API)** — a protocol (RFC
  6455) that upgrades an HTTP connection into a persistent, two-way channel, so either side can send
  messages at any time with little overhead: chat, presence, live cursors, games. Connections are
  stateful, so servers need sticky routing and a pub/sub backplane (Redis) to reach users connected
  to other nodes. Server-Sent Events are the simpler one-way alternative, and the one this module
  plans for realtime.
- **[Webhook](https://en.wikipedia.org/wiki/Webhook)** — an HTTP callback: when something happens in
  another system (a payment captured, a PR merged) it POSTs a JSON payload to a URL you registered.
  Verify its **signature**, answer 2xx quickly and do the work from a queue, and deduplicate,
  because providers retry and the same event can arrive twice or out of order.
- **[Socket.IO](https://socket.io/docs/v4/)** — library for realtime, bidirectional, event-based
  communication between browser and server: uses WebSocket when it can and falls back to HTTP
  long-polling, adding automatic reconnection, acknowledgements, rooms and broadcasting. It is its
  own protocol on top, so a plain WebSocket client cannot talk to a Socket.IO server; scale across
  nodes with an adapter such as Redis.
- **[GitHub](https://docs.github.com/)** — Git repository hosting with pull requests, code review,
  issues, Actions and package registries; home to most open-source code.
- **[GitHub Actions](https://docs.github.com/en/actions)** — CI/CD built into GitHub: YAML workflows
  in `.github/workflows` run jobs on events (push, pull request, schedule) on hosted or self-hosted
  runners, reusing actions from the marketplace.
- **[GitLab](https://docs.gitlab.com/)** — one DevSecOps platform: Git hosting, merge requests,
  built-in CI/CD (`.gitlab-ci.yml`), a container registry and security scanning, as SaaS or
  self-managed.
- **[Jenkins](https://www.jenkins.io/)** — open-source automation server, the long-standing
  self-hosted CI/CD tool: pipelines as code in a Jenkinsfile and a very large plugin ecosystem;
  flexible, but you run and maintain it.
- **[Argo CD](https://argo-cd.readthedocs.io/)** — declarative GitOps continuous delivery for
  Kubernetes (CNCF graduated): the desired state of each app lives in Git, Argo CD keeps the cluster
  synced to it and shows any drift, and a rollback is a revert.
- **[OpenAPI / Swagger](https://www.openapis.org/)** — the OpenAPI Specification is a standard,
  language-agnostic description of an HTTP API in YAML or JSON (endpoints, parameters, schemas,
  auth) from which docs (Swagger UI), client SDKs, server stubs and tests are generated. Swagger was
  the specification's original name and is still the name of its best-known tools.
- **[Postman](https://www.postman.com/)** — API platform for building and testing requests:
  collections, environments, automated tests, mock servers and shared API documentation.

### Data structures

- **[Array](https://en.wikipedia.org/wiki/Array_(data_structure))** — elements in contiguous memory,
  addressed by index: O(1) read and write by index and cache-friendly, but inserting or deleting in
  the middle shifts everything after it, O(n). Dynamic arrays (JavaScript arrays, Python lists,
  Java's ArrayList) double their capacity when full, so appending is amortised O(1).
- **[Stack](https://en.wikipedia.org/wiki/Stack_(abstract_data_type))** — LIFO, last in first out:
  push and pop at the top, both O(1). Behind function calls, undo, parsing expressions and brackets,
  iterative DFS, and monotonic-stack problems ("next greater element").
- **[Queue](https://en.wikipedia.org/wiki/Queue_(abstract_data_type))** — FIFO, first in first out:
  enqueue at the rear, dequeue at the front, both O(1) with a circular buffer or linked list (not
  JavaScript's `array.shift()`, which is O(n)). Behind BFS, schedulers and buffers; a message queue
  is the distributed version, and a deque works at both ends.
- **[Linked list](https://en.wikipedia.org/wiki/Linked_list)** — nodes each holding a value and a
  pointer to the next: O(1) insert or delete once you hold the node (nothing shifts), but O(n) to
  reach the i-th element and poor cache locality. Interview patterns: fast and slow pointers (cycle,
  middle), in-place reversal, a dummy head node.
- **[Doubly linked list](https://en.wikipedia.org/wiki/Doubly_linked_list)** — nodes point to both
  the next and the previous node, so a node you hold is unlinked in O(1) and the list can be walked
  both ways. Together with a hash map it makes an **LRU cache** with O(1) get and put (LeetCode
  146).
- **[Call stack](https://en.wikipedia.org/wiki/Call_stack)** — the runtime's stack of **frames**,
  one per active function call, holding its arguments, local variables and return address; a call
  pushes a frame and a return pops it. Its size caps recursion depth (stack overflow), which is why
  deep recursion gets rewritten with an explicit stack.
- **[Hash map](https://en.wikipedia.org/wiki/Hash_table)** — key → value storage: a hash function
  turns the key into a bucket index, giving O(1) average insert, lookup and delete (O(n) in the
  worst case, when many keys collide; collisions are handled by chaining or open addressing). No
  order. The workhorse of counting, deduplication and two-sum-style lookups; caches and key-value
  stores are hash maps spread over machines.
- **[Binary tree](https://en.wikipedia.org/wiki/Binary_tree)** — every node has at most two
  children. A **[binary search tree](https://en.wikipedia.org/wiki/Binary_search_tree)** keeps left
  < node < right, so search and insert are O(log n) when balanced (red-black, AVL) and O(n) when
  not. A **[heap](https://en.wikipedia.org/wiki/Heap_(data_structure))** keeps each parent ≤ its
  children (a min-heap): the minimum in O(1), push and pop in O(log n), which makes it a priority
  queue. Database indexes use B-trees, the many-children, disk-friendly relative. LeetCode writes a
  tree in level order with `null` for a missing child, as this block does.
- **[Matrix / grid](https://en.wikipedia.org/wiki/Matrix_(mathematics))** — a 2-D array addressed as
  `[row][col]`, O(1) per cell. Grids model maps and boards (BFS and DFS over neighbours, number of
  islands), and dynamic-programming tables store the answers to subproblems (edit distance, longest
  common subsequence).
- **[Shards](https://en.wikipedia.org/wiki/Shard_(database_architecture))** — **sharding** splits
  one dataset horizontally across several databases, each holding the rows for part of a **shard
  key**: by **range** (A–H, I–P…: range queries stay easy, hot spots are likely), by **hash** of the
  key (an even spread, but range queries touch every shard), or through a lookup directory. Scales
  writes and storage past one machine, at the cost of cross-shard queries and transactions and of
  rebalancing. Choose a key that spreads load evenly and keeps each request on one shard, such as
  `user_id`.
- **[Hash ring](https://en.wikipedia.org/wiki/Consistent_hashing)** — **consistent hashing**:
  servers and keys are hashed onto the same circle, and each key belongs to the first server
  clockwise from it. Adding or removing a server moves only about 1/N of the keys, where
  `hash(key) % N` moves nearly all of them; **virtual nodes** (many points per server) even out the
  load. Used by Cassandra, Amazon's Dynamo, Memcached clients and CDNs.

### Database

**[SQL table](https://dbml.dbdiagram.io/docs/)** — a relational table, written as a DBML `Table` block
(the same text as a schema board and dbdiagram.io). The words its columns use:

- **Primary key** `[pk]` — the column or columns that identify each row: unique, never null, one per
  table, indexed automatically. `increment` lets the database number it (`IDENTITY`, `SERIAL`,
  `AUTO_INCREMENT`). A UUID instead can be created by the client and is not guessable, at the cost
  of a bigger, less index-friendly key.
- **Foreign key** `[ref: > users.id]` — a column whose value must exist as a key in another table,
  so the database enforces the relationship. Index it; joins and cascading deletes go through it.
- **Relationship** — the `ref` operator says which: `>` many-to-one (many orders to one user), `<`
  one-to-many, `-` one-to-one, `<>` many-to-many, which a database stores as a join table.
- **`not null`, `unique`, `default`** — constraints: a value is required; no two rows may share the
  value (enforced by an index); the value used when an insert leaves the column out.
- **[Index](https://use-the-index-luke.com/)** — a separate sorted structure (a B-tree) that finds
  rows without scanning the whole table: faster reads, slower writes, more storage. A **composite
  index** such as `(aggregate_id, occurred_at)` serves queries that filter on its columns from the
  left: `aggregate_id` alone, or both, but not `occurred_at` alone.
- **Enum** — a column limited to a fixed list of values (`pending`, `paid`, `shipped`).
- **[Normalisation](https://en.wikipedia.org/wiki/Database_normalization)** — keep each fact in one
  place (repeated data moves into its own table, linked by a foreign key) so it cannot be updated in
  one place and forgotten in another; denormalise on purpose, and only where reads need the speed.

The templates in the Database tab:

- **Table** — an empty table with a `bigint` auto-increment primary key, to start from.
- **users** — the accounts table most systems begin with: a unique `email` (the login), a name and
  `created_at`.
- **orders** — a one-to-many child of `users`: `user_id` references `users.id`, `status` has a
  default, and money is an integer in the smallest unit (`total_paise`), never a floating-point
  number.
- **Join table** — resolves a many-to-many (users ⇄ roles): one row per pair, the two foreign keys
  together as a composite primary key so a pair cannot repeat, plus facts about the pair
  (`granted_at`).
- **Event log** — an append-only record of what happened (`type`, a `jsonb` payload, `occurred_at`)
  to each entity: the basis of audit trails, **event sourcing** (current state is the replay of the
  events) and the **transactional outbox** (write the event in the same transaction as the change,
  publish it to a queue afterwards). The `(aggregate_id, occurred_at)` index reads one entity's
  history in order.
