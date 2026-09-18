# Ember — the short version

A pattern-first interview-prep app: the problems, the notes, the plan and the
whiteboard in one place, with your progress tracked across all of them.

This file is the quick tour — **what it does** and **what it is built with**.
The README is the same thing at full length (200KB of it); `/docs` in the app is
the same thing written for someone using it rather than building it.

- Live: <https://dsa-prep-maang.vercel.app> · the in-app guide: `/docs`
- Full detail: [README.md](../README.md)
- Per-module docs: [design.md](design.md) · [learn.md](learn.md) ·
  [tasks.md](tasks.md) · [aws-infrastructure.md](aws-infrastructure.md) ·
  [aws-runbook.md](aws-runbook.md)

---

## What it does

In the order `/docs` introduces it.

| | |
|---|---|
| **Roadmap** | 517 interview problems in 23 patterns, ordered as a ramp — arrays → two pointers → sliding window → … → DP. Company tags, one-click status, a table whose columns and filters follow your account. |
| **Attempts** | A stopwatch you start before opening the problem. Log how long it took and how it went; five outcomes that each decide what happens to the row, plus a note, a colour and a confidence rating per sitting. |
| **Revision** | A spaced-repetition queue on a 3/7/21/60-day ladder across every curriculum. Each review is answered with four buttons that say what date they would book. |
| **Pattern guides** | One long-form guide per pattern (~2,000 words), Java and C++ side by side. |
| **Learn** | Five reference tracks, 205 topics: Complexity (6), React (43), Node.js (68), SQL (53), Computer Networks (35). Definition, why it exists, a small example, the gotchas. |
| **SQL Lab** | 117 SQL problems in 8 categories. 72 run in the browser on SQLite compiled to WebAssembly and are graded against a generated result; 45 link out to LeetCode. |
| **Pro Coder** | A competitive-programming ladder: 1,100 Codeforces and CodeChef problems across 49 CP patterns and 7 rating tiers. Link your Codeforces handle and it marks what you have solved. |
| **Practice** | Two drills against the curriculum: a pattern quiz (which technique does this problem want?) and a mock harness that runs two unsolved problems against one clock. |
| **Playbook** | A 24-week plan — four phases, a weekly timetable built from your real available hours, and a drift line saying how far ahead or behind you are. |
| **Assistant** | Chat across four model providers, with the problem you are on attached. Every thread is kept. |
| **Tasks** | A board for what you meant to do: your own columns, deadlines, subtasks, file attachments, and roadmap problems that tick themselves off as you solve them. |
| **System Design** | A whiteboard for designing systems — canvas boards (shapes, frames, connectors, pen) and schema boards (DBML text ⇄ diagram), with a library of 173 technologies, data-structure blocks and SQL tables, and a 196-entry reference explaining what each one is. *Ships hidden; the super admin previews it.* |
| **Applications** | The job hunt: every company on a board you move by dragging, with a timeline per application, each round's questions and your answers, a post-mortem, the offer, and which CV you sent. Board, table, calendar, timeline and insights views; a reminder in the top bar when something is due. *Ships hidden; the super admin previews it.* |
| **Stats & Profile** | Solved ring, a year-long heatmap, streaks, weakest patterns, company coverage; a profile with your numbers and picture. |
| **Feedback** | Anyone can send a suggestion, bug or complaint and watch its status; staff triage it and reply once. |
| **Admin** | Four roles, a dashboard, user management, content editing, an audit log, and a switch to hide a module while it is being built. |

Everything above is one account, one progress model, and one revision queue.

---

## The stack

JavaScript throughout — no TypeScript, no build step on the server.

### Front end

| | |
|---|---|
| **React 18** + **Vite 6** | The app and its build. Routes are code-split; the main bundle carries the shell. |
| **React Router 6** | Routing, including the public `/docs` and the full-screen design workspace. |
| **axios** | The API client, with a silent-refresh interceptor for expired access tokens. |
| **sql.js 1.14** | SQLite compiled to WebAssembly, in a worker — this is what runs your SQL Lab answers in the browser. |
| **Plain CSS** | One token file for colour, theme and accent (`styles/tokens.css`); no CSS framework, no component library. |

