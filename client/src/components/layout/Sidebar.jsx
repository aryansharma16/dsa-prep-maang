import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BRAND } from '../../brand.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { ROLE_LABEL, can } from '../../store/caps.js';
import {
  MODULE_NAV,
  modulePreview,
  moduleVisible,
  visibleChildren,
} from '../../store/modules.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import {
  IconBook,
  IconChevronRight,
  IconExpand,
  IconGrid,
  IconMenu,
  IconShield,
} from '../ui/Icons.jsx';

const HOVER_TITLE = {
  on: 'Hover to open is on — the rail expands while the pointer is over it. Click to turn it off.',
  off: 'Hover to open is off — the rail only expands when you open it. Click to turn it on.',
};

/**
 * Which nav groups are open, remembered across reloads.
 *
 * Wrapped both ways, like every other reader of `localStorage` in this app: it
 * throws on access in a private window with site data blocked, and a menu that
 * will not render is a worse outcome than a group that forgets it was open.
 */
const GROUPS_KEY = 'sidebar-groups';

const readGroups = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(GROUPS_KEY));
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
};

const writeGroups = (open) => {
  try {
    localStorage.setItem(GROUPS_KEY, JSON.stringify(open));
  } catch {
    // Nothing to do about it, and nothing worth telling anyone.
  }
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
  const { totals } = useRoadmap();
  const { user, modules } = useAuth();
  const { pathname } = useLocation();
  const [openGroups, setOpenGroups] = useState(readGroups);

  const toggleGroup = (key) =>
    setOpenGroups((prev) => {
      const next = prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key];
      writeGroups(next);
      return next;
    });

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

    A group resolves its children here rather than in either branch below, so
    both get the same answer and neither has to know that `visible` is a list of
    module keys. `kids` is `null` for a plain entry and an array for a group,
    which is also the test the branches switch on.
  */
  const nav = MODULE_NAV.map((item) => ({ ...item, kids: visibleChildren(modules, item) }))
    // A group with nothing in it is not drawn — a dropdown that opens onto an
    // empty list is worse than a missing menu row.
    .filter((item) => (item.kids ? item.kids.length > 0 : moduleVisible(modules, item.key)));

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
            {nav.map(({ key, group, to, label, Icon, kids }) => {
              /*
                A group in the rail is one icon pointing at its first child, not
                a flyout. The rail is a column of icons you hit on the way past;
                a submenu that opens sideways out of it is a thing to aim at,
                and the expanded menu two pixels away already does that job
                properly. Active whenever any child's route is.
              */
              const target = kids ? kids[0].to : to;
              const id = group || key;
              const dev = !kids && modulePreview(modules, key);
              return (
                <NavLink
                  key={id}
                  onClick={onNavigate}
                  to={target}
                  className={({ isActive }) =>
                    `rail-item ${
                      isActive || (kids && kids.some((c) => pathname.startsWith(c.to)))
                        ? 'active'
                        : ''
                    } ${dev ? 'in-dev' : ''}`
                  }
                  title={dev ? `${label} — in development` : label}
                >
                  <Icon size={15} />
                </NavLink>
              );
            })}
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
            {nav.map(({ key, group, to, label, Icon, kids }) => {
              if (!kids) {
                return (
                  <NavLink
                    key={key}
                    onClick={onNavigate}
                    to={to}
                    className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
                  >
                    <Icon size={14} />
                    {label}
                    {/* Only ever rendered for someone holding `module:preview`,
                        so the badge doubles as the reason nobody else sees
                        this row. */}
                    {modulePreview(modules, key) && <span className="dev-pill">Dev</span>}
                  </NavLink>
                );
              }

              /*
                Open if you opened it, or if you are already inside it. The
                second half is not a convenience: landing on /learn/hld from a
                bookmark with the group shut leaves the menu unable to say where
                you are, and the row you are on invisible.
              */
              const inside = kids.some((child) => pathname.startsWith(child.to));
              const open = inside || openGroups.includes(group);

              return (
                <div className="nav-group" key={group}>
                  <button
                    type="button"
                    className={`nav-item ${inside ? 'within' : ''}`}
                    aria-expanded={open}
                    onClick={() => toggleGroup(group)}
                  >
                    <Icon size={14} />
                    {label}
                    <IconChevronRight size={12} className={`nav-chev ${open ? 'open' : ''}`} />
                  </button>
                  {open && (
                    <div className="nav-group-items">
                      {kids.map((child) => (
                        <NavLink
                          key={child.to}
                          onClick={onNavigate}
                          to={child.to}
                          className={({ isActive }) => `nav-item child ${isActive ? 'active' : ''}`}
                        >
                          {child.label}
                          {modulePreview(modules, child.key) && (
                            <span className="dev-pill">Dev</span>
                          )}
                        </NavLink>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      {/*
        Out of the scroller and pinned to the floor. None of these three is
        somewhere you go on your way through the app: the guide is what you
        open when you are stuck, admin is a different job entirely, and the
        hover switch is a setting. Keeping them off the scroller means they are
        always in the same place rather than wherever the list above happens to
        end — which is what made them findable back when a twenty-two-row
        pattern list sat between you and them.
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
