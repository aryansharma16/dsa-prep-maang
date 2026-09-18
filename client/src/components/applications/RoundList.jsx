import { useState } from 'react';

import { IconChevronRight, IconClock, IconEdit, IconPlus, IconTrash, IconUsers } from '../ui/Icons.jsx';
import { QuestionList } from './QuestionList.jsx';
import { roundWhen, stamp } from './time.js';
import { modeLabel, outcomeHue, outcomeLabel, roundTypeLabel } from './vocab.js';

/**
 * The loop, in the order the company put it in.
 *
 * Sorted by `order` and never by date, which is the one thing about this list
 * worth stating. They are different facts and both are right: a round logged
 * retroactively, a round moved two weeks later, an assessment that sat unopened
 * for a fortnight. Sorting by date would reorder somebody's loop because they
 * rescheduled one call — the timeline next door is the view that reads by date,
 * and it is a separate view for exactly this reason.
 *
 * A round opens in place rather than in a dialog. Logging questions is the
 * thing you came here to do, and putting it behind a second overlay would mean
 * the screen you use most is the one furthest away.
 */
function Round({ app, round, open, onToggle, onEdit, onDelete, onQuestion, busy }) {
  const questions = round.questions || [];
  const graded = questions.filter((question) => question.rating).length;

  return (
    <li className={`ap-round ${open ? 'is-open' : ''}`} data-hue={outcomeHue(round.outcome)}>
      <div className="ap-round-head">
        <button
          type="button"
          className="ap-round-toggle"
          aria-expanded={open}
          onClick={onToggle}
        >
          <IconChevronRight size={12} className="ap-round-caret" />
          <i className="ap-dot" aria-hidden="true" />
          <span className="ap-round-name">
            <strong>{round.label || roundTypeLabel(round.type)}</strong>
            {round.label && <span className="ap-muted">{roundTypeLabel(round.type)}</span>}
          </span>
        </button>

        <span className="ap-round-meta">
          {round.scheduledAt && (
            <span className="ap-round-when" title={stamp(round.scheduledAt)}>
              {roundWhen(round.scheduledAt)}
            </span>
          )}
          <span className="ap-chip ap-chip-outcome" data-hue={outcomeHue(round.outcome)}>
            {outcomeLabel(round.outcome)}
          </span>
          {questions.length > 0 && (
            <span className="ap-chip ap-chip-quiet" title={`${graded} graded`}>
              {questions.length} Q
            </span>
          )}
        </span>

        <span className="ap-round-tools">
          <button type="button" className="icon-btn" title="Edit this round" onClick={onEdit}>
            <IconEdit size={12} />
          </button>
          <button
            type="button"
            className="icon-btn"
            title="Delete this round"
            disabled={busy}
            onClick={onDelete}
          >
            <IconTrash size={12} />
          </button>
        </span>
      </div>

      {open && (
        <div className="ap-round-body">
          {(round.mode || round.durationMinutes || round.rescheduledCount > 0) && (
            <p className="ap-round-facts">
              {round.mode && <span>{modeLabel(round.mode)}</span>}
              {round.durationMinutes ? (
                <span>
                  <IconClock size={11} /> {round.durationMinutes} min
                </span>
              ) : null}
              {/*
                Three reschedules is a company telling you something, and
                nothing else on the page records it. It costs one push on the
                write that moved the date.
              */}
              {round.rescheduledCount > 0 && (
                <span className="ap-warn">
                  moved {round.rescheduledCount}{' '}
                  {round.rescheduledCount === 1 ? 'time' : 'times'}
                </span>
              )}
            </p>
          )}

          {round.interviewers?.length > 0 && (
            <p className="ap-round-facts">
              <IconUsers size={11} />
              {round.interviewers
                .map((person) => [person.name, person.title].filter(Boolean).join(', '))
                .join(' · ')}
            </p>
          )}

          {round.notes && <p className="ap-round-notes">{round.notes}</p>}

          <QuestionList
            questions={questions}
            busy={busy}
            onAdd={(text) => onQuestion.add(round.id, text)}
            onChange={(questionId, patch) => onQuestion.update(round.id, questionId, patch)}
            onRemove={(questionId) => onQuestion.remove(round.id, questionId)}
          />
        </div>
      )}
    </li>
  );
}

export function RoundList({ app, onAdd, onEdit, onDelete, onQuestion, busy, openRound, setOpenRound }) {
  const [localOpen, setLocalOpen] = useState(null);
  const current = openRound ?? localOpen;
  const toggle = (id) => {
    const next = current === id ? null : id;
    setOpenRound ? setOpenRound(next) : setLocalOpen(next);
  };

  const rounds = app.rounds || [];

  return (
    <section className="ap-rounds">
      <header className="ap-section-head">
        <h3>Rounds</h3>
        <button type="button" className="btn sm" onClick={() => onAdd()}>
          <IconPlus size={11} />
          Add round
        </button>
      </header>

      {rounds.length ? (
        <ol className="ap-round-list">
          {rounds.map((round) => (
            <Round
              key={round.id}
              app={app}
              round={round}
              open={current === round.id}
              busy={busy}
              onToggle={() => toggle(round.id)}
              onEdit={() => onEdit(round)}
              onDelete={() => onDelete(round)}
              onQuestion={onQuestion}
            />
          ))}
        </ol>
      ) : (
        <div className="ap-empty-inline">
          <p>No rounds yet.</p>
          <p className="ap-muted">
            When they call, add the round — then log what they asked while you still remember it.
          </p>
        </div>
      )}
    </section>
  );
}
