import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../../api/http.js';
import { designApi } from '../../../api/index.js';
import { recordFromWire } from '../../../design/engine/diff.js';
import { createCommands } from '../../../design/engine/commands.js';
import { createEditor } from '../../../design/engine/editor.js';
import { isKnownType } from '../../../design/shapes/registry.js';
import { clearMirror, createAutosave, readMirror } from '../../../design/sync/autosave.js';
import { createTabLock } from '../../../design/sync/tabLock.js';
import { newId } from '../../../design/core/ids.js';
import { useToast } from '../../../store/ToastContext.jsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.jsx';
import { Inspector } from '../inspector/Inspector.jsx';
import { CanvasContextMenu } from './CanvasContextMenu.jsx';
import { Canvas } from './Canvas.jsx';
import { EditorContext } from './hooks.js';
import { ShortcutsDialog } from './ShortcutsDialog.jsx';
import { Toolbar } from './Toolbar.jsx';
import { ZoomControls } from './ZoomControls.jsx';

/**
 * One open board: loads it, creates its editor, wires autosave and the tab
 * lock, and lays out the canvas with its toolbar and inspector.
 *
 * Keyed by board id in Workspace, so switching boards unmounts this and mounts
 * a fresh one — no editor is ever reused across boards. The editor is created
 * in a `useState` initialiser, which is side-effect free, and everything that
 * touches the outside world (fetch, listeners, channels) happens in effects, so
 * React's development double-mount is harmless.
 */
