/**
 * The side-menu modules a super admin can take off the app.
 *
 * A module is one entry in the side menu *and* the API surface behind it, which
 * is the whole point of naming them here: hiding has to mean both halves of the
 * same decision. A nav item removed on its own is a hidden door — the link is
 * gone and `/tasks` still loads for anyone who remembers the URL, or for anyone
 * who reads the bundle. Each key below is claimed by a `requireModule(key)` in
 * routes/index.js, so the two move together.
 *
 * The roadmap is deliberately not listed. It is where everything lands: a
 * hidden route redirects to `/`, the admin panel sends a learner to `/`, and the
 * catch-all route goes to `/`. Making it hideable would mean inventing a second
 * destination for the one deployment that ever used it. Profile and admin are
 * absent for the opposite reason — neither is a learner module, and the panel is
 * already gated by the `panel` capability.
 *
 * `path` is the client route, kept here so the admin panel can tell a super
 * admin what a module actually is without a second table in JSX.
 */
export const MODULES = Object.freeze([
  { key: 'revision', label: 'Revision', path: '/revision' },
  { key: 'stats', label: 'Stats', path: '/stats' },
  { key: 'chat', label: 'AI Chat', path: '/chat' },
  /*
    Learn is the one module with no API surface, and so the one key with no
    matching `requireModule` in routes/index.js. Its content is authored as JS
    modules in the client bundle rather than stored here, because it is
    reference prose we write ourselves — nobody's data, nothing per-account,
    nothing to fetch.

    That makes hiding it purely cosmetic, which is exactly what the header above
    warns about, so it is worth being explicit about why it is acceptable here:
    the "hidden door" this normally leaves open is a route that still serves
    somebody else's records. There are no records. Someone who reads the bundle
    finds the same React notes the nav item would have linked to.
  */
  { key: 'learn', label: 'Learn', path: '/learn' },
  { key: 'tasks', label: 'Tasks', path: '/tasks' },
  /*
    Feedback is a module for the same reason the four above are: it is a side
    menu entry and an API surface, and hiding it has to mean both. It is worth
    knowing what hiding it costs, though — it is the channel people use to say
    something is broken, so taking it away takes away the report as well as the
    page. The queue in the admin panel is deliberately not behind this key, so
    what has already been submitted stays answerable either way.
  */
  { key: 'feedback', label: 'Feedback', path: '/feedback' },
]);

export const MODULE_KEYS = MODULES.map((module) => module.key);

export const moduleLabel = (key) => MODULES.find((module) => module.key === key)?.label || key;
