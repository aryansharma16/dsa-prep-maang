/**
 * The side-menu modules a super admin can take off the app.
 *
 * A module is one entry in the side menu *and* the API surface behind it, which
 * is the whole point of naming them here: hiding has to mean both halves of the
 * same decision. A nav item removed on its own is a hidden door — the link is
 * gone and `/notes` still loads for anyone who remembers the URL, or for anyone
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
  { key: 'notes', label: 'Notes', path: '/notes' },
]);

export const MODULE_KEYS = MODULES.map((module) => module.key);

export const moduleLabel = (key) => MODULES.find((module) => module.key === key)?.label || key;
