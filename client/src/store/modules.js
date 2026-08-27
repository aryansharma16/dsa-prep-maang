import {
  IconBoard,
  IconBook,
  IconCalendar,
  IconChart,
  IconChat,
  IconCode,
  IconDice,
  IconRotate,
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
    with them. It is also the only entry here that most sessions never see — the
    server leaves `playbook` out of `visible` for everyone but the site owner,
    so `moduleVisible` filters it out with no special case needed here.
  */
  { key: 'playbook', to: '/playbook', label: 'Playbook', Icon: IconCalendar },
  { key: 'revision', to: '/revision', label: 'Revision', Icon: IconRotate },
  { key: 'stats', to: '/stats', label: 'Stats', Icon: IconChart },
  { key: 'chat', to: '/chat', label: 'AI Chat', Icon: IconChat },
  { key: 'learn', to: '/learn', label: 'Learn', Icon: IconBook },
  { key: 'procoder', to: '/cp', label: 'Pro Coder', Icon: IconCode },
  /* Beside Pro Coder rather than beside the roadmap: both are things you do with
     the curriculum, and the drill draws its questions from the roadmap the way
     the ladder draws its problems from its own list. */
  { key: 'practice', to: '/practice', label: 'Practice', Icon: IconDice },
  { key: 'tasks', to: '/tasks', label: 'Tasks', Icon: IconBoard },
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
