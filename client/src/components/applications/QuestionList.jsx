import { useEffect, useRef, useState } from 'react';

import { IconChevronRight, IconPlus, IconTrash } from '../ui/Icons.jsx';
import { RATING_OPTIONS, ratingHue, ratingLabel } from './vocab.js';

/**
 * The questions you were asked, and what you said.
 *
 * This is the screen the module exists for, and it is used exactly once per
 * round: in the ten minutes after an interview, while you can still remember,
 * against a clock in your head that says this is not worth the effort. So the
 * whole design is about the cost of the *second* question.
 *
 * Type the question, press Enter, and the next empty row is focused with the
 * question already saved. That is the whole interaction. Grading it and writing
 * down what you answered are deliberately separate, later, optional acts —
 * a form that asked for all three before it would accept anything would mean
 * you log two questions instead of nine, and nine half-filled rows are worth
 * more than two complete ones.
 *
 * Which is also why the rating starts empty rather than at a default. An
 * ungraded question and one you blanked on are the two facts this field exists
 * to keep apart, and a default would quietly turn every row you did not get to
 * into one of them.
 */

function QuestionRow({ question, index, onChange, onRemove, busy }) {
  const [open, setOpen] = useState(false);
  const [answer, setAnswer] = useState(question.answer || '');
  const [notes, setNotes] = useState(question.notes || '');

  /* A save from elsewhere — another tab, a discarded draft — should win over an
     untouched local copy, the way the drawer's fields do. */
  useEffect(() => setAnswer(question.answer || ''), [question.answer]);
  useEffect(() => setNotes(question.notes || ''), [question.notes]);

  const commit = (patch) => onChange(question.id, patch);

  return (
    <li className={`ap-q ${open ? 'is-open' : ''}`} data-hue={ratingHue(question.rating)}>
      <div className="ap-q-head">
        <span className="ap-q-n mono">{index + 1}</span>

        <input
          className="ap-q-text"
          defaultValue={question.text}
          maxLength={600}
          aria-label="The question"
          onBlur={(event) => {
            const value = event.target.value.trim();
            if (value && value !== question.text) commit({ text: value });
          }}
        />

        {/*
          The rating is four buttons rather than a dropdown, and it is the one
          place in the module that is not a `Dropdown`. Four values that are
          each one word, set in a run of nine rows, on a screen whose entire
          purpose is speed — a menu here would be two clicks where the point is
          none.
        */}
        <span className="ap-q-rate" role="group" aria-label="How it went">
          {RATING_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              className={`ap-rate ${question.rating === option.value ? 'on' : ''}`}
              data-hue={ratingHue(option.value)}
              title={option.note ? `${option.label} — ${option.note}` : option.label}
              aria-pressed={question.rating === option.value}
              disabled={busy}
              onClick={() =>
                commit({ rating: question.rating === option.value ? '' : option.value })
              }
            >
              {option.label}
            </button>
          ))}
        </span>

        <button
          type="button"
          className={`icon-btn ap-q-toggle ${open ? 'on' : ''}`}
          aria-expanded={open}
          title={open ? 'Hide your answer' : 'Write down what you said'}
          onClick={() => setOpen((value) => !value)}
        >
          <IconChevronRight size={12} />
        </button>

        <button
          type="button"
          className="icon-btn"
          title="Remove this question"
          disabled={busy}
          onClick={() => onRemove(question.id)}
        >
          <IconTrash size={12} />
        </button>
      </div>

      {open && (
        <div className="ap-q-body">
          <label className="field">
            <span>What you answered</span>
            <textarea
              rows={4}
              value={answer}
              maxLength={4000}
              placeholder="The approach you gave, how far you got, where it fell apart…"
              onChange={(event) => setAnswer(event.target.value)}
              onBlur={() => answer !== (question.answer || '') && commit({ answer })}
            />
          </label>
          <label className="field">
            <span>Notes</span>
            <input
              value={notes}
              maxLength={1000}
              placeholder="What you'd do differently"
              onChange={(event) => setNotes(event.target.value)}
              onBlur={() => notes !== (question.notes || '') && commit({ notes })}
            />
          </label>
        </div>
      )}
    </li>
  );
}

export function QuestionList({ questions = [], onAdd, onChange, onRemove, busy }) {
  const [draft, setDraft] = useState('');
  const inputRef = useRef(null);

  const submit = (event) => {
    event.preventDefault();
    const text = draft.trim();
    if (!text) return;
    onAdd(text);
    setDraft('');
    /* Focus never leaves. The next question is already being remembered. */
    inputRef.current?.focus();
  };

  return (
    <div className="ap-questions">
      {questions.length > 0 && (
        <ol className="ap-q-list">
          {questions.map((question, index) => (
            <QuestionRow
              key={question.id}
              question={question}
              index={index}
              onChange={onChange}
              onRemove={onRemove}
              busy={busy}
            />
          ))}
        </ol>
      )}

      <form className="ap-q-add" onSubmit={submit}>
        <IconPlus size={12} />
        <input
          ref={inputRef}
          value={draft}
          maxLength={600}
          placeholder={
            questions.length ? 'And the next one…' : 'What did they ask? Enter to add another'
          }
          onChange={(event) => setDraft(event.target.value)}
        />
        {draft.trim() && (
          <button type="submit" className="btn sm" disabled={busy}>
            Add
          </button>
        )}
      </form>

      {questions.length > 0 && (
        <p className="ap-q-hint ap-muted">
          {questions.filter((question) => question.rating).length} of {questions.length} graded.
          Open a row to write down what you said.
        </p>
      )}
    </div>
  );
}

export { ratingLabel };
