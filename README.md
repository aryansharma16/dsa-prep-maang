# Ember

A pattern-first interview prep tracker. The first module is the DSA roadmap:
429 curated problems ordered as a curriculum — arrays → two pointers → prefix
sum → sliding window → … → DP — with real company tags, one-click progress
tracking and a spaced-repetition revision queue. System design and the rest
follow the same shape.

React + Vite · Node/Express · MongoDB Atlas · Cloudinary. JavaScript throughout.

The product name lives in `client/src/brand.js` and nowhere else — the sidebar,
both auth pages and the document title read from it, so renaming is one edit.

---

## What's in it

| | |
|---|---|
| **Roadmap** | 429 problems in 22 patterns, filters, a configurable table, inline statements and notes |
| **Pattern guides** | A full-screen reader per pattern — ~2,000 words, Java and C++ side by side |
| **Revision** | A spaced-repetition queue on a 3/7/21/60-day ladder |
| **Assistant** | Chat across Gemini, Cerebras, DeepSeek and Grok — pick a model or let it route per question, attach the problem you are on, and keep every thread |
| **Stats** | Solved ring, year-long heatmap, streaks, weakest patterns, company coverage |
| **Profile** | Your numbers, plus a profile picture uploaded to Cloudinary |
| **Auth** | Email + password, JWT in httpOnly cookies, silent refresh |
| **Motivation** | A line under every page heading, chosen from what you have actually solved |
| **Admin** | Four roles, user management, content editing, a guide block editor and an audit log |

## Running it

```bash
# 1. Backend
cd server
cp .env.example .env          # fill in MONGO_URI and the two JWT secrets
npm install
npm run seed                  # fetch sources -> curate -> write to MongoDB
npm run seed:guides           # the 22 pattern guides
npm run dev                   # http://localhost:4000

# 2. Frontend (second terminal)
cd client
npm install
npm run dev                   # http://localhost:5173
```

`client/.env` sets the dev port and proxy target. Vite only exposes
`VITE_`-prefixed variables to the browser, so `PORT` and `API_URL` are read by
`vite.config.js` instead. The port is `strictPort`, so a clash fails loudly
rather than silently moving to another port and breaking your CORS config.

Atlas needs **Network Access → 0.0.0.0/0** (or your IP) or the seed will hang
on connect.

