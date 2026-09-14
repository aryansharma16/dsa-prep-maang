import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { childrenOf, resolveDrop, visibleRows } from '../../../design/tree/tree.js';
import { IconEdit, IconMore, IconPlus, IconTrash } from '../../ui/Icons.jsx';
import {
  IconCanvasBoard,
  IconCaret,
  IconDuplicate,
  IconFolder,
  IconLink,
  IconSchemaBoard,
} from '../icons.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';

/**
 * The project's folder tree.
 *
 * A real ARIA tree: one row in the tab order at a time, arrows to walk it,
 * right and left to open and close, Enter to open, F2 to rename, Delete to
 * delete. The mouse gets the same verbs through the context menu and the row's
 * hover buttons, and drag to move.
 *
 * Drag uses pointer events rather than HTML5 drag-and-drop. The native API draws
 * its own ghost, cannot show a "drop inside this folder" state distinct from
 * "drop between these two rows" without fighting it, does nothing on touch, and
 * fires its events on whatever element the pointer happens to cross — none of
 * which a tree this small is worth the trouble of working around.
 */

const DRAG_THRESHOLD = 4;
const EXPAND_DELAY = 600;
const SCROLL_ZONE = 28;

const iconFor = (node, open) =>
  node.kind === 'folder' ? (
    <IconFolder size={15} open={open} />
  ) : node.boardKind === 'schema' ? (
    <IconSchemaBoard size={15} />
  ) : (
    <IconCanvasBoard size={15} />
  );

