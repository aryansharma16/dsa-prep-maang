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
 */
export function AddProblemModal({ onClose }) {
  const { groups, addProblem } = useRoadmap();
  const { success, error } = useToast();

  const [patterns, setPatterns] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [patternSlug, setPatternSlug] = useState('');
  const [topicTags, setTopicTags] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [articleUrl, setArticleUrl] = useState('');
  const [video, setVideo] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState('todo');

  const [more, setMore] = useState(false);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  const urlRef = useRef(null);

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
  useEffect(() => {
    if (!url.trim()) {
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
  }, [url]);

  const submit = async (e) => {
    e.preventDefault();
    if (!title.trim()) return error('Give the problem a title');
    setSaving(true);
    try {
      await addProblem({
        title: title.trim(),
        url: url.trim(),
        difficulty,
        patternSlug,
        topicTags,
        companies,
        articleUrl: articleUrl.trim(),
        video: video.trim(),
        notes,
        status,
      });
      success(`Added "${title.trim()}"`);
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not add that problem'));
    } finally {
      setSaving(false);
    }
  };

  const extras =
    topicTags.length + companies.length + (articleUrl ? 1 : 0) + (video ? 1 : 0) + (notes ? 1 : 0);

  return (
    <Modal title="Add a problem" onClose={onClose} initialFocus={urlRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Problem URL</span>
            <input
              ref={urlRef}
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://leetcode.com/problems/... or any other link"
            />
          </label>

          {(looking || note) && (
            <p className="hint" style={{ marginTop: -6, marginBottom: 12 }}>
              {looking ? 'Looking it up...' : note}
            </p>
          )}

          <label className="field">
            <span>Title</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Two Sum" />
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
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={saving}>
            {saving ? 'Adding...' : 'Add problem'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