Cloudinary credentials are optional — see [File uploads](#file-uploads). Without
them everything works except uploading a profile picture, which answers
`503 UPLOADS_DISABLED`.

### Seed scripts

| command | does |
|---|---|
| `npm run seed:fetch` | downloads the source lists into `data/raw/` |
| `npm run seed:curate` | ranks, dedupes and assigns patterns |
| `npm run seed:db` | upserts problems and patterns into MongoDB |
| `npm run seed` | all three, in order |
| `npm run seed:guides` | writes the pattern guides |
| `npm run seed:motivation` | writes the 160 motivational lines |
| `npm run seed:logos` | pre-warms the company logo cache |
| `npm run ai:draft` | drafts new motivational lines with Gemini, for you to curate |

## The curriculum

22 patterns in learning order. Inside each, problems run easy → hard; that
ordering *is* the ramp.

| | | |
|---|---|---|
| Arrays & Hashing | Two Pointers | Prefix Sum |
| Sliding Window | Strings | Binary Search |
| Stack & Monotonic Stack | Linked List | Binary Trees |
| Binary Search Trees | Heap / Priority Queue | Tries |
| Backtracking | Graphs (BFS/DFS) | Advanced Graphs |
| Greedy | Intervals | 1-D DP |
| 2-D DP | Bit Manipulation | Math & Geometry |
| Design | | |

### Where the problems come from

| Source | Contribution |
|---|---|
| [Striver's SDE Sheet](https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems) | 180 of 191 (the rest are LeetCode-premium or duplicate listings) |
| [NeetCode 150 / Blind 75](https://github.com/neetcode-gh/leetcode) | 143 of 150 (7 are premium-only) · 69 Blind 75 |
| [Company tags](https://github.com/liquidslr/leetcode-company-wise-problems) | 20 companies, ask-frequency per problem |
| [LeetCode API](https://github.com/noworneverev/leetcode-api) | difficulty, topic tags, likes, statements on demand |

A problem's rank is `Σ(company weight × ask frequency)` plus a bonus for
appearing on a curated sheet. Every problem on Striver's SDE Sheet or NeetCode
150 is kept regardless of rank, so those sheets stay complete. Premium problems
are dropped — you can't open them.

Re-running the seed is safe: it upserts by slug, prunes retired problems, and
never touches your progress or the problems you added yourself.

## Pattern guides

Every one of the 22 patterns has a written guide behind the ⓘ on its heading —
roughly two thousand words on when to reach for the pattern, what the core idea
is, the variations, a language toolkit table, complexity, and the mistakes
people actually make. Java and C++ sit in tabs on the same code block.

It opens as a **full-screen reader**, not a side panel: prose that long needs a
readable measure and a way to navigate. The headings become a side rail with
scroll-spy, the prose is held to ~70 characters, and a progress line doubles as
the header's bottom border. Escape hands you back to the roadmap with its scroll
position intact.

Guides are stored as **typed blocks**, not HTML or Markdown:

| block | renders as |
|---|---|
| `heading` | a section title, and an anchor the side rail jumps to |
| `paragraph` · `bullets` | prose |
| `code` | a tab strip when it has more than one language variant, with copy |
| `callout` | a labelled box — `TIP` / `NOTE` / `WATCH OUT` |
| `table` · `image` · `video` · `links` | as you'd expect; video is a YouTube id, not a URL |

Each block is a React component, so nothing goes through
`dangerouslySetInnerHTML` and no sanitizer stands between the database and the
page. `PatternGuide` is its own collection rather than a field on `Pattern`,
because the roadmap aggregation `$lookup`s whole pattern documents — a guide
field would ship all 22 guides on every sidebar load.

A pattern with no guide answers `200` with `guide: null`, not `404`. It isn't an
error; the reader shows the blurb and the key techniques instead.

`editedAt` on a guide is what stops the seeder overwriting hand edits. Null means
"still exactly what was seeded" and the seeder is free to refresh it.

## Tracking

- **Status** — click the circle to cycle not started → attempted → solved
- **Flag** and **needs revision** — one click each
- **Statement** — expand a problem to read it inline, fetched from LeetCode on
  first open and cached in the DB afterwards
- **Notes** — inline, autosaving, with a 1–5 confidence rating
- **Log attempt** — optional two-tap popover for time spent and outcome
- **Revision queue** — solving schedules a review on a 3/7/21/60-day ladder,
  stretched or compressed by your confidence

### Filtering

The whole curated list — ~430 problems — ships in one response and the client
filters locally. Search and filters are instant, and the server keeps a single
query shape.

Difficulty · company · sheet · status, plus **Flagged** and **Needs revision**
toggles, and the search box in the top bar (`/`) covers titles, companies and
topic tags. Searching from Stats or Revision navigates you to the roadmap first,
rather than leaving you typing into a box that does nothing.

While anything is filtering, every pattern section expands and empty ones
disappear — a collapsed section that happens to hold your only match is a search
that looks like it found nothing.

### The problems table

Twenty-two columns exist; you choose which you see. **Columns** in the toolbar
opens the editor — show/hide, reorder, five width presets (`XS`–`XL`, scaled off
the width each column was designed at), and pinning.

Up to **three columns freeze to the left edge**. That cap is not arbitrary:
the pinned block doesn't scroll, so every column you freeze is width the
scrollable middle no longer has. The actions strip is always pinned right — it's
chrome, not data, and it should stay reachable however far you scroll. A shadow
marks each frozen edge, and only when something is actually hidden behind it.

The layout lives in localStorage, not on the account: it's a per-screen
preference — what fits a 27" monitor isn't what fits a laptop — and reading it
synchronously means the table paints in its real shape instead of flashing the
defaults while a request lands. A saved layout that outlived a deploy is
reconciled against the current column registry: unknown columns are dropped, new
ones are spliced in at their default position rather than appended.

### Revision queue

Everything you marked for revision, plus everything the schedule says is due,
with `3d overdue` / `Due today` / `Due in 5d` and overdue in red. Clearing a row
removes it immediately — and puts it back if the write actually failed, because
a queue that quietly shows fewer items than you have is worse than a slow one.

The ladder is 3 → 7 → 21 → 60 days, multiplied by confidence: 1 shrinks the gap
to 0.4×, 5 stretches it to 2×.

## Profile

Your picture, name and email, then joined date, solved count, current and
longest streak, active days, time logged, the solved ring, the activity heatmap,
your strongest patterns, company coverage, and the last eight problems you
solved. Recent solves are derived from the roadmap already in memory, so the page
costs one request.

**About** holds the optional details — bio, college, graduation year, location,
target role, GitHub, LinkedIn, LeetCode, website and target companies. Edit them
from that panel; a super admin can also edit them from the admin panel. Both use
the same `ProfileFields` component and the same zod schema
(`server/src/config/profileFields.js`), so the two forms cannot drift into
disagreeing about what a profile contains.

Link fields accept either a bare handle or a full URL — `aryansharma16` and
`https://github.com/aryansharma16` both work, and the panel shows the last path
segment rather than the whole URL. `PATCH /auth/me` needs no capability: it can
only ever reach the caller's own document. It does still run the reserved-address
check, or anyone could rename themselves onto `SUPER_ADMIN_EMAIL` and be promoted
at their next sign-in.

### Profile picture

**Add photo** on the profile card uploads to Cloudinary; the picture then shows
in the top bar too. Both read `user.avatar.url` from the same auth context, so a
new photo can never appear in one place and not the other.

Uploads are cropped to a 512px square at upload time with `gravity: face`
(falling back to a centre crop, so a logo or a cartoon isn't mangled) and served
as an auto-format, auto-quality image. Cropping on the way *in* means the stored
bytes are the bytes served — no reason to keep the 4000px original a phone camera
produces when it's only ever shown at 72px.

With no picture you get initials: from your name, tinted by a hue derived from
your email so it's stable across devices. All six colours clear 4.5:1 against the
near-black initials, so they stay legible in either theme. A picture URL that
fails to load falls back to the same initials rather than a broken-image icon.

## Stats

A solved ring split by difficulty, a year-long activity heatmap with current and
longest streaks, your weakest patterns, and per-company coverage (solved *and*
how many that company asks — 12 solved means nothing on its own).

The heatmap ramp is a single hue with monotone lightness, stepped separately for
light and dark rather than flipped, and validated for contrast against each
surface. Those five `--heat-*` tokens in `styles/tokens.css` are computed, not
hand-picked — re-run the check if you change them. The by-pattern panel has a
table view for the same numbers without relying on colour.

Every change writes to the screen first and persists in the background. If the
request fails the row rolls back and a toast says so.

## Keyboard

| key | |
|---|---|
| `j` / `k` | move between problems |
| `s` | toggle solved |
| `f` | flag |
| `r` | needs revision |
| `n` | notes |
| `o` | open the problem in a new tab |
| `/` | search |
| `Esc` | leave the search box, or close a dialog or the guide reader |
| `Ctrl` `B` | collapse the sidebar |

Single-key shortcuts are suppressed while you're typing in a field and while any
dialog or the guide reader is open.

## Signing in

Email and password. The access token lives 15 minutes and the refresh token 30
days, both in httpOnly cookies — so neither is reachable from JavaScript, and
neither is stored anywhere the page can leak. On the first 401 caused by expiry
the client refreshes silently and replays the request; a second failure means the
session is genuinely gone and the app drops to the login screen rather than
leaving you on a page where every action fails.

`/auth/me` is deliberately retryable. Excluding it would log you out on any
reload more than fifteen minutes after signing in, despite a perfectly valid
refresh token.

### The auth pages

A split layout: the form on the left, and on the right a panel built from the
app's own vocabulary — pattern rows, progress bars, mono fractions — rather than
a stock illustration. It's the product drawn at rest, and it's completely inert:
no data, no requests, nothing to load before the form is usable. Below 940px the
showcase drops out and the form is the page.

Behind the form is a **canvas web that reacts to the cursor**: nodes drift, any
two within 145px share an edge, and nearby nodes lean toward the pointer. Every
few seconds — and whenever the cursor settles somewhere new — a breadth-first
search runs from the node nearest the pointer and the edges light up ring by
ring as it discovers them. The traversal the roadmap spends a whole pattern on,
running on the login screen.

Two things that make it work rather than merely exist:

- **Density and link distance are one decision.** At ~1 node per 9,500px² with a
  145px reach the average node has about seven neighbours — connected enough for
  a wave to cross the panel, sparse enough to still read as a web. Sparser than
  that and BFS dies two rings out.
- **Nodes stay lit for less time than the search takes to cross.** Longer, and
  every edge is lit at once — a flood, not a traversal, and bright enough to
  argue with the Sign in button.

It takes no pointer events and tracks the cursor from the window, so it keeps
reaching while you type. A radial scrim lays page colour under the middle of the
column so no line ever crosses the text. Under `prefers-reduced-motion` it draws
once and never animates; a hidden tab stops the loop.

## File uploads

Cloudinary, behind `services/media.service.js`. Callers hand over a buffer and a
folder and get back a record to store — they never touch the SDK. Profile
pictures are the only user today; documents reuse `uploadBuffer` as-is, with a
different folder and `resourceType`.

```
uploadBuffer(buffer, { folder, publicId, resourceType, transformation, tags })
destroyAsset(publicId)          // never throws
assetUrl(publicId, transform)   // one upload, any size, rendered on demand
folderFor('avatars')            // everything under one prefix
```

Nothing touches disk. Multer holds the file in memory and it streams straight
out, which matters on a host with an ephemeral or read-only filesystem.

Four decisions worth knowing:

- **Credentials never block boot.** Upload is one feature; a missing key fails
  that one request with `503 UPLOADS_DISABLED` instead of taking the roadmap
  down with it. `GET /api/health` reports `uploads` and `ai` as `true|false`, because when a
  picture won't save the first question is whether this deployment has the keys.
- **The real type check is Cloudinary, not the mime header.** `resource_type:
  'image'` means it decodes the file and rejects anything that isn't an image —
  a guarantee `Content-Type` can't give, since the client writes it. The multer
  allowlist is there to catch the honest mistake before spending a round trip.
- **`destroyAsset` never throws.** Callers are deleting a *replaced* file; the
  new one is already saved. Failing the user's request because old bytes outlived
  their record is the wrong trade — an orphan in the cloud is cheaper than a
  broken save.
- **Avatars use a stable `public_id`** (the user's `_id`), so an interrupted
  upload can't leave two live avatars for one account. `invalidate: true` stops
  CDN caches serving the old face for hours.

Auth middleware runs **before** multer on the upload route, so an
unauthenticated request is turned away before anyone can push five megabytes into
the process heap. The cap is 5MB for images, 10MB for documents.

| env var | |
|---|---|
| `CLOUDINARY_URL` | `cloudinary://<key>:<secret>@<cloud>` — copy it straight off Cloudinary's API Keys screen |
| `CLOUDINARY_CLOUD_NAME` / `_API_KEY` / `_API_SECRET` | the same thing in three parts, for hosts where a URL-shaped secret is awkward |
| `CLOUDINARY_FOLDER` | prefix for everything this app creates, default `maang-prep` |

`CLOUDINARY_URL` wins when both are set.

### Note attachments go to S3

Images and PDFs dropped into a note take a second path, behind
`services/s3.service.js`, with `services/file.service.js` as the seam between
the bytes in the bucket and the rows that index them. Same bargain as
Cloudinary — callers hand over a buffer and a key, nobody outside those files
imports the SDK.

The difference worth knowing is that S3 is a byte store and Cloudinary is not.
Cloudinary decodes what you send it and refuses anything that isn't an image;
S3 will happily accept a renamed executable, label it `image/png` because the
request said so, and serve it back with that type forever. So the check that
came free there is rebuilt here in `sniffType()`, from the file's own leading
bytes. Stored types are sniffed, never echoed from the request.

There are exactly two env vars, and no credential:

| env var | |
|---|---|
| `AWS_REGION` | `ap-south-1` |
| `AWS_S3_BUCKET` | the bucket everything lands in |
| `AWS_S3_PREFIX` | key prefix for everything this app writes, default `maang-prep` |

The absence of an access key is the design, not an omission. On EC2 the
instance role supplies short-lived credentials through the SDK's default
provider chain and rotates them automatically; setting `AWS_ACCESS_KEY_ID`
would shadow that and replace a rotating credential with a permanent one.
`npm run s3:probe` proves the whole path end to end from the box.

Full detail: [docs/aws-infrastructure.md](docs/aws-infrastructure.md) for what
exists and why, [docs/aws-runbook.md](docs/aws-runbook.md) for deploying,
verifying and fixing it.

## Admin panel

`/admin`, for the owner and a small team. Four roles, and the split is
deliberate: **the curriculum belongs to the super admin alone**; guides and user
administration are delegable.

|                        | user | admin | dev_member | super_admin |
|------------------------|:----:|:-----:|:----------:|:-----------:|
| Open the panel         |  –   |   ✓   |     ✓      |      ✓      |
| View problems/patterns |  –   |   ✓   |     ✓      |      ✓      |
| **Edit problems**      |  –   |   –   |     –      |      ✓      |
| **Edit patterns**      |  –   |   –   |     –      |      ✓      |
| Edit pattern guides    |  –   |   ✓   |     ✓      |      ✓      |
| View users             |  –   |   ✓   |     ✓      |      ✓      |
| Edit user details      |  –   |   ✓   |     ✓      |      ✓      |
| Set password / revoke  |  –   |   ✓   |     –      |      ✓      |
| Assign roles           |  –   |   –   |     –      |      ✓      |
| Delete an account      |  –   |   –   |     –      |      ✓      |

**This is not a ladder**, which is why `config/roles.js` is a capability set per
role rather than a numeric rank. `dev_member` writes guides but must never touch
a password; `admin` sets passwords but is not "above" dev_member. A rank
comparison cannot express that without lying about one of them. The server sends
the caller's capability list on `GET /auth/me`, so the UI hides what it cannot
do without keeping a second copy of this table in JSX — and every route still
checks for itself.

A learner who types `/admin` is redirected home. Not a 403 page: that would
confirm the route exists.

### The super admin is pinned, not assigned

`SUPER_ADMIN_EMAIL` in `server/.env`. The role is re-asserted on boot, on
register and at every login, and **no API path can grant or revoke it** — the
role enum on the endpoint does not contain `super_admin`, so the request fails
validation before a handler runs.

Two guards close escalation paths that the matrix above hides, and neither is
obvious:

- **A super admin target is off limits to everyone but themselves.** `admin`
  holds "set password" — so without this, an admin sets the owner's password and
  signs in as them. Two clicks to own the site.
- **The pinned address cannot be moved onto or off any account.** `admin` and
  `dev_member` can both edit a user's email. Without this, either one moves
  `SUPER_ADMIN_EMAIL` off the owner, puts it on their own account, signs back in
  — and the login hook promotes them.

### Content protection

Editing anything in the panel stamps `editedAt`, and the seed scripts skip
edited content. Without that, `npm run seed:db` would silently revert every
admin edit on its next run — it `$set`s all four pattern fields and every
problem field — and its prune would delete an admin-created shared problem
*along with every user's progress on it*.

| script | protection |
|---|---|
| `seed:db` patterns | skips `editedAt != null` |
| `seed:db` problems | skips `editedAt != null` |
| `seed:db` prune | never touches `editedAt != null`, `--force` or not |
| `seed:guides` | already skipped edited guides; the panel now sets the stamp |
| `seed:motivation` | skips `editedAt != null`; prunes only rows that carry a seed `key` |

`--force` resets `editedAt` and hands content back to the repo. The prune is
deliberately exempt from `--force`: overwriting an edit loses text that also
lives in git, while pruning loses other people's progress permanently.

### The guide editor

A block editor matching the typed-block schema, so it cannot produce invalid
data. Blocks are added, reordered by drag or arrow, duplicated and deleted; the
right pane is a live preview rendered by the **real `GuideBlocks`** component,
fed the exact payload that will be saved — so it is a guarantee about the result
rather than an approximation of it.

Details that matter more than they look:

- Blocks carry a **client-only key**. They have no id, so an index key would
  send the cursor, the collapsed state and the open code tab to the wrong block
  the moment you reorder.
- The preview is `useDeferredValue`'d. `GuideBlocks` re-runs the syntax
  highlighter over every code block, so previewing on each keystroke stutters on
  a 2,000-word guide.
- A **video block stores a bare YouTube id**, and the field extracts one from
  any URL you paste. The reader interpolates it straight into the embed src, so
  a full watch URL would render a silently dead iframe.
- The **table editor enforces one cell per column** in its mutation helpers, not
  at save. `GuideBlocks` maps rows blind — a short row silently loses a cell.

### Warnings

Confirmation on everything is how you train the reflex that defeats the one
dialog that matters, so this is tiered:

| action | treatment |
|---|---|
| Delete an account · delete a shared problem | **type the email or title to confirm** |
| Change a role, an email, or a password · revoke sessions · hand a guide back | `ConfirmDialog`, naming the consequence |
| First save of a guide the seeder still owns | explains it stops `seed:guides` refreshing it — **once**, never again |
| Later saves of that guide | straight through; the skip is already true |
| Reorder, edit or delete a *draft* block | **nothing.** Undo, not confirm — it has not left the browser |

### Activity

Every content and user change is recorded with who, what and when, filterable by
action and by person. The actor's email is copied onto the row rather than
joined, so history stays readable after the account that made it is deleted —
which is exactly when you want to read it.

## Motivation

A single line under every page heading, chosen server-side from what you have
actually done. Not a quote of the day — that becomes wallpaper inside a week.

```
0 solved today            ->  "Stop planning the week. Solve one, then decide
                               whether you have another in you."
solved a Hard today       ->  "That one was supposed to be hard. You finished it
                               anyway, which is the entire point."
Graphs at 3 of 28         ->  "Graphs is where you are thinnest: 3 of 28. Good.
                               Now you know what to attack."
100-day streak            ->  "100 days. Very few people reach this. Most of them
                               are not the ones who felt ready."
```

`GET /api/motivation?surface=roadmap` builds a **signals** object — solved
counts, today's solves, the streak, the weakest pattern, the revision backlog —
and hands it to every line's **trigger**. The trigger vocabulary is a table in
`server/src/config/motivationTriggers.js`, in the same spirit as `roles.js`:
predicates live in code, and the admin panel only ever picks a key from it plus,
where it makes sense, one number. A rule the panel produces cannot be invalid.

Placeholders — `{pattern}`, `{streak}`, `{solved}`, `{remaining}`, `{due}` and
the rest — are filled from the signals. **A line still holding an unfilled token
is discarded and the next candidate used**, so a line asking for `{pattern}` on
an account with no weak pattern quietly loses rather than rendering braces at
somebody.

Four decisions worth knowing:

- **Specificity is banded, not ranked.** The numbers fall into three groups, and
  what separates them is how long a condition stays true. Persistent state — a
  weak pattern, a streak, a revision backlog — sits at 40–52, and the picker
  draws from everything within 20 points of the winner, so those rotate against
  each other instead of one owning the page for months. Momentary events sit at
  68–95 and sweep the lot, because when you have just solved a Hard that is the
  only thing worth saying.
- **Thresholds are a ladder.** Six streak lines at 3, 7, 14, 30, 60 and 100 all
  match on day 100; only the highest rung you have reached stays in the draw.
  Without that, a hundred-day streak could be told that three days is "not
  impressive yet".
- **The pick holds still.** It is `fnv1a(user : surface : day : solved : today :
  streak)`, so it changes when the progress inside it changes and not otherwise.
  Navigating between pages does not reshuffle it; solving something does.
- **The signed-out page is handed no signals at all.** Every trigger except
  `always` tests something about a person, so a stranger can only ever match the
  generic pool. That falls out of the predicates rather than a filter on the
  public route, which is why adding a trigger cannot accidentally widen it.

The line is `.motivation` — a rule and some text, not a panel. It is a remark
about your progress, and a bordered card would put it in competition with the
data it is commenting on. It renders nothing at all when nothing matches.

### The sign-in page

`AuthLayout` promises "nothing to load before the form is usable", and it still
holds. A line from `components/layout/authLines.js` is in the bundle and paints
on the first frame; the public `GET /api/motivation/login` then replaces it if
and when it answers. The strip has a fixed two-line height, so nothing moves,
and with the server unreachable the page is exactly what it was before.

### Editing them

**Admin → Motivation.** Write a line, choose the condition, choose the pages,
set a weight. The threshold input appears only for conditions that take a
number, because the form is built from the server's catalogue rather than a
second copy of it in JSX.

**"What would I see right now?"** runs the real picker against your own signals
and shows the result for all five surfaces, with the numbers beside it. It is
the difference between choosing a condition and guessing at one.

The 160 shipped lines live in `server/scripts/seed/motivation-lines.js` and
follow the `editedAt` contract the rest of the content does: edit one in the
panel and `npm run seed:motivation` skips it from then on; `--force` hands it
back. Lines written in the panel have no seed `key`, which is what keeps the
prune from ever deleting them. The seeder also validates the content file before
it connects — an unknown trigger, an over-long line, or a token the condition
cannot fill stops the run rather than landing in the database looking healthy
and never once appearing.

## AI

Google Gemini, behind `services/gemini.service.js`. Callers hand over a prompt
and get back text or a parsed object; they never touch the SDK.

```
generateText(prompt, { system, model, temperature, maxOutputTokens, timeoutMs })
generateJson(prompt, { schema, ... })   // responseSchema, so the shape is a guarantee
aiEnabled()                             // and `ai` in /api/health
```

That indirection earns its keep faster here than anywhere else: `@google/generative-ai`
was retired in November 2025, `@google/genai` 2.x ships `models.generateContent`,
and Google's docs already describe a different shape again for the unreleased
3.x. When it moves, one function in that file changes.

Three places use it, and **none of them lets a learner prompt the model**:

- **A personal line, rewritten as your day moves.** Written from your own
  numbers — solved counts, streak, weakest pattern — and cached in `DailyLine`.
  It quotes live figures, so the moment you solve something it stops being true;
  the row stores the snapshot it was written from, and a line whose numbers have
  moved is **rewritten, never served stale**. That is bounded at **three calls
  per person per day** — enough for the shape of a session, and past it the
  curated pool answers instead, which interpolates live signals and so is never
  stale and never costs anything. Concurrent tabs are collapsed by an in-process
  single-flight keyed on the state being asked about, the way
  `logo.service.js` dedupes icon fetches.
- **"Draft with AI" in the panel.** Returns candidates and saves none of them.
  Everything starts unticked and is editable; only what you tick is written.
- **`npm run ai:draft`,** which writes candidates to `data/ai/` for you to curate
  into the content file by hand.

The seed corpus itself is written by hand, deliberately. A seed step that called
a model would produce different content on every run, which is exactly what the
idempotent upsert exists to prevent — what lands in git is copy someone read.

Four decisions worth knowing:

- **A missing key never blocks boot,** the same trade Cloudinary makes. It fails
  the one request that wanted a model with `503 AI_DISABLED`, and `/api/health`
  says whether this deployment has the key at all.
- **Every AI path has a non-AI answer.** No key, a new account, a slow model,
  output that fails validation — all of them fall through to the curated line.
  A motivational remark is the last thing in this app that should break a page,
  so `dailyLine` returns null on any failure and never throws.
- **The daily line is validated before it is shown.** One sentence, no line
  breaks, at most 240 characters, and it must contain a digit — a line citing no
  number means the model ignored the data, which is the generic quote this whole
  feature exists to avoid. Anything failing that is dropped for the curated pick.
- **No rate limiter, because the data model is the limit.** The unique
  `{user, day}` index plus the `generations` counter cap the daily line at three
  calls per person per day — `$inc`ed in the same write that stores the text, so
  the cap holds against the concurrency it exists to bound rather than against a
  read-modify-write two processes can both win. Drafting is behind
  `content:write` with a count capped at ten by its schema.

| env var | |
|---|---|
| `GEMINI_API_KEY` | from [AI Studio](https://aistudio.google.com/apikey). Optional; without it the AI features answer `503` and everything else works |
| `GEMINI_MODEL` | default `gemini-3.6-flash`. A variable rather than a constant because Google retires these on a schedule — `gemini-2.5-flash` shuts down in October 2026 |

## Theme

Dark by default, light on the toggle in the top bar, remembered in localStorage
and applied before first paint by an inline script in `index.html` — so the theme
never flashes on reload.

Light is a straight token swap in `styles/tokens.css`, not a filter. The syntax
highlighting palette is re-picked rather than lightened, because the dark theme's
pastels wash out completely on white.

## Adding your own problems

**Add** in the top bar takes a single URL. Paste a LeetCode link and the title,
difficulty and tags fill themselves in; paste anything else and you fill three
short fields. Your problems live in the same pattern sections as the seeded
ones and only you can see them.

Everything else the schema stores sits behind **More details**, so the common
path stays a paste and a save: topic tags and companies (chips, with companies
suggested from your existing list), an editorial link, a video link (any YouTube
URL shape — the id is extracted server-side), a starting status, and notes.
Status and notes are written to `Progress`, not `Problem`, so adding something
you already solved counts immediately.

### owner vs addedBy

`Problem` carries two user references, and they answer different questions:

| field | means | seeded value |
|---|---|---|
| `owner` | who can see it — a visibility rule | `null` (everyone) |
| `addedBy` | who created the record — provenance | `null` (from the seed) |

They match for every user-added problem today. They are separate so that
promoting a problem into the shared list stays possible: `owner` would go `null`
while `addedBy` keeps pointing at whoever contributed it. Collapsing them into
one field would destroy that information permanently.

## Shared UI

`components/ui/Modal.jsx` is the base dialog — focus trap, Escape, backdrop
click, focus restored to whatever opened it, and `role="dialog"` wired to its
title. Children render raw below the header so a `<form>` can span the body and
footer; use the `.modal-body` / `.modal-foot` classes inside.

```jsx
{open && (
  <Modal title="Add a problem" onClose={close} initialFocus={urlRef}>
    <form onSubmit={submit}>
      <div className="modal-body">…</div>
      <div className="modal-foot">…</div>
    </form>
  </Modal>
)}
```

`ConfirmDialog.jsx` wraps it for yes/no questions (`tone="danger"` for
destructive ones). Cancel takes focus first, so Enter and Escape both do the
safe thing.

While any dialog is open, `isAnyModalOpen()` suppresses the page-level single-key
shortcuts — otherwise `s` would mark a problem solved behind the dialog. The
guide reader registers with the same hook, so it can never drift from a dialog on
the things that are easy to get wrong.

Sizes: `sm` (390px, confirmations), default (460px), `lg` (680px).

`PasswordField.jsx` is a password input with a reveal toggle. The toggle is
`tabIndex={-1}` on purpose: tabbing out of the password field should reach the
submit button, not a control you only want after a typo.

Toasts come from `ToastContext` — `toast()`, `success()`, `error()` — and render
in an `aria-live` region above every overlay, so a failed save is still visible
with a dialog open.

## Layout

```
server/
  src/
    config/      env, db connection
    models/      User, Pattern, Problem, Progress, PatternGuide, CompanyLogo,
                 AuditLog, Motivation, DailyLine
    routes/      route tables only
    controllers/ request/response
    services/    auth, leetcode, spaced repetition, media, logos, gemini,
                 audit, activity, motivation (signals, picker, daily line)
    middleware/  requireAuth, errorHandler, validate, upload
  scripts/seed/  fetch-sources -> curate -> seed
    guides/      one file per pattern, written with block constructors
  scripts/ai/    draft-motivations, for curating into the seed file
  data/raw/      committed source snapshots
  data/ai/       AI drafts awaiting review
client/
  src/
    api/         axios client + endpoints
    components/
      layout/    AppShell, Sidebar, AuthLayout, ParticleWeb
      problem/   table, guide reader, notes, statement, modals
      profile/   avatar upload
      stats/     solved ring, activity heatmap
      admin/     panel tabs, editors, the motivation corpus
      ui/        Modal, ConfirmDialog, Avatar, PhotoPreview, MotivationLine, Icons
    hooks/       useGuide, useMotivation, useLocalState, useTableLayout
    pages/       Login, Register, Roadmap, Revision, Stats, Profile, Admin
    store/       Auth, Roadmap, Toast contexts
    styles/      tokens, base, app
    brand.js     the product name, in one place
```

`route → controller → service`, models alongside. No repository layer, no DI.

### API

| method | route | |
|---|---|---|
| `POST` | `/auth/register` · `/auth/login` · `/auth/logout` · `/auth/refresh` | session |
| `GET` `PATCH` | `/auth/me` | the signed-in user, and editing your own details |
| `POST` `DELETE` | `/auth/me/avatar` | profile picture |
| `GET` | `/patterns` · `/patterns/:slug/guide` | curriculum and guides |
| `GET` | `/problems` · `/problems/:slug/description` | roadmap, statement on demand |
| `POST` `DELETE` | `/problems` · `/problems/lookup` · `/problems/:id` | your own problems |
| `GET` `PATCH` `POST` | `/progress/revision` · `/progress/:id` · `/progress/:id/attempt` | tracking |
| `GET` | `/stats` | profile and stats pages |
| `GET` | `/motivation` | the line for one page, chosen from your progress |
| `GET` | `/motivation/login` | the sign-in page's line — **public on purpose** |
| `GET` | `/companies/:slug/logo` | cached brand icons — **public on purpose** |
| `GET` | `/health` | `ok`, uptime, whether uploads and AI are configured |
| — | `/admin/*` | the panel — see [Admin panel](#admin-panel) for the capability behind each route |

The logo and login-motivation routes are the only unauthenticated data routes.
The second is handed no signals at all, so a visitor we know nothing about can
only match the generic pool — a property of the trigger predicates, not a filter
on the route. The browser loads logos through an `<img>`, which cannot replay a
request after a silent token refresh — behind `requireAuth` every logo would
break fifteen minutes into a session.
Nothing there is private: it's a cache of publicly reachable brand icons keyed by
company name, fetched from Google's favicon service with DuckDuckGo as fallback,
stored in Mongo, and de-duplicated so twenty rows asking for the same logo on
first paint cost one fetch.

## Deploying

API on EC2 behind nginx at `api.algoforge.work`; client on Vercel (root
directory `client`).

**The client never calls the API host directly.** `client/vercel.json` rewrites
`/api/*` to the API server-side, so the browser only ever sees one origin:

```json
"rewrites": [
  { "source": "/api/:path*", "destination": "https://api.algoforge.work/api/:path*" },
  { "source": "/(.*)", "destination": "/" }
]
```

Order matters — the SPA catch-all would swallow `/api` if it came first.

That arrangement is not just tidiness. Calling the API host directly makes the
auth cookies third-party, and Safari and Brave block those by default: login
would work in Chrome and silently fail elsewhere. Through the rewrite the
cookies are first-party, there is no CORS preflight, and every preview
deployment works without adding its URL anywhere.

So **leave `VITE_API_URL` unset on Vercel.** Setting it bypasses the rewrite and
reintroduces exactly that problem. It exists only for hosts that cannot proxy.

On the API box, `NODE_ENV=production` is what makes cookies `Secure` +
`SameSite=None`, and `MONGO_URI` / `JWT_*` / `CLIENT_URL` / `CLOUDINARY_URL` come
from `server/.env`. `render.yaml` is kept for the alternative Render path.

After a deploy, `GET /api/health` answers `{ ok, uptime, uploads }` — `uploads`
is the quickest way to tell whether the Cloudinary keys made it onto the box.
