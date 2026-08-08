# DSA Prep

A pattern-first DSA tracker. 429 curated problems ordered as a curriculum —
arrays → two pointers → prefix sum → sliding window → … → DP — with real
company tags, one-click progress tracking and a spaced-repetition revision
queue.

React + Vite · Node/Express · MongoDB Atlas. JavaScript throughout.

---

## Running it

```bash
# 1. Backend
cd server
cp .env.example .env          # fill in MONGO_URI and the two JWT secrets
npm install
npm run seed                  # fetch sources -> curate -> write to MongoDB
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

## Tracking

- **Status** — click the circle to cycle not started → attempted → solved
- **Flag** and **needs revision** — one click each
- **Statement** — expand a problem to read it inline, fetched from LeetCode on
  first open and cached in the DB afterwards
- **Notes** — inline, autosaving, with a 1–5 confidence rating
- **Log attempt** — optional two-tap popover for time spent and outcome
- **Revision queue** — solving schedules a review on a 3/7/21/60-day ladder,
  stretched or compressed by your confidence

## Profile

The initials avatar in the top bar links to `/profile`. Initials come from your
name, and the tile colour is derived from your email so it is stable across
devices — all six colours clear 4.5:1 against the near-black initials, so they
stay legible in either theme.

The page shows who you are and how you're doing: joined date, solved count,
current and longest streak, active days, time logged, the solved ring, the
activity heatmap, your strongest patterns, company coverage, and the last eight
problems you solved. Recent solves are derived from the roadmap already in
memory, so the page costs one request.

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

### Keyboard

| key | |
|---|---|
| `j` / `k` | move between problems |
| `s` | toggle solved |
| `f` | flag |
| `r` | needs revision |
| `n` | notes |
| `o` | open the problem in a new tab |
| `/` | search |
| `Ctrl` `B` | collapse the sidebar |

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
shortcuts — otherwise `s` would mark a problem solved behind the dialog.

Sizes: `sm` (390px, confirmations), default (460px), `lg` (680px).

## Layout

```
server/
  src/
    config/      env, db connection
    models/      User, Pattern, Problem, Progress
    routes/      route tables only
    controllers/ request/response
    services/    auth, leetcode, spaced repetition
    middleware/  requireAuth, errorHandler, validate
  scripts/seed/  fetch-sources -> curate -> seed
  data/raw/      committed source snapshots
client/
  src/
    api/         axios client + endpoints
    components/  layout, problem, ui
    pages/       Login, Register, Roadmap, Revision, Stats
    store/       Auth, Roadmap, Toast contexts
    styles/      tokens, base, app
```

`route → controller → service`, models alongside. No repository layer, no DI.

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
`SameSite=None`, and `MONGO_URI` / `JWT_*` / `CLIENT_URL` come from
`server/.env`. `render.yaml` is kept for the alternative Render path.
