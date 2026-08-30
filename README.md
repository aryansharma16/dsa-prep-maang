# Ember

A pattern-first prep tracker, with two curriculums. The **roadmap** is 517
curated interview problems ordered as a ramp — arrays → two pointers → prefix
sum → sliding window → … → DP — with real company tags, one-click progress
tracking and a spaced-repetition revision queue. **Pro Coder** is 1,100 curated
Codeforces and CodeChef problems arranged as a rating ladder, for getting from
Newbie to Candidate Master rather than through an interview loop. System design
and the rest follow the same shape.

React + Vite · Node/Express · MongoDB Atlas · Cloudinary. JavaScript throughout.

The product name lives in `client/src/brand.js` and nowhere else — the sidebar,
both auth pages and the document title read from it, so renaming is one edit.

---

**Using it rather than building it?** The app documents itself: **`/docs`** is a
guide to every feature in the order a learner needs it, with no setup and no
code. It is [public](#the-guide) — it needs no session, so it is reachable from
the sign-in page as well as from the sidebar.

## What's in it

| | |
|---|---|
| **Roadmap** | 517 problems in 23 patterns, filters that follow your account, a configurable table, inline statements and notes |
| **Attempts** | A stopwatch you start before you open the problem and read off when you log it, five outcomes that each decide what happens to the row, and a note, a colour and a confidence per sitting — editable and deletable for half an hour after logging, and drawn back into the table as one chip per attempt |
| **Pattern guides** | A full-screen reader per pattern — ~2,000 words, Java and C++ side by side |
| **Learn** | Reference notes for the things around the algorithms. Five tracks — Complexity, 6 topics from "what is a logarithm" to the Big-O tables worth knowing cold; React, 43 topics from the virtual DOM through the ecosystem a job expects; Node.js, 68 topics from closures to a hardened API with a cache, a queue and tests; SQL, 53 topics from "what is a database" through ER models, normalisation, every join shown with its result, window functions, isolation levels and query plans; and Computer Networks, 35 topics from the OSI layers through subnets, TCP, DNS and TLS to load balancers, CDNs and a VPC drawn the way AWS draws it — each a definition, why the thing exists, a small example and the gotchas, with linkable sections, arrow-key paging, read tracking, the official docs linked and the assistant one click away |
| **Practice** | Two ways to train against the curriculum rather than work through it: a **pattern drill** that shows a problem's title and six techniques and asks which one it wants — three seconds a repetition, on the skill an interview tests in its first ninety seconds — and a **mock harness** that runs two unsolved problems against one clock with the answers off the page, a code box that stays locked until you have written the approach down, and a four-line self-scored rubric |
| **Playbook** | A 24-week interview-prep plan — four phases targeting 396 of the 517 roadmap problems and the ≤Specialist half of the ladder, all 117 SQL problems on the Friday evening block, a high-level design track from week 13 and a machine-coding/LLD track from week 14, a weekly timetable built around real available hours, and a drift line that says how far ahead or behind the schedule you actually are. One plan document per account; the schedule itself is authored prose, written to one specific starting point |
| **SQL Lab** | 117 SQL problems in 8 categories, with two kinds of row and one rule between them: **72 run in your browser** — SQLite compiled to WASM, their own schema and rows, graded against a generated expected result — and **45 link out to LeetCode**, because a problem that already has a judge should be solved on it. Progressive hints, a reference solution behind the same 25-minute gate as every editorial, MySQL shims so the answers match what the Learn track teaches, and the same revision ladder as everything else |
| **Pro Coder** | A competitive-programming ladder: 1,100 problems (800 Codeforces, 300 CodeChef) across 49 CP patterns and 7 rating tiers, full width and in its own palette — the app's glass material, re-stepped darker and carrying Codeforces' rating ramp — following your light/dark choice. Link your Codeforces handle and it marks what you have already solved and tells you which problems are a stretch for your rating |
| **Revision** | A spaced-repetition queue on a 3/7/21/60-day ladder, across both curriculums |
| **Assistant** | Chat across Gemini, Cerebras, DeepSeek and Grok — pick a model or let it route per question, attach the problem you are on, and keep every thread. On Pro Coder it becomes a CP coach with a stricter spoiler rule that knows your rating |
| **Tasks** | A board for what you meant to do — your own columns, drag between them, deadlines that default to unlimited, subtasks, files, and problems pulled from the roadmap that tick themselves off as you solve them. One stopwatch, running at a time, so you learn how long things actually take |
| **Stats** | Solved ring, year-long heatmap, streaks, weakest patterns, company coverage |
| **Profile** | Your numbers, plus a profile picture uploaded to Cloudinary |
| **Auth** | Email + password, JWT in httpOnly cookies, silent refresh |
| **Rate limits** | Per-address and per-account ceilings on every route, tight on sign-in, registration, chat and uploads |
| **Motivation** | A line under every page heading, chosen from what you have actually solved |
| **Feedback** | Anyone can send a suggestion, a bug or a complaint — from the account menu, the sign-out dialog or its own page — and watch the status change. Staff triage the queue and leave one reply. Signing out asks for a rating out of five, which shows against the account in the panel |
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
npm run seed:learn            # the 5 Learn tracks and their 205 topics
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
| `npm run seed:learn` | writes the 5 Learn tracks and their 205 topics. `-- --dry-run` validates every block and prints the totals without opening a connection; `-- --force` overwrites topics the admin panel has edited |
| `npm run seed:learn:verify` | compares every seeded topic against the content files, field by field, and fails if anything differs |
| `npm run seed:cp` | the whole Pro Coder pipeline — see [Seeding it](#seeding-it) |
| `npm run seed:cp:fetch` | Codeforces problemset + contests → `data/raw/cp/` |
| `npm run seed:cp:sheets` | the curated CP sheets (CP-31, ladders, A2OJ) |
| `npm run seed:cp:codechef` | rated CodeChef problems, with tags for the shortlist |
| `npm run seed:cp:curate` | fills the (pattern × tier) grid → `data/cp/curated-cp.json`. `-- --dry` prints the distribution and writes nothing |
| `npm run seed:cp:solutions` | attaches reference solutions from four public repos — additive and idempotent |
| `npm run seed:cp:db` | upserts the CP ladder into MongoDB |
| `npm run seed:cp:guides` | writes the 12 core CP guides |
| `npm run seed:sql` | the SQL Lab: verify, then write |
| `npm run seed:sql:verify` | runs every reference solution and generates the expected grids → `data/sql/curated-sql.json`. Refuses to write if anything disagrees |
| `npm run seed:sql:db` | upserts the verified SQL bank into MongoDB |
| `npm run seed:motivation` | writes the 160 motivational lines |
| `npm run seed:logos` | pre-warms the company logo cache |
| `npm run ai:draft` | drafts new motivational lines with Gemini, for you to curate |
| `npm run migrate:problem-slugs` | one-off: makes a problem slug unique per owner rather than globally — see [Yours is yours](#yours-is-yours) |
| `npm run migrate:attempt-ids` | one-off: gives an id and a `loggedAt` to attempts logged before they had them, without which they show as locked — see [Attempts](#attempts) |

## The curriculum

23 patterns in learning order. Inside each, problems run easy → hard; that
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
| Design | Concurrency | |

### Where the problems come from

| Source | Contribution |
|---|---|
| [Striver's SDE Sheet](https://takeuforward.org/interviews/strivers-sde-sheet-top-coding-interview-problems) | 180 of 191 (the rest are LeetCode-premium or duplicate listings) |
| [NeetCode 150 / Blind 75](https://github.com/neetcode-gh/leetcode) | 143 of 150 (7 are premium-only) · 69 Blind 75 |
| [Company tags](https://github.com/liquidslr/leetcode-company-wise-problems) | 20 companies, ask-frequency per problem |
| [FAANG interview questions](https://github.com/ombharatiya/FAANG-Coding-Interview-Questions) | 271 problems reported asked at 22 companies in 2025-26 |
| [LeetCode API](https://github.com/noworneverev/leetcode-api) | difficulty, topic tags, likes, statements on demand |
| **AI-recommended 300** | computed here, not imported — see below |

A problem's rank is `Σ(company weight × ask frequency)` plus a bonus for
appearing on a curated sheet. Every problem on Striver's SDE Sheet, NeetCode 150
or the FAANG list is kept regardless of rank, so those sheets stay complete.
Premium problems are dropped — you can't open them.

**The two company fields are not the same claim, which is why they are two
fields.** `companies` is a measured ask-frequency from a dataset carrying no
date, so a problem Google stopped asking in 2019 scores the same as one they
asked last month. `askedRecently` is a list of names with no frequency at all,
from interviews reported in 2025-26. Merging them would have meant inventing a
frequency for the second and putting it in the same array as real ones, where
nothing downstream could tell which was which — so the roadmap carries two
filters and an extra column instead. 256 of the 517 problems carry a recency
signal, and eleven of the names in it (OpenAI, Anthropic, Databricks, Stripe and
the other AI labs) exist only there, with no frequency data and no logo.

A fourth source whose problems are kept regardless of rank does not add to a
list built this way — it *displaces*, because a pattern's filler allowance is
whatever its quota has left once core is seated. The first run with the FAANG
list seated 271 problems and silently dropped 67 already-curated ones. The
per-pattern quotas in `patterns.js` were re-derived as `core + existing filler`
to make it additive, and the curation report now prints `+n over quota` per
pattern so the next drift is visible rather than silent.

Re-running the seed is safe: it upserts by slug, prunes retired problems, and
never touches your progress or the problems you added yourself.

### The AI-recommended 300

Four of the five sheets on the roadmap are imported — somebody else's list,
carried in whole. The fifth is computed from the curated rows themselves at seed
time by `server/scripts/seed/ai-sheet.js`, and it answers the question none of
the others do: **if you only have time for three hundred, which three hundred?**

It is built on marginal value rather than absolute value. The eleventh
sliding-window problem is not worth what the second one is, because by then you
own the template and are only re-typing it. So the picker is a greedy pass with
diminishing returns: each problem is scored, and every pick multiplies the score
of everything sharing its *technique* by 0.55, so the third problem in a cluster
has to be about three times as good as the first one in an untouched cluster to
beat it. Technique is derived from the LeetCode topic tags with the pattern's own
dominant tags removed — inside `sliding-window`, "Sliding Window" separates
nothing while "Monotonic Queue" is exactly the distinction worth a slot.

The score is four terms, and each is there for a different reason:

| term | what it says | weight |
|---|---|---|
| canon | on a list that survived someone else's curation | Blind 75 **12** · NeetCode 150 **8** · Striver **4.5** · FAANG list **1** |
| demand | how many companies ask it, and how many asked recently | `0.3 × companies` (cap 20) + `0.6 × recent` (cap 6) |
| quality | LeetCode like ratio, as "well-posed or trick?" | `(ratio − 72) / 9`, clamped ±3, neutral when unknown |
| shape | Medium is the interview currency | Medium **+1.5** · Easy **+0.6** · Hard **0** |

The FAANG list is weighted at 1 on purpose: it holds 271 of the 517, so it
barely discriminates, and its real signal — *who asked it recently* — is already
counted in `demand`. Weighting it like a curated sheet double-counted it, and the
first run put 91 problems on the sheet that were on no other list.

**The per-pattern budgets are hand-set, and that is the point.** A proportional
split would hand `arrays-hashing` 26 slots because the roadmap happens to hold 44
of them. But `tries` is four techniques and `arrays-hashing` is closer to twelve,
and neither number has anything to do with how many rows were curated. So the
quota is a judgement about how many problems it takes to *own* a pattern:

| trees | arrays | dp-1d | graphs | stack | binary-search | dp-2d | linked-list | heap · backtracking · advanced-graphs |
|---|---|---|---|---|---|---|---|---|
| 27 | 24 | 20 | 20 | 17 | 17 | 17 | 15 | 13 each |

`strings` is cut to 9 and `design` to 4 — both pools are weak because the
problems that matter under those names are filed elsewhere (LRU under
linked-list, Min Stack under stack, Group Anagrams under arrays-hashing).
`concurrency` gets **0**: six problems asked in a dedicated round at two
companies not on most target lists, and not an algorithm pattern. The budgets sum
to exactly 300.

**Two hand-lists correct the score where it is confidently wrong.** `ALWAYS`
carries problems whose importance is not in the data — Dijkstra and
Floyd-Warshall exist here only as Striver's bare implementation exercises with no
LeetCode id, no votes and no company tags, so they score near the floor while
being the entire point of the pattern they sit in; same for 0-1 Knapsack and
Matrix Chain Multiplication. `NEVER` drops rows that are not really problems
(`striver-bfs` is a topic stub), rows the classifier filed under the wrong
pattern, and exact re-runs of a template already covered — Sqrt(x), Valid Perfect
Square and The N-th Root of an Integer are one problem written three times. Both
lists are checked against the curated rows at build time, so a slug that stops
existing fails the seed instead of silently shrinking the sheet.

The result is **300 problems, 55 Easy / 192 Medium / 53 Hard**, covering 22 of
the 23 patterns. It is a strict superset of Blind 75 — all 69 — and holds 139 of
NeetCode's 150. The four it drops are the four that are covered by a neighbour:
Min Cost Climbing Stairs (Climbing Stairs), Distinct Subsequences (Edit Distance
and LCS), Count Good Nodes, and Buy and Sell Stock with Cooldown. The remaining
~90 are pattern coverage and 2025-26 recency that neither short list carries.

**It is purely additive.** The pass only ever pushes onto a problem's `sheets`,
and it runs last, so no existing membership changes and the roadmap is the same
517 either way. `ai-300` is deliberately last in `SHEET_LABEL` too: the title
badge shows the first sheet it finds, so a row that read `SDE` yesterday still
reads `SDE`, and `AI` only ever appears on the 39 picks that are on no other
list.

## Pattern guides

Every one of the 23 patterns has a written guide behind the ⓘ on its heading —
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

## Learn

The roadmap teaches the algorithms. **Learn** is for everything around them —
the vocabulary you use every day and could not define under pressure. There are
five tracks: **Complexity**, 6 topics that start at "how many times can you
halve a thousand" and end at the Big-O tables; **React**, 43 topics from what
happens between a `setState` and the pixels through to the ecosystem a React job
actually expects; **Node.js**, 68 topics that start at closures and `map` and
end at a hardened, paginated, authenticated API with a cache, a queue and tests
behind it; **SQL**, 53 topics that start at "what is a database" and end at
reading a query plan; and **Computer Networks**, 35 topics that start at "what
is a network" and end at debugging one in a VPC.

The ends of that list are deliberate, and it is not about length.
**Complexity** is first because it is the maths the roadmap assumes you have
already — a pattern guide that opens with "this is `O(n log n)`" is worth
nothing to a reader for whom the `log` in that is a mystery, and that is a gap
worth closing on its own page rather than in an aside. **SQL** and **Networks**
are last because they are the two tracks that are not notes about somebody's
API. React and Node are reference you reach for while building; an interview
asks about ER models, BCNF, isolation levels, the OSI layers and TCP the way it
asks about graphs, so those two are written to be learned front to back rather
than looked up.

Sidebar → **Learn** → a track → a topic. Each topic is the same shape, so it
reads as a cheatsheet and holds up as documentation: the definition in the
official docs' terms, why the API exists, its signature as a table, the smallest
example that shows the point, how it actually works, the mistakes people make,
a one-line "when do I reach for this" table, and a link back to the official page.

**Read, and revised.** Two different facts, and they stay two different facts.
*Read* is set by scrolling to the bottom as well as by the button, and means "my
eyes have been over this". *Revise this* is the deliberate act: you say how solid
it felt and the topic joins the same 3/7/21/60 ladder a problem goes on, in the
same merged queue, scheduled by the same `nextReview()`.

Both are on the server now, on one row, in two fields. Read used to be kept in
localStorage *specifically* to keep the two apart — a topic skimmed on a train
has no business in Tuesday's queue — and what actually keeps them apart is
`scheduledAt`, not which storage the fact lives in. The queue reads that field
and never `readAt`, so read can follow you between browsers, which is what it
should always have done. The scroll handler that sets it fires on every frame
past the ninety-percent mark and writes exactly once.

### Complexity — the 6 topics

| | |
|---|---|
| **The idea** (2) | Logarithms, from scratch · Big-O in plain words |
| **Counting it** (2) | Time complexity, counted off the code · Space complexity |
| **Using it** (2) | Reading the constraints · The cheat sheet |

It assumes nothing. **Logarithms** starts at doubling and halving and never
names a rule before the idea behind it is already there, because everything
after it leans on `log n` and a reader who half-remembers school gets nothing
from a page that opens with "clearly this is `O(log n)`". **Big-O in plain
words** is the notation itself — drop the constants, `O` against `Ω` against
`Θ`, worst against average, and what amortised actually guarantees.

Then the counting: **Time complexity** walks every shape from `O(1)` to `O(n!)`
with the code that produces it — including the two-pointer loop that looks
nested and is not, and the `O(n)` library call inside an `O(n)` loop that is
where most accidental quadratics really come from — and **Space complexity**
covers the auxiliary/total split and the recursion stack everybody forgets to
count.

The last two are the ones you use in a real interview. **Reading the
constraints** turns `n ≤ 10⁵` into "so I am looking for `O(n log n)`" and then
into a shortlist of techniques that produce that shape, which is a much smaller
question than "think of something clever". **The cheat sheet** is the tables:
data structures average and worst, sorting, and — the part the published cheat
sheets leave out — what a Java collection, a C++ STL container and a JavaScript
built-in actually cost, because `ArrayList.contains` and `arr.shift()` are where
the complexity you reasoned about goes wrong in practice.

Examples carry **Java and JavaScript** tabs: Java because it is the roadmap's
default solution language, JavaScript because it is the one this reader writes
all day, and the shape being taught is legible in both.

### React — the 43 topics

| | |
|---|---|
| **Foundations** (4) | How React works · JSX · ReactDOM and roots · StrictMode |
| **Components and state** (6) | Components and props · State · Lists and keys · Conditional rendering · Forms and controlled inputs · Lifting state and composition |
| **Hooks** (14) | Rules of hooks · `useState` · `useEffect` · `useLayoutEffect` · `useRef` · `useContext` · `useReducer` · `useMemo` · `useCallback` · `useTransition` · `useDeferredValue` · `useId` · `useSyncExternalStore` · Custom hooks |
| **Advanced** (6) | Context patterns · memo and performance · Error boundaries · Portals · lazy and Suspense · Refs to components |
| **React 19** (4) | Actions and form hooks · `useOptimistic` · The `use` API · Other React 19 changes |
| **Pitfalls** (1) | Common pitfalls — stale closures, derived state, effect abuse, unstable deps |
| **The ecosystem** (8) | State management · Data fetching · Routing · Forms at scale · TypeScript with React · Testing components · Performance in practice · Rendering and Next.js |

The first six sections are React itself. **The ecosystem** is everything a React
job expects that React does not ship — and because that is the material an
interview probes, those eight topics each end with an **Interview** table, the
same as the whole Node track. The rest of React stays pure reference.

### Node.js — the 68 topics

| | |
|---|---|
| **JavaScript foundations** (7) | Values and types · Functions · Scope and closures · `this` and context · Objects and destructuring · Array methods · Classes and prototypes |
| **Async JavaScript** (5) | Callbacks · Promises · `async`/`await` · Promise combinators · Errors and throwing |
| **Node fundamentals** (6) | What is Node.js · Node architecture · Your first script · npm and package.json · Globals · `process` and the environment |
| **Modules** (4) | CommonJS · ES modules · Module resolution · The built-in modules |
| **The event loop** (5) | Event loop phases · Microtasks and macrotasks · Timers · Blocking the event loop · Async patterns |
| **Files, buffers and streams** (6) | The `fs` module · Paths and directories · Buffers · Streams · Backpressure · EventEmitter |
| **HTTP and your first server** (5) | HTTP fundamentals · Methods and status codes · Your first server · Routing by hand · Headers and cookies |
| **Express** (6) | Express basics · Routing · Middleware · Error handling · Project structure · Config and environments |
| **REST APIs** (5) | REST principles · API design · Pagination, filtering, sorting · Validation · Versioning and idempotency |
| **PostgreSQL** (6) | SQL basics · Joins and aggregates · Postgres from Node · Transactions and concurrency · Prisma · Indexes and performance |
| **Authentication** (5) | Authentication vs authorization · Passwords · JWT · Sessions and cookies · Authorization and RBAC |
| **Security** (5) | The threats that matter · Injection · XSS and CSRF · CORS and security headers · Secrets and rate limiting |
| **Production essentials** (3) | Redis and caching · Queues and background jobs · Testing |

The Node track is ordered easy to hard and written for interviews as well as for
reference, so it differs from React in two ways. Every topic ends with an
**Interview** table — the questions that topic actually gets asked, answered in
a line each — and its examples are **runnable**: real files with the command to
run them, where sections 7 to 12 build one `/tasks` API across topics rather
than showing unrelated fragments. You write the server with `http.createServer`,
rewrite it on Express, give it layers, REST semantics and cursor pagination, put
it on Postgres, add login, and then attack it. **Production essentials** closes
it out with the three things a tutorial API never has: a cache, somewhere to put
slow work, and tests.

A one-line summary of every topic in all five tracks is in
[docs/learn.md](docs/learn.md#what-is-in-each-track).

**Each track has its own light.** Learn wears the app's glass material like
every other page — see [The material](#the-material) — and adds one thing to it:
a colour. `.shell` lights the whole app in whichever accent you picked; a track
page relights its own region in the track's hue over the top of that, so
Complexity is violet, React is sky, Node is green, SQL is amber and Networks is
teal, and the icon tile, the
meter, the section rules, the side rail's marker and the progress bar down a
topic all follow. The hue is one word in the registry, resolved from the same
palette the accent picker draws from, which is also what re-steps it for the
light theme. Colour never sits *under* text — it is on edges, icons and marks
only, because this is a surface you read for twenty minutes at a time.

The reading page is built for reference rather than for essays. Prose is held
to about 74 characters, but **code blocks and tables get the full column**,
which is a third wider than the pattern-guide reader — a code sample is a
figure, not a paragraph, and holding one to a text measure is what makes a docs
page feel cramped. A rule under the top bar fills as you scroll, the side rail
tracks the heading you are on, clicking one puts the anchor in the address bar
so a section is linkable, and `←` and `→` walk the track. Reaching the bottom
ticks the topic off; the ticks and counts show up again on the track index and
as a meter on the hub, so you can see what is left. That progress lives in the
account, on the same row as the schedule and in a different field — see
[Read, and revised](#learn) above.

None of that costs a frame. The rule is written straight to its own element
rather than held in state, so scrolling a topic does not re-render the page
sixty times a second to move a bar; the side rail measures its headings once
and compares scroll offsets after that, rather than reading the layout of every
heading on every frame. Both were doing real work per frame on a long topic —
see [docs/learn.md](docs/learn.md#the-reading-page).

**Nothing waits on a blank page.** Every Learn page draws its own frame from the
URL and fills it in as the requests land, rather than holding the route on the
word `Loading...` until they do. A track index paints its title, its filter and
a grid of correctly-sized cards straight away; a topic paints its crumb, its
column and its progress rule.

The hub is the same idea from the other end, and it is the one place the move to
the database could have cost something visible. Its cards used to come from
a registry in the bundle and were on screen in the first frame; a catalogue
request cannot be. So the five tracks' **chrome** — name, colour, icon, one
sentence, under a kilobyte — stays in the bundle and answers immediately,
and the catalogue replaces it the moment it arrives. On a second visit it never
appears at all: the catalogue is read synchronously out of localStorage at module
load, so the meters, the totals and a working search box are there on the first
frame, which is better than the page managed before. That mirror is a cache and
never the record — the response overwrites it, and a version that has not changed
deliberately keeps the existing objects so two hundred cards are not handed new
identities to redraw an identical page.

It renders through the **same block renderer** as the pattern guides, and now it
uses the same storage too. Learn content is authored as the same typed blocks, so
code tabs, copy buttons, callouts and syntax colours were already built — and
because the block vocabulary was already a Mongoose schema, moving the topics
into Mongo added **no new block types at all**, and the Networks track added
none either — only two link helpers, `rfc` and `awsDoc`. `sig`, `cheat` and `asked` are a
table with the header row filled in; the SQL track's sample and result grids are
a table with `caption` and `variant` set, and those two fields had been on
`guideBlockSchema` since that track was written.

**The prose is authored in git and served from the database.** The 205 modules
live under `server/scripts/seed/learn/` and `npm run seed:learn` writes them,
skipping anything the admin panel has edited — the same `editedAt` handshake the
pattern guides use. Git stays the place a paragraph is written and reviewed; the
database is what the app reads.

Two requests serve the whole module. `GET /learn/catalogue` is every track,
section and topic heading in one document — about 25 KB compressed, replacing
the lazy chunks that were larger — and `GET /learn/topics/:track/:topic` is one
topic's words. Both carry an ETag and answer a repeat visit with a 304 and an
empty body.

**A request means you opened something.** A hover prefetch on the topic cards and
an idle prefetch of the two pages the arrow keys reach were both built and both
removed: individually cheap, and collectively they turn the network panel into
noise on a page whose entire job is being read. Opening a topic is one request;
going back to one you have already opened is none, because bodies are cached for
the session.

The move made the topic page *faster*, which was not the goal. It used to be two
chained imports — the track index named the topic's loader, so the words could
not start downloading until the index had arrived — and a cold link paid both
round trips end to end. The body's URL comes from the address bar now, so both
requests leave on the same frame.

Every topic carries two or three questions wired to the assistant. Clicking one
opens the chat dock and sends it, so the question the notes did not answer is
one click rather than a context switch.

Adding a track is a folder under `server/scripts/seed/learn/` and an entry in its
registry — see [docs/learn.md](docs/learn.md) for the block vocabulary and how to
add a topic or a track.

### SQL — the 53 topics

| | |
|---|---|
| **Foundations** (4) | What a database is · DBMS vs a file system · The three-schema architecture · Data models |
| **Designing it** (6) | The ER model · Relationships and cardinality · ER diagram → tables · The relational model · Keys · Constraints |
| **Normalisation** (4) | Functional dependencies · 1NF, 2NF, 3NF · BCNF and lossless joins · Denormalisation |
| **The language** (5) | SQL's five families · Data types · Creating and altering tables · INSERT/UPDATE/DELETE · DELETE vs TRUNCATE vs DROP |
| **Querying** (7) | How a SELECT actually runs · WHERE · NULL · ORDER BY and LIMIT · DISTINCT and aliases · Aggregates · GROUP BY and HAVING |
| **Joins** (6) | What a join really is · INNER · LEFT and RIGHT · FULL OUTER and CROSS · SELF · UNION, INTERSECT, EXCEPT |
| **Going further** (6) | Subqueries · Correlated subqueries · EXISTS, IN, ANY, ALL · CTEs · Window functions · Frames, LAG and LEAD |
| **Beyond the query** (5) | Views · Stored procedures · Triggers · Indexes · Privileges and SQL injection |
| **Transactions** (6) | Transactions · ACID · Dirty, non-repeatable and phantom reads · Isolation levels · Locks and deadlocks · MVCC |
| **Fast, and asked** (4) | How a query is executed · Reading EXPLAIN · What makes a query slow · The questions, and the classic queries |

**Every syntax topic prints its result.** That is the thing this track does that
a reference page does not: two sample tables, the query, and the rows that came
back, one under the other. `LEFT JOIN` returning six rows and `INNER JOIN`
returning five is not a sentence to remember, it is two grids on the same page
with a person visibly missing from one of them.

Which means the data has to be the same everywhere, so it is defined once, in
`server/scripts/seed/learn/sql/sample-data.js`: **six employees and four departments.**
Small enough to check a result by eye, and chosen so that two rows carry the
whole Joins section — **Radia has no department** and **Legal has no
employees**. Those are the only rows the six join types disagree about. The same
two tables are behind `COUNT(*)` being 6 while `COUNT(dept_id)` is 5, behind the
self-join that walks the manager chain, and behind the recursive CTE that walks
it to any depth.

**Theory first, and it is an argument.** Sections 1 to 3 are what a DBMS is, how
a schema is designed, and how it is normalised — before a single `SELECT`.
Normalisation is one badly-designed table carried through 1NF, 2NF and 3NF with
the anomaly each step removes named as it goes, rather than three definitions
and three unrelated examples. Transactions get six topics and are worked as
**two-session timelines**: a dirty read is a clock with two columns, not a
paragraph, because that is the only honest way to show what the second
connection could see and when.

The dialect is **MySQL first** — it is what LeetCode grades and what interview
questions assume — with a second code tab where a difference is real rather than
a paragraph about it. Footer links go to the MySQL and PostgreSQL manuals, and to
Wikipedia for the theory topics, which have no vendor.

The last topic is the revision page: ~90 questions answered in a line each, then
the twelve queries that get asked by name — Nth highest salary, duplicates,
department-wise top-N, consecutive rows, running totals, pivoting — each against
those same six employees, with the answer printed.

### Computer Networks — the 35 topics

| | |
|---|---|
| **The idea** (4) | What a network actually is · The OSI and TCP/IP models · Encapsulation, and what a packet is · What happens when you type a URL |
| **The link and the address** (5) | Switch, router, gateway · MAC addresses and ARP · IP addresses · Subnets and CIDR · NAT, and why your laptop is 192.168.x.x |
| **Routes and names** (3) | How a packet finds its way · Joining a network: DHCP · DNS |
| **Transport** (4) | TCP vs UDP · The TCP handshake, and closing down · Ports and sockets · Reliability, windows and congestion |
| **The web layer** (6) | HTTP from the network side · HTTP/1.1, /2 and /3 · HTTPS and TLS · Origins, and CORS · WebSockets, SSE and polling · The other protocols worth naming |
| **Delivering it at scale** (5) | Forward and reverse proxies · Load balancers, L4 and L7 · CDNs, caching and the edge · Latency, bandwidth and throughput · The network security a developer owns |
| **Networking in the cloud** (4) | VPCs, subnets and route tables · Security groups vs NACLs · Route 53, ALB, ACM, CloudFront · Peering, VPN, PrivateLink |
| **When it breaks** (2) | ping, dig, curl, ss, tcpdump · Reading the failure |
| **The interview** (2) | The cheat sheet · The questions, rapid fire |

**Written to a ceiling, and the ceiling is the point.** The reader is a developer
who builds applications, deploys them to AWS and sits interviews — not someone
becoming a network engineer. There is no OSPF, no VLAN trunking, no packet
crafting and no subnet arithmetic drilled for its own sake. Every topic had to
answer one question to get in: *does knowing this change what I would build,
debug or say out loud?*

**The order is the path a byte takes.** Layers and addresses first, because
nothing after them parses without those words; then routes and names, then
transport, then the web layer on top of all of it. Section 6 is the four boxes
that appear in every system design answer — proxy, load balancer, CDN, and the
latency budget they exist to spend — and section 7 is the same ideas with AWS's
names on them, because a route table and a security group are where this reader
actually meets them. **What happens when you type a URL** is the one topic that
is a narrative rather than a reference: the sixty-second version you should say
out loud, and then the same journey in full.

The last two are revision. **The cheat sheet** is every table in the track in
one place — layers, ports, status codes, CIDR sizes, latency numbers,
`Cache-Control`, the AWS mapping — and **The questions, rapid fire** is forty
questions answered at the length you would actually say them, in the order an
interview walks. Where the track overlaps Node — HTTP, CORS, cookies — the split
is the side of the socket you are on: Node teaches you to write the server, this
teaches what the network did before your handler ran.

## SQL Lab — practise the queries

The Learn track teaches SQL; this is where you write it. **117 problems** across
the eight shapes a SQL interview question comes in, and the thing that makes it
a Lab rather than a list: for most of them, **the query actually runs**, against
a real database, in your browser, and the app tells you whether the answer is
right.

| Category | Problems | Runs here | Links out | What it is for |
|---|---|---|---|---|
| Select & filter | 18 | 15 | 3 | Right rows, right columns, one table |
| Sorting & pagination | 7 | 6 | 1 | Order, ties, top-N, the Nth of something |
| Aggregation & grouping | 21 | 7 | 14 | Collapse rows into groups, then filter the groups |
| Joins | 30 | 20 | 10 | Combine tables, and keep the rows that did not match |
| Subqueries & CTEs | 12 | 6 | 6 | A query inside a query, and naming one |
| Window functions | 11 | 6 | 5 | Rank, running totals, the previous row |
| Strings, dates & logic | 12 | 6 | 6 | CASE, text functions, date arithmetic |
| Modify & design | 6 | 6 | 0 | INSERT, UPDATE, DELETE, DDL |
| **Total** | **117** | **72** | **45** | 53 Easy · 58 Medium · 6 Hard |

Category is the default spine; **difficulty** is one toggle (or `g`) away, from
the same payload, exactly as the ladder does it.

### Two kinds of row, and the rule between them

A problem is either solved **here** or solved **where it lives**, and `mode` on
the problem says which. The rule is one line: **if the problem already exists on
a platform, it links to the platform.**

|  | In the Lab | On the platform |
|---|---|---|
| What it carries | Its own schema, rows, expected grid, hints, a solution and an explanation | A title, a summary in our words, a difficulty, a category and a link |
| Where it runs | SQLite compiled to WASM, in a worker, in your tab | LeetCode's judge |
| What marks it | The app compares your result against the expected one | You do, with the status button, after LeetCode says so |
| The row | A button that opens the workbench | An anchor with the external-link mark, exactly like a roadmap row |

Re-typing LeetCode's tables so the same question could be graded a second time
would have been a worse copy in three separate ways. Their judge has the hidden
cases; ours would have five hand-picked rows. Their page has the editorial and
the discussion. And a submission there **counts** — it goes on a profile
somebody is actually building. What the Lab adds to a linked problem is the part
LeetCode does not have: which of the eight categories it belongs to, which Learn
topic teaches the idea behind it, and the same 3/7/21/60 revision ladder every
other problem in this app is on.

The distinction is visible **before** the click, not after it — the linked rows
carry the external mark and an `LC` tag, and a `Where` column says `Lab` or `LC`
outright. A row that silently opened a new tab when the one above it opened a
panel is how a table stops being trusted.

### Where the problems come from

| Source | Contribution |
|---|---|
| [LeetCode SQL 50](https://leetcode.com/studyplan/top-sql-50/) | 45 link-outs, in the plan's own numbering, filed under the Lab's categories |
| [SQL-Interview-Prep-Question](https://github.com/Aafreen29/SQL-Interview-Prep-Question) | Real questions from Facebook, Visa and Wayfair loops — CTR per app, friend-request acceptance rate, page recommendations, histogram buckets — authored here, because none of them has a platform to send you to |
| [CrackingTheSQLInterview](https://github.com/xoraus/CrackingTheSQLInterview) · [Awesome-SQL-Interview](https://github.com/jaimin-bariya/Awesome-SQL-Interview) · [dbms-core-notes](https://github.com/a2rp/dbms-core-notes) · [awesome-database-learning](https://github.com/pingcap/awesome-database-learning) | The theory side, which is the Learn track's 53 topics rather than the Lab's — there is no query to write for ACID or BCNF |
| Written for the Lab | The traps. `NOT IN` with a NULL, `<>` skipping NULLs, `DISTINCT` applying to the row — the mistakes that produce a **wrong answer with no error**, which is the one thing reading about them demonstrably does not fix |

All fifty of the SQL 50 are reachable, but only forty-five are links: the other
five were authored here before the plan was imported, and the local versions are
the gentlest problems in the bank and the ones a beginner meets first. They keep
a credit link to the original. `verify.js` **fails the seed if any LeetCode id
appears twice**, so that arrangement cannot quietly drift into the bank holding
two copies of Big Countries — one you solve here and one that sends you away.

### The engine

`sql.js` — SQLite compiled to WebAssembly — in a Web Worker, so a query that
loops forever costs a worker rather than the tab. ~700 KB, fetched when a
problem is opened rather than when the page loads, so the download overlaps with
reading the statement.

**Nothing leaves the browser.** No SQL is sent anywhere — the server ships
problems and stores progress, and never executes a query. That is what removes
the injection and resource-exhaustion questions a server-side runner would have
raised, and it is why the whole content half of the API is three read endpoints:
the bank, one problem, and the category counts.

The dialect people write is **MySQL**, because that is what the Learn track
teaches and what LeetCode grades — so the missing functions are shimmed onto the
SQLite handle rather than the SQL being rewritten. `DATEDIFF`, `DATE_FORMAT`, `DATE_ADD`,
`DATE_SUB`, `ADDDATE`, `SUBDATE`, `IF`, `LEFT`, `RIGHT`, `LOCATE`, `NVL` and
MySQL's `TRUNCATE`. A rewriter would be a second
SQL implementation and a second set of bugs nobody could see from the query they
typed. Where a difference is real and cannot be shimmed, the problem says so in
a `dialectNote` — 16 of them do.

### How a problem is graded

The expected result is **generated, never typed**. `npm run seed:sql:verify`
runs each reference solution against the same sql.js build and the same shims
the browser will use, and whatever comes back *is* the expectation. A
hand-written grid would be a second opinion about the answer, and the two
disagree eventually — at which point the Lab tells somebody with a correct query
that they are wrong, which is the one failure that makes the module worthless.

That closes one hole and opens another: running a solution proves it **runs**,
not that it answers the **question**. So every problem carries a hand-written
`expectRows`, and the verifier fails the seed when the count it produced
disagrees. It is the cheapest possible assertion against the most expensive
possible mistake.

Three more things the verifier refuses to write:

- a problem marked `orderMatters` whose reference solution is **not order-stable
  across two runs** — an `ORDER BY` that does not fully determine the order would
  fail correct answers at random;
- a linked problem carrying a `setupSql` or a `solutionSql`, because a fragment
  of half-finished local authoring left on a link-out is how one problem ends up
  existing twice with the two halves disagreeing;
- two linked problems pointing at the same URL, or any two problems claiming the
  same LeetCode id.

`orderMatters` is `false` by default and set on 61 problems — only where the
question actually asks for an ordering, because a query with no `ORDER BY` has
no defined order and grading one positionally is a coin toss. The six `modify`
problems are graded differently again: an `UPDATE` returns no rows, so the
reader's statements run for their side effects and a `checkSql` the problem
carries runs afterwards against the table they left behind.

### The workbench

Two panes, because the point of the screen is seeing the question and your
answer at once: the statement, the sample tables and the expected grid on the
left; the editor, the verdict and what you actually got on the right. A wrong
result is **diffed cell by cell** rather than merely rejected.

Hints are progressive and revealed one at a time; the reference solution sits
behind the same 25-minute clock as every editorial in the app, and peeking is
recorded the same way. Your draft is kept per problem, so closing the workbench
to go and read a Learn topic and coming back does not lose what you had written.
A first pass puts the problem on the revision ladder; running it again does not,
because re-running a solved query here is free and celebrating it every time
would make the message mean nothing.

## Pro Coder — competitive programming

A second curriculum, for a different goal. The roadmap answers "am I ready for
an interview loop"; Pro Coder answers "how do I get from 1200 to 1900 on
Codeforces". Different problems, a different progression signal, and its own
everything — collections, routes, filters, columns, theme and coach.

**1,100 problems.** 800 Codeforces and 300 CodeChef, across **49 CP patterns** in
**7 rating tiers**:

| Tier | Codeforces rating | What it is for |
|---|---|---|
| Foundations | 800–1000 | Read the statement, write the loop, print the answer |
| Pupil | 1100–1300 | One observation stands between you and the answer |
| Specialist | 1400–1500 | The standard toolkit becomes automatic — where most people stall |
| Expert | 1600–1800 | Two ideas per problem instead of one |
| Candidate Master | 1900–2100 | Heavy machinery, used precisely |
| Master | 2200–2400 | Flows, DP optimisations, polynomials, decompositions |
| Advanced | 2500+ | Geometry, persistence, randomisation, and what fits no name |

49 patterns rather than the roadmap's 22, because interview prep splits problems
by what you have to *recognise* and CP splits them by what you have to
*implement*. "Dynamic programming" is one interview pattern and eight of these —
someone fluent in knapsack is not thereby able to write a digit DP.

The page is organised on two axes and you pick the spine. **Tier** is the
default, because rating is what actually gates what you can attempt; **Pattern**
is one toggle (or `g`) away for when you are drilling a technique across the
whole range. Both groupings are derived from one payload, so flipping between
them costs a re-render rather than a request.

### Where the problems come from

| Source | Contribution |
|---|---|
| [Codeforces API](https://codeforces.com/apiHelp) | 11,363 problems with ratings, tags and solve counts; 2,143 contests for division and date |
| [CodeChef practice API](https://www.codechef.com/practice) | 4,086 rated problems, then tags and editorials for the shortlist |
| [CP-31 Sheet](https://github.com/shobhitraj1/CP-31-Sheet-Solutions) | 31 problems at each rating 800–1500, with a C++ reference solution each |
| [Codeforces Ladders](https://github.com/karansinghgit/CodeForces-Ladders) | Div. 2 A–E, 100 problems each, with ratings |
| [A2OJ Ladder](https://github.com/rishabhdeepsingh/A2OJ-Ladder) | ~150 topic lists — the human-assigned pattern labels |

The sweep alone would give you a list, not a curriculum: score correlates with
solve count, solve count correlates with how common a tag is, and the top 600
by score is 70% Div. 2 A and B. So selection fills a **(pattern × tier) grid** —
each pattern gets a quota spread across the tiers it actually appears in — and
ranks within each cell by solve count, curated-sheet weight and how confident
the pattern assignment is. A problem named by a curated sheet bypasses every
filter, because a human who put it on a syllabus has already answered the
question the filters approximate. 986 of the 1,100 are named by at least one
sheet; 312 carry a reference solution.

The ladder grew from 800 to 1,100 by raising `TARGET_CF` and `TARGET_CC`, not by
lowering a bar: 11,363 Codeforces problems and 4,086 CodeChef ones are on disk,
3,872 of the latter clear the submission and solver floors, and `minSolvers()`
is unchanged — so the extra 300 come off the top of a deeper selection. Note that
a target only binds if the quotas can reach it. The top-up pass refuses to take
any pattern past 1.5× its quota, so the CP pattern quotas had to be scaled by
four thirds in the same change; without that the run would have stopped at 795
and the shortfall would have looked like a thin pool rather than arithmetic.

Pattern assignment is a priority list, not a lookup: a Codeforces problem
carries several tags and only one is the technique being taught, so
`dp + trees + dfs` is filed under DP on Trees rather than Linear DP. Where a
curated sheet has an opinion, it wins over the tags.

### Reference solutions

`npm run seed:cp:solutions` attaches links to accepted submissions from four
public repos — abeaumont, Erfaniaa, hhhrrrttt222111 and mhdnazrul — taking
coverage from 195 problems to 312 of 1,100. It is additive and idempotent: it
never removes a link, never overwrites the CP-31 solutions the curator already
attached, and de-duplicates by URL, so re-running it does not stack duplicates.

**These are other people's submissions, not editorials.** They are unreviewed,
and the editorial link already on 294 problems is the better source and stays
first; this fills the gap where there is no editorial at all.

Every source is included because its paths or its index table name a problem
*identifier* — a Codeforces contest id and index, or a CodeChef problem code.
Repos that name problems only by title were looked at and rejected: Codeforces
titles repeat across contests, so a title match produces confident links to the
wrong problem, and a wrong link is worse than no link because you only discover
it after clicking. All 195 attached links were verified to resolve, and to carry
the problem's own identity somewhere in the URL.

### Codeforces handle sync

Link your handle and the ladder stops asking you where you are. It pulls
`user.info` for your live rating and rank, and `user.status` for every accepted
submission, then marks the ones that are on the ladder.

The rule is that **sync never downgrades**. It may mark a problem solved; it
may never un-mark one, clear a flag, drop a note or reset a schedule. A row that
already exists gets only the three platform fields written to it. A problem
Codeforces says you solved but you never logged here shows as `AC` on the row
rather than being silently ticked — that is a prompt worth having, and there is
a bar filter for exactly that list.

Rating drives the coaching too: the tier rail marks where you actually are, and
a problem more than ~200 above your rating is called a stretch problem rather
than something you should be getting.

One sync per account per ten minutes — `user.status` is the largest response
Codeforces serves, and the whole app shares one IP against a per-IP rate limit.

### Guides

Every one of the 49 patterns carries a **brief**: the invariant, when it fires,
its complexity, what goes wrong, and a reading list pointing at cp-algorithms
and the USACO Guide. It ships with the ladder and renders on the first frame.

The **12 core patterns** — the Pupil-to-Specialist backbone, where almost
everybody stalls — additionally have a full write-up with Java and C++
implementations, in the same reader the roadmap's guides use:

prefix sums · two pointers · greedy & the exchange argument · binary search on
the answer · gcd/divisors/sieve · modular arithmetic · BFS & DFS · DSU ·
shortest paths · linear DP · knapsack · Fenwick & segment trees

### The theme

Pro Coder gets its own look, and it is one CSS wrapper rather than a second
stylesheet. `.cp-root` redefines the design tokens every component in the app
already reads, so the modals, chips, dropdowns and tables the ladder *reuses*
re-skin themselves for free. The glass panels and the ambient wash it introduced
are the app's own material now — see [The material](#the-material) — so what
still makes this its own room is the palette on top of them: a deeper canvas, and
Codeforces' rating ramp as the only real colour on the page, where a tier's band
is a 6px dot and a progress bar rather than a saturated edge on every card.

The glass is translucency over that wash and nothing else. There is no
`backdrop-filter` in the module, or anywhere else in the app, and that is
measured rather than assumed: a blurred backdrop is re-rasterized whenever
anything behind it paints, and on the expanded 805-row ladder it took scrolling
from a 16.7ms median frame to 56.5ms — 87 of 88 frames past the 32ms line. The
same page with a plain translucent fill drops no frames at all.

It follows the appearance setting, in both directions. An earlier version pinned
itself dark in both themes, which made the one screen you might spend an hour on
the one screen that ignored what you picked — and portalled dropdown menus
(those render on `<body>`, outside the wrapper) came back in the *app's* theme,
so a light-theme reader got a white menu falling out of a black page. Following
the theme deletes the mismatch that caused it. The accent is not redefined
either: whichever colour you chose is the one the ladder wears.

The page runs full width rather than inside the shell's 1500px well — seven tier
cards across the top and up to fourteen table columns are what the width is for.

`.cp-root` carries tokens and nothing else, which is what lets the guide reader
wear it: the reader is the roadmap's own full-viewport `.reader-*` layout, in the
ladder's palette.

### Filters and columns

Independently filterable by platform, so Codeforces and CodeChef never blur
together. Rating is a **range** filter with one-tap bands; tier, division,
problem letter, pattern, topics, contest and curated sheet are all there, plus
bar toggles for flagged, needs revision, added-by-me and *solved on judge, not
logged*.

Judge tags are their own opt-in column and filter, off by default. A Codeforces
tag list is the editorial's answer key — `dp, bitmasks` on a problem you have
not started is most of the solution — so seeing them is something you switch on
rather than something that happens to you. The `topicTags` shown on the row are
our own, coarser taxonomy.

CodeChef ratings are never mixed into a Codeforces number. The two scales were
calibrated against different populations — a CodeChef 1600 sits well below a
Codeforces 1600 — so the rating filter and the stats histogram are Codeforces
only, and a CodeChef difficulty renders in its own style rather than wearing the
Codeforces colour ramp.

### Seeding it

```bash
cd server
npm run seed:cp            # fetch → sheets → codechef → curate → db → guides
npm run seed:cp:curate -- --dry   # print the distribution, write nothing
```

Same contract as the roadmap seed: idempotent, upserts by slug, prunes retired
problems, and never touches your progress, your own additions, or anything the
admin panel has edited. `data/raw/cp/` and `data/cp/curated-cp.json` are
committed, so a curate run is a pure function of files on disk rather than of
whatever Codeforces was serving that afternoon.

## Practice — drill and mock

Two exercises *over* the curriculum. Neither writes to a problem row: a drill
answer is a recognition and a mock is a session with a shared clock, and the
attempt log is supposed to mean "I sat down with this problem". They get their
own collections, `DrillRun` and `MockRun`.

**The pattern drill** shows a problem's title and difficulty — and deliberately
not its topic tags, which would answer the question — plus six techniques, one of
which is right. Number keys answer, Enter moves on. It needed no new content:
every one of the 517 problems already carries a `patternSlug`.

The case for it is arithmetic. An interview is decided in the first ninety
seconds, on recognising what shape the statement is; everything after that is
implementation you can already do. Re-solving trains the implementation at
twenty-five minutes a repetition. This trains the recognition at about three
seconds, so a minute is twenty repetitions of the part that was failing. Misses
are stored per run, and the **most missed** panel is the one weakness the rest of
the app cannot see — a pattern you never recognise is a pattern you never
attempt, so it is not a low number anywhere else.

**The mock harness** draws two unsolved problems, runs one clock across both,
keeps the editorial and the walkthrough off the page entirely, and holds the code
box locked until the approach is written down — because saying it before you type
is the half of the round most people skip. It ends in four questions you answer
honestly: did I clarify, did I state complexity, did I test an example, did I
narrate. No model marks it. Those four are what candidates actually lose on, and
each is something you can answer about yourself; what was missing was never the
judgement, it was being made to sit the exam.

## The editorial gate

The walkthrough and the article are behind twenty-five minutes on the problem,
and it is a hard block rather than a warning — a warning gets clicked through at
minute four, which is exactly where the learning would have been.

What counts as time spent is two numbers added together: `progress.attemptMinutes`,
which is the sum of every sitting already logged and is computed server-side on
every row, plus the running clock if it is on this problem. The durable half is
what makes a hard block survivable — gating on the live timer alone would mean
closing a tab locks an editorial you had genuinely earned. A solved problem is
never gated: you have earned the answer, and comparing yours against a better one
is the most useful thing you can do next.

Opening one is remembered locally for a day so the next attempt logged against
that problem arrives with `peeked` already ticked — not once the problem is
solved, though, because reading an editorial to compare answers is reading, not
peeking.

## Where you actually struggle

Stats used to call its pattern panel "Weakest patterns" and rank by *least
complete*, which is a fact about the plan rather than about you — a pattern at
0/27 is untouched, not hard.

The leak report ranks by **relearn rate**: attempts per problem solved, read out
of the attempt log. 1.0 means it went in first time; above 2 is a pattern you are
re-learning rather than learning. Beside it: how many solves needed a hint or a
video, how many sittings ended without one, and the most common failure reason.
It only appears once there are four attempts across two problems in a pattern —
two attempts on one problem is a bad afternoon, not a weakness — and until then
the coverage view stands alone, which is the honest order. The Playbook shows the
top two on its Today tab, as the one signal allowed to argue with the schedule.

## Playbook — the prep plan

A dated, phased schedule that turns 396 of the 517 roadmap problems, the
≤Specialist half of the 1,100-problem ladder and all 117 SQL Lab problems into a
week-by-week timetable, and reads your actual progress back out of them.

**It is an ordinary module, and it used to not be.** `playbook` was marked
`owner: true` in `server/src/config/modules.js` — a third kind of hidden, pinned
to the account in `SUPER_ADMIN_EMAIL`, invisible to every other role and not
toggleable from the panel at all. That flag is gone and so is the mechanism
behind it: `OWNER_MODULE_KEYS`, the `playbook` capability in `config/roles.js`,
and the branch each of `moduleAccess` and `requireModule` carried for it. The
key is now in `visible` for every role and hideable from **Admin → Modules**
like the nine beside it.

Nothing about the data had to move, because the data was already right. The
`Playbook` collection is one document per account keyed on `owner`, unique and
immutable, and both handlers query on `req.userId` — the start date, the ticks
and the retro lines have always been per-user, and every number on the page is
derived at render from *that* account's roadmap and ladder rows. A second
account opening it sees the same authored schedule with its own zeroes under it,
which is what the other curriculum modules do. The owner-only rule was a claim
about the plan, not about the module, and it cost no migration to drop.

**The plan text has two readings, and the account decides which one it gets.**
It is written in the second person to a specific starting point — an
average-pace learner two years out of college DSA, in a Node/React job, aiming
at Swiggy/Razorpay-tier loops — and about twenty-five of its sentences lean on
that person's CV: the systems they built, the stack they work in, the things
they said while the plan was being written. Shown to everybody those read as a
plan addressed to somebody else, which is the fastest way to stop trusting one,
and they put one account's employment history in front of every other account.

So those lines are authored twice, side by side in the same call:

```js
body: voiced(
  'Reaching a brute force first is not a weakness to skip past — …',   // everyone
  'You already do this — it is the habit you called a weakness. …',    // the author
),
```

`speak()` walks the document and collapses every `voiced()` node to one reading;
both are resolved once at module load, because there are exactly two possible
documents and rebuilding either per render would be work spent on nothing.
`planFor(own)` is the only way out of the module — the raw structures are
deliberately **not** exported, so a component cannot import `WEEKS` directly and
render `[object Object]` where a voiced line should be. Components take the
resolved document as a `doc` prop from the page, which reads it once through
`usePlan()`; one render can therefore never mix the two.

Side by side rather than in a second file, because the only real risk is drift:
a generic line reworded six months from now should have its personal twin on the
next line, not in a module nobody remembers to open. 25 strings of 899 differ;
ids never do, so a tick survives whichever reading you are shown.

`usePlan()` keys off `user.role === 'super_admin'` rather than a capability. A
capability answers "may this account *do* this", and this only decides which of
two sentences renders — dressing it as a boundary would overclaim, because
**both readings ship in the client bundle either way.** This is a presentation
split, the same trade the Learn prose makes: whoever reads the bundle finds
both. Anything that genuinely must not reach another account cannot be authored
in `plan.js` at all — it would have to be served from the API for the accounts
allowed to see it.

**Twenty-four weeks, four phases.** Rebuild the base (weeks 1–5, the patterns you
half-know, re-done for the optimal solution), the core machine (6–13, binary
search through greedy — the eight patterns that decide most loops), hard mode
(14–18, DP and hard graphs, one a week, no stacking), and interview mode (19–24,
no new patterns — recall, speed, company sets and talking while you code). Weeks
13 and 18 carry no new problems at all; they are what stops the middle of a plan
like this from falling apart.

**Targets are weighted, not divided.** An Easy counts 0.6, a Medium 1.0, a Hard
1.6. The sixteen weeks that carry new work come to 429 weighted units, ~27 a
week, which is what each week is actually built to — so the DP weeks ask for
fewer problems than the arrays weeks and cost the same evening.

**The plan targets 396 of the roadmap's 517, and the gap is the point.** It used
to target all 429, back when 429 was the whole roadmap. When the roadmap grew to
517 the arithmetic stopped working: covering everything in the same twenty-four
weeks means 34 units a week against a 33h/week budget that was already full,
which does not produce a better-prepared candidate — it produces a plan you are
behind on by week six and a drift line you learn to ignore.

So the schedule targets a subset and the roadmap keeps the rest: everything on
Striver's SDE Sheet or NeetCode 150, plus everything reported asked at a named
company in 2025-26. That is 401 problems and exactly 429 weighted units, very
slightly *lighter* per week than the plan already was — so the twenty-four weeks
and the target date hold without being renegotiated. This is what the recency
signal is actually for: at 33h/week the binding question was never which problems
exist, it was which 400 of them to do.

Two consequences, both of which look like bugs if you don't know:

- **The phase bars still divide by every problem in the pattern**, not by the
  targeted subset. They answer "how much of this pattern have I done", which is a
  question about you; the weekly target answers "what does this week ask for",
  which is a question about the schedule. Restricting the bars would mean solving
  an untargeted problem moved nothing, and a bar that ignores real work is worse
  than one that never reaches 100%.
- **`concurrency` is targeted by no week.** Six problems asked in a dedicated
  round at Databricks and Netflix, neither on the target list, and not an
  algorithm pattern — putting it in the ramp would spend a week of the ramp to
  buy nothing. It stays on the roadmap. Five of the subset's 401 are concurrency
  problems, which is why the week targets sum to 396 rather than 401.

**The plan is authored, the state is stored.** Phases, weeks, rules, the
timetable and the system-design track live in `client/src/playbook/plan.js`, like
the Learn track's prose and for the same reason: a document, identical for every
render, where editing a sentence should be a commit and not a migration. The
`Playbook` collection holds only the three things that file cannot know — the
start date, the ticked ids, and the weekly retro lines. Everything else is
derived at render: a phase's bar is the real solved count of the patterns it
owns, read out of the roadmap, so the only way to move it is to solve something.

**The one number that governs the week** is the drift line under the header:
problems solved against problems the schedule expected by now, stated as a count
and not softened. Ahead, on track, or *n* behind with what to cut.

**Four tracks, because the target loops are not only DSA.** The plan is aimed at
MAANG-bar Indian product companies — Swiggy, Razorpay, Flipkart, Uber, CRED,
PhonePe, Atlassian — alongside the MAANG loops themselves, and those loops run
two DSA rounds, a machine-coding or LLD round, an HLD round and often a SQL
screen. A plan that spent twenty-four weeks on algorithms alone would leave a
candidate strong in the round he shares with everyone else and untested in the
two rounds where three years of shipping backend code is an advantage.

| Track | Weeks | Slot | Size |
|---|---|---|---|
| DSA | 1–24 | mornings, Saturday | 396 problems + 150 ladder |
| SQL | 4–15 | Friday evening, 90 min | all 117 in the SQL Lab |
| HLD | 13–24 | Tue/Thu evening + Sunday | 25 topics in six blocks |
| LLD & machine coding | 14–22 | Sunday, 90 min | 24 topics, 8 of them built |

**Nothing was added on top — both new tracks are funded.** 33 hours was already a
full week beside a full-time job, and a plan that quietly asks for 38 is one you
fail in week three. So SQL takes the Friday evening re-solve hour (the worst DSA
hour in the schedule and the first one anyone skips; Friday morning's flagged
problems roll into Saturday), and LLD takes the Sunday ladder session, halving
the ladder from week 14 — 150 CP problems rather than 192. That second trade is
the cheapest hour in the plan to move: rule 7 already says the ladder is bought
for implementation speed and never for rating, and by week 14 that speed is
bought. The honest version of "I added a design track" is always "I removed
something else", so `plan.js` says which.

A `TIMETABLE` slot carrying `replaces` takes over a block that already exists
rather than adding one, and that flag is also what keeps
`PLAN_TOTALS.hoursPerWeek` honest — a replacement counted as an addition would
advertise a 38-hour week to someone who has 33.

**The Method tab answers the questions a schedule cannot.** Six panels, ordered
from the smallest unit of work outward: the week; the six-step loop for a single
problem, every step on a clock; the five-stage ladder for getting comfortable
with a whole pattern, with hours attached to each stage; what a pattern costs
once you are confident (2 problems a month, ~30 min — and what re-opens it); the
four revision intervals and their real price (4.5h/week, 14% of the budget); the
four mental models that make 400 solved problems into 400 *available* ones; and
the eleven rules last, because a summary read before the thing it summarises is
just a list.

**Company sets name the tags that exist.** The roadmap carries 20 company tags
and Swiggy, Razorpay, CRED and PhonePe are not among them. Week 22 therefore
drills Flipkart, Uber, Atlassian, Goldman Sachs and Amazon as the proxy — those
loops draw from the same medium pool — and says so, rather than sending you
looking for a filter that returns nothing.

## Tracking

- **Status** — click the circle to cycle not started → attempted → solved
- **Flag** and **needs revision** — one click each
- **Statement** — expand a problem to read it inline, fetched from LeetCode on
  first open and cached in the DB afterwards
- **Notes** — inline, autosaving, with a 1–5 confidence rating
- **Log attempt** — a stopwatch, five outcomes, and a note, a colour and a
  confidence per sitting, correctable for half an hour after logging — see
  [Attempts](#attempts)
- **Your solution** — the code you actually wrote, in Java, C++ or JavaScript,
  stored per sitting and rendered back highlighted. Nothing runs it; it is there
  so you can read attempt 2 against attempt 1 and see whether you fixed the bug
  or repeated it
- **Why it failed** — on a sitting that did not solve it, one tap: *no approach ·
  too slow · edge case · language · ran out of time*. Five different missing
  skills that used to be one word, and after two hundred problems the histogram
  of them is the most actionable thing in the app
- **Revision queue** — solving schedules a review on a 3/7/21/60-day ladder,
  stretched or compressed by your confidence

### Attempts

A sitting with a problem, written down: how long it took, how it went, and what
you want to remember about it. The clock icon on any row opens the log.

**Three columns, and none of them scrolls.** The dialog is the app's widest at
1220px, and the width buys a shape rather than more room for the same ribbon:
the sitting you are logging on the left — clock, minutes, outcome, confidence,
note — the code you wrote in the middle, and every sitting before this one on
the right. Stacked in one column, as it was, the button you came to press was
two screens below the chips you came to tap, and the log you keep beside you
while writing the note was under it.

The columns are stretched to each other, so the code box takes whatever height
the form beside it happens to be — a chip row added later changes it with no
number to update. Only the log scrolls, capped at 62vh, which is what keeps a
problem with twenty sittings the same height as one with two. Below 1120px the
form's two columns stack and the log keeps its rail; below 860px everything
stacks and the log goes under the form. Wide, but never full-bleed: `.modal`
takes its 20px gutter out of its own width rather than expecting a margin to
find room beside it, which is a thing no dialog here did correctly and none of
them was wide enough to show.

**The stopwatch.** Start it, close the dialog, go and solve the thing — it keeps
running in a pill in the top bar next to the task timer, and the row's clock
icon pulses so the table says which problem is being counted. Open the log again
and the elapsed time is already in the minutes field, marked `timed`, and it
keeps tracking the clock while the dialog sits open. Touch a preset or type a
number and it stops: then the number is yours and the `timed` mark comes off,
because a measured minute and a guessed one should not read as the same evidence
when the question is whether you are getting faster. Presets are still there —
5 / 15 / 30 / 45 / 60 / 90 — and logging with the defaults is still two taps.

Unlike the task timer, this clock is *local*. A task's tracked seconds are a
property of a server object that outlives the tab; a problem's are a measurement
in flight, which becomes `minutes` on an attempt the moment you log it and is
the server's from there. So it lives in localStorage: no model, no endpoint, no
round trip per tick, and one cost — a clock started on the laptop is not running
on the phone. It is anchored to a wall-clock instant rather than counting ticks,
so a reload, a sleeping laptop and a background tab all come back with the right
number. Twelve hours is the cap, the same one the board takes.

**Five outcomes**, and the table in `server/src/config/attemptOutcomes.js` is the
rule rather than a branch in the controller:

| outcome | marks it solved | flags it for revision |
|---|---|---|
| Solved | ✓ | – |
| With hints | ✓ | – |
| After video | ✓ | ✓ |
| Partial | – | ✓ |
| Stuck | – | ✓ |

"After video" is why the table exists: it solves the problem *and* should bring
it back around, which is not something a boolean can say. An outcome may raise
the revision flag and may never lower one — how one sitting went is not evidence
that a flag you set by hand no longer applies — and getting stuck on something
already solved does not un-solve it.

**A note, a colour and a confidence per attempt.** Each has a twin on the
problem itself, and the pair says two different things. The problem's note is
what you eventually understood; the attempt's is the account of one sitting. The
problem's confidence is the current number the revision ladder multiplies by and
is overwritten every time you log; the attempt's stays where it was written,
which is what turns the log into a series — 2 → 3 → 4 over three sittings is a
problem you are learning, and three 2s is a problem you are re-reading. The
colour is a mark you put on a sitting to find it again, from the same named
palette the board's columns are drawn from, so it survives a theme switch.

**Editable and deletable for thirty minutes, then not.** All three fields can be
changed after the fact and the whole attempt can be removed — which is the way
out of a mis-tap that used to mean deleting the problem — but only inside a
half-hour window from when it was logged. The log is a record, not a draft:
left open forever it stops being evidence of anything, because a history you can
rewrite at leisure is a history that agrees with whatever you believe today,
which is the opposite of what timing yourself is for. Left closed entirely it
punishes the ordinary mis-tap — logging against the row above, or 30m when you
meant 3. Half an hour is the span in which you are still in the sitting you just
logged and can remember what happened in it.

Each row counts its window down (`24m left`, then `40s left`) and says **locked**
once it is gone, so the Edit button disappearing has a visible reason rather than
reading as a bug. An editor still open when the window closes shuts itself — a
textarea whose next save will be refused is one that quietly eats what you typed.
The rule is the server's: `ATTEMPT_EDIT_WINDOW_MS` in
`server/src/config/attempts.js`, enforced in the update's own filter so the check
and the write cannot drift apart. The client mirrors it to draw the countdown.

The window is measured from `loggedAt` and never from `at`. They are the same
instant today and are not the same fact: `at` is when the sitting happened and is
what a "log yesterday's attempt" feature would let you set, `loggedAt` is when
the record was written and is immutable. A grace period anchored to a value its
beneficiary can choose is not a grace period.

Deleting one removes the sitting and nothing else: the row's status, its solve
date and its place on the revision ladder are the server's reading of everything
up to now rather than a running total of the array, and recomputing them would
need the history the delete just threw away. If the status is actually wrong,
the circle in the first column is one click.

The **Attempts** column draws one chip per sitting, oldest first, with the
outcome on the border and your colour down the left edge: three attempts ending
in green is a different problem from three ending in red, and the count column
beside it cannot tell them apart. It ships with the roadmap — the last four
attempts with their notes cut to 120 characters, which is what the tooltip
shows. The dialog fetches the whole log with whole notes, because that is worth
a request once you have opened it and is not worth shipping 517 times over.

**Attempts carry ids**, and did not always. While the array was append-only an
index was a stable address and the sub-documents were stored with `_id: false`.
Delete ended that: once a sitting can be removed, every index after the hole
shifts, so an edit issued against a number read a moment ago lands on the wrong
one. An id does not move.

Attempts logged before that change have neither an id nor a `loggedAt`, and both
have to be backfilled — one command, safe to run twice:

```bash
cd server && npm run migrate:attempt-ids
```

It is not optional and it is not only for old data. An attempt with no id cannot
be addressed by the edit and delete endpoints, so the dialog shows it as
**locked** — which is true, and reads as a broken clock, because the reason on
screen is a deadline that has not passed. Anything logged in the half hour
either side of the deploy is exactly the case that looks wrong, and so is
anything logged by a server process that has not restarted onto the new code.
Hovering a locked row says which of the two it is. `loggedAt` is copied from `at`
rather than stamped with now, so migrating does not hand every attempt in the
history a fresh half-hour of editability.

### Filtering

The whole curated list — ~520 problems — ships in one response and the client
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

The roadmap runs **full width**, the way Pro Coder, the Playbook and the SQL Lab
do, rather than inside the shell's 1500px well. With a dozen columns showing —
company logos, topics, sheets, tries, the attempt chip and the track strip — that
well was making the table scroll sideways while the right-hand third of a wide
monitor sat empty. Every column but the title is a fixed width you chose, so the
width handed back goes two places: fewer columns pushed off the right edge, and
the rest of it to the title, which is the one column that grows.

Twenty-four columns exist; you choose which you see. **Columns** in the toolbar
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

**Three sources, one list.** The roadmap, the Pro Coder ladder and the Learn
tracks keep separate collections and come due independently, so the page fetches
all three queues and merges them, badges the non-roadmap rows, and offers a
toggle once there is anything in a second one. Any request failing leaves the
others rendering — a hidden module empties nothing.

**Test mode.** The default queue is a list you look at and press *I got it* on,
which tests nothing: the problem is in front of you while you decide whether you
remember it. Test mode collapses each row to its **title alone** — no difficulty,
no companies, no tags, all of which are hints — and asks for the trigger and the
approach before anything is revealed. The reveal then shows your note, the last
solution you wrote, and *what you said this problem was the last three times*.
Reading "I said prefix sums" from two months ago next to what you just typed is
the clearest signal in the app that something has or has not stuck. The line is
kept whichever way the review went, and especially when it went badly.

The ladder is 3 → 7 → 21 → 60 days, multiplied by confidence: 1 shrinks the gap
to 0.4×, 5 stretches it to 2×. It caps at 60: `LADDER_DAYS[min(stage, 3)]`.

### Two ways in, so two ways out

A row is in the queue because `needsRevision` is set **or** because
`nextReviewAt` has passed, and the two actions on it mean different things:

| | |
|---|---|
| **✓ I got it** | a review that went well. The ladder moves on a rung and the next date is recomputed from today |
| **↻ Take it off** | clears the flag, and clears the schedule *only if that schedule is what put the row here*. One still in the future is left alone — dismissing a flag should not silently retire a problem from revision |

Both go to `POST /progress/:id/review` with `result: 'recalled' | 'dismissed'`,
and **not** to the status patch. That is the fix for a real bug: both buttons
used to send `{ needsRevision: false }`, which does nothing at all to a row that
is due by schedule. `patchProgress` could not have helped either — it advances
the ladder only when the status *transitions* to solved, and a row due for
revision is already solved. So the row vanished optimistically, the write
succeeded, no error showed, and it was back on the next load. Twenty-one of
twenty-six rows in one real queue were stuck that way, some overdue by twelve
days.

The lesson is in the route, not the patch: "set this field" and "I reviewed
this" are different requests, and only the second one has any business moving a
schedule.

## Tasks

The roadmap records what happened. This records what you *meant* to happen — a
sentence like "I'll do these three sliding-window questions today" is about
three problems at once, has a deadline, and is true before any of them is
opened, so `Progress` has nowhere to put it.

One board per account. There is no board switcher and no assignees: this is a
self-learning platform, so the board has exactly one reader, and the space a
column of avatars would take goes to the two things that actually matter here —
the questions attached and the time spent.

**Four views over one fetch.** Board, List, Table and Calendar all read the same
array. The whole board arrives in one request and is filtered in the browser,
the same bargain the roadmap strikes and for the same reasons: the collection is
bounded at 500 tasks, every view needs the whole set to group and count, and a
paged board cannot tell you how much is in the column below the fold. Which view
you are on is a device preference, not an account one — it depends on the screen
you are at. Below 760px the board falls back to List, because four columns in
360px is a horizontal scroll showing one column at a time, which is a worse list
than a list.

### The four views

| view | what it is for |
|---|---|
| **Board** | the shape of the week. Columns, cards, drag. The default, and the only one that cannot be drawn on a phone |
| **List** | working through a task. Rows grouped under their column, with subtasks and questions nested and tickable in place. Also what the board becomes below 760px |
| **Table** | the questions the board cannot answer — what is oldest, what has taken longest, what is due first *across* every column at once. Six sortable columns |
| **Calendar** | a month by deadline, with an **Unscheduled** tray beside it. Drag a task onto a day to give it a deadline, or back to the tray to clear it |

The Table deliberately does not use `useTableLayout`. That hook is bound to the
roadmap's 22-column registry and its saved layout, and the show/hide/resize/pin
it buys is worth having on 22 columns and not on six — bending it here would
couple two screens that have no reason to move together.

The Calendar's tray is not a nicety either. Deadlines default to unlimited, so
most tasks have none; a calendar that drew only the dated ones would show an
almost empty month and read as broken rather than as accurate.

### Narrowing it down

Search is a plain box over title, notes, tags, subtask titles and question
titles. Filters are the roadmap's engine, declared in `filters/tasks.js`:
priority and deadline in the dialog, three flags in the bar, tags from whatever
the loaded board actually uses.

The two are treated differently on purpose, the same split the roadmap makes: a
**filter** describes a view you want to come back to, so it is saved to the
account; a **search** is a thing you are doing right now, so it is not. Opening
the board to three cards and no visible reason why is the failure that avoids.

There is deliberately no filter on *column*. The board **is** the columns, so
narrowing by one would empty three of the four panes it is made of — and in List
and Table the grouping already does that job.

### Columns are yours

Add, rename, recolour, reorder, delete. The colours are the shared block hues,
stored as a *name* and resolved by `[data-hue]` in `tokens.css` — a stored
`#26c281` would be a dark-theme green forever, and this way one attribute
recolours a column in both themes.

What a column **means** is a separate field from what it is called:

| kind | |
|---|---|
| `open` | work that is waiting. Most columns |
| `active` | where started work lives |
| `done` | finishes the task, stamps it, and stops its clock. Only one per board |

Behaviour hangs off `kind` and never off the name, which is the whole point:
rename "Done" to "Shipped" and completion, the stopped timer and the filled ring
all still work. Matching on the string is how that quietly breaks the first time
somebody edits a column. Changing a column's kind re-completes — or un-completes
— everything already sitting in it, so `completedAt` means the same thing however
it was set.

Deleting a column that holds tasks asks where they go. It is not a yes/no
question, so it is not a `ConfirmDialog`: deleting the tasks with the column
would make a mistyped name unrecoverable, and moving them somewhere you did not
pick is a guess that is only ever noticed too late. The last column cannot be
deleted — a board with none has nowhere to put the next task.

### Dragging, and the two ways that are not dragging

Cards drag between and within columns, with a line showing where the card will
land and **nothing moving until the drop**. That is a gap indicator rather than
the guide editor's swap-on-hover, which mutates the list under the pointer while
you are still deciding, so a drag across four cards shuffles all four and the
drop lands somewhere you did not choose.

Drag is a shortcut, not the only path. Every card has a `…` menu with **Move
to**, and `[` / `]` move a focused card between columns — a touchscreen has no
hover and a keyboard has no drag. Same argument the column layout editor makes
by putting up and down buttons beside its grip.

A move sends the destination column **in full**, in the order it was drawn:
`POST /tasks/move` with `{ id, status, ids }`. So within-column and cross-column
moves are one operation with no second endpoint to keep in step, and the server
never has to reconstruct what the board looked like. Deliberately not fractional
indices — a personal board has tens of cards per column, a full-column write is
one round trip and cannot drift, and the fractional scheme buys a smaller write
in exchange for rebalancing logic exercised only in the rare case, which is
where it breaks.

### Questions from the roadmap

A task can name any problem you can see. The picker makes **no request**:
`RoadmapContext` is mounted for every signed-in route, so all 517 problems are
already a local array — the same trick the chat composer uses, and the reason
`RoadmapProvider` sits above everything in `App.jsx`.

Each link stores a ref **and** a snapshot, following `Conversation`. Neither
alone works. A slug is ambiguous, because `Problem` is uniquely indexed on
`{ slug, owner }` and an unscoped lookup can match a stranger's custom problem.
A bare ObjectId dangles, because you can delete a problem you added while a task
still names it — and a dangling id renders as a blank row, which reads as
corruption, where a dangling title reads as history. So the ref finds live
progress and the snapshot is what is drawn when it no longer resolves. The
snapshot is written server-side from the problem row and never echoed from the
request, the same rule `resolveAssets` applies to attachments.

**The ring on a card is derived, never stored**, and half of what it counts does
not live on the task:

```
done  = subtasks ticked + linked questions solved
total = subtasks + linked questions
```

Solving a linked problem on the roadmap moves the ring on the board with no
write, no refetch and nothing to keep in step. A stored percentage would be that
answer taken at the moment you last opened this page. A task with nothing to
count shows no ring rather than a permanent 0% — zero progress and nothing to
measure are different states, and only one of them reads as failure.

Subtasks are one level, by schema. A subtask holding subtasks turns the progress
count, the renderer and the drag target into recursive walks with depth guards,
and nothing this feature is for needs the second level.

### The clock

**One timer runs at a time, anywhere in the account.** Starting one stops
whatever else was running and banks it as a session, so a task shows both a
total and how many sittings it took.

`runningSince` is a timestamp and elapsed time is never stored ticking. That is
what makes a reload, a second tab and a closed laptop all agree — each is just a
different "now" applied to the same instant — and a running timer costs zero
writes per second instead of one. Every timer response also carries the server's
own `now`, so a browser whose clock is four minutes fast does not show four
extra minutes.

One-at-a-time is enforced twice. The service stops before it starts, and a
partial unique index backs that up so two tabs racing cannot both win:

```js
taskSchema.index({ user: 1 }, {
  unique: true,
  partialFilterExpression: { runningSince: { $gt: new Date(0) } },
})
```

`$gt` rather than `$ne: null`, because partial filters accept only a few
operators and `$ne` is not among them. It selects the same rows: BSON orders
null below Date, so a task that has never run is not in the index at all. A
start that loses the race catches the duplicate-key and retries once — the shape
`upsertProgress` uses for a double-clicked status.

Two bounds worth knowing. A session is **capped at twelve hours** and flagged
`truncated`: one timer left running overnight otherwise reports nineteen hours
on one problem and ruins the average the feature exists to produce, and the flag
is what lets it be corrected rather than believed. A run under five seconds is
discarded — that is a misclick, not a sitting.

Time can also be typed in afterwards, and a typed session is stored exactly like
a measured one. The timer you forgot to start is the common case, and a tracker
you cannot correct is one you stop trusting.

**The running clock shows in the top bar on every page.** That is why its state
is a context rather than page state, and it is the actual fix for the failure
the twelve-hour cap only bounds: a timer you cannot see is a timer you forget to
stop. Every consumer of it shares one interval, so N timers on screen still tick
once.

Dropping a card into the done column stops its clock. Finishing something and
leaving it running is not a state worth being able to reach.

### Files

Images and PDFs, through `services/file.service.js` to a private S3 bucket —
`purpose: 'task-attachment'`, `linkedTo: { type: 'task' }`, keys under
`tasks/<id>/`. No schema change: `File` was already polymorphic.

Drop them, pick them, or paste them. Paste is the one that earns its place — the
thing most often attached to a task like this is a screenshot of a failing test,
and Cmd-Shift-4 then Cmd-V is the shortest path from the screen to the card.

Types are sniffed from the leading bytes, never taken from the request, for the
reason [Task attachments go to S3](#task-attachments-go-to-s3) gives. A rejected
file lands in `failed` rather than failing the batch, and the toast repeats the
server's own reason — "images and PDFs only" is a confusing thing to be told
when the real answer is that this deployment has no bucket configured.

Deleting a task is soft because the row owns S3 objects and dropping it is what
makes their keys unfindable.

### What it will not let you do

Every one of these is a bound on a loop rather than a shape on the feature —
the numbers are far above any real board, the way `VIEW_LIMITS` is.

| | |
|---|---|
| tasks per account | 500 live ones. Soft-deleted rows do not count |
| columns per board | 12 |
| `done` columns | 1 |
| title | 200 characters |
| notes | 4,000 |
| column name | 40 |
| tags | 20 per task, 40 characters each |
| questions attached at once | 50 |
| attachments | 10 files per request, 25MB each, images and PDFs only |
| one sitting | 12 hours measured, 12 hours typed. Under 5 seconds is discarded |
| uploads | 30 an hour, per account — the ceiling avatars already share |

Everything else is the ordinary write limiter: 120 writes per five minutes per
account, which the module inherits by being mounted below it in
`routes/index.js` rather than by declaring anything.

The full reference — every field, every endpoint with its request and response
shapes, every error code, and how to verify the module end to end — is
[docs/tasks.md](docs/tasks.md).

## Profile

Your picture, name and email, then joined date, solved count, current and
longest streak, active days, time logged, the solved ring, the activity heatmap,
your strongest patterns, company coverage, and the last eight problems you
solved. Recent solves are derived from the roadmap already in memory, so the page
costs one request.

**Your feedback** sits at the foot of the page — the last three things you sent
and what happened to them, so a reply does not go unread inside a dialog you have
no reason to open twice.

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

## The guide

`/docs` is the app explaining itself: what Ember is for, the first hour, the
roadmap, logging an attempt, the revision ladder, and every shortcut — written
for someone using it rather than building it.

It is **the one route mounted on both sides of the auth branch** in `App.jsx`.
The reader who most needs to know what this is has not signed up yet, and a page
that answers that from behind a login answers nobody. So it is reachable three
ways: **Guide** in the sidebar, a small *What is Ember?* under the brand on both
auth pages, and `/docs` directly.

Signed out it draws its own thin bar with **Sign in** and **Start your
journey**; signed in it renders inside the shell and picks up the sidebar. The
only other thing that changes with the session is the button at the foot, which
becomes **Back to the course**. Nothing on the page fetches.

It is built on one idea: **a guide to a tool should let you work the tool.**
Every mechanic that a paragraph explains badly is a thing you can operate on the
page instead — the status circle cycles, the stopwatch runs, picking an outcome
drives a mock roadmap row so you watch the revision flag light up, and the
confidence dial recomputes the ladder live off the same curve
`services/review.service.js` uses. None of it fetches and none of it touches an
account; the rows are props, not `Progress`. Prose is around the demos rather
than instead of them.

Two measures, named as `--docs-wide` against the prose cap: running text stays
near 68 characters because that is what it takes to read, and a table, a demo or
a keyboard grid is scanned rather than read and has no business being that
narrow. The section hues come from the board's own `[data-hue]` palette — ten
identical grey headings read as one wall, and the colour is what lets you find
where you were.

It is styled entirely from `styles/tokens.css`, so it follows the reader's theme
and their chosen accent like everything else — there is no second palette to
keep in step.

There is deliberately **no second copy in `docs/`**. Those files are references
for someone working on the code; this is the one written for someone using it,
and two versions of the same guide is the drift this codebase avoids everywhere
else.

## The side menu

Three regions, and the split is the whole design: a **head** with the toggle and
the brand, a **scroller** holding the roadmap, the modules and the twenty-two
patterns, and a **floor** pinned below it with **Guide**, **Admin** and one
switch.

The floor is not a leftover. Nothing on it is a stop on the way through the app
— the guide is what you open when you are stuck, admin is a different job
entirely, and the switch is a setting. Above the pattern list they sat between
you and the twenty-two sections you actually came for, and they moved down the
column every time a pattern was added. Pinned to the floor they are in the same
place every time, and the patterns start at the top.

**Feedback is not in the menu at all**, and it is the one module that isn't.
It lives in the account menu instead, with the other two things that are about
you rather than about the page. It is still a module — the server still gates
`/feedback` on it, and hiding it still takes the menu item with it.

### Hover to open

Collapsed, the menu is a 56px rail of icons. Hovering it opens the full menu
**for as long as the pointer is on it**, then lets go. Tabbing into the rail
does the same thing, since a keyboard user reading a column of icons has the
same problem.

A peek is a *view*, never a change: `collapsed` is untouched throughout, so
nothing about it is written to storage and nothing survives the pointer leaving.
Clicking the toggle mid-peek is therefore not really a toggle — the menu is
already on screen, and `collapsed` is what makes it stay there.

It is lifted out of the flex row and drawn **over** the page, with a spacer
holding the 56px it vacated, because a hover that reflowed a four-hundred-row
table would be a hover nobody wants. Only `width` changes — `flex-basis` stays
at the rail — so it opens on a 140ms animation and closes the instant the class
drops, and the table behind it never moves either way.

**And it is a switch, not a law.** A menu that unfurls every time you cross it
on the way to the table is the exact thing some people collapse a sidebar to be
rid of, so *Hover to open* at the foot of the menu turns it off, and the rail
then only opens when you open it. On by default, remembered per browser
(`sidebar-hover-open`), and the switch is at the foot of the menu itself —
which is the one place you are guaranteed to be looking when it annoys you.

Two things it deliberately does not do. It never fires on a touchscreen, where
`mouseenter` is synthesised from a tap and the menu would open on the way to
whatever was tapped — `HOVERS` in `hooks/useMediaQuery.js` is how the shell
tells a pointer from a finger. And it never fires below 760px, where `collapsed`
means "closed drawer" rather than "rail" and a hover would fling the whole
drawer over the page.

## The account menu

Your own face, top right, and behind it: **View profile**, **Send feedback**,
**Sign out**.

That end of the bar had collected three separate icon-only controls — a
megaphone, a sign-out arrow, and the avatar — sitting eighteen pixels apart.
None of them said what it was without being hovered, all three were about *you*
rather than about the page, and one of them signed you out. One trigger
everybody already reads as "me", and the three verbs get their names back.

It is built on `AppearancePicker`'s shape rather than on `Dropdown`, and the
difference is not cosmetic: `Dropdown` is a listbox, where the options are
values you are choosing between and one of them is current. These are verbs.
Nothing here is "selected", and a tick column would be lying about that.

The header carries your name and email. That used to be the sign-out button's
tooltip, which is a thing you find by accident on the way out — it is now the
only place the app says which account you are signed in as. Sign out is ruled
off and last, coloured like every other irreversible button here: it is the one
item you cannot take back by clicking the next thing, and it is not what most
people opened the menu for.

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
| `Esc` | leave the search box, or close a dialog, the guide reader or the task drawer |
| `Ctrl` `B` | collapse the sidebar, or — mid-peek — pin it open |

Single-key shortcuts are suppressed while you're typing in a field and while any
dialog or the guide reader is open.

On the task board, with a card focused:

| key | |
|---|---|
| `Enter` | open the card |
| `[` / `]` | move it a column left or right |

Those two are bound to the focused card rather than to the page, so they need no
suppressing: while the drawer is open focus is trapped inside it and no card can
receive them.

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
| avatar and task uploads | 1 hour | 30 | account |
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

### Task attachments go to S3

Images and PDFs dropped onto a task take a second path, behind
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

One `File` collection, and no schema change to add a consumer to it.
`File.linkedTo` is `{ type, id }` and was polymorphic from the start, so tasks
only had to pick their own values — `purpose: 'task-attachment'`,
`linkedTo: { type: 'task' }`, keys under `tasks/<id>/` — and the
`{ 'linkedTo.type', 'linkedTo.id', deletedAt }` index already covered the
lookup. Detaching is scoped by `linkedTo` as well as by owner, so a file id
belonging to your avatar cannot be deleted through a tasks route.

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

Three doors — **Send feedback** in the account menu, the button on the sign-out
dialog, and `/feedback` itself, linked from the foot of your profile — because
the thing that kills a feedback channel is not being where someone was when they
had the thought. The first two open the same `Send` / `Yours` popup; the page
carries the same form and list with more room.

It had a fourth, a floating bubble beside the chat one, and losing it is the
point rather than a cost. Two circles in one corner for two features with
nothing to do with each other is one too many, and of the two, chat is the one
you keep open while you work and feedback is the one you go looking for. It is
also why this is **the one module with no row in the side menu**: it was the only
door that cost a line in a list you read on the way somewhere else.

`FeedbackHost` in the shell is what remains of that bubble — the dialog's one
mount point, kept out of `AppShell` so that opening and closing it does not
redraw the sidebar, the topbar and the whole routed tree underneath.

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
| Playbook | `/playbook` |
| Pro Coder | `/cp` |
| SQL Lab | `/sql` |
| Revision | `/revision` |
| Stats | `/stats` |
| AI Chat | `/chat` |
| Learn | `/learn` |
| Tasks | `/tasks` |
| Practice | `/practice` |
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
   from one list in `client/src/store/modules.js` so neither can be forgotten.
   Feedback is the exception: it has no row to withdraw, so hiding it takes the
   topbar megaphone instead, off the same `moduleVisible` call;
2. the client route is not declared, so the URL falls through to the catch-all
   and lands on the roadmap — indistinguishable from a route that was never
   built, the same line `/admin` takes;
3. **the API answers 404.** `requireModule(key)` sits on the mount in
   `routes/index.js`. Without it, hiding a module is a hidden door: the link is
   gone and `/api/tasks` still answers anyone who reads the bundle or kept a
   bookmark.

404 rather than 403, worded identically to the `notFound` middleware, because a
403 announces that the feature exists. The super admin sees the module with a
**Dev** badge, so an unfinished page is never mistaken for a shipped one.

**Learn used to be the exception to the third point, and no longer is** — worth
naming because the change moved a line that had been drawn deliberately. Its
prose shipped in the client bundle, so there was no API surface to guard and
hiding the module was cosmetic: anyone who read the bundle found the same notes
the nav item would have linked to. That was safe for the reason the rule exists
— the hidden door it prevents is a route still serving somebody else's records,
and there were no records — but it was still a module the toggle could not fully
turn off.

The content is served from Mongo now, behind `requireModule('learn')` on the
mount like every other module. Hiding Learn takes the words with the pages.

Two capabilities, not one: `module:preview` is "an unfinished feature is safe in
my hands", `module:write` is "I decide when it ships". Both are the super
admin's today, and handing a dev_member the first later must not hand them the
second.

There was a third, `playbook`, which was not about unfinished work at all — it
gated the owner-only prep plan. It came out with the `owner` flag rather than
staying in the matrix as a power with no question attached to it, so the list is
back to being about one thing: what is safe to see before it ships.

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

`GET /api/admin/problems` pages like every other admin list — `page` and
`limit`, `limit` defaulting to 25 — but its ceiling is 1000 rather than the
shared 100, and `limit=all` asks for one page of everything up to that ceiling.
The row is a projection of scalars with no `descriptionHtml`, so the whole
curated list and every custom problem on top of it is a few hundred KB: cheaper
to pull once for a quick list or an audit than to walk twenty pages. The
envelope still reports `total` and `pages`, which is how you know whether `all`
actually got all of it. `limit=all` works on the other admin lists too, at their
own ceiling of 100.

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

The chat assistant is separate from all of this and does let a learner prompt a
model — see [Assistant](#whats-in-it). It has **two personas**, chosen by the
route rather than by a setting: the study assistant everywhere, and the **CP
coach** on Pro Coder. They are different jobs. Someone on the roadmap wants to
know what a monotonic stack is; someone on the ladder knows, is stuck on a 1600,
and wants the observation. So the coach answers in invariants rather than
technique names, gives one hint at a time up a five-step ladder, and holds a
stricter spoiler rule — a full solution to a rated problem you are actively
working costs you the thing you came for, so it takes being asked outright.

Attaching a ladder problem sends its *identity*, not its text: title, contest
code and index, rating and division, ladder tier, our own topic tags, and where
your progress stands. We do not mirror statements from either judge, and about
eighty tokens of identity is enough for a model to know which problem you mean —
`1670C, rated 1400` is a name, not a description. It is told your live Codeforces
rating alongside all that, which is what lets it say "this is 250 above you,
treat it as a stretch" instead of answering in a vacuum. It is never told the judge's tag list: that is the editorial's answer
key, the interface deliberately hides it behind a toggle, and handing it over
through the coach would give away what the UI withholds. A thread keeps the
persona it started with, so a conversation opened on the ladder and continued
elsewhere does not change speaker mid-transcript.

Three *other* places use Gemini directly, and **none of them lets a learner
prompt the model**:

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

### The material

The app is **one canvas with glass on it**. `.shell` paints an ambient wash —
three soft radial lights that never move, the first of them in whichever accent
you picked — and every panel above it is a translucent fill rather than a solid
box, so the wash shows through and the whole app reads as one lit surface
instead of forty grey rectangles. Hairline borders instead of hard ones, a
single inset line of light along the top edge of each panel where a real pane
would catch it, a long soft drop underneath, and 10px corners instead of 4.

That is done in the **tokens**, which is the only place it can be done once.
`--surface`, `--surface-2`, `--surface-hover`, `--border` and `--border-soft`
are read by every component in the 10,000-line stylesheet, so making them
translucent re-skinned the sidebar, the top bar, the roadmap, Stats, Revision,
Practice, Tasks, Profile, every dialog and every chip in one edit — the same
leverage `.cp-root` has always used for the ladder.

**No `backdrop-filter`, anywhere in the app.** Translucency only, and that is
measured rather than assumed — the number is in the Pro Coder section above: a
blurred backdrop took scrolling the expanded ladder from a 16.7ms median frame
to 56.5ms. The two that were left, both on the public `/docs` page, are gone
now. There is a second reason beyond cost: an element with a backdrop filter
becomes the containing block for `position: fixed` descendants, which is how a
full-screen dialog ends up anchored to a panel.

**The solid twins.** Glass is wrong wherever content can pass *behind* it — the
rows would scroll visibly through. So each glass token has an opaque twin, and
anything sticky, fixed or portalled uses that instead: `--solid`, `--solid-2`,
`--solid-hover`. That is the roadmap's frozen columns, every sticky table
header, the dialogs and their sticky head and foot, every portalled menu, the
toasts, the chat dock, and the sidebar in the two states where it leaves the
row and draws over the page. The rule is one line long and it is in
`tokens.css`: if you add a sticky or fixed element with a background, it takes a
twin.

**Hover replaces a fill; it never layers on one.** Almost every rule reads
`--surface-hover` as a plain `X:hover { background: ... }` on something already
painted `--surface`, so the value has to clear it by enough to be a step. The
trap is painting it on an element *and* its ancestor: identical opaque greys
made that harmless for years, and translucency turned it into a double tint with
a visible seam where the inner element stopped. The roadmap's pattern heading
had exactly that — the row lit up brighter than the guide button beside it.

**It costs nothing to scroll.** The wash lives on `.shell`, which is
`height: 100%` and does not scroll — `.content` inside it owns the scrollbar —
so it paints once at mount and again only on resize. Nothing in the material
animates, nothing is on a scroll handler, and no part of it is a filter. On the
roadmap with all 23 patterns expanded (517 rows in one scroll container),
scrolling measures 32 fps against a 33 fps baseline before any of this landed —
the same number, inside the noise.

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
server alone would render all 517 problems and then collapse to eleven a beat
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

Scopes are declared for `roadmap`, `revision`, `problems` and `tasks`.
Two are wired up — the roadmap and the board — and the board is what proves the
engine generalises: it needed a new `filters/tasks.js`, and on the server one
string in the allowlist and nothing else.

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
                 CompanyLogo, AuditLog, Motivation, DailyLine, Task, TaskBoard
    routes/      route tables only
    controllers/ request/response
    services/    auth, leetcode, spaced repetition, media, logos, gemini,
                 audit, activity, motivation (signals, picker, daily line),
                 tasks (the board, the clock, attachments)
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
      layout/    AppShell, Sidebar, AccountMenu, AuthLayout, ParticleWeb
      problem/   table, guide reader, notes, statement, modals
      filters/   the spec-driven filters dialog and its chips
      tasks/     the board, its four views, the drawer and the timer
      profile/   avatar upload
      stats/     solved ring, activity heatmap
      admin/     panel tabs, editors, the motivation corpus
      learn/     track and topic cards, the side rail, the Ask-AI buttons
      ui/        Modal, ConfirmDialog, Dropdown, Avatar, PhotoPreview, Icons
    filters/     what each screen can be narrowed by, and the engine
    hooks/       useGuide, useLearnCatalogue, useLearnTopic, useMotivation,
                 useTableLayout, useSavedFilters, useBoardDrag
    learn/       the five tracks' chrome — icons and stubs — and the
                 read/revision helpers; the prose lives on the server now
    pages/       Login, Register, Roadmap, Revision, Stats, Tasks, Learn,
                 Profile, Admin
    store/       Auth, Roadmap, Tasks, AttemptTimer, Toast contexts
    styles/      tokens, base, app
    brand.js     the product name, in one place
docs/          the deep-dive references the README links out to:
               aws-infrastructure, aws-runbook, tasks, learn
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
| `POST` | `/progress/:id/review` | working the revision queue — `recalled` advances the ladder, `dismissed` only clears what put the row there |
| `GET` `PATCH` `DELETE` | `/progress/:id/attempts` · `/progress/:id/attempts/:attemptId` | the attempt log for one problem, and editing or removing one of them — see [Attempts](#attempts) |
| `GET` | `/stats` | profile and stats pages |
| `GET` | `/learn/catalogue` | every track, section and topic heading in one document, ETagged — see [Learn](#learn) |
| `GET` | `/learn/topics/:track/:topic` | one topic's blocks; answers a renamed slug with its canonical path rather than a redirect |
| `GET` | `/learn/progress` · `/learn/revision` | every topic you have read or scheduled, and the ones that are due |
| `PUT` | `/learn/progress/:track/:topic/read` | the browsing fact — never touches the revision ladder |
| `PUT` | `/learn/progress/read` | the one-time hand-over of the old localStorage map, in one request |
| `PUT` `POST` | `/learn/progress/:track/:topic` · `/learn/progress/:track/:topic/review` | scheduling a topic with a confidence, and working the queue |
| `GET` `POST` `PATCH` `DELETE` | `/tasks` · `/tasks/:id` | the board and everything on it in one read; a task |
| `POST` | `/tasks/move` | a drag — `{ id, status, ids }`, the destination column in the order it was drawn |
| `POST` `PUT` `PATCH` `DELETE` | `/tasks/board/statuses` · `/tasks/board/statuses/:statusId` | your columns; `PUT` reorders them, `DELETE` takes `?moveTo=` for the tasks inside |
| `POST` `PATCH` `DELETE` | `/tasks/:id/subtasks` · `/tasks/:id/questions` · `/tasks/:id/attachments` · `/tasks/:id/sessions` | the parts of a task — see [Tasks](#tasks) |
| `GET` `POST` | `/tasks/timer` · `/tasks/:id/timer/start` · `/tasks/:id/timer/stop` | the one running clock |
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
