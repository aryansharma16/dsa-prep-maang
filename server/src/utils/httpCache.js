/**
 * Conditional GETs, for the handful of endpoints that serve authored content.
 *
 * Most of this API answers questions about one account and is never worth
 * revalidating. Learn's catalogue and topic bodies are the opposite: identical
 * for every reader, changed only when someone edits them, and re-fetched on
 * every navigation. They are the first thing here that a 304 is actually for.
 */

/**
 * Sets the validators, and answers a conditional GET before the expensive work.
 *
 * Returns `true` if it has already replied — the caller must return.
 *
 *   if (precondition(req, res, tag)) return;
 *
 * ---------------------------------------------------------------------------
 * Why set the ETag rather than let Express do it.
 *
 * Express computes a weak ETag from the *serialised body*, which means the query
 * has run and the JSON has been stringified before it can decide nothing
 * changed. Setting the header first wins — `res.send` only generates one when
 * the header is absent — and it lets the handler answer a repeat visit without
 * touching Mongo at all. That is the whole saving: not the bytes, the work.
 *
 * `req.fresh` is Express's own getter. It handles the `W/` prefix, a
 * comma-separated list of tags and `*`, and it correctly returns false when the
 * request carries `Cache-Control: no-cache` — which is what a hard reload sends,
 * and which must always get real bytes.
 * ---------------------------------------------------------------------------
 *
 * `private`, never `public`: every caller of this sits below `requireAuth` and
 * carries a session cookie. Nothing in these payloads is per-reader *today*, but
 * that is a fact about the current payload rather than about the endpoint, and
 * `public` is the kind of header that outlives the assumption that justified it.
 *
 * `no-cache` rather than a `max-age`: it means "store it, but revalidate every
 * time", which turns the repeat request into a 304 with an empty body instead of
 * sixty kilobytes. A `max-age` on content that an admin can edit is a stale copy
 * with no way to bust it — the exact bug `invalidateGuide` exists to prevent on
 * the client.
 */
export function precondition(req, res, etag) {
  res.set('ETag', etag);
  res.set('Cache-Control', 'private, no-cache');
  /*
    The response depends on the session — not in its bytes, but in whether it is
    served at all, since `requireModule` can 404 the whole surface. Without this
    a shared cache could hand one reader's 200 to a request that should have been
    turned away.
  */
  res.vary('Cookie');

  if (req.fresh) {
    res.status(304).end();
    return true;
  }
  return false;
}

/**
 * A short-lived memo, for a value that is expensive relative to how often it
 * changes and is read on every request.
 *
 * The catalogue's ETag is four index-only queries. That is cheap, but it is
 * cheap *per request* on the endpoint every Learn page hits, and the answer is
 * identical for everyone. Ten seconds of staleness on a cache validator is
 * invisible — the worst case is one reader revalidating a catalogue that was
 * edited nine seconds ago and getting a 304 they will not get again.
 *
 * Per process, like the module-visibility cache in settings.service.js, and with
 * the same honest caveat: two workers can hold different values for a few
 * seconds. For a validator that is not a correctness problem, it is one extra
 * revalidation.
 */
export function memoize(fn, ms) {
  let value = null;
  let until = 0;

  return async (...args) => {
    const now = Date.now();
    if (value !== null && now < until) return value;
    value = await fn(...args);
    until = now + ms;
    return value;
  };
}
