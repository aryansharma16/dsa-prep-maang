import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLocalState } from '../../hooks/useLocalState.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { ChatLauncher } from '../chat/ChatLauncher.jsx';
import { AddProblemModal } from '../problem/AddProblemModal.jsx';
import { Avatar } from '../ui/Avatar.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconLogout, IconPlus, IconSearch } from '../ui/Icons.jsx';
import { isAnyModalOpen } from '../ui/Modal.jsx';
import { AppearancePicker } from './AppearancePicker.jsx';
import { Sidebar } from './Sidebar.jsx';

export function AppShell() {
  const [collapsed, setCollapsed] = useLocalState('sidebar-collapsed', false);
  const { user, logout } = useAuth();
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

  // Below 1024px the sidebar would eat the table, so collapse it automatically.
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 1024px)');
    const apply = (e) => e.matches && setCollapsed(true);
    apply(mq);
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [setCollapsed]);

  useEffect(() => {
    const onKey = (e) => {
      const typing = /^(INPUT|TEXTAREA)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (isAnyModalOpen()) return;

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        setCollapsed((c) => !c);
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
  }, [setCollapsed]);

  const pct = totals.total ? Math.round((totals.solved / totals.total) * 100) : 0;

  return (
    <div className="shell">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />

      <div className="main">
        <header className="topbar">
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


      {signingOut && (
        <ConfirmDialog
          title="Sign out?"
          message={`You'll be signed out of ${user?.email}.`}
          detail="Your progress is saved to your account — signing back in picks up exactly where you left off."
          confirmLabel="Sign out"
          tone="danger"
          onConfirm={logout}
          onCancel={() => setSigningOut(false)}
        />
      )}
    </div>
  );
}
