import { useCallback, useEffect, useRef, useState } from 'react';
import { baseURL, errorMessage } from '../../../api/http.js';
import { designApi } from '../../../api/index.js';
import { recordFromWire } from '../../../design/engine/diff.js';
import { createCommands } from '../../../design/engine/commands.js';
import { createEditor } from '../../../design/engine/editor.js';
import { measurePan, stressBoard } from '../../../design/engine/stress.js';
import { mergeText } from '../../../design/schema/merge.js';
import { createSchemaSync, META_PARENT, SOURCE_ID, sourceRecord } from '../../../design/schema/schemaSync.js';
import { SchemaPanel } from '../schema/SchemaPanel.jsx';
import { isKnownType } from '../../../design/shapes/registry.js';
import { createAutosave, planRestore, readMirrors, removeMirrors } from '../../../design/sync/autosave.js';
import { createTabLock } from '../../../design/sync/tabLock.js';
import { newId } from '../../../design/core/ids.js';
import { useToast } from '../../../store/ToastContext.jsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.jsx';
import { Inspector } from '../inspector/Inspector.jsx';
import { LibraryPanel } from '../library/LibraryPanel.jsx';
import { CanvasContextMenu } from './CanvasContextMenu.jsx';
import { Canvas } from './Canvas.jsx';
import { EditorContext, useUi } from './hooks.js';
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
  // The schema text as the server last acknowledged it: the base of the next compare-and-set save.
  const sourceRef = useRef({ rev: 0, text: '' });
  const [sourceConflict, setSourceConflict] = useState(null);

  /** Remote schema text: taken as is unless this tab has its own unsaved text, then merged. */
  const receiveSource = useCallback(
    ({ source, sourceRev }) => {
      if (typeof source !== 'string') return;
      const local = editor.store.get(SOURCE_ID)?.data.text ?? '';
      const base = sourceRef.current.text;
      sourceRef.current = { rev: sourceRev, text: source };
      if (local === source) return;
      if (!syncRef.current?.hasPendingSource && local === base) {
        editor.store.applyRemote((tx) => tx.put(sourceRecord(source, sourceRev)));
        return;
      }
      const merged = mergeText(base, local, source);
      if (merged.text === null) {
        setSourceConflict({ mine: local, theirs: source, conflicts: merged.conflicts });
      } else if (merged.text === source) {
        editor.store.applyRemote((tx) => tx.put(sourceRecord(source, sourceRev)));
      } else {
        // Saved again on top of theirs, under their revision.
        editor.store.transact((tx) => tx.update(SOURCE_ID, { data: { text: merged.text } }), { label: 'Merge schema', history: false });
        toastRef.current.toast('Merged schema changes from another device');
      }
    },
    [editor],
  );

  const applyServerResult = useCallback(
    (result) => {
      const sync = syncRef.current;
      if (result.reset) {
        designApi.board(node.id).then((data) => {
          const pending = sync?.pendingIds() || new Set();
          editor.store.applyRemote((tx) => {
            const incoming = new Map(data.elements.map((el) => [el.eid, recordFromWire(el)]));
            for (const record of editor.store.all()) if (record.parent !== META_PARENT && !incoming.has(record.id) && !pending.has(record.id)) tx.drop(record.id);
            for (const [id, record] of incoming) if (!pending.has(id)) tx.put(record);
          });
          if (data.board.kind === 'schema') receiveSource(data.board);
          if (sync) sync.rev = data.board.rev;
        });
        return;
      }
      if (result.board) receiveSource(result.board);
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
    [editor, node.id, receiveSource],
  );

  useEffect(() => {
    let alive = true;
    const tabId = newId(10);
    let sync = null;
    let lock = null;
    let offCommit = null;
    let pollTimer = 0;
    let restoreTimer = 0;
    const disposers = [];

    editor.commands = createCommands(editor);

    designApi
      .board(node.id)
      .then((data) => {
        if (!alive) return;
        const records = data.elements.map(recordFromWire);
        if (data.board.kind === 'schema') {
          sourceRef.current = { rev: data.board.sourceRev ?? 0, text: data.board.source ?? '' };
          records.push(sourceRecord(data.board.source ?? '', data.board.sourceRev ?? 0));
        }
        editor.store.load(records);
        const readOnly = projectReadOnly || !['owner', 'editor'].includes(data.role);
        editor.setReadOnly(readOnly);
        if (data.board.kind === 'schema') editor.schema = createSchemaSync(editor);

        sync = createAutosave({
          boardId: node.id,
          baseRev: data.board.rev,
          send: (batch) => designApi.commit(node.id, batch),
          keepaliveUrl: `${baseURL}/design/boards/${node.id}/ops`,
          getSourceBase: () => sourceRef.current.rev,
          onSourceSaved: (rev, text) => {
            sourceRef.current = { rev, text };
          },
          onStatus: (save) => editor.setSaveStatus(save),
          onResult: applyServerResult,
          onRejected: (rejected) => {
            const conflict = rejected.find((r) => r.op === 'source' && r.code === 'SOURCE_CONFLICT');
            if (conflict?.current) receiveSource(conflict.current);
            rejected = rejected.filter((r) => r.op !== 'source');
            if (!rejected.length) return;
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

        // Unsaved changes left by a tab that closed or crashed before saving them.
        const restoreOrphans = (board, allowWait) => {
          if (!alive || readOnly) return;
          const plan = planRestore(readMirrors(node.id, sync.clientId), board);
          removeMirrors(plan.remove);
          if (plan.silent.ops.length) {
            reapply(plan.silent.ops);
            removeMirrors(plan.silent.keys);
            toastRef.current.toast('Restored changes that had not been saved');
          }
          if (plan.ask) setRestore(plan.ask);
          // A mirror refreshed moments ago may belong to a tab that is still open — or one that just
          // crashed. Look once more after it would have been refreshed again.
          if (plan.waitFor && allowWait) {
            restoreTimer = setTimeout(() => {
              designApi
                .board(node.id)
                .then((fresh) => restoreOrphans(fresh.board, false))
                .catch(() => {});
            }, plan.waitFor);
          }
        };
        restoreOrphans(data.board, true);

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
            } else if (op.op === 'source' && tx.get(SOURCE_ID)) {
              tx.update(SOURCE_ID, { data: { text: op.text } });
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
      clearTimeout(restoreTimer);
      disposers.forEach((fn) => fn());
      offCommit?.();
      sync?.dispose();
      lock?.dispose();
      syncRef.current = null;
      editor.schema?.dispose();
      editor.schema = null;
      onReady?.(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one editor per mount
  }, [editor]);

  // ?sdperf: performance tooling on window.__sd (see design/engine/stress.js).
  useEffect(() => {
    // Remembered for the tab: the workspace rewrites the URL (and drops the query) as boards open.
    try {
      if (new URLSearchParams(window.location.search).has('sdperf')) sessionStorage.setItem('sd-perf', '1');
    } catch {
      /* private mode */
    }
    let enabled = false;
    try {
      enabled = sessionStorage.getItem('sd-perf') === '1';
    } catch {
      enabled = new URLSearchParams(window.location.search).has('sdperf');
    }
    if (phase !== 'ready' || !enabled) return undefined;
    window.__sd = { editor, stress: (n) => stressBoard(editor, n), measurePan: (options) => measurePan(editor, options) };
    return () => {
      delete window.__sd;
    };
  }, [editor, phase]);

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
        {phase === 'ready' && node.boardKind === 'schema' && <SchemaPanel boardName={node.name} />}
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
              <LibraryHost editor={editor} />
              <Toolbar boardKind={node.boardKind} />
              <ZoomControls />
              <CanvasContextMenu />
            </>
          )}
        </div>
        {phase === 'ready' && <Inspector project={project} node={node} />}
      </div>

      {shortcutsOpen && <ShortcutsDialog onClose={() => setShortcutsOpen(false)} />}

      {sourceConflict && (
        <ConfirmDialog
          title="The schema changed on another device"
          message={`Someone saved changes to this schema's text while you were editing it, and ${sourceConflict.conflicts === 1 ? 'one part' : `${sourceConflict.conflicts} parts`} of your changes overlap theirs.`}
          detail="Keep yours to save your text over theirs, or take theirs to discard your unsaved text changes."
          confirmLabel="Keep mine"
          cancelLabel="Take theirs"
          onConfirm={() => {
            const mine = sourceConflict.mine;
            setSourceConflict(null);
            editor.store.transact((tx) => tx.update(SOURCE_ID, { data: { text: mine } }), { label: 'Keep my schema', history: false });
          }}
          onCancel={() => {
            const { theirs } = sourceConflict;
            setSourceConflict(null);
            editor.store.applyRemote((tx) => tx.put(sourceRecord(theirs, sourceRef.current.rev)));
          }}
        />
      )}

      {restore && (
        <ConfirmDialog
          title="Restore unsaved changes?"
          message={`This device has ${restore.ops.length} change${restore.ops.length === 1 ? '' : 's'} to this board from ${new Date(restore.at).toLocaleString()} that never reached the server. The board has been edited since.`}
          detail="Restoring applies them on top of the current board."
          confirmLabel="Restore"
          cancelLabel="Discard"
          onConfirm={() => {
            // Reapplied ops join this tab's queue (and its own mirror) before the old copies go.
            editor.reapplyOps(restore.ops);
            removeMirrors(restore.keys);
            setRestore(null);
          }}
          onCancel={() => {
            removeMirrors(restore.keys);
            setRestore(null);
          }}
        />
      )}
    </EditorContext.Provider>
  );
}

/** The component library, while it is open (I, or the toolbar button). */
function LibraryHost({ editor }) {
  const open = useUi((s) => s.libraryOpen);
  const readOnly = useUi((s) => s.readOnly);
  if (!open || readOnly) return null;
  return <LibraryPanel onClose={() => editor.ui.set({ libraryOpen: false })} />;
}
