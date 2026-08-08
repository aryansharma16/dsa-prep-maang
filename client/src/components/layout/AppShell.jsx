import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLocalState, useTheme } from '../../hooks/useLocalState.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { AddProblemModal } from '../problem/AddProblemModal.jsx';
import { IconLogout, IconMoon, IconPlus, IconSearch, IconSun } from '../ui/Icons.jsx';
import { Sidebar } from './Sidebar.jsx';

export function AppShell() {
  const [collapsed, setCollapsed] = useLocalState('sidebar-collapsed', false);
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { totals } = useRoadmap();
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const searchRef = useRef(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();

  // Only the roadmap renders results, so searching from Stats or Revision takes
  // you there rather than leaving you typing into a box that does nothing.
  const onSearch = (value) => {
    setQuery(value);
    if (value && pathname !== '/') navigate('/');
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

          <button
            className="icon-btn"
            onClick={toggle}
            title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          >
            {theme === 'dark' ? <IconSun size={15} /> : <IconMoon size={15} />}
          </button>

          <button className="icon-btn" onClick={logout} title={`Sign out (${user?.email})`}>
            <IconLogout size={15} />
          </button>
        </header>

        <main className="content">
          <div className="content-inner">
            <Outlet context={{ query, setQuery }} />
          </div>
        </main>
      </div>

      {adding && <AddProblemModal onClose={() => setAdding(false)} />}
    </div>
  );
}
