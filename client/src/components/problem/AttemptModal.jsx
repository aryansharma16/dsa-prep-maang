import { useEffect, useMemo, useRef, useState } from 'react';
import { progressApi } from '../../api/index.js';
import { errorMessage } from '../../api/http.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';
import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { STATUS_HUES } from '../tasks/hues.js';
import { clock } from '../tasks/time.js';
import { IconClock, IconPause, IconPlay, IconRotate, IconTrash } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import {
  OUTCOMES,
  TIME_PRESETS,
  attemptStamp,
  editWindowLeft,
  isEditable,
  minutesLabel,
  outcomeOf,
  windowLabel,
} from './attempts.js';

/** Whole minutes, and never zero once the clock has actually run. */
const toMinutes = (seconds) => (seconds > 0 ? Math.max(1, Math.round(seconds / 60)) : 0);

/**
 * One sitting with a problem: the stopwatch that measured it, how it went, and
 * what you want to remember about it.
 *
 * This replaced a 210px popover with four chips and a button. The popover was
 * right about one thing and wrong about the rest: logging has to stay two taps
 * for the common case, which is why the presets and the outcome chips are still
 * the first things under your cursor and the dialog submits with the defaults
 * already filled in. Everything the popover could not hold — the clock, a note
 * per sitting, a colour for it, and the log of what happened last time — is
 * what makes the number worth logging at all, and none of it fits in a popover
 * anchored to a table cell.
 */
/**
 * @param store  The problem store this dialog writes through — `{ logAttempt,
 *   editAttempt, deleteAttempt, fetchAttempts }`. Defaults to the roadmap's,
 *   which is what every caller wanted while there was one problem set. The CP
 *   ladder passes its own: the dialog is identical, the collection behind it is
 *   not, and a shared modal that could only ever write to `Progress` would mean
 *   a second copy of this file rather than a prop.
 */
export function AttemptModal({ problem, onClose, store }) {
  /*
    Called unconditionally — hooks cannot be conditional, and RoadmapProvider
    wraps the whole authenticated tree, so this resolves on every route
    including /cp. `store` then overrides it where one was passed.
  */
  const roadmap = useRoadmap();
  const { logAttempt } = store || roadmap;
  const timer = useAttemptTimer();
  const onThisProblem = timer.isOn(problem._id);
  const seconds = onThisProblem ? timer.elapsed() : 0;
  const clockMinutes = toMinutes(seconds);

  const progress = problem.progress || {};
  /*
    `null` means the clock is the source of the number, which it is until you
    say otherwise: having gone to the trouble of timing yourself you should not
    then have to transcribe the result. Typing a number or tapping a preset
    takes it over — and `timed` comes off with it, because a measured minute and
    a guessed one are not the same evidence.

    Derived rather than mirrored into state, so a dialog left open while the
    clock runs logs what the clock says now and not what it said when it opened.
  */
  const [manual, setManual] = useState(() => (clockMinutes > 0 ? null : 30));
  const minutes = manual ?? clockMinutes;
  // Resetting the clock out from under an open dialog leaves nothing measured,
  // so the mark has to come off with it.
  const timed = manual === null && clockMinutes > 0;
  const [outcome, setOutcome] = useState('solved');
  const [confidence, setConfidence] = useState(progress.confidence ?? 3);
  const [note, setNote] = useState('');
  const [color, setColor] = useState('');
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setSaving(true);
    await logAttempt(problem._id, { minutes, outcome, confidence, note: note.trim(), color, timed });
    // The measurement has become an attempt, so the clock's job is done. Left
    // running it would be counted twice into the next one.
    if (onThisProblem) timer.reset();
    onClose();
  };

  const selected = outcomeOf(outcome);

  return (
    <Modal title={`Log an attempt — ${problem.title}`} size="xl" onClose={onClose}>
      <div className="modal-body att-body">
        <div className="att-form">
          <TimerPanel problem={problem} timer={timer} onThisProblem={onThisProblem} />

          <section className="att-block">
            <h4>Time spent</h4>
            <div className="chips att-times">
              {TIME_PRESETS.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`chip ${manual === t ? 'on' : ''}`}
                  onClick={() => setManual(t)}
                >
                  {t}m
                </button>
              ))}
              <span className="att-custom">
                <input
                  type="number"
                  min="0"
                  max="600"
                  value={minutes}
                  aria-label="Minutes spent"
                  onChange={(e) => setManual(Math.min(600, Math.max(0, +e.target.value || 0)))}
                />
                <span>min</span>
              </span>
              {timed && (
                <span className="att-timed-tag" title="Measured by the stopwatch, not estimated">
                  <IconClock size={11} /> timed
                </span>
              )}
              {/* The way back to the clock after you have typed over it. Only
                  offered when there is a clock to go back to. */}
              {manual !== null && clockMinutes > 0 && (
                <button type="button" className="link-btn att-usetimer" onClick={() => setManual(null)}>
                  use {clockMinutes}m from the clock
                </button>
              )}
            </div>
          </section>

          <section className="att-block">
            <h4>Outcome</h4>
            <div className="chips att-outcomes">
              {OUTCOMES.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`chip att-outcome ${option.tone} ${outcome === option.value ? 'on' : ''}`}
                  onClick={() => setOutcome(option.value)}
                  title={option.hint}
                >
                  {option.label}
                </button>
              ))}
            </div>
            {/* What the chip is about to do to the row, in words. Two of the
                five raise the revision flag, and that is not guessable from
                the label. */}
            <p className="att-hint">{selected.hint}</p>
          </section>

          <section className="att-block">
            <h4>How it feels now</h4>
            <ConfidenceDots value={confidence} onChange={setConfidence} />
            {/* It goes two places, and they are different facts. The row's copy
                is the current one the ladder multiplies by and gets overwritten
                every time; the attempt's stays where it was written, which is
                what turns the log into a series. */}
            <p className="att-hint">
              Kept on this attempt, and becomes the problem&rsquo;s — it is what
              stretches or shrinks the gap before this comes back.
            </p>
          </section>

          <section className="att-block">
            <h4>What happened</h4>
            <textarea
              className="att-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              maxLength={2000}
              placeholder="Where the time went, what you missed, what to try first next time..."
              spellCheck="false"
            />
            <HuePicker value={color} onChange={setColor} label="Colour this attempt" />
          </section>
        </div>

        <AttemptLog problem={problem} store={store} />
      </div>

      <div className="modal-foot">
        <span className="spacer" />
        <button type="button" className="btn" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn primary" onClick={submit} disabled={saving}>
          {saving ? 'Logging…' : 'Log attempt'}
        </button>
      </div>
    </Modal>
  );
}

