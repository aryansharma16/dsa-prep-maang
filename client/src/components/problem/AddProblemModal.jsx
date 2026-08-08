import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { problemsApi } from '../../api/index.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * One URL field. Paste a LeetCode link and everything fills itself in; paste
 * anything else (GfG, InterviewBit, a blog) and you fill three short fields.
 */
export function AddProblemModal({ onClose }) {
  const { addProblem } = useRoadmap();
  const { success, error } = useToast();

  // Fetched rather than derived from the loaded problems, so a pattern that
  // happens to contain nothing still shows up as a destination.
  const [patterns, setPatterns] = useState([]);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState('Medium');
  const [patternSlug, setPatternSlug] = useState('');
  const [topicTags, setTopicTags] = useState([]);
  const [looking, setLooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [note, setNote] = useState('');
  // Land on the URL field, not the dialog's close button — pasting a link is
  // the whole point of this dialog.
  const urlRef = useRef(null);

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
      });
      success(`Added "${title.trim()}"`);
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not add that problem'));
    } finally {
      setSaving(false);
    }
  };

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

            <div style={{ display: 'flex', gap: 10 }}>
              <label className="field" style={{ flex: 1 }}>
                <span>Difficulty</span>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
                  <option>Easy</option>
                  <option>Medium</option>
                  <option>Hard</option>
                </select>
              </label>

              <label className="field" style={{ flex: 2 }}>
                <span>Pattern</span>
                <select value={patternSlug} onChange={(e) => setPatternSlug(e.target.value)}>
                  {patterns.map((p) => (
                    <option key={p.slug} value={p.slug}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {topicTags.length > 0 && (
              <p className="hint">Tags: {topicTags.join(', ')}</p>
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
