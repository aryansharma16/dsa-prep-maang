# Applications — the reference

The prose version, with the reasoning, is [**Applications** in the README](../README.md#applications).
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
  config/applications.js          every vocabulary, as tables: stages, sources,
                                  apply methods, round types and outcomes, the ceilings
  models/Application.js           the application, its rounds, questions, touchpoints;
                                  the derive hook, the timeline, both wire shapes
  models/ApplicationBoard.js      one per account: what each lane is called
  models/Resume.js                the CV library, one row per distinct file
  services/application.service.js ownership, stage rules, the due list, the report
  services/resume.service.js      hashing, dedupe, upload, serving a CV back
  services/media.service.js       `privateDownloadUrl` — the signed API download
  middleware/upload.js            `singleResume` — PDF and Word only
  controllers/application.controller.js   handlers + the exported zod schemas
  routes/application.routes.js    the route table
  config/modules.js               `{ key: 'applications', …, defaultHidden: true }`
  config/viewScopes.js            `'applications'` in the allowlist
  routes/index.js                 router.use('/applications', requireModule('applications'), …)

client/src/
  pages/Applications.jsx          the page: state, writes, which view is on screen
  filters/applications.js         what the pipeline can be narrowed by
  components/applications/
    vocab.js  time.js             labels for the server's keys; dates and money
    PipelineView  StageColumn  ApplicationCard  CompanyMark      the board
    ApplicationDrawer  Timeline  RoundList  RoundModal  QuestionList
    TouchpointList  OfferPanel  PostMortem  ResumeField          the drawer
    AddApplicationModal  ColumnLabelsModal                       dialogs
    FunnelPanel  DueBadge                                        outside the board
    views/  TableView  CalendarView  FeedView  InsightsView  WeeklyChart
```

The top bar mounts `DueBadge` (in `layout/AppShell.jsx`), Stats mounts
`FunnelPanel`, and `/docs` has a section gated on the module.

---

## Data model

Three collections. All carry `user`, and `timestamps: true`.

### `Application`

One document per application; rounds embedded, questions embedded inside those.
The README argues it; the numbers are that a hunt is tens of applications with a
handful of rounds each, and the one read that does not want the deep half — the
board — drops it with `-rounds.questions`.

| field | |
|---|---|
| `stage` | one of nine, fixed — see below |
| `order` | position in its lane |
| `company` · `companySlug` | the slug is derived on save, indexed, and is the logo key |
| `role` · `team` · `level` · `employment` · `location` · `workMode` | |
| `links[]` | `{ label, url }`, up to 8 |
| `jdText` | the pasted description; nothing reads it yet |
| `source` · `sourceNote` | where you found it |
| `applyMethod` | how you sent it; `''` means not recorded, and is the default |
| `referrer` | `{ name, title, relationship, contact, askedAt }` — **absent**, not empty, when nobody referred you |
| `contact` | the recruiter, same shape; absent when unknown |
| `resume` | `{ id, label, url }` — a reference into the library *and* a snapshot of it |
| `appliedAt` · `followUpBy` | `appliedAt` is set the first time a card leaves the wishlist, and is editable |
| `reached` | `{ applied, screening, in_process, offer, accepted }` — first date each was entered; monotone |
| `rounds[]` | see below |
| `touchpoints[]` | `{ at, kind, fromThem, note }` |
| `comp` | `{ currency, expected, offered, base, bonus, joiningBonus, esop, esopNote, receivedAt, decideBy, notes }` — absent until there is an offer; **amounts in whole units**, rupees not lakhs |
| `postMortem` | `{ round, roundType, roundLabel, theirWord, myRead }` — a ref and a snapshot |
| `closedAt` · `closedReason` | `closedAt` stamped on entering a closed stage, cleared on leaving one |
| `excitement` · `priority` · `tags` · `notes` | |
| `nextRoundAt` · `lastActivityAt` · `firstReplyAt` · `roundCount` · `questionCount` | **derived** — recomputed in `pre('save')`, never accepted from a request |
| `deletedAt` · `deletedBy` | soft delete |

A round:

| field | |
|---|---|
| `type` | one of 18, grouped by family: `screen` (recruiter_screen, oa, aptitude, group_discussion), `technical` (take_home, dsa, hld, lld, core_cs, sql, domain, project_deep_dive), `behavioural` (hiring_manager, bar_raiser, culture_fit, leadership), `closing` (offer_discussion), `other` |
| `label` · `order` | what the company called it; the sequence they put it in |
| `scheduledAt` · `rescheduledFrom[]` | a date change pushes the old one; the outcome is untouched |
| `durationMinutes` · `mode` · `interviewers[]` | |
| `outcome` · `outcomeAt` | `scheduled · awaiting · passed · failed · cancelled · no_show` |
| `feeling` · `notes` | |
| `questions[]` | `{ text, answer, rating, topic, notes, order, addedAt, problem }` — `rating` is `nailed · ok · fumbled · blank`, or `''` for ungraded; `problem` is an unused seam |
| `questionCount` | stored, because the board read projects the questions away |

**Every write is `load → mutate → save()`**, through `ownedApplication`. An
`updateOne` with `arrayFilters` would skip the derive hook and leave the counts
and `nextRoundAt` wrong.

#### Stages

| key | lane | kind | rank | in the funnel |
|---|---|---|---|---|
| `wishlist` | Wishlist | open | 0 | no |
| `applied` | Applied | open | 1 | yes |
| `screening` | Screening | open | 2 | yes |
| `in_process` | In Process | open | 3 | yes |
| `offer` | Offer | open | 4 | yes |
| `accepted` | Offer | closed | 5 | yes |
| `rejected` · `ghosted` · `withdrawn` | Closed | closed | — | yes |

A drop into a lane sets that lane's first stage; Closed resolves to `rejected`.
Declining an offer is `withdrawn` + `closedReason: 'declined_offer'`.

#### Indexes

```js
{ user: 1, deletedAt: 1, stage: 1, order: 1 }   // the board, and every report's $match
{ user: 1, deletedAt: 1, nextRoundAt: 1 }       // what is coming up
{ user: 1, companySlug: 1, appliedAt: -1 }      // "have I applied here before" — includes deleted rows on purpose
```

No unique index. Two roles at one company, and re-applying later, are separate
rows.

### `ApplicationBoard`

One per account, created on first read and **reconciled** on every read, so a
lane added to `config/applications.js` later appears on existing boards.

| field | |
|---|---|
| `columns[]` | `{ key, label, hue, order, hidden }` — `key` immutable, six of them |
| `defaultCurrency` | pre-fills a new offer |
| `staleAfterDays` | 3–180, default 21 — when a live card is drawn as quiet |

Deleting it loses the lane names and nothing else. The report never reads it.

### `Resume`

One row per distinct file per account.

| field | |
|---|---|
| `hash` | SHA-256 of the bytes, or of `link:<normalised url>` for a pasted link |
| `label` · `name` | your name for it; the original filename |
| `source` | `upload` or `link` |
| `url` | the Cloudinary URL, or the pasted link — **not** how an upload is opened; see below |
| `publicId` | `maang-prep/resumes/<userId>/<sha256>.<ext>`; null for a link |
| `bytes` · `format` | |
| `usedCount` | live applications naming it — recounted, never incremented |

```js
{ user: 1, hash: 1 }  unique   // the dedupe, enforced by the database
{ user: 1, createdAt: -1 }     // the picker
```

---

## API

Everything is under `/api/applications`, behind `requireAuth`, `writeLimiter`
and `requireModule('applications')`. Literal paths are declared above `/:id`.

### The page

| | | |
|---|---|---|
| `GET` | `/` | `{ board, applications }` — cards, question bodies, notes and JD left out |
| `GET` | `/:id` | `{ application, prior }` — the whole record with `timeline`, and earlier applications to the same company |
| `GET` | `/due` | `{ upcoming, overdue, count }` — each item carries `kind` (`round` · `decision` · `follow_up`) and `at` |
| `GET` | `/stats` | `{ totals, funnel, bySource, byMethod, kills, reply }` |
| `GET` | `/feed` | `{ events }` — every application's timeline, merged, newest first, capped at 400 |
| `GET` | `/lookup?company=` | `{ prior }` — the add form's warning |

### Applications

| | | |
|---|---|---|
| `POST` | `/` | create — `company` is the only required field; takes `stage` and `resumeId` too |
| `PATCH` | `/:id` | any field above except `stage`; `resumeId: null` detaches the CV; `null` clears `referrer`, `contact` and `comp` |
| `DELETE` · `POST` | `/:id` · `/:id/restore` | soft delete, and undo |
| `POST` | `/move` | a drag — `{ id, column | stage, ids }`, `ids` being the destination lane in drawn order |
| `PATCH` | `/:id/stage` | `{ stage }` or `{ column }` — the drawer and the chip |
| `PUT` | `/:id/post-mortem` | `{ roundId, theirWord, myRead }` — type and label are read off the round |
| `PATCH` | `/board` | `{ columns: [{ key, label, hue, order, hidden }], defaultCurrency, staleAfterDays }` |

### Rounds, questions, touchpoints

| | | |
|---|---|---|
| `POST` · `PATCH` · `DELETE` | `/:id/rounds` · `/:id/rounds/:roundId` | |
| `POST` · `PATCH` · `DELETE` | `/:id/rounds/:roundId/questions` · `…/questions/:questionId` | |
| `POST` · `PATCH` · `DELETE` | `/:id/touchpoints` · `/:id/touchpoints/:touchpointId` | |

Every one of these answers `{ application }` in full, because each changes a
derived field or the timeline.

### The CV library

| | | |
|---|---|---|
| `GET` | `/resumes` | the library, newest first |
| `POST` | `/resumes/check` | `{ hash }` → `{ resume }` or `{ resume: null }` — asked **before** uploading |
| `POST` | `/resumes` | multipart `file` (+ optional `label`) — `201` new, `200` when the server found the hash after all |
| `POST` | `/resumes/link` | `{ url, label }` — same `201`/`200` rule |
| `PATCH` | `/resumes/:resumeId` | `{ label }` — also rewrites the snapshot on every application using it |
| `DELETE` | `/resumes/:resumeId` | removes the row and the Cloudinary object; applications keep their snapshot |
| `GET` | `/resumes/:resumeId/file` | the CV itself: an upload is streamed `inline`, a link is a `302` |

---

## Errors

`{ error: { message, code } }`, as everywhere.

| code | status | |
|---|---|---|
| `VALIDATION` | 400 | zod, naming the field — includes an unknown stage, source, method or round type |
| `NO_STAGE` · `BAD_STAGE` | 400 | a move with neither a stage nor a lane |
| `TOO_MANY_APPLICATIONS` · `_ROUNDS` · `_QUESTIONS` · `_TOUCHPOINTS` · `_RESUMES` | 400 | the ceilings below |
| `BAD_URL` | 400 | a pasted CV link that is not http(s) |
| `NO_FILE` · `BAD_FILE_TYPE` · `FILE_TOO_LARGE` · `BAD_FIELD` | 400 | the upload middleware |
| — | 404 | any application, round, question, touchpoint or CV you cannot see — and the whole module while it is hidden |
| `UPLOADS_DISABLED` | 503 | no Cloudinary credentials; pasted links still work |
| `UPLOAD_FAILED` | 400 / 502 | Cloudinary refused, or was unreachable |
| `RESUME_UNAVAILABLE` | 502 | the signed download for `/file` failed |
| `RATE_LIMITED` | 429 | uploads are behind `uploadLimiter` as well |

**404, never 403**, for anything that is somebody else's.

---

## Limits

| | |
|---|---|
| live applications per account | 500 |
| rounds per application · questions per round | 20 · 40 |
| touchpoints · interviewers per round · links · tags | 100 · 6 · 8 · 12 |
| CVs per account | 40 |
| CV file | 8 MB; PDF, DOC or DOCX |
| question · answer · round notes · application notes · JD | 600 · 4,000 · 4,000 · 8,000 · 20,000 characters |
| `staleAfterDays` | 3–180 |
| `/due` window | 7 days ahead |
| `/feed` | 400 events |

---

## Client

### State

`pages/Applications.jsx` holds the board and the card list from one request,
and the open drawer's full record from a second. A write from the drawer answers
the whole application, which replaces both copies (`absorb`). A **drag** is the
one optimistic write — the lane is redrawn at once and a failure reloads rather
than trying to invert the move. Everything else waits for the server, because
almost every write changes a derived field whose rules live there.

### Views

`useLocalState('applications:view')`. All five read the filtered, searched list;
none fetches, except **Timeline**, which asks `/feed` so it words events with
the same `applicationTimeline` the drawer uses. **Insights** draws its weekly
chart from the filtered cards and its tables from `/stats`, which is the whole
hunt — a baseline for the filtered chart to be read against.

### Opening a CV

`openResume` in `ResumeField.jsx`: opens the tab inside the click, calls
`/auth/me` through the API client so an expired access token is refreshed,
then points the tab at `/api/applications/resumes/:id/file`. A CV whose library
row has been deleted opens its stored URL instead.

### Hashing

`crypto.subtle.digest('SHA-256')` in the browser, before any upload. It exists
only on a secure origin (https or localhost); elsewhere the field uploads
straight away and the server's own check dedupes.

---

## Verifying it

```bash
cd server && npm run dev      # :4000
cd client && npm run dev      # :5173
```

**The gate.** As the super admin, Applications shows with a **Dev** badge. As
anyone else, `GET /api/applications` answers **404** worded like `notFound`, the
nav item is absent, and `/applications` falls through to the roadmap.

**The pipeline.** Add one with only a company name — it lands in Applied with its
logo. Drag it to Screening: no form, and the timeline gains "Reached Screening".
Drag it to Closed: it says Rejected; change the chip to Ghosted. Drag it back
out: the closed date clears and how far it got does not.

**Rounds.** Add a recruiter call yesterday, *passed*, and a DSA round tomorrow.
The card shows tomorrow's round and the top-bar reminder names it. Move the old
round's date: its timeline node moves. Log three questions with Enter; leave one
ungraded and confirm it stays ungraded rather than "blanked". Delete the DSA
round after pointing a post-mortem at it: the post-mortem still names the kind.

**CVs.** Upload a PDF. Attach the *same file renamed* to a second application:
the toast says it was already in the library and the network tab shows no
upload. Paste a Drive link twice: one row. Click the CV: it opens inline, from
`/api/applications/resumes/…/file`, not from `res.cloudinary.com`.

**The numbers.** With a few applications across two sources and both apply
methods, the source table splits referred from cold, the method table separates
Easy Apply, and "where they end" includes a ghosted application's last round.

**Views and screens.** All five views over the same filtered list; the chart's
axis text stays small on a wide window; light and dark; 390px, where the board
scrolls sideways and the calendar collapses to dots.

---

## Operating it

**No migration.** All three collections are created on first use.
`defaultHidden: true` means the first deploy shows nothing to anybody but the
super admin; switching it on is **Admin → Modules**.

**Cloudinary will not deliver a PDF publicly on a new account**, and the app
does not need it to — CVs are served through `/file`, which uses a signed API
download that setting does not cover. Do not "fix" it by linking the CDN URL:
it will 401 on any account with the default setting, and it would make a CV
readable by anyone the link reaches.

**Deleting an application does not delete its CV.** The CV belongs to the
library and may be attached elsewhere; only deleting it from the library removes
the Cloudinary object.

**Hiding the module deletes nothing.** Applications, boards and CVs stay; the API
answers 404 and the nav item goes.
