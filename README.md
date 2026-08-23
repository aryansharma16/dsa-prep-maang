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
| **Roadmap** | 429 problems in 22 patterns, filters that follow your account, a configurable table, inline statements and notes |
| **Pattern guides** | A full-screen reader per pattern — ~2,000 words, Java and C++ side by side |
| **Revision** | A spaced-repetition queue on a 3/7/21/60-day ladder |
| **Assistant** | Chat across Gemini, Cerebras, DeepSeek and Grok — pick a model or let it route per question, attach the problem you are on, and keep every thread |
| **Stats** | Solved ring, year-long heatmap, streaks, weakest patterns, company coverage |
| **Profile** | Your numbers, plus a profile picture uploaded to Cloudinary |
| **Auth** | Email + password, JWT in httpOnly cookies, silent refresh |
| **Rate limits** | Per-address and per-account ceilings on every route, tight on sign-in, registration, chat and uploads |
| **Motivation** | A line under every page heading, chosen from what you have actually solved |
| **Feedback** | Anyone can send a suggestion, a bug or a complaint — from a bubble, the topbar or its own page — and watch the status change. Staff triage the queue and leave one reply. Signing out asks for a rating out of five, which shows against the account in the panel |
| **Admin** | Four roles, a dashboard, user management, content editing, a guide block editor and an audit log |
| **Modules** | The super admin can hide a side-menu module while it is being built — gone from the menu, the routes and the API, for everyone but them |

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
| `npm run migrate:problem-slugs` | one-off: makes a problem slug unique per owner rather than globally — see [Yours is yours](#yours-is-yours) |

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

**Filters** opens the dialog: difficulty · status · sheet · topics · companies.
**Flagged**, **Needs revision** and **Added by me** stay out in the bar, because
those are the ones you flip mid-session and flip back. The search box in the top
bar (`/`) covers titles, companies and topic tags; searching from Stats or
Revision navigates you to the roadmap first, rather than leaving you typing into
a box that does nothing.

**Topics** matches a problem's tags rather than the pattern it is filed under, so
it cuts across the sections — binary search turns up inside Sorting and inside
Intervals, and picking it collects both.

Topics and companies are multi-select. Ticking several is OR within the field and
AND across fields: two companies and Hard means *asked at either, and hard*. The
menu stays open across picks and keeps what you typed into it, so choosing four
companies is one gesture; what you chose shows as accent chips under the control,
and clicking a chip takes it back off. The count on the **Filters** chip counts
fields, not values — three companies is one reason the list is short, not three.

Filters are saved to your account, so the roadmap you left narrowed is the one
you come back to, on any machine. The search box is deliberately not saved: it's
a question you asked, not a decision about how you're working. See
[Saved views](#saved-views) for how that round-trips.

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

**Your feedback** sits at the foot of the page — the last three things you sent
and what happened to them, so a reply does not go unread behind a bubble you have
stopped noticing.

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

The range is selectable — the last 3, 6 or 12 months, or a calendar year, with
years only offered once there is something in them. The count in the header and
the colour ramp both follow the selection, so narrowing to three months re-reads
the ramp against what is on screen rather than against a spike from March.

Both edges widen to whole Sunday–Saturday weeks, because a column *is* a week
and a half-drawn one misaligns every row under it. The days that widening pulls
in — and the rest of the current week — are rendered hidden. Getting the anchor
wrong here is subtle and was a live bug: walking back a year and *then* aligning
to a Sunday shifts the whole window earlier and ends the grid up to six days
short, which drops today off the right edge and makes the heatmap look empty on
the day you actually solved something. Every date is built in UTC, matching the
day keys the server buckets by.

Columns are fractional, not a fixed 13px, so the chart is as wide as the panel
and **nothing scrolls** — capped at 20px a column so a three-month range does not
blow the squares up into a calendar. The old fixed grid left a band of dead
space, clipped on a phone, and its `overflow-x: auto` also produced a stray
*vertical* scrollbar: setting one axis to `auto` computes the other from
`visible` to `auto`, and 2px of padding was enough to trip it.

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

## Small screens

Two steps, both stated in `styles/app.css` and one of them mirrored in JS.

**1024px — tablet.** The sidebar has already collapsed to its icon rail by
here, so this step gives the page back the margins the rail freed and lets any
panel holding a table scroll sideways rather than crushing its columns.

**760px — phone.** The shell itself stops working: the sidebar leaves the flex
row and becomes a drawer over the content, opened by a button that only exists
below this width. The breakpoint is also `NARROW` in `hooks/useMediaQuery.js`,
and **the two have to stay equal** — the drawer's only opener is revealed by the
stylesheet while the table's frozen columns are dropped by the hook, so a drift
between them leaves the nav unopenable or the columns sheared.

Both steps prefer letting a wide thing scroll over hiding it. A table you have
to swipe is usable; a column that silently vanished is a bug report.

What the phone step actually changes, beyond the drawer: the keyboard hints go
(there is no keyboard), rows grow from 36px to 42px and icon buttons from 24px
to 28px (a fingertip is nearer 9mm than a cursor is), dialogs open against the
top rather than the middle (centred, a form with the keyboard up puts its
heading behind the notch and its buttons under the keyboard), and the columns
dialog and the audit log restack from one row into two — both had more fixed
track than a 390px screen has width, which pushed the size buttons off the
right edge and left the audit entry forty pixels wide.

### Typing on a phone

Every text field goes to 16px below 760px, and that block is deliberately the
last thing in `app.css`.

The size is not a type choice. WebKit zooms the page in when a field under 16px
takes focus and does not zoom back out when the field is done — so tapping the
search box left you on a table two-thirds off-screen with no gesture that undid
it. Every browser on iOS is WebKit, including Chrome, so this was every iOS
user rather than the Safari ones. 16px is simply the threshold Safari checks.

It sits at the end of the file because it repeats selectors declared earlier at
the same specificity, and several of those originals (`.np-search input`,
`.nb-table input`) live further down than the small-screen block — folding
these rules into that block would silently lose to them.

Viewport heights use `dvh` with a `vh` line above as the fallback. On iOS
`100vh` is the viewport with the URL bar *retracted*, which is taller than what
is on screen while the bar is showing — a chat dock sized from it put its
composer under the browser chrome exactly when the keyboard was up.

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

## Rate limiting

`server/src/middleware/rateLimit.js`, in front of everything under `/api`.

The threat is not a clever one. It's a loop: a script on `/auth/login` walking a
password list, a script on `/chat/stream` spending the API key, or any route at
all hit until a small instance stops answering. None of that needs a
vulnerability — the endpoints work exactly as designed, just far more often than
a person could ask.

So the shape is **one generous ceiling over everything, and tight ones where a
single request is expensive or a wrong answer is worth guessing at.** Tight
everywhere is a limiter someone switches off the first time it fires on a real
user, which is worse than not having one.

| policy | window | limit | counted against |
|---|---|---|---|
| everything under `/api` | 1 min | 300 | client address |
| `POST /auth/login` | 15 min | 10 **failures** | client address |
| `POST /auth/register` | 1 hour | 5 | client address |
| `POST /chat/stream` | 10 min | 20 | account |
| avatar and note uploads | 1 hour | 30 | account |
| every other write below `/admin` | 5 min | 120 | account |

Four decisions in there are worth more than the numbers:

- **Failures are what login counts.** A password manager filling the form
  correctly, a shared office address, one person on a phone and a laptop — none
  of those should spend budget that exists to stop guessing. Registration is the
  same idea inverted and so can't share the limiter: there a *success* is the
  abuse, so nothing is skipped.
- **Signed-in routes count the account, not the address.** Shared egress is the
  ordinary case for this audience — a college network, a hostel, a carrier's
  CGNAT — and keying chat or uploads by address would have hundreds of people
  who did nothing wrong locking each other out. It opens nothing: minting
  accounts to buy budget has to get past the registration limit first, and the
  address-keyed backstop runs above everything regardless of how many sessions a
  connection spreads itself across.
- **IPv6 is keyed by prefix.** A v4 line gives an attacker one address to be
  counted by; a v6 subscriber is handed a whole block to rotate through for
  free. Addresses collapse to their /56, so rotating inside your own allocation
  buys nothing.
- **`/api/health` is exempt.** It's the health check on both deployment paths,
  and a 429 there doesn't read as "slow down" — it reads as "the service is
  down", and the answer to that is a restart.

A rejection is the same `{ error: { message, code, meta } }` every other failure
is, with `code: "RATE_LIMITED"` and `meta.retryAfterSeconds`, so the UI can say
*try again in 40 seconds* rather than *try again later*. The standard
`RateLimit` and `Retry-After` headers go out alongside it.

Two knobs, both optional: `RATE_LIMIT_GLOBAL_PER_MINUTE` raises the backstop if
a shared network ever trips it, and `RATE_LIMIT_DISABLED=true` turns everything
off for a load test you're running against yourself. The limits stay on in
development on purpose, so they're exercised by ordinary use rather than
discovered in production.

The counters live in the process. That's exact on the single instance this
deploys to, and it degrades honestly rather than silently if that changes — N
instances means N times the limit, since each keeps its own tally. The fix at
that point is `rate-limit-redis` in the `store` option, and nothing else moves.

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

## Feedback

Three doors to one dialog — a bubble beside the chat one, an icon in the topbar,
and `/feedback` in the side menu — because the thing that kills a feedback channel
is not being where someone was when they had the thought. All three open the same
`Send` / `Yours` popup; the page carries the same form and list with more room.

A submission is a **kind** (suggestion, bug, complaint, other), a one-line title,
the detail, and the route you were on when you opened the form — "the stats page"
is most of a bug report, and asking someone to remember where they were is asking
for a worse one.

| status | what it promises |
|---|---|
| Waiting | nobody has picked it up |
| Being read | somebody is looking at it |
| Planned | accepted, not built yet |
| Done | done, or answered |
| Not planned | read, and we are not doing it |

**Two terminal states, not one.** Closing something you disagree with as "Done"
is a lie the submitter can read, so declining is its own ending. Anything finer —
duplicate, deferred, won't fix — is a sentence, and that is what the one reply
per submission is for.

**The cap is five open submissions per account, not a rate per hour.** A time
window punishes the person who finds three bugs in ten minutes, which is exactly
who this exists for, and it clears on a clock nobody controls. A cap on the
unanswered clears when staff work the queue, so the limit tracks the conversation
— and it needs no counter collection, no TTL and no timer.

Submissions cannot be edited or deleted by their sender. A submission is a message
that has been *received*: rewriting it after somebody has read and answered it
makes the queue change under its reader, and deleting it deletes their reply.

### Rating, and the sign-out dialog

Signing out is the one moment somebody has just finished using the thing and has
an opinion they will not have an hour later, so that dialog asks: five stars, and
an amber **Send feedback** button beside them.

It stays a confirmation first. The stars are optional, the button is optional, and
neither stands between anyone and the **Sign out** they opened it to press — an
exit survey you have to dismiss to leave is how you teach people to stop reading
dialogs.

The rating is **one value per account, latest wins**, on `User.rating`
(`{ stars, at }`). Rating again is changing your mind, not casting a second vote;
the question the panel answers is "how does this person feel about it now", not
"how did their opinion move over eight months". It is **absent until they rate**,
so "never said" and "said one star" cannot be confused — the second is a
complaint, the first is silence, and the Users table prints `Not rated` rather
than a row of empty stars.

`PUT /auth/me/rating` lives on `/auth/me`, not under `/feedback`. It writes only to
the caller's own document, and the picker sits in a dialog that exists whether or
not the Feedback module is switched on — behind `requireModule('feedback')` it
would 404 the moment a super admin hid the module, in the one dialog nobody thinks
to test.

**Admin → Users** shows it as a read-only column, hover-dated. Read-only because
five buttons a row would put five tab stops in every row of the list, and because
an admin does not hold an opinion on somebody else's behalf.

**Admin → Feedback** is the queue — filter by status, kind or text, and open one
to set its status and write the reply. Both save in one request, because they are
decided in one sitting. Sorted by arrival and never by last-touched: a queue that
reorders as you work it moves rows between pages under the person going down them.
Every answer writes an audit row.

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
| See site settings      |  –   |   ✓   |     ✓      |      ✓      |
| **Change site settings** |  –   |   –   |     –      |      ✓      |
| Read the feedback queue |  –  |   ✓   |     ✓      |      ✓      |
| Answer feedback        |  –   |   ✓   |     ✓      |      ✓      |
| **See a module in development** | – | – |    –      |      ✓      |
| **Hide / release a module** | –  |   –   |     –      |      ✓      |

**This is not a ladder**, which is why `config/roles.js` is a capability set per
role rather than a numeric rank. `dev_member` writes guides but must never touch
a password; `admin` sets passwords but is not "above" dev_member. A rank
comparison cannot express that without lying about one of them. The server sends
the caller's capability list on `GET /auth/me`, so the UI hides what it cannot
do without keeping a second copy of this table in JSX — and every route still
checks for itself.

A learner who types `/admin` is redirected home. Not a 403 page: that would
confirm the route exists.

`feedback:read` and `feedback:write` are split even though all three staff roles
hold both today. Reading the queue is triage; writing on an item sends a sentence
to a real person, signed with a name, in the product's voice. The overlap is what
the matrix currently says, not a claim the two are the same power.

### The dashboard

The panel's landing page answers what an operator actually asks on arriving —
*is anything waiting on me, is anything misconfigured, is the place alive* —
rather than counting what exists.

| Panel | Question | Form |
|---|---|---|
| Five tiles | Is anything waiting? | open feedback and how long the oldest has waited, active this week, new accounts, patterns with no guide, hand-edited problems |
| Attempts, last 30 days | Is the place alive? | one column per UTC day, bucketed by the same `dayKey` the streak uses |
| System | Is anything misconfigured? | AI providers ready, chat and its retention, uploads, hidden modules — each a dot **and** a word |
| People | Who has keys, is anyone here? | 7-day and 30-day active against the account total, plus the staff roll |
| Patterns without a guide | What is unfinished? | a worklist linking into Guides |
| Recent activity | What changed? | the audit feed, and a link to all of it |

**Every key is gated server-side and omitted when denied**, not sent and hidden in
JSX — `content` needs `content:read`, `health` needs `settings:read`, `users`
needs `user:read`, `feedback` needs `feedback:read`. The work behind a denied key
is never run. The client renders on the *presence* of a key, so there is nothing
for a client-side capability check to get wrong.

The chart is CSS grid, not SVG, for the reason the activity heatmap is: fractional
columns make it exactly as wide as the panel at any width, with no viewBox
arithmetic and nothing to scroll. One series means one colour from the `--heat-*`
ramp and no legend; weekends are a background band, never a mark; a day with
nothing on it draws nothing.

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

### Modules in development

**Admin → Modules.** A side-menu module the super admin has hidden keeps working
for them and stops existing for everyone else. It is how a half-built feature
lives in `main` instead of on a branch nobody merges.

| module | route |
|---|---|
| Revision | `/revision` |
| Stats | `/stats` |
| AI Chat | `/chat` |
| Notes | `/notes` |
| Feedback | `/feedback` |

The roadmap is deliberately not eligible: it is where the catch-all route, the
admin redirect and every other redirect land, so hiding it would mean inventing
a second place for people to end up.

Feedback is worth hiding deliberately rather than by habit — it is the channel
people use to report that something is broken, so taking it away takes the report
with it. The queue in the panel is **not** behind the module gate: hiding the form
stops new submissions, it does not empty a collection with people already waiting
in it.

**Hidden means three things at once**, and the third is the one that matters:

1. the nav item is not drawn — in the rail *and* in the expanded menu, both fed
   from one list in `client/src/store/modules.js` so neither can be forgotten;
2. the client route is not declared, so the URL falls through to the catch-all
   and lands on the roadmap — indistinguishable from a route that was never
   built, the same line `/admin` takes;
3. **the API answers 404.** `requireModule(key)` sits on the mount in
   `routes/index.js`. Without it, hiding a module is a hidden door: the link is
   gone and `/api/notes` still answers anyone who reads the bundle or kept a
   bookmark.

404 rather than 403, worded identically to the `notFound` middleware, because a
403 announces that the feature exists. The super admin sees the module with a
**Dev** badge, so an unfinished page is never mistaken for a shipped one.

Notes is the one module with a public surface — `/api/notes/public/:publicId`,
the share links — and that is gated too. Hiding the module means it has not
shipped, so publishing it to people who never signed in is the opposite of the
intent. Existing links resume working when it is released; nothing is deleted.

Two capabilities, not one: `module:preview` is "an unfinished feature is safe in
my hands", `module:write` is "I decide when it ships". Both are the super
admin's today, and handing a dev_member the first later must not hand them the
second.

The state lives in the `Setting` document as a list of what is *hidden*, so a
module added to `server/src/config/modules.js` ships visible with no migration
and no row to remember to write. It is cached for 30s like the rest of the
settings, so a change can take up to that long to reach the pm2 workers that did
not serve the write.

### Seeing an account

**Admin → Users** lists everyone with two recency columns, because they answer
different questions and one alone misleads:

| column | is | comes from |
|---|---|---|
| **Active** | when they last had the app open | `lastSeenAt`, stamped by the refresh endpoint |
| **Signed in** | when they last typed a password | `lastLoginAt`, stamped at login |

A sign-in months ago on an account seen this morning only means the session
never lapsed; the pair is what separates dormant from long-lived. `lastSeenAt`
is written from `POST /auth/refresh` rather than from `requireAuth` on purpose —
refresh already loads the account and runs about every fifteen minutes for an
open tab, so "last active" costs one write per active user per window instead of
one on every request in the API.

Opening an account shows a read-only **study record**: solved and attempted,
current and best streak, active days, logged attempts and time, how much is
flagged or due for revision, their last ten solves, and every problem they added
— which is the list a super admin most often wants, since nobody else can see
those. All of it is computed from `Progress` by the same streak helper the
learner's own stats page uses, so the panel cannot quote a different number back
than the one they are looking at.

It is read-only deliberately. The panel exists to administer an account, not to
reach into somebody's study record.

**Admin → Problems** has a scope filter for user-added problems and now names
the owner on each row. A super admin can edit or delete any of them; the delete
confirmation says whose roadmap it is coming out of, because "removed for
everyone" was wrong in exactly the case that mattered.

### Activity

Every content and user change is recorded with who, what and when, filterable by
action and by person. The actor's email is copied onto the row rather than
joined, so history stays readable after the account that made it is deleted —
which is exactly when you want to read it.

Hiding or releasing a module is recorded as `module.visibility`, phrased by
audience — *everyone → super admin only* — because a `hidden: false → true`
reads backwards at a glance and this log exists to be skimmed.

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

### Editing and deleting your own

Rows you added carry a **MINE** tag, a pencil in the actions cluster, and a
**Delete problem** in the notes panel. The seeded curriculum carries none of
them. **Added by me** in the filter bar narrows the roadmap to just your
additions — it only appears once you have some, because otherwise it filters to
an empty page, which reads as a bug rather than an answer.

The edit dialog is the add dialog with different verbs — one component, so a
field added to one cannot go missing from the other. Two things differ, and both
follow from what an edit is:

- **The URL is fixed.** It is what the slug was derived from, and the slug is
  what every `Progress` row joins on, so moving it would detach your own
  history. Delete and re-add if the link was wrong.
- **Status and notes are absent.** They live on `Progress` and are offered on
  the way in as a convenience for something you already solved. After that the
  row's own controls own them.

Changing the pattern moves the problem to the end of the new section, where a
fresh addition would land — its old position means nothing there.

**Ownership is the test, not `source`.** A LeetCode problem you added is
`source: 'leetcode'` and every bit as much yours; keying the controls off source
hid them on half of anyone's own additions. The roadmap aggregation computes
`mine` per row server-side, so the row cannot disagree with the endpoint that
will accept or refuse the edit. `PATCH /api/problems/:id` and `DELETE
/api/problems/:id` both check `owner` and answer 403 otherwise.

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

### Yours is yours

The seeded curriculum is `owner: null` and global to every account. Everything
you add is `owner: <you>` and reaches nobody else — not the roadmap, not stats,
not the revision queue, not the chat context, not a shared link.

One filter says so, and every read of a problem goes through it:

```js
{ $or: [{ owner: null }, { owner: userId }] }
```

The queries that take an **id** carry it too, including the two progress
endpoints. Without it a problem id is enough to attach yourself to someone
else's private addition — and the revision queue populates the problem it points
at, so their problem would then appear on your page.

**A slug is unique per owner, not globally** — `{ slug: 1, owner: 1 }` on
`Problem`. Globally unique looks right until two people add the same LeetCode
problem: the second one is refused, with *"that problem is already in your
list"*, about a row they cannot see and did not create. One learner adding a
problem must not change what another is allowed to add. Mongo counts
`owner: null` as a value here, so the curriculum still gets exactly one row per
slug and each account gets at most one of its own beside it.

Two consequences worth knowing:

- Every read by slug is now ambiguous unless it is scoped, so `lookup`,
  `getDescription` and the duplicate check all carry the owner clause. "Already
  tracked" means *by you*.
- The seeder upserts on `{ slug, owner: null }`. On slug alone, the first
  curated problem that someone had already added for themselves would have
  `owner: null` set on *their* row — quietly publishing one person's private
  addition to the whole deployment.

Deployments that predate this need the index swapped once. Mongoose creates the
new one on boot but never drops the old one, so without this the original unique
`slug_1` is still there and still refusing the second person:

```bash
npm run migrate:problem-slugs   # in server/, safe to run twice
```

## Saved views

Filters are declared, not hand-wired. A screen describes what it can be narrowed
by, and the dialog, the count on the chip, what Clear all clears, the row
matching and the round-trip to the account all fall out of that one description.
The roadmap's lives in `filters/roadmap.js`; the engine is `filters/spec.js`.

```js
export const ROADMAP_FILTERS = defineFilters([
  {
    id: 'topics',            // the key in the bag, and in the database
    kind: 'many',            // 'one' | 'many' | 'flag'
    label: 'Topics',
    place: 'dialog',         // 'dialog' (behind the button) | 'bar'
    match: (p, values) => (p.topicTags || []).some((t) => values.includes(t)),
  },
  …
])
```

`match` is only ever called with a value that is actually set, so it never opens
with an "if nothing is selected" guard — that check lives in the engine, once.
The three kinds are the three shapes a control can produce, not three ideas about
data. Add `control: 'segmented'` to render a `one` as a row of buttons instead of
a dropdown, and omit `options` for a field whose choices come from loaded data.

`<FiltersModal spec={…} value={…} options={…}>` renders the whole dialog from
that, and `useSavedFilters(scope, spec)` is the state:

```js
const [filters, setFilters] = useSavedFilters('roadmap', ROADMAP_FILTERS)
```

Two stores, for the reason `AppearanceContext` keeps two. The account is where
the choice lives — that's what makes it survive a reload on another machine — but
the account arrives a request after the first paint, and restoring from the
server alone would render all 429 problems and then collapse to eleven a beat
later. So localStorage answers synchronously and the server reconciles behind it.
Where the two disagree, the account wins; nothing is pushed until the fetch has
been heard from, so a save can't overtake it and leave the two out of step while
both believe they're in sync. Writes are debounced, and a failed one is retried
by the next change rather than surfaced — the filter is applied and stored
locally either way.

Server-side it's `GET`/`PUT`/`DELETE /api/views/:scope`, one `UserView` row per
account per scope. The bag is stored opaquely on purpose: the server bounds it
and never reads inside it, so the roadmap gained a topic filter without the
database learning what a topic is. What it does enforce is a boundary — `scope`
is an allowlist and the payload is capped on every axis a caller controls (24
fields, 40-char names, 80-char values, 60 values per multi-select), all in
`config/viewScopes.js`. Clearing every filter deletes the row instead of storing
an empty one.

Stale values are kept, not dropped. A saved company that's no longer in the
roadmap stays selected and shows as a chip matching nothing — visible and
removable, which silently discarding it would not be. A filter that no longer
exists in the spec *is* dropped on load, the same way a stale saved column layout
is reconciled.

Scopes are declared for `roadmap`, `revision`, `notes` and `problems`; only the
roadmap uses one so far.

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
    models/      User, UserView, Pattern, Problem, Progress, PatternGuide,
                 CompanyLogo, AuditLog, Motivation, DailyLine
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
      filters/   the spec-driven filters dialog and its chips
      profile/   avatar upload
      stats/     solved ring, activity heatmap
      admin/     panel tabs, editors, the motivation corpus
      ui/        Modal, ConfirmDialog, Dropdown, Avatar, PhotoPreview, Icons
    filters/     what each screen can be narrowed by, and the engine
    hooks/       useGuide, useMotivation, useLocalState, useTableLayout,
                 useSavedFilters
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
| `GET` `PATCH` | `/auth/me` | the signed-in user with their capabilities and visible modules, and editing your own details |
| `PUT` | `/auth/me/rating` | your own rating out of five — replaces, never appends |
| `POST` `DELETE` | `/auth/me/avatar` | profile picture |
| `GET` | `/patterns` · `/patterns/:slug/guide` | curriculum and guides |
| `GET` | `/problems` · `/problems/:slug/description` | roadmap, statement on demand |
| `POST` `PATCH` `DELETE` | `/problems` · `/problems/lookup` · `/problems/:id` | your own problems — edit and delete are owner-checked |
| `GET` `PATCH` `POST` | `/progress/revision` · `/progress/:id` · `/progress/:id/attempt` | tracking |
| `GET` | `/stats` | profile and stats pages |
| `GET` `PUT` `DELETE` | `/views/:scope` | the filters you left on a screen — see [Saved views](#saved-views) |
| `GET` `POST` | `/feedback` | your own submissions, and sending one — capped at 5 open per account |
| `GET` | `/motivation` | the line for one page, chosen from your progress |
| `GET` | `/motivation/login` | the sign-in page's line — **public on purpose** |
| `GET` | `/companies/:slug/logo` | cached brand icons — **public on purpose** |
| `GET` | `/health` | `ok`, uptime, whether uploads and AI are configured |
| — | `/admin/*` | the panel — see [Admin panel](#admin-panel) for the capability behind each route |

Every route above is behind a request ceiling, and the sign-in, registration,
chat and upload routes are behind tighter ones — see
[Rate limiting](#rate-limiting) for the numbers and what each is counted
against.

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

A production build now refuses to start if it is set, because that warning was
not enough once already: the variable was set on the project, the bundle called
`api.algoforge.work` directly, and sign-in failed on every iOS device while
working perfectly on the desktop Chrome it was tested in. The cookies were
third-party, WebKit dropped the `Set-Cookie`, and the next `/auth/me` bounced
straight back to the login screen.

That is the worst shape a bug can have — one platform completely broken, the
one you develop on fine — so `vite.config.js` turns it into a build failure
with the explanation attached:

```
VITE_API_URL is set to "https://api.algoforge.work".

That bypasses the /api rewrite and makes the auth cookies third-party,
which every browser on iOS blocks — sign-in fails there and nowhere else.
```

Set `ALLOW_CROSS_ORIGIN_API=true` alongside it for a host that genuinely cannot
proxy. It downgrades the failure to a warning, and it is deliberately a second
variable rather than a flag on the first: bypassing the rewrite should be a
decision someone states out loud, not a default they inherit.

On the API box, `NODE_ENV=production` is what makes cookies `Secure` +
`SameSite=None`, and `MONGO_URI` / `JWT_*` / `CLIENT_URL` / `CLOUDINARY_URL` come
from `server/.env`. `render.yaml` is kept for the alternative Render path.

After a deploy, `GET /api/health` answers `{ ok, uptime, uploads }` — `uploads`
is the quickest way to tell whether the Cloudinary keys made it onto the box.