/**
 * The stopwatch, in the dialog it feeds.
 *
 * It is deliberately not a clock that only exists here — starting it and
 * closing the dialog is the normal use, and the pill in the top bar is where it
 * is watched from. This panel is where it is started, banked and read off.
 */
function TimerPanel({ problem, timer, onThisProblem }) {
  const seconds = onThisProblem ? timer.elapsed() : 0;
  const elsewhere = Boolean(timer.timer) && !onThisProblem;

  return (
    <section className={`att-timer ${onThisProblem && timer.running ? 'live' : ''}`}>
      <span className="att-clock mono">{clock(seconds)}</span>

      <div className="att-timer-acts">
        {!onThisProblem && (
          <button
            type="button"
            className="btn sm"
            onClick={() => timer.start(problem._id, problem.title)}
          >
            <IconPlay size={10} /> Start
          </button>
        )}

        {onThisProblem && (
          <>
            <button
              type="button"
              className="btn sm"
              onClick={() => (timer.running ? timer.pause() : timer.resume())}
            >
              {timer.running ? <IconPause size={10} /> : <IconPlay size={10} />}
              {timer.running ? 'Pause' : 'Resume'}
            </button>
            <button type="button" className="btn sm" onClick={timer.reset} title="Throw it away">
              <IconRotate size={10} /> Reset
            </button>
          </>
        )}
      </div>

      {/* One clock, like the board's. Saying whose it is beats a second clock
          quietly replacing the first one you forgot about. */}
      {elsewhere && (
        <p className="att-hint att-elsewhere">
          Running on <b>{timer.timer.title}</b> — starting here replaces it.
        </p>
      )}
    </section>
  );
}

/** The swatch row, shared by the new attempt and by every row in the log. */
function HuePicker({ value, onChange, label }) {
  return (
    <div className="tk-hues att-hues" role="radiogroup" aria-label={label}>
      <button
        type="button"
        role="radio"
        aria-checked={!value}
        aria-label="No colour"
        title="No colour"
        className={`tk-hue att-hue-none ${!value ? 'on' : ''}`}
        onClick={() => onChange('')}
      />
      {STATUS_HUES.map((hue) => (
        <button
          key={hue}
          type="button"
          role="radio"
          aria-checked={value === hue}
          aria-label={hue}
          title={hue}
          data-hue={hue}
          className={`tk-hue ${value === hue ? 'on' : ''}`}
          onClick={() => onChange(hue)}
        />
      ))}
    </div>
  );
}

/**
 * The 1–5 row, used for the attempt being logged and for editing one already in
 * the log. `onChange(null)` clears it, because "I no longer think that was a 4"
 * is a different edit from leaving it alone.
 */
