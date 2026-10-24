import {
  IconBoard,
  IconBook,
  IconBriefcase,
  IconCalendar,
  IconChart,
  IconChat,
  IconCode,
  IconDatabase,
  IconDice,
  IconFile,
  IconRotate,
  IconShapes,
} from '../components/ui/Icons.jsx';

/**
 * The side-menu modules, and whether this session may see them.
 *
 * The list comes from the server on `GET /auth/me` — `{ visible, preview }` —
 * so which modules exist and who they are for lives in `server/src/config`
 * rather than being copied into JSX, exactly like the capability matrix in
 * caps.js. What is kept here is the part the server has no business knowing:
 * the icon and the order they sit in.
 *
 * All of this is for rendering. Hiding a nav item is a courtesy; the routes
 * behind a hidden module are locked by `requireModule` on the server, so a
 * bookmark to /tasks gets the same 404 as a URL that never existed.
 */

export const MODULE_NAV = [
  /*
    First, above every other module, because it is the one that says what to do
    with them. It used to be the only entry here that most sessions never saw —
    the server left `playbook` out of `visible` for everyone but the site owner
    — and it is an ordinary module now, in `visible` for every role unless a
    super admin hides it. Nothing in this file changed either way: it never had
    a special case for it, because `moduleVisible` only ever asked the server.
  */
  { key: 'playbook', to: '/playbook', label: 'Playbook', Icon: IconCalendar },
  /*
    Second, under the plan and above the rest, because it is the other
    curriculum. The roadmap and the ladder are the two lists you actually work
    through; everything below is something you do *about* them — revise, chart,
    ask, read, drill, plan.
  */
  { key: 'procoder', to: '/cp', label: 'Pro Coder', Icon: IconCode },
  /*
    Third, under the two curriculums it sits beside. The Lab is a list you work
    through like the roadmap and the ladder, not something you do *about* them
    — which is what everything below this line is.
  */
  { key: 'sql', to: '/sql', label: 'SQL Lab', Icon: IconDatabase },
  { key: 'revision', to: '/revision', label: 'Revision', Icon: IconRotate },
  { key: 'stats', to: '/stats', label: 'Stats', Icon: IconChart },
  { key: 'chat', to: '/chat', label: 'AI Chat', Icon: IconChat },
  { key: 'learn', to: '/learn', label: 'Learn', Icon: IconBook },
  /*
    A group rather than a link, and the only one in this list.

    System design is three rooms that belong together and live in two modules:
    the HLD notes are a Learn track, the whiteboard is its own workspace, and
    LLD will be a second Learn track. A flat menu can show one of those, and
    picking which one is a worse answer than a dropdown.

    It sits here, under Learn, rather than last where the whiteboard used to:
    HLD is reading you do most days, not a workspace you go into.

    `children` carry their own module keys, so visibility is per child — the
    group appears when *any* child is visible. A normal account sees it holding
    only HLD; the whiteboard is still behind `requireModule('design')` on the
    server, and its row is simply absent rather than shown and refused.
  */
  {
    group: 'systems',
    label: 'System Design',
    Icon: IconShapes,
    children: [
      { key: 'learn', to: '/learn/hld', label: 'HLD' },
      { key: 'design', to: '/design', label: 'Practice' },
      // LLD joins here when that Learn track exists.
    ],
  },
  /* Down here with the rest of the after-the-fact work rather than next to
     either list, because training against the curriculum is not working
     through it — the drill draws its questions from the roadmap the way the
     ladder draws its problems from its own list. */
  { key: 'practice', to: '/practice', label: 'Practice', Icon: IconDice },
  { key: 'tasks', to: '/tasks', label: 'Tasks', Icon: IconBoard },
  /*
    Last, under Tasks, because they are the two boards and this is the one you
    open less often.

    It is the only entry here that is not about the curriculum at all. Everything
    above it is something you do to get ready; this is the thing you were getting
    ready for — which is also why it ends the list rather than sitting among the
    rooms you prepare in.
  */
  { key: 'applications', to: '/applications', label: 'Applications', Icon: IconBriefcase },
  /*
    A group, like System Design, because it will hold several pages: Resume
    Building now, more interview guides later. Every child shares the one
    `interview` module key, so hiding it hides the whole group.
  */
  {
    group: 'interview',
    label: 'Interview Helper',
    Icon: IconFile,
    children: [
      { key: 'interview', to: '/interview/resume', label: 'Resume Building' },
      { key: 'interview', to: '/interview/recruiters', label: 'MAANG Recruiter Directory' },
      { key: 'interview', to: '/interview/messages', label: 'Outreach Messages' },
      { key: 'interview', to: '/interview/sprint', label: '30-Day Sprint' },
      { key: 'interview', to: '/interview/behavioral', label: 'Behavioral Prep' },
      { key: 'interview', to: '/interview/negotiation', label: 'Offer Negotiation' },
      // More interview pages join here.
    ],
  },
  /*
    Feedback is deliberately absent. It is a module like the rest — the server
    still gates /feedback on it, and `moduleVisible(modules, 'feedback')` still
    decides whether the topbar's megaphone is drawn — but it had three doors
    into the same dialog and only one of them cost a row in a menu you read on
    the way to somewhere else. The bubble and the topbar button remain, and the
    page itself is a click away from your profile.
  */
];

/**
 * Unknown means hidden. Before the session resolves `modules` is null, and
 * drawing a module we have not been told about — then taking it away a moment
 * later — is the one behaviour worth ruling out by construction here.
 */
export const moduleVisible = (modules, key) => Boolean(modules?.visible?.includes(key));

/**
 * The children of a group this session may actually open.
 *
 * A group is visible when it has at least one of these, so the caller filters
 * and tests emptiness in one step rather than asking twice. Returns `null` for
 * a plain entry, which is what tells the two renderers below which shape they
 * are holding — a `children` key that is sometimes absent would have every call
 * site guessing.
 */
export const visibleChildren = (modules, item) =>
  item.children ? item.children.filter((child) => moduleVisible(modules, child.key)) : null;

/**
 * Visible to this person, hidden from everyone else — i.e. still being built.
 *
 * Only ever true for someone holding `module:preview`, because the server sends
 * an empty `preview` list to everybody else. It drives the "dev" badge, so an
 * unfinished page is never mistaken for a shipped one.
 */
export const modulePreview = (modules, key) => Boolean(modules?.preview?.includes(key));
