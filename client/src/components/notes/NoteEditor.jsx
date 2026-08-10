import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { errorMessage } from '../../api/http.js';
import { notesApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { EmojiPicker } from '../ui/EmojiPicker.jsx';
import {
  IconArrowLeft,
  IconCheck,
  IconEye,
  IconTrash,
} from '../ui/Icons.jsx';
import { AutoTextarea } from './AutoTextarea.jsx';
import { BlockList } from './BlockList.jsx';
import { NoteBlocks } from './NoteBlocks.jsx';
import { NoteInspector, VisibilityPicker } from './NoteInspector.jsx';
import { blankBlock, isSendable, toPayload, withKeys } from './blockTypes.js';

/**
 * The builder.
 *
 * Three decisions shape everything below.
 *
 * **One canvas, not a split.** The admin guide editor puts a form on the left
 * and a preview on the right, which is right for content someone else will
 * read and wrong here: it halves the writing width and asks you to look in two
 * places to know what you are making. These blocks are edited in the shape they
 * will be read in, and Preview is a toggle for checking the finished thing
 * rather than a permanent second pane.
 *
 * **Autosave.** A personal note is not a form to be submitted — losing one to a
 * closed tab is the failure that stops people writing them. Saving is debounced
 * and the header says which of the three states it is in, so the save button is
 * a manual override rather than the only path.
 *
 * **Nothing is created until there is something to create.** `/notes/new` holds
 * no id and writes no row until the first real edit, so opening the editor and
 * changing your mind leaves nothing behind. The id arrives on that first save
 * and the URL is corrected under the user without a navigation.
 */

const AUTOSAVE_MS = 1400;

const emptyMeta = {
  title: '',
  summary: '',
  icon: '',
  tags: [],
  category: '',
  patternSlug: '',
  visibility: 'private',
  status: 'draft',
  cover: null,
};

/** A blank note opens with one paragraph, so there is a caret to start typing in. */
const starterBlocks = () => [blankBlock('paragraph')];

export function NoteEditor({ noteId = null, onExit }) {
  const navigate = useNavigate();
  const { success, error } = useToast();

  const [id, setId] = useState(noteId);
  const [meta, setMeta] = useState(emptyMeta);
  const [blocks, setBlocks] = useState(noteId ? [] : starterBlocks);
  /*
    Null until the first committed render, for a new note as well as a loaded
    one. Seeding it with anything else — an empty object, the starter blocks —
    makes the first `dirty` comparison fail against a shape that was never on
    screen, and a note nobody has touched yet opens reading "Unsaved".
  */
  const [baseline, setBaseline] = useState(null);
  const [loading, setLoading] = useState(Boolean(noteId));
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState(null);
  const [preview, setPreview] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [publicId, setPublicId] = useState('');

  const patchMeta = (changes) => setMeta((m) => ({ ...m, ...changes }));

  /**
   * Exactly what goes on the wire.
   *
   * Blocks that the server would refuse are filtered rather than allowed to fail
   * the whole request — an Image block with no file yet is a normal state on the
   * canvas and an invalid one in the payload. It stays on screen and starts
   * saving the moment it has a file.
   */
  const payload = useMemo(
    () => ({
      title: meta.title.trim() || 'Untitled note',
      summary: meta.summary.trim(),
      icon: meta.icon || '',
      tags: meta.tags,
      category: meta.category.trim(),
      patternSlug: meta.patternSlug,
      visibility: meta.visibility,
      status: meta.status,
      cover: meta.cover?.fileId ? { fileId: meta.cover.fileId } : null,
      blocks: blocks.filter(isSendable).map(toPayload),
    }),
    [meta, blocks],
  );

  // Read by the async save path, which must not close over a stale render.
  const latest = useRef({ payload, id });
  latest.current = { payload, id };

  const dirty = baseline !== null && JSON.stringify(payload) !== JSON.stringify(baseline);

  // Worth saving at all: a title someone typed, or a block with something in it.
  const hasContent =
    Boolean(meta.title.trim()) || payload.blocks.some((b) => JSON.stringify(b).length > 40);

  /* ----------------------------------------------------------------- load */

  useEffect(() => {
    if (!noteId) return;
    let live = true;
    notesApi
      .get(noteId)
      .then(({ note }) => {
        if (!live) return;
        const loaded = (note.blocks || []).map(withKeys);
        const next = {
          title: note.title === 'Untitled note' ? '' : note.title,
          summary: note.summary || '',
          icon: note.icon || '',
          tags: note.tags || [],
          category: note.category || '',
          patternSlug: note.patternSlug || '',
          visibility: note.visibility,
          status: note.status,
          cover: note.cover || null,
        };
        setMeta(next);
        setBlocks(loaded.length ? loaded : starterBlocks());
        setPublicId(note.publicId || '');
        setBaseline(null); // recomputed below, once `payload` reflects the load
      })
      .catch((err) => error(errorMessage(err, 'Could not open that note')))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [noteId, error]);

  /*
    The baseline is taken one render *after* the load, not during it. Taken
    inside the `.then` it would be built from the payload of the render that is
    already on screen — the empty one — and the editor would open permanently
    dirty and autosave over the note it just read.
  */
  useEffect(() => {
    if (!loading && baseline === null) setBaseline(payload);
  }, [loading, baseline, payload]);

  /* ----------------------------------------------------------------- save */

  const save = useCallback(
    async ({ silent = false } = {}) => {
      const { payload: body, id: current } = latest.current;
      setSaving(true);
      try {
        const note = current
          ? await notesApi.update(current, body)
          : await notesApi.create(body);

        if (!current) {
          setId(note.id);
          setPublicId(note.publicId);
          // Replace, not push: Back should leave the editor, not walk through
          // the moment the note gained an id.
          navigate(`/notes/${note.id}/edit`, { replace: true });
        }
        setBaseline(body);
        setSavedAt(Date.now());
        if (!silent) success('Saved');
        return note;
      } catch (err) {
        error(errorMessage(err, 'Could not save'));
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [navigate, success, error],
  );

  // Debounced autosave. Deliberately not on an interval — a timer that fires
  // while you are mid-sentence saves half a thought and costs a request per tick.
  useEffect(() => {
    if (!dirty || saving || (!id && !hasContent)) return undefined;
    const timer = setTimeout(() => save({ silent: true }).catch(() => {}), AUTOSAVE_MS);
    return () => clearTimeout(timer);
  }, [dirty, saving, id, hasContent, save]);

  useEffect(() => {
    const onKey = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key === 's') {
        event.preventDefault();
        if (dirty) save().catch(() => {});
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [dirty, save]);

  // Only while dirty — an always-on handler would prompt on every reload and
  // teach people to click through it.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /* --------------------------------------------------------------- upload */

  /**
   * Uploads need a note id, and a brand-new note has none.
   *
   * The lock matters: dropping four images at once fires four uploads in the
   * same tick, and without it each would find no id and create its own note.
   */
  const creating = useRef(null);
  const ensureId = useCallback(async () => {
    if (latest.current.id) return latest.current.id;
    if (!creating.current) {
      creating.current = save({ silent: true }).finally(() => {
        creating.current = null;
      });
    }
    const note = await creating.current;
    return note.id;
  }, [save]);

  const upload = useCallback(
    async (files, onDone) => {
      setUploading(true);
      try {
        const target = await ensureId();
        const { assets, failed } = await notesApi.upload(target, files);
        if (failed?.length) {
          error(
            failed.length === files.length
              ? `Could not upload ${failed[0].originalName} — ${failed[0].error}`
              : `${failed.length} of ${files.length} files were rejected`,
          );
        }
        if (assets.length) onDone(assets);
      } catch (err) {
        error(errorMessage(err, 'Upload failed'));
      } finally {
        setUploading(false);
      }
    },
    [ensureId, error],
  );

  /**
   * Pasting a screenshot appends an image block.
   *
   * The single most common thing anyone does while writing a note about a bug,
   * and the one interaction whose absence makes an editor feel like a form.
   */
  useEffect(() => {
    if (preview) return undefined;
    const onPaste = (event) => {
      const files = [...(event.clipboardData?.files || [])].filter((f) =>
        f.type.startsWith('image/'),
      );
      if (!files.length) return;
      event.preventDefault();
      upload(files, (assets) =>
        setBlocks((prev) => [
          ...prev,
          ...assets.map((asset) => ({ ...blankBlock('image'), asset })),
        ]),
      );
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [preview, upload]);

  /* ---------------------------------------------------------------- exit */

  const leave = () => {
    // Dirty on the way out is saved rather than queried. There is no version of
    // "discard my note" anyone wants from a back button, and the note is theirs.
    if (dirty && hasContent) save({ silent: true }).catch(() => {});
    onExit();
  };

  const destroy = async () => {
    try {
      if (id) await notesApi.remove(id);
      success('Note moved to trash');
      onExit();
    } catch (err) {
      error(errorMessage(err, 'Could not delete that note'));
    }
  };

  if (loading) return <div className="loading">Opening…</div>;

  const status = saving
    ? { text: 'Saving…', tone: 'busy' }
    : dirty
      ? { text: 'Unsaved', tone: 'dirty' }
      : savedAt || id
        ? { text: 'Saved', tone: 'ok' }
        : { text: 'Draft', tone: 'idle' };

  return (
    <div className="ne">
      <header className="ne-head">
        <button type="button" className="btn ghost" onClick={leave}>
          <IconArrowLeft size={12} />
          Notes
        </button>

        <span className={`ne-status ${status.tone}`}>
          {status.tone === 'ok' && <IconCheck size={11} />}
          {status.text}
        </span>

        <span className="spacer" />

        <VisibilityPicker
          value={meta.visibility}
          status={meta.status}
          publicId={publicId}
          onChange={(visibility) => patchMeta({ visibility })}
          onPublish={() => patchMeta({ status: 'published' })}
        />

        <button
          type="button"
          className={`btn ${preview ? 'primary' : ''}`}
          onClick={() => setPreview((p) => !p)}
        >
          <IconEye size={12} />
          {preview ? 'Editing' : 'Preview'}
        </button>

        <button type="button" className="btn primary" disabled={!dirty || saving} onClick={() => save()}>
          Save
        </button>

        {id && (
          <button
            type="button"
            className="icon-btn danger"
            title="Delete note"
            onClick={() => setConfirming(true)}
          >
            <IconTrash size={13} />
          </button>
        )}
      </header>

      <div className={`ne-body ${preview ? 'reading' : ''}`}>
        <div className="ne-canvas">
          <div className="ne-doc">
            {preview ? (
              <article className="nr">
                <NoteHeader meta={meta} />
                <NoteBlocks blocks={payload.blocks} />
              </article>
            ) : (
              <>
                <div className="ne-title-row">
                  <EmojiPicker
                    className="ne-icon"
                    title="Pick an emoji"
                    value={meta.icon}
                    onChange={(icon) => patchMeta({ icon })}
                  />
                  <AutoTextarea
                    className="ne-title"
                    value={meta.title}
                    placeholder="Untitled note"
                    onChange={(title) => patchMeta({ title })}
                    onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                  />
                </div>

                <AutoTextarea
                  className="ne-summary"
                  value={meta.summary}
                  placeholder="One line on what this is about…"
                  onChange={(summary) => patchMeta({ summary })}
                />

                <BlockList
                  blocks={blocks}
                  onChange={setBlocks}
                  upload={upload}
                  uploading={uploading}
                />
              </>
            )}
          </div>
        </div>

        {!preview && (
          <NoteInspector meta={meta} onChange={patchMeta} noteId={id} upload={upload} />
        )}
      </div>

      {confirming && (
        <ConfirmDialog
          title="Delete this note?"
          message={`“${meta.title.trim() || 'Untitled note'}” moves to the trash.`}
          detail="Its images and PDFs stay with it — deleting for good, from the trash, is what releases them."
          confirmLabel="Move to trash"
          tone="danger"
          onConfirm={destroy}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  );
}

/** The lede, shared by the preview and the reader page. */
export function NoteHeader({ meta }) {
  return (
    <div className="nr-lede">
      {meta.icon && <span className="nr-icon">{meta.icon}</span>}
      <h1>{meta.title.trim() || 'Untitled note'}</h1>
      {meta.summary && <p>{meta.summary}</p>}
      {meta.tags?.length > 0 && (
        <div className="nr-tags">
          {meta.tags.map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
        </div>
      )}
    </div>
  );
}
