import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../../brand.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useLocalState } from '../../hooks/useLocalState.js';
import { IconChart, IconChevronRight, IconGrid, IconMenu, IconRotate } from '../ui/Icons.jsx';

const pct = (solved, total) => (total ? Math.round((solved / total) * 100) : 0);

// Two or three letters is enough to recognise a pattern in the collapsed rail.
const abbrev = (name) =>
  name
    .replace(/[^A-Za-z0-9 &/-]/g, '')
    .split(/[\s&/-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

export function Sidebar({ collapsed, onToggle }) {
  const { groups, totals } = useRoadmap();
  const [patternsOpen, setPatternsOpen] = useLocalState('sidebar-patterns-open', true);
  const navigate = useNavigate();
  const location = useLocation();

  const goToPattern = (slug) => {
    if (location.pathname !== '/') navigate(`/?pattern=${slug}`);
    else {
      window.dispatchEvent(new CustomEvent('focus-pattern', { detail: slug }));
    }
  };

  return (
    <aside className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-head">
        <button className="icon-btn" onClick={onToggle} title="Toggle sidebar (Ctrl+B)">
          <IconMenu size={15} />
        </button>
        {!collapsed && (
          <div className="brand">
            <span className="brand-mark">{BRAND.mark}</span>
            <span>{BRAND.name}</span>
          </div>
        )}
      </div>

      <div className="sidebar-scroll">
        {collapsed ? (
          <>
            <NavLink to="/" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} title="Roadmap">
              <IconGrid size={15} />
            </NavLink>
            <NavLink
              to="/revision"
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              title="Revision"
            >
              <IconRotate size={15} />
            </NavLink>
            <NavLink
              to="/stats"
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              title="Stats"
            >
              <IconChart size={15} />
            </NavLink>
            <div style={{ height: 8 }} />
            {groups.map((g) => (
              <button
                key={g.slug}
                className="rail-item"
                onClick={() => goToPattern(g.slug)}
                title={`${g.name} — ${g.solved}/${g.total}`}
              >
                {abbrev(g.name)}
              </button>
            ))}
          </>
        ) : (
          <>
            <NavLink to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconGrid size={14} />
              Roadmap
              <span className="count">
                {totals.solved}/{totals.total}
              </span>
            </NavLink>
            <NavLink
              to="/revision"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <IconRotate size={14} />
              Revision
            </NavLink>
            <NavLink to="/stats" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconChart size={14} />
              Stats
            </NavLink>

            <button
              className="sidebar-label sidebar-label-btn"
              onClick={() => setPatternsOpen((o) => !o)}
              aria-expanded={patternsOpen}
            >
              <span className={`chev ${patternsOpen ? 'open' : ''}`}>
                <IconChevronRight size={11} />
              </span>
              Patterns
              <span className="count">{groups.length}</span>
            </button>
            {patternsOpen &&
              groups.map((g, i) => (
                <button
                  key={g.slug}
                  className="pattern-link"
                  style={{ width: '100%', textAlign: 'left' }}
                  onClick={() => goToPattern(g.slug)}
                >
                  <div className="pattern-link-top">
                    <span className="pattern-index">{String(i + 1).padStart(2, '0')}</span>
                    <span className="name">{g.name}</span>
                    <span className="frac">
                      {g.solved}/{g.total}
                    </span>
                  </div>
                  <div className="minibar">
                    <span style={{ width: `${pct(g.solved, g.total)}%` }} />
                  </div>
                </button>
              ))}
          </>
        )}
      </div>
    </aside>
  );
}
