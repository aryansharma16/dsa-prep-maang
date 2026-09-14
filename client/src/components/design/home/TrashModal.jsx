import { useCallback, useEffect, useState } from 'react';
import { errorMessage } from '../../../api/http.js';
import { designApi } from '../../../api/index.js';
import { daysLeft } from '../../../design/core/time.js';
import { useToast } from '../../../store/ToastContext.jsx';
import { ConfirmDialog } from '../../ui/ConfirmDialog.jsx';
import { Modal } from '../../ui/Modal.jsx';
import { IconCanvasBoard, IconFolder, IconRestore, IconSchemaBoard } from '../icons.jsx';

/**
 * Everything in the System Design trash: whole projects, and folders or boards
 * deleted from inside a live project.
 *
 * Restore is one click and deleting for good asks first, naming what goes with
 * it — the asymmetry is the point of having a trash at all.
 */
export function TrashModal({ onClose, onRestoredProject }) {
  const { success, error: toastError } = useToast();
  const [data, setData] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    designApi
      .trash()
      .then(setData)
      .catch((err) => toastError(errorMessage(err, 'Could not load the trash')));
  }, [toastError]);

  useEffect(load, [load]);

  const run = async (fn, message) => {
    setBusy(true);
    try {
      await fn();
      success(message);
      load();
    } catch (err) {
      toastError(errorMessage(err));
    } finally {
      setBusy(false);
      setConfirm(null);
    }
  };

  const empty = data && !data.projects.length && !data.nodes.length;

  return (
    <Modal title="Trash" onClose={onClose} size="md">
      <div className="modal-body sd-trash">
        {!data && <div className="loading">Loading…</div>}
        {empty && <p className="hint">Nothing in the trash. Deleted projects and boards wait here for 30 days.</p>}

        {data?.projects.length > 0 && (
          <section>
            <h4>Projects</h4>
            {data.projects.map(({ project, expiresAt }) => (
              <div key={project.id} className="sd-trash-row" data-hue={project.hue}>
                <span className="sd-trash-icon sd-dot">{project.icon || project.name.slice(0, 1)}</span>
                <span className="sd-trash-name">{project.name}</span>
                <span className="sd-trash-when">{daysLeft(expiresAt)}d left</span>
                <button
                  type="button"
                  className="btn ghost"
                  disabled={busy}
                  onClick={() =>
                    run(async () => {
                      const restored = await designApi.restoreProject(project.id);
                      onRestoredProject?.(restored);
                    }, `Restored ${project.name}`)
                  }
                >
                  <IconRestore size={14} /> Restore
                </button>
                <button
                  type="button"
                  className="btn ghost danger"
                  disabled={busy}
                  onClick={() => setConfirm({ kind: 'project', item: project })}
                >
                  Delete
                </button>
              </div>
            ))}
          </section>
        )}

        {data?.nodes.length > 0 && (
          <section>
            <h4>Folders and boards</h4>
            {data.nodes.map(({ node, projectName, descendants, expiresAt }) => {
              const Icon = node.kind === 'folder' ? IconFolder : node.boardKind === 'schema' ? IconSchemaBoard : IconCanvasBoard;
              return (
                <div key={node.id} className="sd-trash-row">
                  <span className="sd-trash-icon">
                    <Icon size={15} />
                  </span>
                  <span className="sd-trash-name">
                    {node.name}
                    <small>
                      in {projectName}
                      {descendants > 0 ? ` · with ${descendants} inside` : ''}
                    </small>
                  </span>
                  <span className="sd-trash-when">{daysLeft(expiresAt)}d left</span>
                  <button
                    type="button"
                    className="btn ghost"
                    disabled={busy}
                    onClick={() => run(() => designApi.restoreNode(node.id), `Restored ${node.name}`)}
                  >
                    <IconRestore size={14} /> Restore
                  </button>
                  <button
                    type="button"
                    className="btn ghost danger"
                    disabled={busy}
                    onClick={() => setConfirm({ kind: 'node', item: node, descendants })}
                  >
                    Delete
                  </button>
                </div>
              );
            })}
          </section>
        )}
      </div>

      {confirm && (
        <ConfirmDialog
          title="Delete for good?"
          message={
            confirm.kind === 'project'
              ? `“${confirm.item.name}” and every board in it will be deleted permanently.`
              : `“${confirm.item.name}”${confirm.descendants ? ` and ${confirm.descendants} item(s) inside it` : ''} will be deleted permanently.`
          }
          detail="This cannot be undone."
          confirmLabel="Delete for good"
          tone="danger"
          busy={busy}
          onCancel={() => setConfirm(null)}
          onConfirm={() =>
            run(
              () =>
                confirm.kind === 'project'
                  ? designApi.purgeProject(confirm.item.id)
                  : designApi.purgeNode(confirm.item.id),
              `Deleted ${confirm.item.name}`,
            )
          }
        />
      )}
    </Modal>
  );
}
