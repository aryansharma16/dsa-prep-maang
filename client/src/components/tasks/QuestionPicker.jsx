import { useMemo, useRef, useState } from 'react';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { IconCheck, IconSearch } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Pick problems to hang off a task.
 *
 * `RoadmapContext` is mounted for every signed-in route, so all 429 problems
 * are a local array and this makes no request at all — the same trick the chat
 * composer's picker uses, and the reason `RoadmapProvider` sits above
 * everything in App.jsx.
 *
 * It differs from that one in the way that matters here: this is multi-select
 * and commits once. The sentence the feature exists for is "I'll do *these
 * three* today", and a picker that closes on the first tap makes saying it
 * three separate acts — each with its own round trip and its own chance to half
 * succeed.
 *
 * A Modal rather than the chat sheet, because this opens from a full-width
 * drawer and not from a 350px dock.
 */
export function QuestionPicker({ attached = [], onPick, onClose }) {
  const { groups } = useRoadmap();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState(() => new Set());
  const [saving, setSaving] = useState(false);
  const inputRef = useRef(null);

  const already = useMemo(
    () => new Set(attached.map((question) => String(question.problemId))),
    [attached],
  );

  /*
    Every match, grouped by pattern, with no cap — the same decision the chat
    picker documents. A list that stops at forty and does not say so reads as a
    roadmap with two patterns in it, and you cannot tell a missing problem from
    a missing feature.
  */
  const { sections, count } = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const out = [];
    let total = 0;

    for (const group of groups) {
      const matches = needle
        ? group.problems.filter((problem) =>
            [
              problem.title,
              group.name,
              ...(problem.topicTags || []),
              ...(problem.companies || []).map((company) => company.name),
            ]
              .join(' ')
              .toLowerCase()
              .includes(needle),
          )
        : group.problems;

      if (!matches.length) continue;
      total += matches.length;
      out.push({ slug: group.slug, name: group.name, problems: matches });
    }

    return { sections: out, count: total };
  }, [groups, query]);

  const toggle = (id) =>
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const commit = async () => {
    if (!picked.size) return;
    setSaving(true);
    try {
      await onPick([...picked]);
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal title="Add questions" size="lg" onClose={onClose} initialFocus={inputRef}>
      <div className="modal-body tk-pick-body">
        <label className="tk-pick-search">
          <IconSearch size={13} />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search problems…"
            aria-label="Search problems"
          />
          <span className="mono">{count}</span>
        </label>

        <div className="tk-pick">
          {count === 0 && <div className="empty">No problem matches that.</div>}

          {sections.map((section) => (
            <div key={section.slug}>
              <div className="tk-pick-head">
                {section.name}
                <span className="count">{section.problems.length}</span>
              </div>

              {section.problems.map((problem) => {
                const id = String(problem._id);
                const on = picked.has(id);
                const attachedAlready = already.has(id);

                return (
                  <button
                    key={id}
                    type="button"
                    className={`tk-pick-item ${on ? 'on' : ''}`}
                    disabled={attachedAlready}
                    aria-pressed={on}
                    onClick={() => toggle(id)}
                  >
                    <span className="tk-pick-box">{(on || attachedAlready) && <IconCheck size={10} />}</span>
                    <span className={`diff ${problem.difficulty}`}>{problem.difficulty[0]}</span>
                    <span className="nm">{problem.title}</span>
                    {attachedAlready ? (
                      <span className="tk-pick-note">added</span>
                    ) : (
                      problem.progress?.status === 'solved' && (
                        <span className="tk-pick-note solved">solved</span>
                      )
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="modal-foot">
        <span className="hint">
          {picked.size ? `${picked.size} selected` : 'Pick as many as the task covers'}
        </span>
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn primary"
          disabled={!picked.size || saving}
          onClick={commit}
        >
          {saving ? 'Adding…' : `Add ${picked.size || ''}`.trim()}
        </button>
      </div>
    </Modal>
  );
}
