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
  /*
    Playbook — the site owner's own interview-prep plan.

    The one module in this list that is not for the people using the app. It is
    a dated, phased schedule that reads the owner's roadmap and ladder progress
    and says what to do this morning, so it is meaningless to anybody else: a
    second account opening it would see somebody else's timetable with their own
    zeroes under it.

    So it is marked `owner`, which is a different kind of hidden from the
    `modules.hidden` list a super admin toggles in the panel. Hidden means "not
    finished yet, show me anyway" and is a setting. Owner means "this belongs to
    one account" and is not toggleable at all — see OWNER_MODULE_KEYS below,
    moduleAccess() in services/settings.service.js, and the `playbook` capability
    in config/roles.js. All three read the same flag.
  */
  { key: 'playbook', label: 'Playbook', path: '/playbook', owner: true },
  { key: 'revision', label: 'Revision', path: '/revision' },
  { key: 'stats', label: 'Stats', path: '/stats' },
  { key: 'chat', label: 'AI Chat', path: '/chat' },
  /*
    Learn was the one module with no API surface, and so the one key with no
    matching `requireModule`. Its *content* is still authored as JS modules in
    the client bundle rather than stored here, because it is reference prose we
    write ourselves — nobody's data, nothing to fetch.

    It has records now. Marking a topic read puts it on the same 3/7/21/60
    revision ladder a problem goes on, and that is per-account, so `/learn/*` in
    routes/index.js is behind this key like every other module here. Hiding it
    is no longer merely cosmetic: it takes the reading progress with the pages.

    What hiding it still cannot do is un-ship the prose. Someone who reads the
    bundle finds the same React notes the nav item would have linked to — which
    is fine, and was always the trade.
  */
  { key: 'learn', label: 'Learn', path: '/learn' },
  { key: 'tasks', label: 'Tasks', path: '/tasks' },
  /*
    Pro Coder — the competitive-programming curriculum.

    A module rather than a second home page, and so hideable, because it is the
    one part of the app that is not for everyone: someone preparing for an
    interview loop in six weeks has no business being sent down a Codeforces
    ladder, and a deployment aimed at them should be able to take it off the
    menu. The roadmap is not hideable for the mirror-image reason — see above.

    Claimed by `requireModule('procoder')` on the /cp mount in routes/index.js,
    which covers every route the module has, including the ones added tomorrow.
  */
  { key: 'procoder', label: 'Pro Coder', path: '/cp' },
  /*
    Practice — the two things you do *with* the curriculum rather than to it.

    A drill that shows a problem's title and asks which pattern it is, and a mock
    that runs two problems against one clock with the answers hidden. One module
    for both because they are the same kind of object — training against material
    that already exists — and two side-menu entries for two screens would be a
    menu that grows one row per exercise.

    Its own module rather than a corner of the roadmap because neither reads or
    writes a problem row: they write their own runs, they have their own history,
    and hiding them has to take the API with the nav item like every key here.
  */
  { key: 'practice', label: 'Practice', path: '/practice' },
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

/**
 * Modules that belong to the account that owns the site rather than to
 * everyone.
 *
 * Kept as a derived list rather than a second literal so a module can never be
 * marked `owner` here and forgotten there. Read by `moduleAccess` to keep the
 * key out of the side menu, and by `requireModule` to 404 the API behind it —
 * the same two halves every other module in this file moves in.
 */
export const OWNER_MODULE_KEYS = MODULES.filter((module) => module.owner).map((m) => m.key);

/** The capability that unlocks an owner module. One today, and one is enough. */
export const OWNER_MODULE_CAP = 'playbook';

export const moduleLabel = (key) => MODULES.find((module) => module.key === key)?.label || key;
