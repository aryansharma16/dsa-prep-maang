import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../../../api/http.js';
import { designApi } from '../../../api/index.js';
import { newObjectId } from '../../../design/core/ids.js';
import { appendOrder, childrenMap, descendants, firstBoard, pathTo } from '../../../design/tree/tree.js';
import { useLocalState } from '../../../hooks/useLocalState.js';
import { useToast } from '../../../store/ToastContext.jsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.jsx';
import { BoardEditor } from '../canvas/BoardEditor.jsx';
import { IconCanvasBoard, IconSchemaBoard } from '../icons.jsx';
import { Explorer } from './Explorer.jsx';
import { PanelSplitter } from './PanelSplitter.jsx';
import { TopBar } from './TopBar.jsx';

/**
 * The full-window editor for one project.
 *
 * Owns the project's tree (a flat list of nodes, edited optimistically) and the
 * layout; the board itself — canvas, tools, inspector, autosave — belongs to
 * `BoardEditor`, which is keyed by board id so switching boards is a clean
 * unmount of one editor and mount of the next.
 *
 * The URL is the source of truth for which board is open. `/design/:project`
 * with no board picks the one you had open last on this device, or the first
 * board in the tree.
 */
export function Workspace() {
  const { projectId, boardId } = useParams();
  const navigate = useNavigate();
  const { success, error: toastError } = useToast();

  const [data, setData] = useState(null); // { project, role, nodes, treeRev }
  const [loadError, setLoadError] = useState(null);
  const [editor, setEditor] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [renamingId, setRenamingId] = useState(null);

  const [explorerWidth, setExplorerWidth] = useLocalState('sd-explorer-w', 252);
  const [explorerOpen, setExplorerOpen] = useLocalState('sd-explorer-open', true);
  const [expandedList, setExpandedList] = useLocalState(`sd-tree:${projectId}`, null);

  /* ------------------------------------------------------------ loading */

  const load = useCallback(async () => {
    try {
      const result = await designApi.project(projectId);
      setData(result);
      setLoadError(null);
    } catch (err) {
      setLoadError({ status: err?.response?.status, message: errorMessage(err, 'Could not open this project') });
    }
  }, [projectId]);

  useEffect(() => {
    setData(null);
    load();
  }, [load]);

  // The workspace owns the whole window while it is open.
  useEffect(() => {
    document.documentElement.classList.add('sd-active');
    return () => document.documentElement.classList.remove('sd-active');
  }, []);

  const nodes = data?.nodes;
  const byId = useMemo(() => new Map((nodes || []).map((n) => [n.id, n])), [nodes]);
  const tree = useMemo(() => childrenMap(nodes || []), [nodes]);

  // First visit: every folder open, so the starter layout is visible at a glance.
  const expanded = useMemo(() => {
    if (expandedList) return new Set(expandedList);
    return new Set((nodes || []).filter((n) => n.kind === 'folder').map((n) => n.id));
  }, [expandedList, nodes]);
  const setExpanded = useCallback((next) => setExpandedList([...next]), [setExpandedList]);

  const node = boardId ? byId.get(boardId) : null;

  // No board in the URL: open the last one, or the first.
  useEffect(() => {
    if (!data || boardId) return;
    let last = null;
    try {
      last = localStorage.getItem(`sd-last:${projectId}`);
    } catch {
      /* private mode */
    }
    const target = (last && byId.get(last)?.kind === 'board' && byId.get(last)) || firstBoard(tree);
    if (target) navigate(`/design/${projectId}/${target.id}`, { replace: true });
  }, [data, boardId, byId, tree, projectId, navigate]);

  // Remember it, and make sure its folders are open — once per board opened, so a folder on the
  // path can still be collapsed afterwards.
  const revealed = useRef(null);
  useEffect(() => {
    if (!node || revealed.current === node.id) return;
    revealed.current = node.id;
    try {
      localStorage.setItem(`sd-last:${projectId}`, node.id);
    } catch {
      /* private mode */
    }
    const closed = pathTo(byId, node.id).filter((n) => n.kind === 'folder' && !expanded.has(n.id));
    if (closed.length) setExpanded(new Set([...expanded, ...closed.map((n) => n.id)]));
  }, [node, byId, expanded, projectId, setExpanded]);

  // ⌘\ / Ctrl+\ shows and hides the explorer, as the top bar's tooltip promises.
  useEffect(() => {
    const onKey = (event) => {
      if (event.key !== '\\' || !(event.metaKey || event.ctrlKey) || event.altKey || event.shiftKey) return;
      event.preventDefault();
      setExplorerOpen((open) => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setExplorerOpen]);

  useEffect(() => {
    if (data?.project) document.title = `${node ? `${node.name} · ` : ''}${data.project.name} · System Design`;
  }, [data?.project, node]);

  /* ------------------------------------------------------------ tree edits */

  const setNodes = (fn) => setData((d) => (d ? { ...d, nodes: fn(d.nodes) } : d));

  /** Optimistic: apply now, roll back and reload the tree if the server disagrees. */
  const attempt = async (apply, request, message) => {
    const before = data?.nodes;
    apply();
    try {
      const result = await request();
      if (result?.treeRev != null) setData((d) => (d ? { ...d, treeRev: result.treeRev } : d));
      if (message) success(message);
      return result;
    } catch (err) {
      if (before) setNodes(() => before);
      toastError(errorMessage(err));
      load();
      return null;
    }
  };

  const createNode = async ({ kind, boardKind, parentId = null }) => {
    const id = newObjectId();
    const name = kind === 'folder' ? 'New folder' : boardKind === 'schema' ? 'New schema' : 'New canvas';
    const optimisticNode = { id, projectId, parentId, kind, boardKind: boardKind || null, name, order: appendOrder(tree, parentId) };
    if (parentId && !expanded.has(parentId)) setExpanded(new Set([...expanded, parentId]));
    const result = await attempt(
      () => setNodes((list) => [...list, optimisticNode]),
      () => designApi.createNode(projectId, { id, kind, boardKind, name, parentId }),
    );
    if (!result) return;
    setNodes((list) => list.map((n) => (n.id === id ? result.node : n)));
    setRenamingId(id);
    if (kind === 'board') navigate(`/design/${projectId}/${id}`);
  };

  const renameNode = (id, name) => {
    const trimmed = name.trim();
    const current = byId.get(id);
    if (!current || !trimmed || trimmed === current.name) return;
    attempt(
      () => setNodes((list) => list.map((n) => (n.id === id ? { ...n, name: trimmed } : n))),
      () => designApi.renameNode(id, trimmed),
    );
  };

  const moveNode = (id, drop) => {
    attempt(
      () => setNodes((list) => list.map((n) => (n.id === id ? { ...n, parentId: drop.parentId, order: drop.order } : n))),
      () => designApi.moveNode(id, { parentId: drop.parentId, after: drop.after }),
    );
    if (drop.parentId && !expanded.has(drop.parentId)) setExpanded(new Set([...expanded, drop.parentId]));
  };

  const duplicateNode = async (id) => {
    try {
      const result = await designApi.duplicateNode(id);
      setData((d) => ({ ...d, nodes: [...d.nodes, result.node], treeRev: result.treeRev }));
      navigate(`/design/${projectId}/${result.node.id}`);
    } catch (err) {
      toastError(errorMessage(err));
    }
  };

  const removeNode = (id) => {
    const target = byId.get(id);
    if (!target) return;
    const inside = descendants(tree, id);
    const doRemove = () => {
      const gone = new Set([id, ...inside.map((n) => n.id)]);
      const leavingOpenBoard = boardId && gone.has(boardId);
      attempt(
        () => setNodes((list) => list.filter((n) => !gone.has(n.id))),
        () => designApi.removeNode(id),
        `Moved “${target.name}” to the trash`,
      );
      if (leavingOpenBoard) {
        const remaining = childrenMap((nodes || []).filter((n) => !gone.has(n.id)));
        const next = firstBoard(remaining);
        navigate(next ? `/design/${projectId}/${next.id}` : `/design/${projectId}`, { replace: true });
      }
    };
    if (target.kind === 'folder' && inside.length) {
      const boards = inside.filter((n) => n.kind === 'board').length;
      setConfirm({
        title: `Delete “${target.name}”?`,
        message: `It holds ${inside.length} item${inside.length === 1 ? '' : 's'}${boards ? `, including ${boards} board${boards === 1 ? '' : 's'}` : ''}. Everything goes to the trash, where it stays for 30 days.`,
        confirmLabel: 'Move to trash',
        onConfirm: () => {
          setConfirm(null);
          doRemove();
        },
      });
    } else {
      doRemove();
    }
  };

  const copyLink = (id) => {
    const url = `${window.location.origin}/design/${projectId}/${id}`;
    navigator.clipboard?.writeText(url).then(
      () => success('Link copied'),
      () => toastError('Could not copy the link'),
    );
  };

  /* ------------------------------------------------------------ render */

  if (loadError) {
    return (
      <div className="sd-root sd-missing">
        <h2>{loadError.status === 404 ? 'This project is not here' : 'Something went wrong'}</h2>
        <p>{loadError.status === 404 ? 'It may have been moved to the trash, or the link is wrong.' : loadError.message}</p>
        <Link className="btn primary" to="/design">
          All projects
        </Link>
      </div>
    );
  }

  const readOnly = Boolean(data?.project?.archived) || (data?.role && !['owner', 'editor'].includes(data.role));

  return (
    <div
      className={`sd-root ${explorerOpen ? '' : 'explorer-closed'}`}
      style={{ '--sd-explorer-w': `${explorerWidth}px` }}
      data-hue={data?.project?.hue}
    >
      <TopBar
        project={data?.project}
        path={node ? pathTo(byId, node.id) : []}
        node={node}
        editor={editor}
        explorerOpen={explorerOpen}
        onToggleExplorer={() => setExplorerOpen((open) => !open)}
        onRenameBoard={(name) => node && renameNode(node.id, name)}
        readOnly={readOnly}
      />

      <div className="sd-body">
        {explorerOpen && (
          <>
            <Explorer
              project={data?.project}
              tree={tree}
              byId={byId}
              loading={!data}
              activeId={boardId}
              expanded={expanded}
              onExpandedChange={setExpanded}
              renamingId={renamingId}
              onRenamingChange={setRenamingId}
              onOpen={(id) => navigate(`/design/${projectId}/${id}`)}
              onCreate={createNode}
              onRename={renameNode}
              onMove={moveNode}
              onDuplicate={duplicateNode}
              onRemove={removeNode}
              onCopyLink={copyLink}
              readOnly={readOnly}
            />
            <PanelSplitter
              value={explorerWidth}
              min={200}
              max={440}
              onChange={setExplorerWidth}
              onCollapse={() => setExplorerOpen(false)}
              label="Resize the explorer"
            />
          </>
        )}

        <main className="sd-stage">
          {!data && <div className="sd-stage-note">Opening project…</div>}
          {data && node?.kind === 'board' && (
            <BoardEditor
              key={node.id}
              project={data.project}
              node={node}
              readOnly={readOnly}
              onReady={setEditor}
            />
          )}
          {data && !boardId && !firstBoard(tree) && (
            <NoBoards readOnly={readOnly} onCreate={(boardKind) => createNode({ kind: 'board', boardKind })} />
          )}
          {data && boardId && !node && (
            <div className="sd-stage-note">
              This board is not in the project any more.{' '}
              <Link to={`/design/${projectId}`}>Open another</Link>
            </div>
          )}
        </main>
      </div>

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          confirmLabel={confirm.confirmLabel}
          tone="danger"
          onConfirm={confirm.onConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}

function NoBoards({ onCreate, readOnly }) {
  const focus = useRef(null);
  return (
    <div className="sd-noboards">
      <h2>No boards yet</h2>
      <p>A canvas is for architecture and flows; a schema is for tables and relations.</p>
      {!readOnly && (
        <div className="sd-noboards-actions">
          <button ref={focus} type="button" className="sd-noboards-choice" onClick={() => onCreate('canvas')}>
            <IconCanvasBoard size={22} />
            <b>New canvas</b>
            <small>HLD, LLD, flows</small>
          </button>
          <button type="button" className="sd-noboards-choice" onClick={() => onCreate('schema')}>
            <IconSchemaBoard size={22} />
            <b>New schema</b>
            <small>Tables and relations</small>
          </button>
        </div>
      )}
    </div>
  );
}
