import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TagInput } from '../ui/TagInput.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'].map((d) => ({ value: d, label: d }));

const slugify = (title) =>
  title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 100);

const blank = {
  title: '',
  slug: '',
  difficulty: 'Easy',
  patternSlug: '',
  url: '',
  articleUrl: '',
  videoId: '',
  topicTags: [],
  companies: [],
};

export function ProblemEditModal({ problem, readOnly, onClose, onSaved }) {
  const { groups } = useRoadmap();
  const { success, error } = useToast();

  const [form, setForm] = useState(blank);
  const [loading, setLoading] = useState(Boolean(problem));
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const isNew = !problem;

  useEffect(() => {
    if (!problem) {
      setForm({ ...blank, patternSlug: groups[0]?.slug || '' });
      return;
    }
    // The list projection omits most fields; fetch the whole document to edit.
    adminApi
      .problem(problem._id)
      .then(({ problem: full }) =>
        setForm({
          ...blank,
          ...full,
          topicTags: full.topicTags || [],
          companies: (full.companies || []).map((c) => c.name),
        }),
      )
      .catch((err) => error(errorMessage(err, 'Could not load that problem')))
      .finally(() => setLoading(false));
  }, [problem, groups, error]);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const save = async () => {
    setBusy(true);
    try {
      const body = {
        title: form.title.trim(),
        difficulty: form.difficulty,
        patternSlug: form.patternSlug,
        url: form.url.trim(),
        articleUrl: form.articleUrl.trim(),
        videoId: form.videoId.trim(),
        topicTags: form.topicTags,
        companies: form.companies.map((name) => ({ name, freq: 0 })),
      };

      if (isNew) await adminApi.createProblem({ ...body, slug: form.slug.trim() });
      else await adminApi.updateProblem(problem._id, body);

      success(isNew ? 'Problem created' : 'Problem saved');
      setConfirming(false);
      onSaved?.();
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not save that problem'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <Modal title="Problem" onClose={onClose} size="lg">
        <div className="modal-body">
          <div className="loading">Loading...</div>
        </div>
      </Modal>
    );
  }

  const valid = form.title.trim() && form.patternSlug && (!isNew || form.slug.trim());

  return (
    <>
      <Modal title={isNew ? 'New problem' : form.title} onClose={onClose} size="lg">
        <div className="modal-body">
          {readOnly && <div className="alert">Read-only — only the super admin can change problems.</div>}

          <label className="field">
            <span>Title</span>
            <input
              value={form.title}
              disabled={readOnly}
              onChange={(e) =>
                set({
                  title: e.target.value,
                  // Only while creating, and only until it is touched by hand.
                  ...(isNew && !form.slugTouched ? { slug: slugify(e.target.value) } : {}),
                })
              }
            />
          </label>

          {isNew && (
            <label className="field">
              <span>Slug</span>
              <input
                value={form.slug}
                disabled={readOnly}
                onChange={(e) => set({ slug: e.target.value, slugTouched: true })}
              />
              <span className="field-hint">
                Permanent. It is how progress rows and the seed script identify this problem.
              </span>
            </label>
          )}

          <div className="field-row">
            <div className="field" style={{ flex: 1 }}>
              <span>Pattern</span>
              <Dropdown
                ariaLabel="Pattern"
                value={form.patternSlug}
                disabled={readOnly}
                onChange={(v) => set({ patternSlug: v })}
                options={groups.map((g) => ({ value: g.slug, label: g.name }))}
              />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <span>Difficulty</span>
              <Dropdown
                ariaLabel="Difficulty"
                value={form.difficulty}
                disabled={readOnly}
                onChange={(v) => set({ difficulty: v })}
                options={DIFFICULTY_OPTIONS}
              />
            </div>
          </div>

          <label className="field">
            <span>Problem URL</span>
            <input value={form.url} disabled={readOnly} onChange={(e) => set({ url: e.target.value })} />
          </label>

          <label className="field">
            <span>Editorial / article URL</span>
            <input
              value={form.articleUrl}
              disabled={readOnly}
              onChange={(e) => set({ articleUrl: e.target.value })}
            />
          </label>

          <label className="field">
            <span>YouTube video id</span>
            <input
              value={form.videoId}
              disabled={readOnly}
              placeholder="dQw4w9WgXcQ"
              onChange={(e) => set({ videoId: e.target.value })}
            />
          </label>

          <div className="field">
            <span>Topic tags</span>
            <TagInput
              value={form.topicTags}
              onChange={(topicTags) => !readOnly && set({ topicTags })}
            />
          </div>

          <div className="field">
            <span>Companies</span>
            <TagInput
              value={form.companies}
              onChange={(companies) => !readOnly && set({ companies })}
            />
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
          {!readOnly && (
            <button
              type="button"
              className="btn primary"
              disabled={busy || !valid}
              onClick={() => setConfirming(true)}
            >
              {busy ? 'Saving...' : isNew ? 'Create problem' : 'Save changes'}
            </button>
          )}
        </div>
      </Modal>

      {confirming && (
        <ConfirmDialog
          title={isNew ? 'Create this problem?' : 'Save this problem?'}
          message={
            isNew
              ? 'It joins the shared curriculum and appears for every user.'
              : `Everyone sees the change to “${form.title.trim()}” immediately.`
          }
          /*
            The warning the seed protection makes necessary. Saying it plainly
            here is the difference between an admin understanding why their edit
            survived the next deploy and being confused by it.
          */
          detail="Saving marks this problem as hand-edited, so `npm run seed:db` will skip it from now on — the curated source file will no longer refresh it until someone re-seeds with --force."
          confirmLabel={isNew ? 'Create problem' : 'Save changes'}
          busy={busy}
          onConfirm={save}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
