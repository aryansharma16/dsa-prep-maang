import { useEffect, useRef, useState } from 'react';
import { PRIORITY_OPTIONS } from '../../filters/tasks.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import {
  IconCheck,
  IconClose,
  IconExternal,
  IconPaperclip,
  IconPlus,
  IconTrash,
} from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { AttachmentGrid } from './AttachmentGrid.jsx';
import { DeadlineField } from './DeadlineField.jsx';
import { QuestionPicker } from './QuestionPicker.jsx';
import { SessionList } from './SessionList.jsx';
import { SubtaskList } from './SubtaskList.jsx';
import { TimerButton } from './TimerButton.jsx';

/**
 * Everything about one task.
 *
 * A side drawer rather than a modal. The board is the context — which column
 * this is in, what else is in it — and a centred dialog over a dimmed board
 * throws that away to show one card. It also means the drawer can stay open
 * while the board behind it updates, which is what makes ticking four subtasks
 * in a row feel like one action.
 *
 * It registers with `useDialog` all the same, so Escape closes it, focus is
 * trapped and restored, and the page's single-key shortcuts are suppressed
 * while it is open — otherwise typing a subtask title would fire them.
 */

/** Long enough to swallow a burst of typing, short enough to feel saved. */
const SAVE_DELAY = 600;

