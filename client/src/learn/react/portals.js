import { cheat, code, h, jsx, links, note, p, reactDoc, sig, table, tip, ul, warn } from '../blocks.js';

export const doc = {
  blocks: [
    p(
      '`createPortal` renders children into a different DOM node while keeping them in the same place in the **React** tree. The element moves in the document; it does not move in the component hierarchy.',
    ),
    code(
      jsx(`
import { createPortal } from 'react-dom';

createPortal(children, domNode, key?);
`),
    ),

    h('Signature'),
    sig([
      ['`children`', 'JSX', 'Anything renderable.'],
      ['`domNode`', '`Element`', 'Where it lands in the document. Must already exist when the portal renders.'],
      ['`key`', '`string`', 'Optional, for the usual reason — when the portal itself is in a list.'],
    ]),

    h('The two trees'),
    p(
      'This is the whole idea, and everything else follows from it.',
    ),
    table(
      ['', 'React tree', 'DOM tree'],
      [
        ['Parent', 'Unchanged — the portal is still a child of the component that rendered it', 'The `domNode` you passed'],
        ['Context', 'Inherited from the React parent', 'Irrelevant'],
        ['Event bubbling', 'Bubbles to the React parent', 'Bubbles from the `domNode` in the DOM'],
        ['CSS inheritance and stacking', 'Irrelevant', 'From the `domNode` — this is the point'],
      ],
    ),
    p(
      'So a modal rendered through a portal still reads the theme context of the component that opened it, still bubbles its clicks to that component, and is still unmounted when that component unmounts — but it is a child of `<body>` in the document, so no ancestor `overflow: hidden` can clip it and no `z-index` stacking context can trap it.',
    ),

    h('Why: the CSS problem'),
    warn(
      'A `transform`, `filter`, `perspective`, `contain` or `will-change` on any ancestor creates a new containing block, and a `position: fixed` descendant is then positioned relative to *that* rather than the viewport. An `overflow: hidden` ancestor clips it. A `z-index` on a positioned ancestor caps it. None of these can be fixed from inside the modal.',
    ),
    p(
      'A portal sidesteps all of it by moving the node out from under the ancestor entirely. That is the honest reason portals exist — not because the React tree was wrong, but because CSS containment is inherited from the DOM parent and you cannot opt out of it.',
    ),

    h('A modal'),
    code(
      jsx(`
function Modal({ title, onClose, children }) {
  // Escape and focus handling live here, in the React tree, exactly as they
  // would without a portal.
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return createPortal(
    <div className="overlay" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>,
    document.body,
  );
}

// Used like any other component
{isOpen && <Modal title="Confirm" onClose={close}>...</Modal>}
`),
    ),
    tip(
      'Rendering into `document.body` is fine and is what most libraries do. A dedicated `<div id="portal-root">` next to `#root` in `index.html` is slightly tidier — it keeps React-owned nodes out of the way of anything else that appends to `body`.',
    ),

    h('Events bubble through the React tree'),
    p(
      'This surprises people the first time. A click inside a portal fires handlers on the portal component ancestors, even though those elements are nowhere near it in the document.',
    ),
    code(
      jsx(`
// The onClick fires when the modal content is clicked, because Modal is a
// React child of this div — even though the modal DOM lives in <body>.
<div onClick={() => console.log('clicked')}>
  <Modal>...</Modal>
</div>
`),
    ),
    ul(
      'Usually convenient: a form inside a portal still submits to the form handler above it.',
      'Occasionally a trap: a click-outside handler on an ancestor fires for clicks *inside* the portal. Guard it by checking the target, or by putting the dismiss handler on the overlay itself.',
      'Native listeners added with `addEventListener` on a DOM ancestor do **not** see portal events — the DOM tree is what matters there.',
    ),

    h('Do you need one?'),
    table(
      ['Case', 'Portal?'],
      [
        ['A modal or dialog', 'Yes, unless you use `<dialog>` with `showModal()`'],
        ['A tooltip or popover that must escape `overflow: hidden`', 'Yes'],
        ['A toast stack', 'Yes — it belongs at the document level'],
        ['A dropdown inside a scroll container', 'Yes, or CSS anchor positioning'],
        ['A dropdown with room to open in place', 'No — plain absolute positioning is simpler'],
        ['Rendering into a non-React part of the page', 'Yes — this is the other use, embedding React into an existing app'],
      ],
    ),
    note(
      'The native `<dialog>` element with `showModal()` handles the top layer, the backdrop, focus trapping and Escape without a portal at all, and is now well supported. Worth checking before reaching for this.',
    ),

    h('Accessibility does not come free'),
    warn(
      'A portal fixes the CSS problem and nothing else. A modal still needs `role="dialog"`, `aria-modal="true"`, an accessible name, focus moved into it on open and restored on close, a focus trap while open, and Escape to dismiss. Moving the node in the DOM does none of that.',
    ),
    p(
      'This codebase keeps that logic in one place — `components/ui/useDialog.js` handles the focus trap and Escape, and `Modal.jsx` uses it — which is the right shape: the portal is a detail, the dialog behaviour is the component.',
    ),

    h('Cheatsheet'),
    cheat([
      ['Escape `overflow: hidden` or a stacking context', '`createPortal(children, document.body)`'],
      ['Keep context and events working', 'Automatic — the React tree is unchanged'],
      ['Stop an ancestor click-outside firing', 'Check `e.target`, or handle dismissal on the overlay'],
      ['A native listener that misses portal events', 'Expected — it is watching the DOM tree'],
      ['A modal without a portal', 'The `<dialog>` element with `showModal()`'],
      ['Make it accessible', '`role`, `aria-modal`, focus trap, Escape — a portal does not do this'],
    ]),

    links(
      reactDoc('reference/react-dom/createPortal', 'createPortal'),
      reactDoc('reference/react-dom/components/dialog', '<dialog>'),
    ),
  ],
};
