import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext.jsx';
import { feedbackModal } from '../../store/feedbackModal.js';
import { moduleVisible } from '../../store/modules.js';
import { Avatar } from '../ui/Avatar.jsx';
import { IconLogout, IconMegaphone, IconUser } from '../ui/Icons.jsx';

/**
 * The account menu, hung off your own face in the top right.
 *
 * It replaces three separate controls that had collected at that end of the bar
 * — a megaphone, a sign-out arrow and the avatar itself — none of which said
 * what it was without being hovered, and all three of which were about *you*
 * rather than about the page. One trigger everybody already recognises, and the
 * three things behind it get their names back.
 *
 * A menu, not a modal, and modelled on AppearancePicker rather than on
 * Dropdown: Dropdown is a listbox, where the options are values you are
 * choosing between and one of them is current. These are verbs. Nothing here is
 * "selected", and a tick column would be lying about that.
 */
export function AccountMenu({ onSignOut }) {
  const { user, modules } = useAuth();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // The shell listens for Escape too, to leave the search box. This one is
      // on top of it and is the one that was meant.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Arrows walk the items, which is what `role="menu"` promises and what the
     hand reaching for the keyboard expects. Tab still works and still leaves. */
  const onMenuKeys = (e) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[e.key];
    if (!step) return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('.acct-item')];
    const at = items.indexOf(document.activeElement);
    items[(at + step + items.length) % items.length]?.focus();
  };

  // Every item closes the menu first: what each of them opens — a page, a
  // dialog — wants the focus and the screen to itself.
  const run = (fn) => () => {
    setOpen(false);
    fn();
  };

  return (
    <div className="acct-wrap" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={`avatar-btn ${open || pathname === '/profile' ? 'active' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        title={user?.email}
      >
        <Avatar name={user?.name} email={user?.email} src={user?.avatar?.url} size={28} />
        <span className="sr-only">Account</span>
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- roving focus lives on the items
        <div className="acct-menu" role="menu" aria-label="Account" onKeyDown={onMenuKeys}>
          {/*
            Not decoration. This is the only place the app now says which
            account you are signed in as — it used to be the sign-out button's
            tooltip, which is a thing you find by accident on the way to leaving.
          */}
          <div className="acct-who">
            <Avatar name={user?.name} email={user?.email} src={user?.avatar?.url} size={34} />
            <div className="acct-id">
              <span className="acct-name">{user?.name}</span>
              <span className="acct-mail">{user?.email}</span>
            </div>
          </div>

          <button
            type="button"
            role="menuitem"
            className="acct-item"
            onClick={run(() => navigate('/profile'))}
          >
            <IconUser size={14} />
            View profile
          </button>

          {/* Same gate as everywhere else: hiding the module has to take every
              door with it, and this is now the last one in the shell. */}
          {moduleVisible(modules, 'feedback') && (
            <button
              type="button"
              role="menuitem"
              className="acct-item"
              onClick={run(() => feedbackModal.open('send'))}
            >
              <IconMegaphone size={14} />
              Send feedback
            </button>
          )}

          {/* Ruled off and last. It is the one item here you cannot undo by
              clicking the next thing, and it is not what most people opened
              this for. */}
          <div className="acct-sep" />
          <button type="button" role="menuitem" className="acct-item danger" onClick={run(onSignOut)}>
            <IconLogout size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
