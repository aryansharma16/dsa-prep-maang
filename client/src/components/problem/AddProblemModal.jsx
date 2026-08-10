import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { problemsApi } from '../../api/index.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { IconChevronRight } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { TagInput } from '../ui/TagInput.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

const DIFFICULTY_OPTIONS = ['Easy', 'Medium', 'Hard'].map((d) => ({ value: d, label: d }));

const STATUSES = [
  ['todo', 'Not started'],
  ['attempted', 'Attempted'],
  ['solved', 'Already solved'],
];

/**
 * One URL field does the work: paste a LeetCode link and title, difficulty and
 * tags fill themselves in. Everything else the DB stores sits behind "More
 * details" so the common path stays a paste and a save.
 *
 * Pass `problem` and the same form edits it instead. One component rather than
 * two, because the fields, the pattern list, the company suggestions and the
 * tag inputs are identical — a separate editor would be this file with the
 * verbs changed, and would drift the first time a field was added to one of
 * them.
 *
 * Two things do differ, and both follow from what an edit *is*:
 *
 * - The URL is shown but not editable. It is what the slug was derived from,
 *   and the slug is what every progress row joins on, so moving it would
 *   detach your own history. Delete and re-add if the link was wrong.
 * - Status and notes are absent. They live on `Progress`, not `Problem` — they
 *   are offered on the way in as a convenience for something you already
 *   solved, and after that the row's own controls own them.
 */