Deliberately about five runtime dependencies. The canvas engine, the DBML
parser, the markdown renderer and the syntax highlighter are all written in the
repo rather than pulled in.

### Back end

| | |
|---|---|
| **Node + Express 4** | The API, mounted under `/api`. |
| **MongoDB** (Atlas) + **Mongoose 8** | Every document: users, problems, attempts, tasks, chats, design boards. |
| **zod** | Request validation at the edge of every route. |
| **jsonwebtoken** + **bcryptjs** | Access and refresh tokens in httpOnly cookies; passwords hashed with bcrypt. |
| **express-rate-limit** | Per-address and per-account ceilings on every route — tight on sign-in, registration, chat and uploads. |
| **multer** | Uploads held in memory and streamed out; nothing is written to disk. |
| **compression · cors · cookie-parser · morgan** | The usual middleware. |

### The services it talks to

Every one of these is **optional to boot**. A missing credential fails its own
feature with a clear message; it never stops the server.

| Service | Used for | Without it |
|---|---|---|
| **AWS S3** (`@aws-sdk/client-s3`) | Task attachments, and design-board assets later. Uploads go through `s3.service.js`; a `File` row indexes each object, and downloads are pre-signed URLs. | Attachment upload answers 503; everything else works. |
| **Cloudinary** | Profile pictures — an image that wants resizing and a CDN more than it wants a bucket — and the CVs attached to job applications, stored once per file by content hash and served back through the API rather than the CDN. (Company logos are not here: they are fetched once and cached as bytes in Mongo.) | Profile-picture and CV uploads answer `503 UPLOADS_DISABLED`; a CV pasted as a link still works. |
| **SendGrid** (HTTPS API) **or SMTP** (nodemailer) | Signup requests, approvals, password resets. Whichever credential is present wins; SendGrid first. | Nothing is sent — each message is logged instead, which is the normal local setup. |
| **Gemini, Cerebras, DeepSeek, xAI** | The assistant. A registry tries (provider, model) pairs in order and sidelines one that is rate-limited, so a free tier is actually usable. | The assistant says no model is configured. |
| **LeetCode API** | Problem statements and metadata pulled into the roadmap. | Statements fall back to the link out. |
| **Codeforces · CodeChef · curated sheets** | Seed-time only: where the Pro Coder ladder comes from. | Nothing at runtime. |
| **Simple Icons** (CC0) | Build-time only: the brand logos in the design component library. | Nothing at runtime. |

There is no Filestack, no Firebase and no third-party auth: files are S3 and
Cloudinary, and sign-in is this server's own JWTs.

### Where it runs

```
Browser ──► Vercel (static client)
                 │  /api/* rewritten to api.algoforge.work
                 ▼
           Express API (Render)  ──► MongoDB Atlas
                 │
                 ├──► S3            task attachments
                 ├──► Cloudinary    profile pictures
                 ├──► SendGrid/SMTP mail
                 └──► AI providers  the assistant
```

The client is static files on Vercel (`client/vercel.json`), which rewrites
`/api/*` to the API host and everything else to `index.html`. The API is a Node
web service (`render.yaml` in the repo root). Mongo is Atlas — a replica set,
which the design module needs for its transactions.

---

## Running it

```bash
cd server && cp .env.example .env   # MONGO_URI and the two JWT secrets
npm install && npm run seed         # problems, patterns, guides, tracks
npm run dev                         # http://localhost:4000

cd client && npm install && npm run dev   # http://localhost:5173
```

Only `MONGO_URI` and the JWT secrets are required. Everything else — S3,
Cloudinary, mail, the AI keys — turns one feature on when you add it.

Tests: `cd client && npm test` (the design engine) and `cd server && npm test`
(fractional keys, op folding, validation, tree helpers).

See [Running it](../README.md#running-it) in the README for the seed scripts and
the full environment table.
