import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { timeAgo } from '../../../design/core/time.js';
import { IconEdit, IconMore, IconTrash } from '../../ui/Icons.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';
import { IconArchive } from '../icons.jsx';
import { blueprintFor } from './blueprints.js';

/**
 * One project, as a card on the grid or a row in the list.
 *
 * Both shapes are here rather than in two components because everything that
 * makes a project a project — its colour, the actions menu, what the meta line
 * says — is the same either way; only the frame around it changes. The artwork
 * is a small diagram in the project's colour, picked from its id (see
 * `blueprints.js`), not a rendered thumbnail of its boards.
 */
export function ProjectCard({ project, view = 'grid', onOpenIntent, onEdit, onArchive, onTrash }) {
  const [menu, setMenu] = useState(false);
  const moreRef = useRef(null);
  const boards = project.boardCount ?? 0;
  const meta = `${boards} ${boards === 1 ? 'board' : 'boards'} · ${
    project.archived ? 'archived' : `edited ${timeAgo(project.touchedAt)}`
  }`;

  const more = (
    <>
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
    </>
  );

  if (view === 'list') {
    return (
      <article className={`sd-prow ${project.archived ? 'is-archived' : ''}`} data-hue={project.hue}>
        <Link
          to={`/design/${project.id}`}
          className="sd-prow-link"
          onPointerEnter={onOpenIntent}
          onFocus={onOpenIntent}
        >
          <span className="sd-prow-icon" aria-hidden="true">
            {project.icon || project.name.slice(0, 1).toUpperCase()}
          </span>
          <span className="sd-prow-text">
            <b>{project.name}</b>
            {project.description && <small>{project.description}</small>}
          </span>
          <span className="sd-prow-meta">{meta}</span>
        </Link>
        {more}
      </article>
    );
  }

  const blueprint = blueprintFor(project.id);

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
            {blueprint.links.map((d) => (
              <path key={d} d={d} />
            ))}
            {blueprint.nodes.map(([x, y, w, h]) => (
              <rect key={`${x},${y}`} x={x} y={y} width={w} height={h} rx={7} />
            ))}
          </svg>
          <span className="sd-card-open">Open</span>
          <span className="sd-card-icon">{project.icon || project.name.slice(0, 1).toUpperCase()}</span>
        </div>
        <div className="sd-card-body">
          <h3 title={project.name}>{project.name}</h3>
          {project.description && <p className="sd-card-desc">{project.description}</p>}
          <p>{meta}</p>
        </div>
      </Link>

      {more}
    </article>
  );
}