function ConfidenceDots({ value, onChange, clearable = false }) {
  return (
    <span className="confidence att-conf">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={`conf-dot ${value && n <= value ? 'on' : ''}`}
          onClick={() => onChange(clearable && value === n ? null : n)}
          title={`${n} of 5${clearable && value === n ? ' — click again to clear' : ''}`}
          aria-label={`Confidence ${n} of 5`}
        />
      ))}
    </span>
  );
}

/** The same dots, as a fact rather than a control. */
function ConfidenceRead({ value }) {
  if (!value) return null;
  return (
    <span className="conf att-item-conf" title={`Felt ${value} of 5 at the time`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <i key={n} className={n <= value ? 'on' : ''} />
      ))}
    </span>
  );
}

/**
 * Every sitting so far, newest first.
 *
 * Fetched rather than read off the roadmap: the table carries the last four
 * with their notes cut to 120 characters, which is a preview and not the thing
 * itself. Falls back to that preview while the request is in flight, so the
 * panel is never empty for a problem you know you have attempted.
 */
function AttemptLog({ problem, store }) {
  // Through the store rather than straight to the API, so the chips in the row
  // behind this dialog change with the log in front of it.
  const roadmap = useRoadmap();
  const { editAttempt, deleteAttempt, fetchAttempts } = store || roadmap;
  const [attempts, setAttempts] = useState(() => problem.progress?.recentAttempts || []);
  const [state, setState] = useState('loading');
  const [error, setError] = useState(null);
  const [editing, setEditing] = useState(null);
  const [confirming, setConfirming] = useState(null);
  /*
    Re-renders once a second so the countdown counts and the controls go away on
    the second they expire — and only while there is something still counting,
    so a log of settled attempts costs nothing. `now` is read into the render
    rather than compared in an effect, which is what keeps every row's label,
    its Edit button and the open editor deciding from one instant.
  */
  const [now, setNow] = useState(() => Date.now());
  const counting = attempts.some((a) => isEditable(a, now));

  useEffect(() => {
    if (!counting) return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [counting]);

  useEffect(() => {
    let live = true;
    (fetchAttempts ? fetchAttempts(problem._id) : progressApi.attempts(problem._id))
      .then((data) => {
        if (!live) return;
        setAttempts(data.attempts);
        setState('ready');
      })
      .catch((err) => {
        if (!live) return;
        setError(errorMessage(err, 'Could not load the log'));
        setState('ready');
      });
    return () => {
      live = false;
    };
  }, [problem._id]);

  const total = useMemo(() => attempts.reduce((n, a) => n + (a.minutes || 0), 0), [attempts]);

  /*
    The window can close while its editor is open. Shutting it is not tidiness —
    a textarea whose next blur will be refused is a textarea that quietly eats
    what you typed into it.

    Adjusted during render rather than in an effect, which is React's own answer
    for state that has to follow something else: an effect runs after paint, so
    the editor would be visible for a frame after it stopped working. The guard
    is what stops it looping — once `editing` is null the branch is dead.
  */
  const openAttempt = attempts.find((a) => a._id === editing);
  if (editing && (!openAttempt || !isEditable(openAttempt, now))) {
    setEditing(null);
    setConfirming(null);
  }

  const save = async (attemptId, patch) => {
    const before = attempts;
    // Optimistic, and the editor stays open — a colour is one tap and you are
    // usually about to pick a different one.
    setAttempts((rows) => rows.map((a) => (a._id === attemptId ? { ...a, ...patch } : a)));
    setError(null);
    try {
      // Replaced by what the server stored, not left on what was asked for.
      const saved = await editAttempt(problem._id, attemptId, patch);
      setAttempts(saved.attempts || []);
    } catch (err) {
      setAttempts(before);
      setError(errorMessage(err, 'Could not save that edit'));
    }
  };

  const remove = async (attemptId) => {
    const before = attempts;
    setAttempts((rows) => rows.filter((a) => a._id !== attemptId));
    setConfirming(null);
    setEditing(null);
    setError(null);
    try {
      const saved = await deleteAttempt(problem._id, attemptId);
      setAttempts(saved.attempts || []);
    } catch (err) {
      setAttempts(before);
      setError(errorMessage(err, 'Could not delete that attempt'));
    }
  };

  return (
    <aside className="att-log">
      <header className="att-log-head">
        <h4>Attempt log</h4>
        {attempts.length > 0 && (
          <span className="att-log-total mono">
            {attempts.length} · {minutesLabel(total)}
          </span>
        )}
      </header>

      {error && <div className="alert">{error}</div>}

      {!attempts.length && (
        <p className="att-empty">
          {state === 'loading' ? 'Loading…' : 'Nothing logged yet. The first one goes in here.'}
        </p>
      )}

      <ol className="att-list">
        {[...attempts].reverse().map((attempt, i) => {
          /*
            Half an hour from logging, and then the sitting is a record rather
            than a draft — see server/src/config/attempts.js. Attempts written
            before this shipped have no id to address and no `loggedAt` to
            measure from, and land on the same side of the same rule.
          */
          const left = editWindowLeft(attempt, now);
          const editable = isEditable(attempt, now);
          const open = editable && editing === attempt._id;
          /*
            Two ways to be locked, and they need different explanations. The
            ordinary one is the window running out. The other is an attempt with
            no id — written by a server from before attempts had them — which
            cannot be addressed however new it is, and on screen is a lock with a
            deadline that has not passed sitting next to it. That reads as a
            broken clock, so it says which it is.
          */
          const unaddressable = !attempt._id && left > 0;

          return (
            <li
              key={attempt._id || `legacy-${i}`}
              className="att-item"
              data-hue={attempt.color || undefined}
            >
              <div className="att-item-head">
                <span className="att-item-when">{attemptStamp(attempt.at)}</span>
                <span className={`att-outcome-pill ${outcomeOf(attempt.outcome).tone}`}>
                  {outcomeOf(attempt.outcome).short}
                </span>
                <ConfidenceRead value={attempt.confidence} />
                <span className="att-item-mins mono" title={attempt.timed ? 'Timed' : 'Estimated'}>
                  {attempt.timed && <IconClock size={10} />}
                  {minutesLabel(attempt.minutes)}
                </span>
                {editable ? (
                  <>
                    {/* The countdown is the whole explanation of why the button
                        beside it is about to vanish. Without it the control
                        simply disappears and reads as a bug. */}
                    <span className="att-item-window" title="How long this attempt can still be changed">
                      {windowLabel(left)}
                    </span>
                    <button
                      type="button"
                      className="link-btn att-item-edit"
                      onClick={() => setEditing(open ? null : attempt._id)}
                    >
                      {open ? 'Done' : 'Edit'}
                    </button>
                  </>
                ) : (
                  <span
                    className="att-item-locked"
                    title={
                      unaddressable
                        ? 'Logged before attempts carried ids, so there is nothing to address it by. Run `npm run migrate:attempt-ids` in server/ to unlock it.'
                        : 'Attempts can be changed for 30 minutes after they are logged'
                    }
                  >
                    locked
                  </span>
                )}
              </div>

              {open ? (
                <AttemptEditor
                  attempt={attempt}
                  onSave={(patch) => save(attempt._id, patch)}
                  confirming={confirming === attempt._id}
                  onAskDelete={() => setConfirming(attempt._id)}
                  onCancelDelete={() => setConfirming(null)}
                  onDelete={() => remove(attempt._id)}
                />
              ) : (
                attempt.note && <p className="att-item-note">{attempt.note}</p>
              )}
            </li>
          );
        })}
      </ol>
    </aside>
  );
}

/**
 * Re-annotating one sitting after the fact, and taking it back out.
 *
 * What was worth writing down about an attempt is usually clear only after the
 * next one — the log is a record you keep, not a form you filled in once.
 *
 * Delete asks first, inline. A confirmation dialog on top of this one would be
 * a second overlay over a panel you can already see, for an action that removes
 * one row from a list in front of you.
 */
function AttemptEditor({ attempt, onSave, confirming, onAskDelete, onCancelDelete, onDelete }) {
  const [note, setNote] = useState(attempt.note || '');
  const area = useRef(null);

  useEffect(() => {
    area.current?.focus();
  }, []);

  return (
    <div className="att-edit">
      <textarea
        ref={area}
        value={note}
        maxLength={2000}
        onChange={(e) => setNote(e.target.value)}
        onBlur={() => note !== (attempt.note || '') && onSave({ note })}
        placeholder="What happened this time..."
        spellCheck="false"
      />

      <div className="att-edit-row">
        <span className="att-edit-label">Felt</span>
        <ConfidenceDots
          value={attempt.confidence}
          onChange={(confidence) => onSave({ confidence })}
          clearable
        />
      </div>

      {/* Saves on the click rather than waiting for a Save button: a colour is
          one tap and the result is visible on the row behind it. */}
      <HuePicker
        value={attempt.color || ''}
        onChange={(color) => onSave({ color })}
        label="Colour this attempt"
      />

      <div className="att-edit-foot">
        {confirming ? (
          <>
            <span className="att-edit-label">Delete this attempt?</span>
            <button type="button" className="link-btn danger" onClick={onDelete}>
              Delete
            </button>
            <button type="button" className="link-btn" onClick={onCancelDelete}>
              Keep
            </button>
          </>
        ) : (
          <button type="button" className="link-btn att-delete" onClick={onAskDelete}>
            <IconTrash size={11} /> Delete this attempt
          </button>
        )}
      </div>
    </div>
  );
}