export function Explorer({
  project,
  tree,
  byId,
  loading,
  activeId,
  expanded,
  onExpandedChange,
  renamingId,
  onRenamingChange,
  onOpen,
  onCreate,
  onRename,
  onMove,
  onDuplicate,
  onRemove,
  onCopyLink,
  readOnly,
}) {
  const rows = useMemo(() => visibleRows(tree, expanded), [tree, expanded]);
  const [focusId, setFocusId] = useState(null);
  const [menu, setMenu] = useState(null);
  const [drag, setDrag] = useState(null);
  const listRef = useRef(null);
  const addRef = useRef(null);
  const suppressClick = useRef(false);

  const rowIndex = useMemo(() => new Map(rows.map((row, i) => [row.node.id, i])), [rows]);
  const tabStop = focusId && rowIndex.has(focusId) ? focusId : activeId && rowIndex.has(activeId) ? activeId : rows[0]?.node.id;

  const toggle = useCallback(
    (id, open) => {
      const next = new Set(expanded);
      const shouldOpen = open ?? !next.has(id);
      if (shouldOpen) next.add(id);
      else next.delete(id);
      onExpandedChange(next);
    },
    [expanded, onExpandedChange],
  );

  const focusRow = (id) => {
    setFocusId(id);
    requestAnimationFrame(() => listRef.current?.querySelector(`[data-node-id="${id}"]`)?.focus());
  };

  /* ------------------------------------------------------------ keyboard */

  const onKeyDown = (event) => {
    if (renamingId || drag) return;
    const current = byId.get(tabStop);
    if (!current) return;
    const index = rowIndex.get(current.id);
    const isFolder = current.kind === 'folder';
    const open = expanded.has(current.id);

    switch (event.key) {
      case 'ArrowDown':
        if (rows[index + 1]) focusRow(rows[index + 1].node.id);
        break;
      case 'ArrowUp':
        if (rows[index - 1]) focusRow(rows[index - 1].node.id);
        break;
      case 'Home':
        if (rows[0]) focusRow(rows[0].node.id);
        break;
      case 'End':
        if (rows.length) focusRow(rows.at(-1).node.id);
        break;
      case 'ArrowRight':
        if (isFolder && !open) toggle(current.id, true);
        else if (isFolder && childrenOf(tree, current.id)[0]) focusRow(childrenOf(tree, current.id)[0].id);
        break;
      case 'ArrowLeft':
        if (isFolder && open) toggle(current.id, false);
        else if (current.parentId) focusRow(current.parentId);
        break;
      case 'Enter':
      case ' ':
        if (isFolder) toggle(current.id);
        else onOpen(current.id);
        break;
      case 'F2':
        if (!readOnly) onRenamingChange(current.id);
        break;
      case 'Delete':
      case 'Backspace':
        if (!readOnly) onRemove(current.id);
        break;
      default:
        return;
    }
    event.preventDefault();
  };

  /* ------------------------------------------------------------ drag to move */

  const dragState = useRef(null);

  const targetAt = useCallback(
    (x, y, draggedId) => {
      const list = listRef.current;
      if (!list) return null;
      const el = document.elementFromPoint(x, y);
      const row = el?.closest?.('[data-node-id]');
      if (row && list.contains(row)) {
        const target = byId.get(row.dataset.nodeId);
        if (!target) return null;
        const rect = row.getBoundingClientRect();
        const rel = (y - rect.top) / rect.height;
        let position;
        if (target.kind === 'folder') position = rel < 0.25 ? 'before' : rel > 0.75 ? 'after' : 'inside';
        else position = rel < 0.5 ? 'before' : 'after';
        const drop = resolveDrop(tree, byId, draggedId, target, position);
        return drop ? { id: target.id, position, drop } : { id: target.id, position: 'invalid' };
      }
      if (list.contains(el)) {
        // Empty space below the rows: to the end of the root.
        const roots = childrenOf(tree, null);
        const last = roots.at(-1);
        if (!last) return null;
        const drop = resolveDrop(tree, byId, draggedId, last, 'after');
        return drop ? { id: last.id, position: 'after', drop } : null;
      }
      return null;
    },
    [byId, tree],
  );

  useEffect(() => {
    if (!drag) return undefined;
    let raf = 0;
    const scroll = () => {
      const state = dragState.current;
      const list = listRef.current;
      if (state && list) {
        const rect = list.getBoundingClientRect();
        if (state.y < rect.top + SCROLL_ZONE) list.scrollTop -= 8;
        else if (state.y > rect.bottom - SCROLL_ZONE) list.scrollTop += 8;
      }
      raf = requestAnimationFrame(scroll);
    };
    raf = requestAnimationFrame(scroll);
    return () => cancelAnimationFrame(raf);
  }, [drag]);

  useEffect(() => {
    const cancel = () => {
      const state = dragState.current;
      if (state) clearTimeout(state.expandTimer);
      dragState.current = null;
      setDrag(null);
    };

    const onMoveEvent = (event) => {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;
      state.x = event.clientX;
      state.y = event.clientY;
      if (!state.dragging) {
        if (Math.hypot(event.clientX - state.startX, event.clientY - state.startY) < DRAG_THRESHOLD) return;
        state.dragging = true;
        document.documentElement.classList.add('sd-dragging');
      }
      const target = targetAt(event.clientX, event.clientY, state.id);
      const key = target ? `${target.id}:${target.position}` : '';
      if (key !== state.targetKey) {
        clearTimeout(state.expandTimer);
        state.targetKey = key;
        if (target?.position === 'inside' && !expanded.has(target.id)) {
          state.expandTimer = setTimeout(() => toggle(target.id, true), EXPAND_DELAY);
        }
      }
      setDrag({ id: state.id, x: event.clientX, y: event.clientY, target });
    };

    const onUp = (event) => {
      const state = dragState.current;
      if (!state || event.pointerId !== state.pointerId) return;
      document.documentElement.classList.remove('sd-dragging');
      if (state.dragging) {
        suppressClick.current = true;
        const target = targetAt(event.clientX, event.clientY, state.id);
        if (target?.drop) onMove(state.id, target.drop);
      }
      cancel();
    };

    const onKey = (event) => {
      if (event.key === 'Escape' && dragState.current?.dragging) {
        event.stopPropagation();
        document.documentElement.classList.remove('sd-dragging');
        cancel();
      }
    };

    window.addEventListener('pointermove', onMoveEvent);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointermove', onMoveEvent);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', onKey, true);
    };
  }, [targetAt, onMove, expanded, toggle]);

  const onRowPointerDown = (event, node) => {
    if (readOnly || event.button !== 0 || renamingId) return;
    if (event.target.closest('button, input')) return;
    dragState.current = {
      id: node.id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      dragging: false,
    };
  };

  /* ------------------------------------------------------------ menus */

  const createItems = (parentId) => [
    { label: 'New canvas', icon: <IconCanvasBoard size={14} />, onSelect: () => onCreate({ kind: 'board', boardKind: 'canvas', parentId }) },
    { label: 'New schema', icon: <IconSchemaBoard size={14} />, onSelect: () => onCreate({ kind: 'board', boardKind: 'schema', parentId }) },
    { label: 'New folder', icon: <IconFolder size={14} />, onSelect: () => onCreate({ kind: 'folder', parentId }) },
  ];

  const nodeItems = (node) => {
    if (readOnly) {
      return node.kind === 'board'
        ? [{ label: 'Copy link', icon: <IconLink size={14} />, onSelect: () => onCopyLink(node.id) }]
        : [];
    }
    const rename = { label: 'Rename', icon: <IconEdit size={14} />, shortcut: 'F2', onSelect: () => onRenamingChange(node.id) };
    const remove = { label: 'Move to trash', icon: <IconTrash size={14} />, shortcut: 'Del', danger: true, onSelect: () => onRemove(node.id) };
    if (node.kind === 'folder') return [...createItems(node.id), 'sep', rename, 'sep', remove];
    return [
      rename,
      { label: 'Duplicate', icon: <IconDuplicate size={14} />, onSelect: () => onDuplicate(node.id) },
      { label: 'Copy link', icon: <IconLink size={14} />, onSelect: () => onCopyLink(node.id) },
      'sep',
      remove,
    ];
  };

  /* ------------------------------------------------------------ render */

  const dropClass = (id) => {
    if (!drag?.target || drag.target.id !== id) return '';
    return `drop-${drag.target.position}`;
  };

  return (
    <aside className="sd-explorer" aria-label="Project explorer">
      <div className="sd-explorer-head">
        <span className="sd-explorer-title" title={project?.name}>
          <span className="sd-explorer-badge">{project?.icon || project?.name?.slice(0, 1) || '·'}</span>
          <span className="sd-explorer-name">{project?.name || ' '}</span>
        </span>
        {!readOnly && (
          <button
            ref={addRef}
            type="button"
            className="sd-icon-btn"
            aria-label="Add to project"
            aria-haspopup="menu"
            title="New board or folder"
            onClick={() => setMenu({ anchor: addRef.current, items: createItems(null) })}
          >
            <IconPlus size={14} />
          </button>
        )}
      </div>

      <div
        ref={listRef}
        className={`sd-tree ${drag ? 'is-dragging' : ''}`}
        role="tree"
        aria-label="Folders and boards"
        onKeyDown={onKeyDown}
        onContextMenu={(event) => {
          if (event.target.closest('[data-node-id]') || readOnly) return;
          event.preventDefault();
          setMenu({ anchor: { x: event.clientX, y: event.clientY }, items: createItems(null) });
        }}
      >
        {loading &&
          [0, 1, 2, 3].map((i) => <div key={i} className="sd-tree-skeleton skeleton" style={{ width: `${70 - i * 9}%` }} />)}

        {!loading && !rows.length && (
          <p className="sd-tree-empty">Empty project. Use + to add a canvas, a schema or a folder.</p>
        )}

        {rows.map(({ node, depth }) => {
          const isFolder = node.kind === 'folder';
          const open = isFolder && expanded.has(node.id);
          const active = node.id === activeId;
          const renaming = node.id === renamingId;
          return (
            <div
              key={node.id}
              data-node-id={node.id}
              role="treeitem"
              aria-level={depth + 1}
              aria-expanded={isFolder ? open : undefined}
              aria-selected={active}
              aria-label={node.name}
              tabIndex={node.id === tabStop ? 0 : -1}
              className={`sd-tree-row ${active ? 'active' : ''} ${drag?.id === node.id ? 'dragged' : ''} ${dropClass(node.id)}`}
              style={{ '--depth': depth }}
              onFocus={() => setFocusId(node.id)}
              onPointerDown={(event) => onRowPointerDown(event, node)}
              onClick={() => {
                if (suppressClick.current) {
                  suppressClick.current = false;
                  return;
                }
                if (renaming) return;
                if (isFolder) toggle(node.id);
                else onOpen(node.id);
              }}
              onDoubleClick={() => !readOnly && onRenamingChange(node.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                const items = nodeItems(node);
                if (items.length) setMenu({ anchor: { x: event.clientX, y: event.clientY }, items });
              }}
            >
              <span
                className="sd-tree-caret"
                aria-hidden="true"
                onClick={(event) => {
                  if (!isFolder) return;
                  event.stopPropagation();
                  toggle(node.id);
                }}
              >
                {isFolder && <IconCaret size={12} open={open} />}
              </span>
              <span className={`sd-tree-icon ${node.kind}`}>{iconFor(node, open)}</span>
              {renaming ? (
                <RenameInput
                  value={node.name}
                  onDone={(name) => {
                    onRenamingChange(null);
                    if (name != null) onRename(node.id, name);
                    focusRow(node.id);
                  }}
                />
              ) : (
                <span className="sd-tree-name">{node.name}</span>
              )}
              {!renaming && !readOnly && (
                <span className="sd-tree-actions">
                  {isFolder && (
                    <button
                      type="button"
                      tabIndex={-1}
                      className="sd-icon-btn sm"
                      aria-label={`Add to ${node.name}`}
                      onClick={(event) => {
                        event.stopPropagation();
                        setMenu({ anchor: event.currentTarget, items: createItems(node.id) });
                      }}
                    >
                      <IconPlus size={12} />
                    </button>
                  )}
                  <button
                    type="button"
                    tabIndex={-1}
                    className="sd-icon-btn sm"
                    aria-label={`Actions for ${node.name}`}
                    onClick={(event) => {
                      event.stopPropagation();
                      setMenu({ anchor: event.currentTarget, items: nodeItems(node) });
                    }}
                  >
                    <IconMore size={12} />
                  </button>
                </span>
              )}
            </div>
          );
        })}
      </div>

      {drag && (
        <div className="sd-tree-ghost" style={{ transform: `translate(${drag.x + 12}px, ${drag.y + 8}px)` }}>
          {iconFor(byId.get(drag.id) || { kind: 'board' }, false)}
          <span>{byId.get(drag.id)?.name}</span>
        </div>
      )}

      {menu && <ActionMenu anchor={menu.anchor} items={menu.items} onClose={() => setMenu(null)} />}
    </aside>
  );
}

function RenameInput({ value, onDone }) {
  const ref = useRef(null);
  const done = useRef(false);

  useEffect(() => {
    const input = ref.current;
    input?.focus();
    input?.select();
  }, []);

  const finish = (name) => {
    if (done.current) return;
    done.current = true;
    onDone(name);
  };

  return (
    <input
      ref={ref}
      className="sd-tree-input"
      defaultValue={value}
      maxLength={120}
      aria-label="Name"
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => {
        event.stopPropagation();
        if (event.key === 'Enter') finish(event.currentTarget.value);
        if (event.key === 'Escape') finish(null);
      }}
      onBlur={(event) => finish(event.currentTarget.value)}
    />
  );
}
