import { ApiError } from '../../utils/ApiError.js';

/**
 * The only place in this app that talks to codeforces.com.
 *
 * Everything about this file exists because the Codeforces API is public,
 * unauthenticated, generous, and rate-limited to roughly one request every two
 * seconds per IP. Exceed that and it answers 403 for a while — which, on a
 * shared deployment IP, means one person's sync can lock everybody else out.
 * So calls are serialised through a single queue with a floor on the gap
 * between them, and there is exactly one door to walk through.
 *
 * The other reason it is one file: Codeforces reports failures in the body, and
 * the status line it pairs them with is inconsistent. A bad handle is
 * `{ status: "FAILED", comment: "…User with handle x not found" }` — sometimes
 * with a 400, sometimes with a 200. So `res.ok` is never the check on its own,
 * and the body has to be read on a 4xx rather than thrown away; that `comment`
 * is the only place the actual reason exists. Handled once, here.
 */

const BASE = 'https://codeforces.com/api';

/** CF documents ~1 req/2s. 2.2s of headroom costs nothing and avoids the 403. */
const MIN_GAP_MS = 2200;

/**
 * Generous, because two of these calls are genuinely large — the full problemset
 * is ~2.2MB and a busy handle's submission list can be bigger — and a timeout
 * that fires mid-download turns a slow sync into a failed one.
 */
const TIMEOUT_MS = 45000;

/** One retry on the errors that are worth retrying, then give up. */
const RETRIES = 2;

/*
  The queue.

  A promise chain rather than a timer loop: each call appends itself to `tail`,
  so N concurrent callers execute in arrival order with the gap enforced between
  them, and nothing has to hold a lock or poll. Two people hitting sync at the
  same moment get spaced out instead of both 403ing.

  In-process, which bounds what it can promise under pm2 cluster mode — each
  worker keeps its own pace and the real gap is divided by the worker count.
  That is the same trade the AI registry's health map documents, and the same
  answer: sharing it would mean a database round trip on every upstream call to
  save a rate limit that already has 2.2s of headroom in it.
*/
let tail = Promise.resolve();
let lastAt = 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function enqueue(job) {
  const run = tail.then(async () => {
    const gap = Date.now() - lastAt;
    if (gap < MIN_GAP_MS) await wait(MIN_GAP_MS - gap);
    try {
      return await job();
    } finally {
      lastAt = Date.now();
    }
  });
  // The chain must not break on a rejection, or every later call inherits it.
  tail = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

const isRetryable = (status) => status === 429 || status === 403 || status >= 500;

/**
 * One call, queued, with the CF envelope unwrapped.
 *
 * Throws `ApiError` rather than returning null — unlike the LeetCode service,
 * whose callers all have a sensible "no description today" fallback. Here the
 * caller is a sync the user pressed a button for, and "Codeforces says that
 * handle does not exist" is the answer they need, not a silent no-op.
 */
async function call(method, params = {}, { retries = RETRIES } = {}) {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null),
  );
  const url = `${BASE}/${method}${query.size ? `?${query}` : ''}`;

  for (let attempt = 0; ; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const res = await enqueue(() => fetch(url, { signal: controller.signal }));

      if (!res.ok && attempt < retries && isRetryable(res.status)) {
        // Linear rather than exponential: the queue already spaces calls, and
        // the thing being backed off from is a per-IP window, not a load spike.
        await wait(MIN_GAP_MS * (attempt + 1));
        continue;
      }

      /*
        Parsed before the status is judged, and that ordering is the point.

        Codeforces answers a bad handle with HTTP 400 and the real reason in the
        body — "User with handle qq not found". Throwing on `!res.ok` first
        discards it and leaves the caller reporting "Codeforces refused the
        request (400)", which tells somebody who mistyped their handle nothing
        at all. The body is cheap and is the only place the answer exists.
      */
      const body = await res.json().catch(() => null);

      if (body?.status === 'FAILED' && body.comment) {
        // A human-readable sentence written by Codeforces, passed straight
        // through rather than replaced with something vaguer of our own.
        // 404 when it is specifically "no such user", so `verifyHandle` can
        // report a typo as a typo rather than as an outage.
        const missing = /not found/i.test(body.comment);
        throw new ApiError(
          missing ? 404 : 400,
          body.comment,
          missing ? 'CF_NOT_FOUND' : 'CF_FAILED',
        );
      }

      if (!res.ok) {
        throw new ApiError(
          res.status === 403 || res.status === 429 ? 429 : 502,
          `Codeforces refused the request (${res.status})`,
          'CF_UNAVAILABLE',
        );
      }

      if (body?.status !== 'OK') {
        throw new ApiError(502, 'Codeforces returned an unexpected response', 'CF_FAILED');
      }

      return body.result;
    } catch (error) {
      clearTimeout(timer);
      if (error instanceof ApiError) throw error;

      if (attempt < retries) {
        await wait(MIN_GAP_MS * (attempt + 1));
        continue;
      }
      // An abort here is our own timeout, not a caller disconnect — nothing
      // upstream of this passes a signal in.
      throw new ApiError(
        504,
        error.name === 'AbortError'
          ? 'Codeforces did not answer in time'
          : `Could not reach Codeforces: ${error.message}`,
        'CF_UNREACHABLE',
      );
    } finally {
      clearTimeout(timer);
    }
  }
}