export function BoardEditor({ project, node, readOnly: projectReadOnly, onReady }) {
  const toast = useToast();
  const toastRef = useRef(toast);
  toastRef.current = toast;

  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [editor] = useState(() =>
    createEditor({
      boardId: node.id,
      boardKind: node.boardKind,
      readOnly: projectReadOnly,
      notify: (kind, message) => (kind === 'error' ? toastRef.current.error(message) : toastRef.current.toast(message)),
      onRequestShortcuts: () => setShortcutsOpen(true),
    }),
  );
  const [phase, setPhase] = useState('loading'); // loading | ready | error
  const [loadError, setLoadError] = useState('');
  const [lockLost, setLockLost] = useState(false);
  const [gone, setGone] = useState(null);
  const [restore, setRestore] = useState(null);
  const syncRef = useRef(null);

  const applyServerResult = useCallback(
    (result) => {
      const sync = syncRef.current;
      if (result.reset) {
        designApi.board(node.id).then((data) => {
          const pending = sync?.pendingIds() || new Set();
          editor.store.applyRemote((tx) => {
            const incoming = new Map(data.elements.map((el) => [el.eid, recordFromWire(el)]));
            for (const record of editor.store.all()) if (!incoming.has(record.id) && !pending.has(record.id)) tx.drop(record.id);
            for (const [id, record] of incoming) if (!pending.has(id)) tx.put(record);
          });
          if (sync) sync.rev = data.board.rev;
        });
        return;
      }
      if (!result.changes?.length) return;
      const pending = sync?.pendingIds() || new Set();
      editor.store.applyRemote((tx) => {
        for (const change of result.changes) {
          if (pending.has(change.eid)) continue;
          if (change.deleted) tx.drop(change.eid);
          else tx.put(recordFromWire(change));
        }
      });
    },
    [editor, node.id],
  );

  useEffect(() => {
    let alive = true;
    const tabId = newId(10);
    let sync = null;
    let lock = null;
    let offCommit = null;
    let pollTimer = 0;
    const disposers = [];

    editor.commands = createCommands(editor);

    designApi
      .board(node.id)
      .then((data) => {
        if (!alive) return;
        editor.store.load(data.elements.map(recordFromWire));
        const readOnly = projectReadOnly || !['owner', 'editor'].includes(data.role);
        editor.setReadOnly(readOnly);

        sync = createAutosave({
          boardId: node.id,
          baseRev: data.board.rev,
          send: (batch) => designApi.commit(node.id, batch),
          onStatus: (save) => editor.setSaveStatus(save),
          onResult: applyServerResult,
          onRejected: (rejected) => {
            editor.store.applyRemote((tx) => {
              for (const entry of rejected) {
                if (!entry.eid) continue;
                if (entry.current && !entry.current.deleted) tx.put(recordFromWire(entry.current));
                else tx.drop(entry.eid);
              }
            });
            toastRef.current.error(
              rejected.some((r) => r.code === 'BOARD_FULL')
                ? 'This board is full — some changes were not saved.'
                : 'Some changes could not be saved and were undone.',
            );
          },
          onGone: ({ code }) => {
            editor.setReadOnly(true);
            setGone(code === 'PROJECT_ARCHIVED' ? 'archived' : 'missing');
          },
        });
        syncRef.current = sync;
        editor.sync = sync;

        offCommit = editor.store.onCommit((commit) => {
          if (commit.origin === 'remote') return;
          const ops = editor.opsFor(commit);
          sync.enqueue(ops);
          lock?.relay([...commit.changes].map(([id, [, after]]) => [id, after]));
        });

        lock = createTabLock({
          boardId: node.id,
          tabId,
          onLost: () => {
            sync.flush({ force: true });
            editor.setReadOnly(true);
            setLockLost(true);
          },
          onRemoteCommit: (records) => {
            editor.store.applyRemote((tx) => {
              for (const [id, record] of records) {
                if (record) tx.put(record);
                else tx.drop(id);
              }
            });
          },
        });
        if (!readOnly) lock.claim();

        // Unsaved changes from a previous session on this device.
        const mirror = readMirror(node.id);
        if (mirror && !readOnly) {
          if (mirror.baseRev === data.board.rev) {
            reapply(mirror.ops);
            toastRef.current.toast('Restored changes that had not been saved');
          } else {
            setRestore(mirror);
          }
        }

        // Other devices: pick up their changes when this tab comes back into view.
        const poll = () => {
          if (document.visibilityState !== 'visible' || !sync || sync.hasPending) return;
          designApi
            .changes(node.id, sync.rev)
            .then((result) => {
              if (result.rev > sync.rev || result.reset) {
                applyServerResult(result);
                sync.rev = Math.max(sync.rev, result.rev);
              }
            })
            .catch(() => {});
        };
        const onVisible = () => document.visibilityState === 'visible' && poll();
        document.addEventListener('visibilitychange', onVisible);
        pollTimer = setInterval(poll, 20_000);
        const offVisible = () => document.removeEventListener('visibilitychange', onVisible);
        disposers.push(offVisible);

        setPhase('ready');
        onReady?.(editor);
      })
      .catch((err) => {
        if (!alive) return;
        setLoadError(errorMessage(err, 'Could not open this board'));
        setPhase('error');
      });

    /** Puts mirrored ops back into the store as ordinary edits, so they save again. */
    function reapply(ops) {
      editor.store.transact(
        (tx) => {
          for (const op of ops) {
            if (op.op === 'put' && isKnownType(op.el.type)) {
              tx.put({ id: op.el.eid, type: op.el.type, parent: op.el.parent, z: op.el.z, data: op.el.data, rev: 0 });
            } else if (op.op === 'patch' && tx.get(op.eid)) {
              const data = { ...(op.set || {}) };
              for (const key of op.unset || []) data[key] = undefined;
              tx.update(op.eid, { ...(op.parent !== undefined ? { parent: op.parent } : {}), ...(op.z !== undefined ? { z: op.z } : {}), data });
            } else if (op.op === 'del') {
              tx.drop(op.eid);
            }
          }
        },
        { label: 'Restore unsaved changes', history: false },
      );
    }
    editor.reapplyOps = reapply;

    return () => {
      alive = false;
      clearInterval(pollTimer);
      disposers.forEach((fn) => fn());
      offCommit?.();
      sync?.dispose();
      lock?.dispose();
      syncRef.current = null;
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one editor per mount
  }, [editor]);

  useEffect(() => {
    if (phase === 'ready') editor.setReadOnly(projectReadOnly || lockLost || Boolean(gone));
  }, [editor, phase, projectReadOnly, lockLost, gone]);

  if (phase === 'error') {
    return (
      <div className="sd-stage-note">
        {loadError}{' '}
        <button type="button" className="link-btn" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }

  return (
    <EditorContext.Provider value={editor}>
      <div className="sd-editor">
        <div className="sd-editor-main">
          {phase === 'loading' ? <div className="sd-stage-note">Opening board…</div> : <Canvas />}

          {phase === 'ready' && (
            <>
              {lockLost && (
                <div className="sd-banner">
                  This board is open for editing in another tab.
                  <button
                    type="button"
                    className="btn primary"
                    onClick={() => {
                      setLockLost(false);
                      editor.setReadOnly(projectReadOnly);
                      // Reload so this tab starts from what the other one saved.
                      window.location.reload();
                    }}
                  >
                    Edit here
                  </button>
                </div>
              )}
              {gone && (
                <div className="sd-banner warn">
                  {gone === 'archived'
                    ? 'This project was archived. The board is read-only.'
                    : 'This board was moved to the trash. Changes are no longer being saved.'}
                </div>
              )}
              <Toolbar boardKind={node.boardKind} />
              <ZoomControls />
              <CanvasContextMenu />
            </>
          )}
        </div>
        {phase === 'ready' && <Inspector project={project} node={node} />}
      </div>

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

      {restore && (
        <ConfirmDialog
          title="Restore unsaved changes?"
          message={`This device has ${restore.ops.length} change${restore.ops.length === 1 ? '' : 's'} to this board from ${new Date(restore.at).toLocaleString()} that never reached the server. The board has been edited since.`}
          detail="Restoring applies them on top of the current board."
          confirmLabel="Restore"
          cancelLabel="Discard"
          onConfirm={() => {
            editor.reapplyOps(restore.ops);
            setRestore(null);
          }}
          onCancel={() => {
            clearMirror(node.id);
            setRestore(null);
          }}
        />
      )}
    </EditorContext.Provider>
  );
}
