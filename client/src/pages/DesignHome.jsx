import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { designApi } from '../api/index.js';
import { ProjectCard } from '../components/design/home/ProjectCard.jsx';
import { ProjectModal } from '../components/design/home/ProjectModal.jsx';
import { TrashModal } from '../components/design/home/TrashModal.jsx';
import { IconCanvasBoard, IconSchemaBoard } from '../components/design/icons.jsx';
import { IconGrid, IconList, IconPlus, IconTrash } from '../components/ui/Icons.jsx';
import { PageSearch } from '../components/ui/PageSearch.jsx';
import { timeAgo } from '../design/core/time.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useToast } from '../store/ToastContext.jsx';
import '../styles/design.css';

/**
 * System Design's landing page: your projects, and the boards you were last in.
 *
 * Inside the normal app shell, unlike a board. This is a list like every other
 * module's landing page; the full-window treatment is for the canvas, where the
 * sidebar would be space taken from the drawing.
 *
 * Writes are optimistic with a rollback — the shape `RoadmapContext` uses — for
 * the edits whose outcome the client already knows (rename, archive, trash). A
 * create waits for the server, because the answer includes the starter tree.
 *
 * Searching, sorting and the grid/list switch are all client-side: the whole
 * list is already here (a hundred projects at most, by the server's own limit),
 * so a request per keystroke would buy nothing. The sort and the view are
 * remembered per device, because they are a way of working rather than a
 * property of the projects.
 */

/** Warms the workspace chunk so opening a project does not wait on a download. */
const warmWorkspace = () => import('./DesignWorkspace.jsx');

const SORTS = [
  { id: 'recent', label: 'Recent', compare: (a, b) => stamp(b.touchedAt) - stamp(a.touchedAt) },
  { id: 'name', label: 'Name', compare: (a, b) => a.name.localeCompare(b.name) },
  { id: 'boards', label: 'Boards', compare: (a, b) => (b.boardCount || 0) - (a.boardCount || 0) },
];

/** Names for the first project, for the person looking at an empty page. */
const STARTERS = ['WhatsApp', 'URL shortener', 'Rate limiter', 'News feed'];

const stamp = (value) => new Date(value || 0).getTime() || 0;