/**
 * The whole problemset — ~11,000 problems with tags, ratings and solve counts.
 *
 * `problemStatistics` is a parallel array keyed by the same (contestId, index)
 * pair rather than being nested inside each problem, so it is zipped here. Every
 * caller wants the solve count; none of them should have to know the API returns
 * it in a second list.
 */
export async function fetchProblemset() {
  const result = await call('problemset.problems');
  const solvedBy = new Map(
    (result.problemStatistics || []).map((s) => [`${s.contestId}:${s.index}`, s.solvedCount || 0]),
  );

  return (result.problems || []).map((p) => ({
    ...p,
    solvedCount: solvedBy.get(`${p.contestId}:${p.index}`) || 0,
  }));
}

/** Every contest CF has ever run — the source of contest names, dates and divisions. */
export const fetchContests = () => call('contest.list', { gym: false });

/** One account's public profile. Also the handle-exists check. */
export async function fetchUser(handle) {
  const [user] = await call('user.info', { handles: handle });
  return user || null;
}

/**
 * Every submission an account has ever made, newest first.
 *
 * Unpaginated on purpose. `from`/`count` exist, but walking them costs one
 * queued request per page at 2.2s each — a handle with 4,000 submissions is
 * eight pages and eighteen seconds — while the whole list is a single call CF is
 * happy to serve. Filtering to accepted submissions is the caller's job.
 */
export const fetchSubmissions = (handle) => call('user.status', { handle });

/**
 * The rating change after every rated contest, oldest first.
 *
 * Empty for an unrated account, which is an ordinary answer and not an error —
 * `user.info` reports no rating for the same person.
 */
export const fetchRatingHistory = (handle) => call('user.rating', { handle });

/**
 * Which division a contest was, from its name.
 *
 * Derived rather than fetched because the API does not carry it: `contest.list`
 * gives a name and a type ('CF' | 'ICPC'), and the division is written into the
 * name by convention. Ordering matters — "Div. 1 + Div. 2" contains "Div. 1", so
 * the combined pattern has to be tested first or every combined round is filed
 * as Div. 1.
 *
 * Educational and Global rounds are their own answer rather than being forced
 * into a division. They are unrated-for-some, span the whole difficulty range,
 * and a learner filtering for "Div. 2" does not mean them.
 */
export function divisionOf(contestName = '') {
  const name = String(contestName);
  if (/div\.\s*1\s*\+\s*div\.\s*2/i.test(name)) return 'Div. 1 + 2';
  if (/educational/i.test(name)) return 'Educational';
  if (/global\s+round/i.test(name)) return 'Global';
  const match = name.match(/div\.\s*([1-4])/i);
  if (match) return `Div. ${match[1]}`;
  return 'Other';
}

/** The public URL for a problem. Contest problems and problemset problems differ. */
export const problemUrl = (contestId, index) =>
  `https://codeforces.com/problemset/problem/${contestId}/${index}`;

/** The contest's own page, which is where the standings and the editorial link live. */
export const contestUrl = (contestId) => `https://codeforces.com/contest/${contestId}`;
