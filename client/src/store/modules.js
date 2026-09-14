import {
  IconBoard,
  IconBook,
  IconCalendar,
  IconChart,
  IconChat,
  IconCode,
  IconDatabase,
  IconDice,
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
  /* Down here with the rest of the after-the-fact work rather than next to
     either list, because training against the curriculum is not working
     through it — the drill draws its questions from the roadmap the way the
     ladder draws its problems from its own list. */
  { key: 'practice', to: '/practice', label: 'Practice', Icon: IconDice },
  { key: 'tasks', to: '/tasks', label: 'Tasks', Icon: IconBoard },
  /*
    Last, because it is the one module where you make something rather than
    work through or look back at something. It opens into a full-screen
    workspace of its own, so its place in this list only matters for getting in.
  */
  { key: 'design', to: '/design', label: 'System Design', Icon: IconShapes },
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
 * Visible to this person, hidden from everyone else — i.e. still being built.
 *
 * Only ever true for someone holding `module:preview`, because the server sends
 * an empty `preview` list to everybody else. It drives the "dev" badge, so an
 * unfinished page is never mistaken for a shipped one.
 */
export const modulePreview = (modules, key) => Boolean(modules?.preview?.includes(key));