export function AddProblemModal({ problem, onClose }) {
  const { groups, addProblem, updateProblem } = useRoadmap();
  const { success, error } = useToast();

  const editing = Boolean(problem);

  const [patterns, setPatterns] = useState([]);
  const [url, setUrl] = useState(problem?.url || '');
  const [title, setTitle] = useState(problem?.title || '');
  const [difficulty, setDifficulty] = useState(problem?.difficulty || 'Medium');
  const [patternSlug, setPatternSlug] = useState(problem?.patternSlug || '');
  const [topicTags, setTopicTags] = useState(problem?.topicTags || []);
  const [companies, setCompanies] = useState((problem?.companies || []).map((c) => c.name));
  const [articleUrl, setArticleUrl] = useState(problem?.articleUrl || '');
  // Stored as a bare id; the server normalises either shape back on save.
  const [video, setVideo] = useState(problem?.videoId || '');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('todo');

  // Open from the start when editing: the thing being corrected is as likely to
  // be a tag or a link as the title, and a disclosure hiding half the form is
  // only worth it while the common path is a paste and a save.
  const [more, setMore] = useState(editing);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const urlRef = useRef(null);
  const titleRef = useRef(null);

  // Companies already in your list, so the chips input can suggest instead of
  // making you spell "Goldman Sachs" correctly.
  const companySuggestions = useMemo(() => {
    const counts = new Map();
    for (const g of groups) {
      for (const p of g.problems) {
        for (const c of p.companies || []) counts.set(c.name, (counts.get(c.name) || 0) + 1);
      }
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([name]) => name);
  }, [groups]);

  useEffect(() => {
    problemsApi
      .patterns()
      .then((list) => {
        setPatterns(list);
        setPatternSlug((current) => current || list[0]?.slug || '');
      })
      .catch(() => error('Could not load the pattern list'));
  }, [error]);

  // Debounced so pasting a URL resolves without a "Fetch" button to press.
  // Never while editing: the URL cannot change, so a lookup could only overwrite
  // the title and tags the person opened this dialog to correct.
  useEffect(() => {
    if (editing || !url.trim()) {
      setNote('');
      return undefined;
    }
    const timer = setTimeout(async () => {
      setLooking(true);
      try {
        const res = await problemsApi.lookup(url.trim());
        if (res.found && res.alreadyTracked) {
          setNote(`Already in your list under "${res.problem.patternSlug}".`);
        } else if (res.found) {
          setTitle(res.problem.title);
          setDifficulty(res.problem.difficulty);
          setTopicTags(res.problem.topicTags || []);
          setNote(`Found on LeetCode — ${res.problem.difficulty}. Pick a pattern and save.`);
        } else {
          setNote(`${res.reason}. Fill in the details below.`);
        }
      } catch (err) {
        setNote(errorMessage(err, 'Lookup failed — fill in the details manually'));
      } finally {
        setLooking(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [url, editing]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return error('Give the problem a title');
    setSaving(true);
    try {
      const common = {
        title: title.trim(),
        difficulty,
        patternSlug,
        topicTags,
        companies,
        articleUrl: articleUrl.trim(),
        video: video.trim(),
      };

      if (editing) {
        await updateProblem(problem._id, common);
        success(`Saved "${title.trim()}"`);
      } else {
        await addProblem({ ...common, url: url.trim(), notes, status });
        success(`Added "${title.trim()}"`);
      }
      onClose();
    } catch (err) {
      error(errorMessage(err, editing ? 'Could not save that' : 'Could not add that problem'));
    } finally {
      setSaving(false);
    }
  };

  const extras =
    topicTags.length + companies.length + (articleUrl ? 1 : 0) + (video ? 1 : 0) + (notes ? 1 : 0);

  return (
    <Modal
      title={editing ? 'Edit your problem' : 'Add a problem'}
      onClose={onClose}
      initialFocus={editing ? titleRef : urlRef}
    >
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Problem URL</span>
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={editing}
              placeholder="https://leetcode.com/problems/... or any other link"
            />
          </label>

          {editing ? (
            <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
              The link is fixed — your progress on this problem is filed under it. Delete and re-add
              if it points at the wrong thing.
            </p>
          ) : (
            (looking || note) && (
              <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
                {looking ? 'Looking it up...' : note}
              </p>
            )
          )}

          <label className="field">
            <span>Title</span>
            <input
              ref={titleRef}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Two Sum"
            />
          </label>

          <div className="field-row">
            {/* div, not label: a <label> only forwards its click to a form
                control, and the dropdown is a button. */}
            <div className="field">
              <span>Difficulty</span>
              <Dropdown
                ariaLabel="Difficulty"
                value={difficulty}
                onChange={setDifficulty}
                options={DIFFICULTY_OPTIONS}
              />
            </div>

            <div className="field" style={{ flex: 2 }}>
              <span>Pattern</span>
              <Dropdown
                ariaLabel="Pattern"
                value={patternSlug}
                onChange={setPatternSlug}
                options={patterns.map((p) => ({ value: p.slug, label: p.name }))}
              />
            </div>
          </div>

          <button type="button" className="disclosure" onClick={() => setMore((v) => !v)}>
            <span className={`chev ${more ? 'open' : ''}`}>
              <IconChevronRight size={12} />
            </span>
            More details
            {!more && extras > 0 && <span className="tag-mini">{extras} set</span>}
            {!more && extras === 0 && <span className="hint">optional</span>}
          </button>

          {more && (
            <div className="disclosure-body">
              <div className="field">
                <span>Topic tags</span>
                <TagInput
                  value={topicTags}
                  onChange={setTopicTags}
                  placeholder="Array, Hash Table..."
                />
              </div>

              <div className="field">
                <span>Asked at</span>
                <TagInput
                  value={companies}
                  onChange={setCompanies}
                  placeholder="Google, Amazon..."
                  suggestions={companySuggestions}
                />
              </div>

              <label className="field">
                <span>Editorial or article link</span>
                <input
                  value={articleUrl}
                  onChange={(e) => setArticleUrl(e.target.value)}
                  placeholder="https://takeuforward.org/..."
                />
              </label>

              <label className="field">
                <span>Video walkthrough</span>
                <input
                  value={video}
                  onChange={(e) => setVideo(e.target.value)}
                  placeholder="YouTube link"
                />
              </label>

              {/* Both live on Progress rather than on the problem, so they are
                  offered once — on the way in, for something you have already
                  solved. After that the row's own controls own them. */}
              {!editing && (
                <>
                  <div className="field">
                    <span>Status</span>
                    <Dropdown
                      ariaLabel="Status"
                      value={status}
                      onChange={setStatus}
                      options={STATUSES.map(([value, label]) => ({ value, label }))}
                    />
                  </div>

                  <label className="field">
                    <span>Notes</span>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      rows={3}
                      placeholder="Approach, edge cases, why it tripped you up..."
                    />
                  </label>
                </>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {editing
              ? saving
                ? 'Saving...'
                : 'Save changes'
              : saving
                ? 'Adding...'
                : 'Add problem'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
