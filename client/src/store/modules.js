import {
  IconChart,
  IconChat,
  IconNote,
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
 * bookmark to /notes gets the same 404 as a URL that never existed.
 */

export const MODULE_NAV = [
  { key: 'revision', to: '/revision', label: 'Revision', Icon: IconRotate },
  { key: 'stats', to: '/stats', label: 'Stats', Icon: IconChart },
  { key: 'chat', to: '/chat', label: 'AI Chat', Icon: IconChat },
  { key: 'notes', to: '/notes', label: 'Notes', Icon: IconNote },
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
