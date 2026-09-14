import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../../../design/core/time.js';
import { IconEdit, IconMore, IconTrash } from '../../ui/Icons.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';
import { IconArchive } from '../icons.jsx';

/**
 * One project on the home grid.
 *
 * The artwork is a small, fixed diagram in the project's colour rather than a
 * rendered thumbnail of its boards. A real thumbnail means rendering a board on
 * the server or storing an image per save; the colour and the icon already
 * tell projects apart at a glance, which is all a card has to do.
 */
export function ProjectCard({ project, onOpenIntent, onEdit, onArchive, onTrash }) {
  const [menu, setMenu] = useState(false);
  const moreRef = useRef(null);
  const boards = project.boardCount ?? 0;

  return (
    <article className={`sd-card ${project.archived ? 'is-archived' : ''}`} data-hue={project.hue}>
      <Link
        to={`/design/${project.id}`}
        className="sd-card-link"
        onPointerEnter={onOpenIntent}
        onFocus={onOpenIntent}
      >
        <div className="sd-card-art" aria-hidden="true">
          <svg viewBox="0 0 220 110" className="sd-card-diagram">
            <rect x="22" y="36" width="54" height="36" rx="7" />
            <rect x="144" y="16" width="54" height="30" rx="7" />
            <rect x="144" y="66" width="54" height="30" rx="7" />
            <path d="M76 54 H108 Q116 54 116 46 V39 Q116 31 124 31 H144" />
            <path d="M76 54 H108 Q116 54 116 62 V73 Q116 81 124 81 H144" />
          </svg>
          <span className="sd-card-icon">{project.icon || project.name.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="sd-card-body">
          <h3 title={project.name}>{project.name}</h3>
          <p>
            {boards} {boards === 1 ? 'board' : 'boards'} · {project.archived ? 'archived' : `edited ${timeAgo(project.touchedAt)}`}
          </p>
        </div>
      </Link>

      <button
        ref={moreRef}
        type="button"
        className="icon-btn sd-card-more"
        aria-label={`Actions for ${project.name}`}
        aria-haspopup="menu"
        aria-expanded={menu}
        onClick={() => setMenu((open) => !open)}
      >
        <IconMore size={14} />
      </button>
      {menu && (
        <ActionMenu
          anchor={moreRef.current}
          returnFocus={moreRef.current}
          label={`Actions for ${project.name}`}
          onClose={() => setMenu(false)}
          items={[
            { label: 'Edit details', icon: <IconEdit size={14} />, onSelect: onEdit },
            {
              label: project.archived ? 'Unarchive' : 'Archive',
              icon: <IconArchive size={14} />,
              onSelect: onArchive,
            },
            'sep',
            { label: 'Move to trash', icon: <IconTrash size={14} />, onSelect: onTrash, danger: true },
          ]}
        />
      )}
    </article>
  );
}
