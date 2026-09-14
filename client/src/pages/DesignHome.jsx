import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { designApi } from '../api/index.js';
import { ProjectCard } from '../components/design/home/ProjectCard.jsx';
import { ProjectModal } from '../components/design/home/ProjectModal.jsx';
import { TrashModal } from '../components/design/home/TrashModal.jsx';
import { IconCanvasBoard, IconSchemaBoard } from '../components/design/icons.jsx';
import { IconPlus, IconTrash } from '../components/ui/Icons.jsx';
import { timeAgo } from '../design/core/time.js';
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
 */

/** Warms the workspace chunk so opening a project does not wait on a download. */
const warmWorkspace = () => import('./DesignWorkspace.jsx');

export function DesignHome() {
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();
  const [projects, setProjects] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loadError, setLoadError] = useState('');
  const [modal, setModal] = useState(null); // 'new' | { edit: project } | 'trash'

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

  return (
    <div className="sd-home">
      <header className="sd-home-head">
        <div>
          <h1>System Design</h1>
          <p>
            Boxes, arrows and schemas. A project holds folders, a folder holds boards — canvases for HLD and LLD,
            schemas for the database.
          </p>
        </div>
        <div className="sd-home-actions">
          <button type="button" className="btn ghost" onClick={() => setModal('trash')}>
            <IconTrash size={14} /> Trash
          </button>
          <button type="button" className="btn primary" onClick={() => setModal('new')}>
            <IconPlus size={14} /> New project
          </button>
        </div>
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
              const Icon = node.boardKind === 'schema' ? IconSchemaBoard : IconCanvasBoard;
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
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="sd-section">
        {projects && active.length > 0 && <h2>Projects</h2>}
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
              <rect x="16" y="40" width="64" height="40" rx="9" />
              <rect x="160" y="14" width="64" height="36" rx="9" />
              <rect x="160" y="70" width="64" height="36" rx="9" />
              <path d="M80 60 H112 Q122 60 122 50 V42 Q122 32 132 32 H160" />
              <path d="M80 60 H112 Q122 60 122 70 V78 Q122 88 132 88 H160" />
            </svg>
            <h3>Design your first system</h3>
            <p>Start with a project — WhatsApp, a URL shortener, the thing you are building at work.</p>
            <button type="button" className="btn primary" onClick={() => setModal('new')}>
              <IconPlus size={14} /> New project
            </button>
          </div>
        )}

        {active.length > 0 && (
          <div className="sd-grid">
            {active.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpenIntent={warmWorkspace}
                onEdit={() => setModal({ edit: project })}
                onArchive={() =>
                  optimistic(project.id, { archived: true }, () => designApi.updateProject(project.id, { archived: true }), 'Archived')
                }
                onTrash={() => trash(project)}
              />
            ))}
            <button type="button" className="sd-card sd-card-new" onClick={() => setModal('new')}>
              <IconPlus size={18} />
              <span>New project</span>
            </button>
          </div>
        )}
      </section>

      {archived.length > 0 && (
        <section className="sd-section">
          <h2>Archived</h2>
          <div className="sd-grid">
            {archived.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
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

      {modal === 'new' && <ProjectModal onSubmit={create} onClose={() => setModal(null)} />}
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