export function TaskDrawer({
  task,
  statuses,
  solved,
  onClose,
  onPatch,
  onDelete,
  onSubtaskAdd,
  onSubtaskToggle,
  onSubtaskRemove,
  onQuestionsAdd,
  onQuestionRemove,
  onUpload,
  onAttachmentRemove,
  onSessionAdd,
  onSessionRemove,
  onChange,
}) {
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const { groups } = useRoadmap();

  const [picking, setPicking] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  useDialog(panelRef, { onClose, initialFocus: titleRef });

  /*
    Title and notes are edited locally and pushed on a debounce, like the
    problem notes panel. Every other field commits on the spot, because every
    other field is a single click and there is no burst to absorb.
  */
  const [draft, setDraft] = useState({ title: task.title, notes: task.notes });
  const saved = useRef({ title: task.title, notes: task.notes });

  // A different task in the same drawer is a different document, not an edit.
  useEffect(() => {
    setDraft({ title: task.title, notes: task.notes });
    saved.current = { title: task.title, notes: task.notes };
  }, [task.id]);

  useEffect(() => {
    const changed = {};
    if (draft.title.trim() && draft.title !== saved.current.title) changed.title = draft.title.trim();
    if (draft.notes !== saved.current.notes) changed.notes = draft.notes;
    if (!Object.keys(changed).length) return undefined;

    const timer = setTimeout(() => {
      saved.current = { ...saved.current, ...changed };
      onPatch(changed);
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, onPatch]);

  const status = statuses.find((entry) => String(entry.id) === String(task.status));

  /** A linked question, plus whatever the roadmap currently knows about it. */
  const liveQuestion = (question) => {
    for (const group of groups) {
      const found = (group.problems || []).find(
        (problem) => String(problem._id) === String(question.problemId),
      );
      if (found) return { ...question, url: found.url, gone: false };
    }
    // Deleted from the roadmap since it was attached. The snapshot is still
    // shown — that is what it is for — but there is nothing to link to.
    return { ...question, url: '', gone: true };
  };

  const upload = async (files) => {
    setUploading(true);
    setProgress(0);
    try {
      await onUpload(files, setProgress);
    } finally {
      setUploading(false);
    }
  };

  /*
    A pasted screenshot is the shortest path from a failing test to this task.

    Through a ref so the listener is attached once rather than swapped on every
    render — `upload` closes over props that change identity constantly, and
    binding it directly would mean an add/remove pair per keystroke in the
    title.
  */
  const uploadRef = useRef(upload);
  uploadRef.current = upload;

  useEffect(() => {
    const node = panelRef.current;
    if (!node) return undefined;

    const onPaste = (event) => {
      const files = [...(event.clipboardData?.files || [])];
      if (!files.length) return;
      event.preventDefault();
      uploadRef.current(files);
    };

    node.addEventListener('paste', onPaste);
    return () => node.removeEventListener('paste', onPaste);
  }, []);

  return (
    <>
      <div className="tk-drawer-scrim" onMouseDown={onClose} />
      <aside
        className="tk-drawer"
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={task.title}
        tabIndex={-1}
      >
        <header className="tk-drawer-head">
          <span className="tk-drawer-status" data-hue={status?.hue}>
            <i className="tk-dot" aria-hidden="true" />
            {status?.name}
          </span>
          <span className="spacer" />
          <TimerButton task={task} size="lg" onChange={onChange} />
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </header>

        <div className="tk-drawer-body">
          <textarea
            ref={titleRef}
            className="tk-drawer-title"
            value={draft.title}
            rows={1}
            maxLength={200}
            aria-label="Title"
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            onKeyDown={(event) => event.key === 'Enter' && event.preventDefault()}
          />

          <div className="tk-fields">
            <label className="tk-field">
              <span>Column</span>
              <Dropdown
                ariaLabel="Column"
                value={String(task.status)}
                options={statuses.map((entry) => ({ value: String(entry.id), label: entry.name }))}
                onChange={(value) => onPatch({ status: value })}
              />
            </label>

            <label className="tk-field">
              <span>Priority</span>
              <Dropdown
                ariaLabel="Priority"
                value={task.priority}
                options={PRIORITY_OPTIONS}
                onChange={(value) => onPatch({ priority: value })}
              />
            </label>
          </div>

          <section className="tk-section">
            <h4>Deadline</h4>
            <DeadlineField value={task.dueAt} onChange={(value) => onPatch({ dueAt: value })} />
          </section>

          <section className="tk-section">
            <h4>Notes</h4>
            <textarea
              className="tk-drawer-notes"
              value={draft.notes}
              rows={3}
              maxLength={4000}
              placeholder="What is this, and what does done look like?"
              aria-label="Notes"
              onChange={(event) => setDraft((prev) => ({ ...prev, notes: event.target.value }))}
            />
          </section>

          <section className="tk-section">
            <h4>
              Questions
              <button type="button" className="link-btn" onClick={() => setPicking(true)}>
                <IconPlus size={11} />
                Add
              </button>
            </h4>

            {task.questions.length === 0 ? (
              <p className="hint dim">
                Nothing attached. Pull in the problems this task is about — they tick themselves off
                as you solve them on the roadmap.
              </p>
            ) : (
              <ul className="tk-questions">
                {task.questions.map(liveQuestion).map((question) => {
                  const isSolved = solved.has(String(question.problemId));
                  return (
                    <li key={question.problemId} className={isSolved ? 'solved' : ''}>
                      <span className="tk-q-tick" aria-hidden="true">
                        {isSolved && <IconCheck size={10} />}
                      </span>
                      <span className={`diff ${question.difficulty}`}>
                        {question.difficulty?.[0] || '?'}
                      </span>
                      <span className="nm">{question.title}</span>
                      {question.gone && (
                        <span className="tag-mini" title="No longer on your roadmap">
                          removed
                        </span>
                      )}
                      {question.url && (
                        <a
                          href={question.url}
                          target="_blank"
                          rel="noreferrer"
                          className="icon-btn"
                          aria-label={`Open ${question.title}`}
                        >
                          <IconExternal size={11} />
                        </a>
                      )}
                      <button
                        type="button"
                        className="icon-btn"
                        aria-label={`Remove ${question.title}`}
                        onClick={() => onQuestionRemove(question.problemId)}
                      >
                        <IconTrash size={11} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <section className="tk-section">
            <h4>Subtasks</h4>
            <SubtaskList
              subtasks={task.subtasks}
              onAdd={onSubtaskAdd}
              onToggle={onSubtaskToggle}
              onRemove={onSubtaskRemove}
            />
          </section>

          <section className="tk-section">
            <h4>
              <IconPaperclip size={12} />
              Attachments
            </h4>
            <AttachmentGrid
              attachments={task.attachments}
              onUpload={upload}
              onRemove={onAttachmentRemove}
              busy={uploading}
              progress={progress}
            />
          </section>

          <section className="tk-section">
            <h4>Time</h4>
            <SessionList
              sessions={task.sessions}
              total={task.trackedSeconds}
              onAdd={onSessionAdd}
              onRemove={onSessionRemove}
            />
          </section>

          <div className="tk-drawer-foot">
            <button type="button" className="link-btn danger" onClick={onDelete}>
              <IconTrash size={12} />
              Delete this task
            </button>
          </div>
        </div>
      </aside>

      {picking && (
        <QuestionPicker
          attached={task.questions}
          onPick={onQuestionsAdd}
          onClose={() => setPicking(false)}
        />
      )}
    </>
  );
}
