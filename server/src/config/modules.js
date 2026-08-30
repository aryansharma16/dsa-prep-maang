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
    Playbook — the interview-prep plan, and the module that says what to do with
    every other one.

    It used to be marked `owner`: a third kind of hidden, pinned to the account
    in SUPER_ADMIN_EMAIL and not toggleable from the panel at all. That flag is
    gone, and with it the whole mechanism — `OWNER_MODULE_KEYS`, the
    `playbook` capability in config/roles.js, and the branches both
    `moduleAccess` and `requireModule` carried for it.

    The argument for owner-only was that the page is meaningless to a second
    account, which turned out to be a claim about the *plan* rather than about
    the module. `Playbook` in models/Playbook.js is already one document per
    account, keyed by owner and unique: the start date, the ticks and the retro
    lines have always been per-user, and every number on the page is derived at
    render from that account's own roadmap and ladder rows. A second account
    opening it does not see somebody else's timetable — it sees the same
    authored schedule with its own progress under it, which is exactly what the
    other curriculum modules do.

    What is still one document for everybody is the plan text itself, authored
    in `client/src/playbook/plan.js` and shipped in the bundle. It is written in
    the second person to a specific starting point, so a reader who is not at
    that starting point is reading advice sized for somebody else. That is a
    content problem and not a permissions one, and hiding the module from them
    was never the fix for it.

    So it is an ordinary module now: in the side menu for every role, and
    hideable from the admin panel like the eight below it.
  */
  { key: 'playbook', label: 'Playbook', path: '/playbook' },
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
    SQL Lab — the third curriculum, and the only one that grades itself.

    A module rather than part of Learn, because Learn is prose we ship in the
    bundle and this is a problem collection, a progress row per account and an
    execution engine. Hideable for the reason Pro Coder is: someone six weeks
    from a front-end interview has no business being sent down a hundred and
    twenty SQL problems, and a deployment aimed at them should be able to take
    it off the menu.
  */
  { key: 'sql', label: 'SQL Lab', path: '/sql' },
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

export const moduleLabel = (key) => MODULES.find((module) => module.key === key)?.label || key;
