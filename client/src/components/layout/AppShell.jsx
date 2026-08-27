import { useCallback, useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLocalState } from '../../hooks/useLocalState.js';
import { HOVERS, NARROW, useMediaQuery } from '../../hooks/useMediaQuery.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { feedbackModal } from '../../store/feedbackModal.js';
import { moduleVisible } from '../../store/modules.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { ChatLauncher } from '../chat/ChatLauncher.jsx';
import { FeedbackLauncher } from '../feedback/FeedbackLauncher.jsx';
import { TimerPill } from '../tasks/TimerPill.jsx';
import { AttemptTimerPill } from '../problem/AttemptTimerPill.jsx';
import { AddProblemModal } from '../problem/AddProblemModal.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { IconLogout, IconMegaphone, IconMenu, IconPlus, IconSearch } from '../ui/Icons.jsx';
import { isAnyModalOpen } from '../ui/Modal.jsx';
import { AppearancePicker } from './AppearancePicker.jsx';
import { Sidebar } from './Sidebar.jsx';
import { SignOutDialog } from './SignOutDialog.jsx';

export function AppShell() {
  const [collapsed, setCollapsed] = useLocalState('sidebar-collapsed', false);
  /*
    Whether the rail is allowed to open itself under the pointer. On by default
    — it is the behaviour that makes a collapsed sidebar worth collapsing — but
    a setting rather than a law, because a menu that unfurls every time you
    cross it on the way to the table is the exact thing some people collapse a
    sidebar to be rid of. The switch is at the foot of the menu itself, which is
    the only place you are guaranteed to be looking when it annoys you.
  */
  const [hoverOpen, setHoverOpen] = useLocalState('sidebar-hover-open', true);
  const [peeking, setPeeking] = useState(false);
  const { user, modules } = useAuth();
  const { totals } = useRoadmap();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  /*
    The admin panel has its own filters, and yanking someone to the roadmap
    mid-edit because they typed in the wrong box would be worse than a search
    that does nothing. Everywhere else, only the roadmap renders results, so
    searching from Stats or Revision takes you there.
  */
  const onAdmin = pathname.startsWith('/admin');

  const onSearch = (value) => {
    setQuery(value);
    if (value && pathname !== '/' && !onAdmin) navigate('/');
  };

  /*
    Below 760px the sidebar stops being a column and becomes a drawer: it lifts
    out of the flex row and slides over the content, because 248px of nav on a
    390px screen is not a layout and the 56px rail it collapses to is 22 pattern
    abbreviations nobody can read.

    `collapsed` carries both meanings rather than gaining a sibling — closed
    rail and closed drawer are the same intent, and two booleans for one idea
    would need reconciling every time the breakpoint is crossed.
  */
  const narrow = useMediaQuery(NARROW);
  const navOpen = narrow && !collapsed;

  /*
    A peek is a *view* of the sidebar, never a change to it — `collapsed` is
    untouched throughout, so nothing about it survives the pointer leaving and
    nothing about it is written to storage.

    Four conditions, and each rules out a way this goes wrong: only when it is
    actually collapsed (there is nothing to reveal otherwise), only when asked
    for, never in drawer mode (down there `collapsed` means "closed drawer" and
    a hover would fling it over the page), and only on a device with a real
    pointer — on a touchscreen `mouseenter` fires on tap and would open the menu
    on the way to whatever was tapped.
  */
  const hovers = useMediaQuery(HOVERS);
  const peek = peeking && collapsed && hoverOpen && !narrow && hovers;

  /*
    Closing the menu with the pointer still inside it would re-open it on the
    spot — the peek's condition is satisfied the instant `collapsed` flips, and
    `mouseenter` is not going to fire again to tell us otherwise. So the toggle
    arms `held`, and only the pointer physically leaving disarms it.

    `pointer` is what keeps that honest. Arming unconditionally would swallow
    the next hover after a Ctrl+B pressed from the far side of the page, where
    there is no pointer in here to fight with and nothing to suppress.
  */
  const pointer = useRef(false);
  const held = useRef(false);

  const onPeek = useCallback((want, viaPointer) => {
    if (viaPointer) {
      pointer.current = want;
      if (!want) held.current = false;
    }
    if (want && held.current) return;
    setPeeking(want);
  }, []);

  const toggleNav = useCallback(() => {
    held.current = pointer.current;
    setPeeking(false);
    setCollapsed((c) => !c);
  }, [setCollapsed]);

  // Below 1024px the sidebar would eat the table, so collapse it automatically.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const apply = (e) => e.matches && setCollapsed(true);
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setCollapsed]);

  /*
    A drawer that survived the navigation it just performed would cover the page
    it took you to. Keyed on pathname, so this fires for the nav links; the
    pattern buttons scroll rather than navigate, and close it through
    `closeNav` instead.
  */
  useEffect(() => {
    if (narrow) setCollapsed(true);
  }, [pathname, narrow, setCollapsed]);

  // Escape closes the drawer, the way it closes every other overlay here.
  useEffect(() => {
    if (!navOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setCollapsed(true);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [navOpen, setCollapsed]);

  const closeNav = () => narrow && setCollapsed(true);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (isAnyModalOpen()) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        toggleNav();
        return;
      }
      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === 'Escape' && document.activeElement === searchRef.current) {
        searchRef.current.blur();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [toggleNav]);

  const pct = totals.total ? Math.round((totals.solved / totals.total) * 100) : 0;

  return (
    <div className={`shell ${navOpen ? 'nav-open' : ''}`}>
      <Sidebar
        collapsed={collapsed}
        peek={peek}
        hoverOpen={hoverOpen}
        onToggle={toggleNav}
        onNavigate={closeNav}
        onPeek={onPeek}
        onHoverOpen={setHoverOpen}
      />

      {/*
        A peeking sidebar is lifted out of the flex row and drawn over the page,
        because a hover that reflowed a four-hundred-row table would be a hover
        nobody wants. This holds the rail-width slot it left, so `.main` is the
        same width open or shut and the page underneath never moves.
      */}
      {peek && <div className="sidebar-peek-space" aria-hidden="true" />}

      {/* Tapping the page you can still see is the fastest way out of a drawer,
          and it is the gesture people try first. */}
      {navOpen && (
        <button className="nav-scrim" onClick={closeNav} aria-label="Close navigation" />
      )}

      <div className="main">
        <header className="topbar">
          {/*
            The sidebar's own toggle travels off-screen with it, so the way back
            in has to live somewhere that stays. CSS hides this above the
            breakpoint, where that toggle is reachable again.
          */}
          <button
            className="nav-toggle"
            onClick={toggleNav}
            aria-label={navOpen ? 'Close navigation' : 'Open navigation'}
            aria-expanded={navOpen}
          >
            <IconMenu size={16} />
          </button>

          <div className="search">
            <span className="glass">
              <IconSearch size={13} />
            </span>
            <input
              ref={searchRef}
              value={query}
              onChange={(e) => onSearch(e.target.value)}
              placeholder="Search problems, companies, tags..."
              aria-label="Search problems"
            />
            {!query && <kbd>/</kbd>}
          </div>

          <div className="spacer" />

          {/*
            Renders nothing unless a clock is running, which is most of the
            time. It sits before the solved counter rather than after it because
            when it is there it is the more urgent of the two — and because
            appearing to the left of a fixed element pushes nothing around that
            the eye was already tracking.
          */}
          <TimerPill />
          {/* Beside it, not instead of it. They measure different things and
              can run at once — an afternoon booked on the board, one problem
              inside it. */}
          <AttemptTimerPill />

          <div className="overall">
            <span>
              <b>{totals.solved}</b> / {totals.total} solved
            </span>
            <div className="bar" style={{ width: 64 }}>
              <span style={{ width: `${pct}%` }} />
            </div>
          </div>

          <button className="btn" onClick={() => setAdding(true)} title="Add your own problem">
            <IconPlus size={13} />
            Add
          </button>

          {/*
            A third door to a dialog whose bubble is eighteen pixels away, and it
            is here because it was asked for. Icon-only, because a labelled
            button beside Add would be the second labelled button in a bar with
            room for one — and the phone block hides it outright, where the
            search field needs the width more than this needs the reminder.
          */}
          {moduleVisible(modules, 'feedback') && (
            <button
              className="icon-btn fb-topbar-btn"
              onClick={() => feedbackModal.open('send')}
              title="Send feedback"
            >
              <IconMegaphone size={15} />
            </button>
          )}

          <AppearancePicker />

          <button
            className="icon-btn"
            onClick={() => setSigningOut(true)}
            title={`Sign out (${user?.email})`}
          >
            <IconLogout size={15} />
          </button>

          <NavLink
            to="/profile"
            className={({ isActive }) => `avatar-btn ${isActive ? 'active' : ''}`}
            title={`${user?.name} — view profile`}
          >
            <Avatar name={user?.name} email={user?.email} src={user?.avatar?.url} size={28} />
            <span className="sr-only">Profile</span>
          </NavLink>
        </header>

        <main className="content">
          <div className="content-inner">
            <Outlet context={{ query, setQuery }} />
          </div>
        </main>
      </div>

      {adding && <AddProblemModal onClose={() => setAdding(false)} />}

      {/* Every signed-in page, and no signed-out one — this shell is only
          mounted behind the auth branch in App.jsx. */}
      <ChatLauncher />
      <FeedbackLauncher />

      {signingOut && <SignOutDialog onCancel={() => setSigningOut(false)} />}
    </div>
  );
}
