import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { invalidateGuide } from '../../hooks/useGuide.js';
import { useToast } from '../../store/ToastContext.jsx';
import { GuideBlocks } from '../problem/GuideBlocks.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { IconChevronRight, IconClose, IconCopy, IconGrip, IconTrash } from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { BlockFields } from './BlockFields.jsx';
import { BLOCK_KINDS, KIND, blankBlock, move, nextKey, toPayload, withKeys } from './blockKinds.js';

/**
 * The block editor.
 *
 * A full-viewport overlay rather than a route, which is what makes unsaved
 * changes tractable: react-router's `useBlocker` only exists under a data
 * router and this app uses `<BrowserRouter>`, so "navigate away" would be
 * unstoppable. As an overlay, leaving means closing, and closing is ours.
 *
 * The preview is rendered by the real `GuideBlocks`, fed the same payload that
 * will be saved — so it is a guarantee about the result rather than an
 * approximation of it.
 */
export function GuideEditor({ slug, onClose, onSaved }) {
  const { success, error } = useToast();
  const panelRef = useRef(null);

  const [meta, setMeta] = useState({ title: '', summary: '' });
  const [blocks, setBlocks] = useState([]);
  const [baseline, setBaseline] = useState(null);
  const [wasEdited, setWasEdited] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [dragging, setDragging] = useState(null);
  const [collapsed, setCollapsed] = useState(() => new Set());
  const [removed, setRemoved] = useState(null);
  const [saving, setSaving] = useState(false);
  const [confirming, setConfirming] = useState(null);

  const payload = useMemo(
    () => ({
      title: meta.title.trim(),
      summary: meta.summary.trim(),
      blocks: blocks.map(toPayload),
    }),
    [meta, blocks],
  );

  const dirty = baseline !== null && JSON.stringify(payload) !== JSON.stringify(baseline);

  /*
    `useDialog` handles Escape on the capture phase and calls stopPropagation,
    which does not stop other listeners on the same node — so with a confirm
    open over this editor, one Escape would close the confirm and immediately
    reopen it via requestClose. Guarding on `confirming` is the local fix; the
    principled one is stopImmediatePropagation in useDialog, which would change
    behaviour for the reader and every existing modal.
  */
  const requestClose = () => {
    if (confirming || saving) return;
    if (dirty) setConfirming('discard');
    else onClose();
  };

  useDialog(panelRef, { onClose: requestClose });

  useEffect(() => {
    adminApi
      .guide(slug)
      .then(({ pattern, guide }) => {
        const loaded = (guide?.blocks || []).map(withKeys);
        setMeta({ title: guide?.title || pattern.name, summary: guide?.summary || pattern.blurb || '' });
        setBlocks(loaded);
        setWasEdited(Boolean(guide?.editedAt));
        setBaseline({
          title: guide?.title || pattern.name,
          summary: guide?.summary || pattern.blurb || '',
          blocks: loaded.map(toPayload),
        });
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not load that guide')));
  }, [slug]);

  // Only while dirty: an always-on handler would prompt on every reload of the
  // admin page, which is the fastest way to teach someone to ignore it.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const problems = blocks
    .map((b, i) => ({ i, message: KIND[b.type]?.validate?.(b) || '' }))
    .filter((p) => p.message);

  const setBlock = (i, next) => setBlocks((prev) => prev.map((b, j) => (j === i ? next : b)));

  const removeBlock = (i) => {
    setRemoved({ block: blocks[i], index: i });
    setBlocks((prev) => prev.filter((_, j) => j !== i));
  };

  const undoRemove = () => {
    if (!removed) return;
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(removed.index, 0, removed.block);
      return next;
    });
    setRemoved(null);
  };

  const duplicate = (i) =>
    setBlocks((prev) => {
      const next = [...prev];
      next.splice(i + 1, 0, withKeys(toPayload(prev[i])));
      return next;
    });

  const save = async () => {
    setSaving(true);
    try {
      await adminApi.saveGuide(slug, payload);
      // Or anyone who already opened this guide — including whoever just edited
      // it, going to check their work — keeps reading the old text.
      invalidateGuide(slug);
      setBaseline(payload);
      setWasEdited(true);
      setConfirming(null);
      success('Guide published');
      onSaved?.();
    } catch (err) {
      error(errorMessage(err, 'Could not save that guide'));
    } finally {
      setSaving(false);
    }
  };

  // Deferred: GuideBlocks is memo'd on identity and re-runs the syntax
  // highlighter over every code block, so previewing on each keystroke would
  // visibly stutter on a 2,000-word guide.
  const previewBlocks = useDeferredValue(payload.blocks);

  return (
    <>
      <div className="ge-overlay">
        <div className="ge" role="dialog" aria-modal="true" ref={panelRef} tabIndex={-1}>
          <header className="ge-head">
            <button type="button" className="btn ghost" onClick={requestClose}>
              <IconClose size={12} />
              Close
            </button>

            <span className="ge-title">
              {meta.title || slug}
              {dirty && <span className="ge-dirty">unsaved</span>}
              {!dirty && wasEdited && <span className="tag-mini">hand-edited</span>}
            </span>

            <span className="spacer" />
            <span className="hint mono">{blocks.length} blocks</span>

            <button
              type="button"
              className="btn"
              onClick={() =>
                setCollapsed((c) => (c.size ? new Set() : new Set(blocks.map((b) => b._k))))
              }
            >
              {collapsed.size ? 'Expand all' : 'Collapse all'}
            </button>

            <button
              type="button"
              className="btn primary"
              disabled={saving || !dirty || problems.length > 0}
              title={problems.length ? `${problems.length} blocks need fixing first` : undefined}
              onClick={() => setConfirming(wasEdited ? 'save' : 'first-save')}
            >
              {saving ? 'Publishing...' : 'Publish'}
            </button>
          </header>

          {loadError && <div className="alert">{loadError}</div>}

          <div className="ge-split">
            <div className="ge-pane">
              <label className="field">
                <span>Title</span>
                <input
                  value={meta.title}
                  onChange={(e) => setMeta({ ...meta, title: e.target.value })}
                />
              </label>
              <label className="field">
                <span>Summary</span>
                <textarea
                  rows={2}
                  value={meta.summary}
                  onChange={(e) => setMeta({ ...meta, summary: e.target.value })}
                />
              </label>

              {removed && (
                <div className="gb-undo">
                  Removed a {removed.block.type} block.
                  <button type="button" className="link-btn" onClick={undoRemove}>
                    Undo
                  </button>
                </div>
              )}

              <div className="gb-list">
                {blocks.map((block, i) => {
                  const kind = KIND[block.type];
                  const isCollapsed = collapsed.has(block._k);
                  const warn = kind?.validate?.(block) || '';

                  return (
                    <div
                      key={block._k}
                      className={`gb-card ${dragging === i ? 'dragging' : ''} ${
                        isCollapsed ? 'collapsed' : ''
                      } ${warn ? 'invalid' : ''}`}
                      draggable
                      onDragStart={() => setDragging(i)}
                      onDragEnd={() => setDragging(null)}
                      onDragOver={(e) => {
                        e.preventDefault();
                        if (dragging === null || dragging === i) return;
                        setBlocks((prev) => move(prev, dragging, i));
                        setDragging(i);
                      }}
                    >
                      <div className="gb-head">
                        <span className="gb-grip" title="Drag to reorder">
                          <IconGrip size={13} />
                        </span>
                        <button
                          type="button"
                          className="gb-toggle"
                          onClick={() =>
                            setCollapsed((c) => {
                              const next = new Set(c);
                              if (next.has(block._k)) next.delete(block._k);
                              else next.add(block._k);
                              return next;
                            })
                          }
                        >
                          <span className={`chev ${isCollapsed ? '' : 'open'}`}>
                            <IconChevronRight size={11} />
                          </span>
                          <span className="gb-type">{kind?.label || block.type}</span>
                          <span className="gb-summary">{kind?.summary?.(block) || ''}</span>
                        </button>

                        <span className="gb-acts">
                          <button
                            type="button"
                            className="icon-btn"
                            title="Move up"
                            disabled={i === 0}
                            onClick={() => setBlocks((p) => move(p, i, i - 1))}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Move down"
                            disabled={i === blocks.length - 1}
                            onClick={() => setBlocks((p) => move(p, i, i + 1))}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Duplicate"
                            onClick={() => duplicate(i)}
                          >
                            <IconCopy size={12} />
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            title="Remove"
                            onClick={() => removeBlock(i)}
                          >
                            <IconTrash size={12} />
                          </button>
                        </span>
                      </div>

                      {!isCollapsed && (
                        <div className="gb-body">
                          <BlockFields block={block} onChange={(next) => setBlock(i, next)} />
                          {warn && <p className="gb-warn">{warn}</p>}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="gb-add">
                {BLOCK_KINDS.map((kind) => (
                  <button
                    key={kind.type}
                    type="button"
                    className="toggle-chip"
                    onClick={() => setBlocks((prev) => [...prev, blankBlock(kind.type)])}
                  >
                    + {kind.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="ge-pane ge-preview">
              <article className="reader-col">
                <div className="reader-lede">
                  <h1>{meta.title}</h1>
                  <p>{meta.summary}</p>
                </div>
                <GuideBlocks blocks={previewBlocks} />
              </article>
            </div>
          </div>
        </div>
      </div>

      {confirming === 'first-save' && (
        <ConfirmDialog
          title="Publish this guide?"
          message={`Everyone reading “${meta.title}” sees this the next time they open it.`}
          /*
            Shown only on the first save of a guide the seeder still owns. After
            that the skip is already true, and repeating this on save #2 through
            #40 is exactly how a warning stops being read.
          */
          detail="Saving marks this guide as hand-edited. From now on `npm run seed:guides` will skip it, so edits to the content file in the repo will no longer reach this pattern — until someone re-seeds with --force, or hands it back from the guides list."
          confirmLabel="Publish"
          busy={saving}
          onConfirm={save}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'save' && (
        <ConfirmDialog
          title="Publish changes?"
          message={`Everyone reading “${meta.title}” sees this the next time they open it.`}
          confirmLabel="Publish"
          busy={saving}
          onConfirm={save}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'discard' && (
        <ConfirmDialog
          title="Discard your changes?"
          message="Everything you have typed since the last publish is lost."
          confirmLabel="Discard changes"
          tone="danger"
          onConfirm={onClose}
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