export function DesignHome() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [projects, setProjects] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // { create: name } | { edit: project } | 'trash'
  const [query, setQuery] = useState('');
  const [sort, setSort] = useLocalState('sd-home-sort', 'recent');
  const [view, setView] = useLocalState('sd-home-view', 'grid');

  const load = useCallback(async () => {
    try {
      const [list, boards] = await Promise.all([designApi.projects(), designApi.recent(6).catch(() => [])]);
      setProjects(list);
      setRecent(boards);
      setLoadError('');
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load your projects'));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const patchLocal = (id, patch) =>
    setProjects((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)));

  const optimistic = async (id, patch, request, message) => {
    const before = projects;
    patchLocal(id, patch);
    try {
      const saved = await request();
      if (saved?.id) patchLocal(id, saved);
      if (message) success(message);
    } catch (err) {
      setProjects(before);
      toastError(errorMessage(err));
    }
  };

  const create = async (body) => {
    const { project, nodes } = await designApi.createProject(body);
    setModal(null);
    const firstBoard = nodes.find((n) => n.kind === 'board');
    navigate(`/design/${project.id}${firstBoard ? `/${firstBoard.id}` : ''}`);
  };

  const edit = async (project, body) => {
    setModal(null);
    await optimistic(project.id, body, () => designApi.updateProject(project.id, body));
  };

  const trash = (project) => {
    const before = projects;
    setProjects((list) => list.filter((p) => p.id !== project.id));
    designApi
      .removeProject(project.id)
      .then(() => success(`Moved “${project.name}” to the trash`))
      .catch((err) => {
        setProjects(before);
        toastError(errorMessage(err));
      });
  };

  const [active, archived] = useMemo(() => {
    const list = projects || [];
    return [list.filter((p) => !p.archived), list.filter((p) => p.archived)];
  }, [projects]);

  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const compare = (SORTS.find((s) => s.id === sort) || SORTS[0]).compare;
    return active
      .filter(
        (p) =>
          !needle ||
          p.name.toLowerCase().includes(needle) ||
          (p.description || '').toLowerCase().includes(needle),
      )
      .sort(compare);
  }, [active, query, sort]);

  const boardTotal = active.reduce((n, p) => n + (p.boardCount || 0), 0);
  const lastTouched = active.reduce((t, p) => Math.max(t, stamp(p.touchedAt)), 0);
  const newProject = (name = '') => setModal({ create: name });

  return (
    <div className="sd-home">
      <header className="sd-hero">
        <div className="sd-hero-copy">
          <h1>System Design</h1>
          <p>
            Boxes, arrows and schemas. A project holds folders, a folder holds boards — canvases for HLD and LLD,
            schemas for the database.
          </p>
          {active.length > 0 && (
            <div className="sd-hero-stats">
              <span className="sd-hero-stat">
                <b>{active.length}</b> {active.length === 1 ? 'project' : 'projects'}
              </span>
              <span className="sd-hero-stat">
                <b>{boardTotal}</b> {boardTotal === 1 ? 'board' : 'boards'}
              </span>
              {lastTouched > 0 && (
                <span className="sd-hero-stat muted">Last edit {timeAgo(lastTouched)}</span>
              )}
            </div>
          )}
        </div>

        <div className="sd-home-actions">
          <button type="button" className="btn ghost" onClick={() => setModal('trash')}>
            <IconTrash size={14} /> Trash
          </button>
          <button type="button" className="btn primary" onClick={() => newProject()}>
            <IconPlus size={14} /> New project
          </button>
        </div>

        <svg className="sd-hero-art" viewBox="0 0 260 120" aria-hidden="true">
          <path d="M66 63 H86 V29 H104" />
          <path d="M66 63 H86 V95 H104" />
          <path d="M166 29 H184 V63 H198" />
          <path d="M166 95 H184 V63 H198" />
          <rect x="8" y="46" width="58" height="34" rx="8" />
          <rect x="104" y="14" width="62" height="30" rx="8" />
          <rect x="104" y="80" width="62" height="30" rx="8" />
          <rect x="198" y="46" width="54" height="34" rx="8" />
        </svg>
      </header>

      {loadError && (
        <div className="alert">
          {loadError}{' '}
          <button type="button" className="link-btn" onClick={load}>
            Try again
          </button>
        </div>
      )}

      {recent.length > 0 && (
        <section className="sd-section">
          <h2>Jump back in</h2>
          <div className="sd-recent">
            {recent.map(({ node, project, lastWriteAt }) => {
              const schema = node.boardKind === 'schema';
              const Icon = schema ? IconSchemaBoard : IconCanvasBoard;
              return (
                <Link
                  key={node.id}
                  to={`/design/${project.id}/${node.id}`}
                  className="sd-recent-item"
                  data-hue={project.hue}
                  onPointerEnter={warmWorkspace}
                >
                  <span className="sd-recent-icon">
                    <Icon size={15} />
                  </span>
                  <span className="sd-recent-text">
                    <b>{node.name}</b>
                    <small>
                      {project.name} · {timeAgo(lastWriteAt)}
                    </small>
                  </span>
                  <span className="sd-recent-kind">{schema ? 'Schema' : 'Canvas'}</span>
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="sd-section">
        {active.length > 1 && (
          <div className="sd-home-bar">
            <h2>Projects</h2>
            <PageSearch
              value={query}
              onChange={setQuery}
              placeholder="Search projects"
              count={shown.length}
              label="Search projects"
            />
            <div className="sd-home-seg" role="group" aria-label="Sort projects">
              {SORTS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={sort === option.id ? 'on' : ''}
                  aria-pressed={sort === option.id}
                  onClick={() => setSort(option.id)}
                  title={`Sort by ${option.label.toLowerCase()}`}
                >
                  {option.label}
                </button>
              ))}
            </div>
            <div className="sd-home-seg" role="group" aria-label="Layout">
              <button
                type="button"
                className={view === 'grid' ? 'on' : ''}
                aria-pressed={view === 'grid'}
                onClick={() => setView('grid')}
                title="Cards"
                aria-label="Show projects as cards"
              >
                <IconGrid size={13} />
              </button>
              <button
                type="button"
                className={view === 'list' ? 'on' : ''}
                aria-pressed={view === 'list'}
                onClick={() => setView('list')}
                title="List"
                aria-label="Show projects as a list"
              >
                <IconList size={13} />
              </button>
            </div>
          </div>
        )}
        {active.length === 1 && <h2>Projects</h2>}

        {!projects && !loadError && (
          <div className="sd-grid">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sd-card skeleton" style={{ height: 196 }} />
            ))}
          </div>
        )}

        {projects && !projects.length && (
          <div className="sd-empty">
            <svg viewBox="0 0 240 120" className="sd-empty-art" aria-hidden="true">
              <path d="M80 60 H112 Q122 60 122 50 V42 Q122 32 132 32 H160" />
              <path d="M80 60 H112 Q122 60 122 70 V78 Q122 88 132 88 H160" />
              <rect x="16" y="40" width="64" height="40" rx="9" />
              <rect x="160" y="14" width="64" height="36" rx="9" />
              <rect x="160" y="70" width="64" height="36" rx="9" />
            </svg>
            <h3>Design your first system</h3>
            <p>Start with a project — WhatsApp, a URL shortener, the thing you are building at work.</p>
            <button type="button" className="btn primary" onClick={() => newProject()}>
              <IconPlus size={14} /> New project
            </button>
            <div className="sd-starters">
              <span>or start from</span>
              {STARTERS.map((name) => (
                <button key={name} type="button" className="sd-starter" onClick={() => newProject(name)}>
                  {name}
                </button>
              ))}
            </div>
          </div>
        )}

        {active.length > 0 && shown.length === 0 && (
          <div className="sd-nomatch">
            No project matches “{query}”.{' '}
            <button type="button" className="link-btn" onClick={() => setQuery('')}>
              Clear the search
            </button>
          </div>
        )}

        {shown.length > 0 && (
          <div className={view === 'list' ? 'sd-rows' : 'sd-grid'}>
            {shown.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                view={view}
                onOpenIntent={warmWorkspace}
                onEdit={() => setModal({ edit: project })}
                onArchive={() =>
                  optimistic(project.id, { archived: true }, () => designApi.updateProject(project.id, { archived: true }), 'Archived')
                }
                onTrash={() => trash(project)}
              />
            ))}
            {view === 'grid' && !query && (
              <button type="button" className="sd-card sd-card-new" onClick={() => newProject()}>
                <IconPlus size={18} />
                <span>New project</span>
              </button>
            )}
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="sd-section">
          <h2>Archived</h2>
          <div className={view === 'list' ? 'sd-rows' : 'sd-grid'}>
            {archived.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                view={view}
                onOpenIntent={warmWorkspace}
                onEdit={() => setModal({ edit: project })}
                onArchive={() =>
                  optimistic(project.id, { archived: false }, () => designApi.updateProject(project.id, { archived: false }), 'Unarchived')
                }
                onTrash={() => trash(project)}
              />
            ))}
          </div>
        </section>
      )}

      {modal?.create !== undefined && (
        <ProjectModal initialName={modal.create} onSubmit={create} onClose={() => setModal(null)} />
      )}
      {modal?.edit && (
        <ProjectModal project={modal.edit} onSubmit={(body) => edit(modal.edit, body)} onClose={() => setModal(null)} />
      )}
      {modal === 'trash' && (
        <TrashModal
          onClose={() => {
            setModal(null);
            load();
          }}
          onRestoredProject={() => load()}
        />
      )}
    </div>
  );
}
