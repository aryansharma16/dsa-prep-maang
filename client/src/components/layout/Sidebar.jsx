import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { BRAND } from '../../brand.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { ROLE_LABEL, can } from '../../store/caps.js';
import { MODULE_NAV, modulePreview, moduleVisible } from '../../store/modules.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useLocalState } from '../../hooks/useLocalState.js';
import {
  IconBook,
  IconChevronRight,
  IconExpand,
  IconGrid,
  IconMenu,
  IconShield,
} from '../ui/Icons.jsx';

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

const HOVER_TITLE = {
  on: 'Hover to open is on — the rail expands while the pointer is over it. Click to turn it off.',
  off: 'Hover to open is off — the rail only expands when you open it. Click to turn it on.',
};

export function Sidebar({
  collapsed,
  peek,
  hoverOpen,
  onToggle,
  onNavigate,
  onPeek,
  onHoverOpen,
}) {
  const { groups, totals } = useRoadmap();
  const { user, modules } = useAuth();
  const [patternsOpen, setPatternsOpen] = useLocalState('sidebar-patterns-open', true);
  const navigate = useNavigate();
  const location = useLocation();

  // Staff only. Cosmetic — the server refuses the routes regardless — but a
  // learner should never see a door they cannot open.
  const showAdmin = can(user, 'panel');

  /*
    What the menu is *showing*, which is not the same as what it is set to. A
    peek draws the full menu over the page without ever touching `collapsed`,
    so letting go of it needs no undo — the pointer leaving is the undo.
  */
  const open = !collapsed || peek;

  /*
    One list feeding both the rail and the expanded menu, rather than the two
    branches below each holding their own copy of the same five links. A module
    hidden by the super admin has to disappear from both — with two lists that
    is a thing you have to remember, and with one it is not a thing at all.

    The roadmap is not in here: it is the app's home, where the catch-all route
    and every redirect land, so it is never hideable. See config/modules.js.
    Nor is the guide, for the opposite reason — it is not a module at all, it
    needs no session, and it is mounted outside this shell as well.
  */
  const nav = MODULE_NAV.filter((item) => moduleVisible(modules, item.key));

  const goToPattern = (slug) => {
    if (location.pathname !== '/') navigate(`/?pattern=${slug}`);
    else {
      window.dispatchEvent(new CustomEvent('focus-pattern', { detail: slug }));
    }
    // Already on the roadmap this only scrolls, so the pathname never changes
    // and the shell's route effect never fires — but the drawer is still sat on
    // top of the section it just scrolled to.
    onNavigate?.();
  };

  /*
    Tabbing into a rail whose labels are all icons is the keyboard equivalent of
    hovering it, so it opens the same way. Guarded on relatedTarget because
    focusout fires on every hop *between* the rail's own links, and closing on
    each of those would flicker the menu shut under the caret.

    The second argument says whether this came from the pointer, which is not a
    detail the shell can infer and does need: it tracks where the pointer is in
    order to know whether closing the menu has to be defended from a hover.
  */
  const onFocusIn = () => onPeek?.(true, false);
  const onFocusOut = (e) => {
    if (!e.currentTarget.contains(e.relatedTarget)) onPeek?.(false, false);
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${peek ? 'peek' : ''}`}
      onMouseEnter={() => onPeek?.(true, true)}
      onMouseLeave={() => onPeek?.(false, true)}
      onFocus={onFocusIn}
      onBlur={onFocusOut}
    >
      <div className="sidebar-head">
        <button
          className="icon-btn"
          onClick={onToggle}
          /* Mid-peek this button no longer closes anything — the menu is
             already closed, it is just being held open by the pointer — so it
             says what it will actually do, which is make that permanent. */
          title={peek ? 'Keep sidebar open (Ctrl+B)' : 'Toggle sidebar (Ctrl+B)'}
        >
          <IconMenu size={15} />
        </button>
        {open && (
          <div className="brand">
            <span className="brand-mark">{BRAND.mark}</span>
            <span>{BRAND.name}</span>
          </div>
        )}
      </div>

      <div className="sidebar-scroll">
        {!open ? (
          <>
            <NavLink onClick={onNavigate} to="/" className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`} title="Roadmap">
              <IconGrid size={15} />
            </NavLink>
            {nav.map(({ key, to, label, Icon }) => (
              <NavLink
                key={key}
                onClick={onNavigate}
                to={to}
                className={({ isActive }) =>
                  `rail-item ${isActive ? 'active' : ''} ${modulePreview(modules, key) ? 'in-dev' : ''}`
                }
                title={modulePreview(modules, key) ? `${label} — in development` : label}
              >
                <Icon size={15} />
              </NavLink>
            ))}
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
            <NavLink onClick={onNavigate} to="/" end className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
              <IconGrid size={14} />
              Roadmap
              <span className="count">
                {totals.solved}/{totals.total}
              </span>
            </NavLink>
            {nav.map(({ key, to, label, Icon }) => (
              <NavLink
                key={key}
                onClick={onNavigate}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={14} />
                {label}
                {/* Only ever rendered for someone holding `module:preview`, so
                    the badge doubles as the reason nobody else sees this row. */}
                {modulePreview(modules, key) && <span className="dev-pill">Dev</span>}
              </NavLink>
            ))}

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

      {/*
        Out of the scroller and pinned to the floor. None of these three is
        somewhere you go on your way through the app: the guide is what you
        open when you are stuck, admin is a different job entirely, and the
        hover switch is a setting. Above the patterns they sat between you and
        the twenty-two sections you came here for, and — worse — they moved
        every time the pattern list grew a row. Down here they are always in
        the same place, and the twenty-two are the top of the list.
      */}
      <div className="sidebar-foot">
        {!open ? (
          <>
            <NavLink
              onClick={onNavigate}
              to="/docs"
              className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
              title="Guide — what this is and how to use it"
            >
              <IconBook size={15} />
            </NavLink>
            {showAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `rail-item ${isActive ? 'active' : ''}`}
                title="Admin"
              >
                <IconShield size={15} />
              </NavLink>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={hoverOpen}
              aria-label="Hover to open"
              className={`rail-item hover-switch ${hoverOpen ? 'on' : ''}`}
              onClick={() => onHoverOpen?.(!hoverOpen)}
              title={hoverOpen ? HOVER_TITLE.on : HOVER_TITLE.off}
            >
              <IconExpand size={15} />
            </button>
          </>
        ) : (
          <>
            <NavLink
              onClick={onNavigate}
              to="/docs"
              className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
            >
              <IconBook size={14} />
              Guide
            </NavLink>
            {showAdmin && (
              <NavLink
                to="/admin"
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <IconShield size={14} />
                Admin
                <span className={`role-pill ${user.role}`}>{ROLE_LABEL[user.role]}</span>
              </NavLink>
            )}
            <button
              type="button"
              role="switch"
              aria-checked={hoverOpen}
              className={`nav-item hover-switch ${hoverOpen ? 'on' : ''}`}
              onClick={() => onHoverOpen?.(!hoverOpen)}
              title={hoverOpen ? HOVER_TITLE.on : HOVER_TITLE.off}
            >
              <IconExpand size={14} />
              Hover to open
              <span className="switch" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    </aside>
  );
}
