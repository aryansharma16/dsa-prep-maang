import { useEffect, useRef, useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { IconClose, IconExternal, IconPlus, IconTrash } from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { CompanyMark } from './CompanyMark.jsx';
import { OfferPanel } from './OfferPanel.jsx';
import { PostMortem } from './PostMortem.jsx';
import { ResumeField } from './ResumeField.jsx';
import { RoundList } from './RoundList.jsx';
import { Timeline } from './Timeline.jsx';
import { TouchpointList } from './TouchpointList.jsx';
import { ago, dateFromInput, dateInputValue } from './time.js';
import {
  ALL_STAGE_OPTIONS,
  APPLY_METHOD_OPTIONS,
  EMPLOYMENT_OPTIONS,
  PRIORITY_OPTIONS,
  SOURCE_OPTIONS,
  WORK_MODE_OPTIONS,
  stageHue,
  stageLabel,
} from './vocab.js';

/**
 * Everything about one application.
 *
 * A side drawer rather than a modal, for the reason the task board's is one:
 * the board is the context — which lane this is in, what else is in it — and a
 * centred dialog over a dimmed board throws that away to show one card. It also
 * lets the drawer stay open while the board behind it updates, which is what
 * makes logging six questions in a row feel like one action rather than six.
 *
 * It registers with `useDialog` all the same, so Escape closes it, focus is
 * trapped and restored, and the page's single-key shortcuts are suppressed
 * while it is open — otherwise typing an interview question would fire them.
 *
 * ---------------------------------------------------------------------------
 * This is the only place an application's fields are edited, and they are
 * edited in place. There is no edit dialog: `AddApplicationModal` creates and
 * nothing else, so there is exactly one surface that knows what a field is
 * called and what it accepts. Two forms over the same twenty fields is a pair
 * that drifts on the first one added to either.
 *
 * Three sections appear only when they have earned it — the offer panel past
 * Offer, the post-mortem once it is closed, the referral block once there is a
 * referrer. A form that showed all of it from the first keystroke would put
 * twelve empty inputs in front of somebody who typed a company name thirty
 * seconds ago.
 * ---------------------------------------------------------------------------
 */

/** Long enough to swallow a burst of typing, short enough to feel saved. */
const SAVE_DELAY = 600;

/** A row of one-click answers under a field. The one matching the current value is lit. */
function QuickChips({ chips, current, onPick }) {
  return (
    <span className="ap-quick">
      {chips.map(({ label, value }) => (
        <button
          key={label}
          type="button"
          className={`toggle-chip ${value === current ? 'on' : ''}`}
          onClick={() => onPick(value)}
        >
          {label}
        </button>
      ))}
    </span>
  );
}

/** Local midnight `days` from today, as the date input's `yyyy-mm-dd`. */
const dayOffset = (days) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return dateInputValue(date);
};

/*
  Applied-on is almost always today or a day or two back (logging last night's
  batch), and follow-up is almost always a fixed gap ahead. Chips make both one
  click instead of a trip through the calendar picker.
*/
const APPLIED_CHIPS = [
  ['Today', 0],
  ['Yesterday', -1],
  ['2 days ago', -2],
  ['Last week', -7],
];
const FOLLOW_UP_CHIPS = [
  ['In 3 days', 3],
  ['In a week', 7],
  ['In 2 weeks', 14],
];

/** A native date input with quick picks. Chips are rebuilt per render so "Today" never goes stale. */
function QuickDate({ label, value, chips, onChange, hint, clearable }) {
  const current = dateInputValue(value);
  const options = chips.map(([chipLabel, days]) => ({ label: chipLabel, value: dayOffset(days) }));
  return (
    <div className="field">
      <span>{label}</span>
      <input
        type="date"
        aria-label={label}
        value={current}
        onChange={(e) => onChange(dateFromInput(e.target.value))}
      />
      <QuickChips
        chips={clearable && current ? [...options, { label: 'Clear', value: '' }] : options}
        current={current}
        onPick={(picked) => onChange(dateFromInput(picked))}
      />
      {hint && <span className="field-hint">{hint}</span>}
    </div>
  );
}

const LEVEL_SUGGESTIONS = ['Intern', 'SDE-1', 'SDE-2', 'SDE-3'];
const SOURCE_NOTE_SUGGESTIONS = ['Instahyre', 'Wellfound', 'Cutshort', 'Hirist', 'Off-campus sheet'];
const ROLE_SUGGESTIONS = ['SDE-1', 'SDE-2', 'Senior SDE', 'EM', 'Recruiter'];

/** A text field that commits on a debounce. Everything else commits on change. */
function Debounced({ label, value, onCommit, hint, textarea, rows = 3, suggestions, ...rest }) {
  const [draft, setDraft] = useState(value || '');
  const committed = useRef(value || '');

  /* A value that changed elsewhere wins over an untouched local copy. */
  useEffect(() => {
    if ((value || '') !== committed.current) {
      committed.current = value || '';
      setDraft(value || '');
    }
  }, [value]);

  useEffect(() => {
    if (draft === committed.current) return undefined;
    const timer = setTimeout(() => {
      committed.current = draft;
      onCommit(draft);
    }, SAVE_DELAY);
    return () => clearTimeout(timer);
  }, [draft, onCommit]);

  /* Closing the drawer mid-debounce would otherwise drop the last few keystrokes. */
  const latest = useRef({ draft, onCommit });
  latest.current = { draft, onCommit };
  useEffect(
    () => () => {
      const { draft: pending, onCommit: commit } = latest.current;
      if (pending !== committed.current) commit(pending);
    },
    [],
  );

  return (
    <label className="field">
      <span>{label}</span>
      {textarea ? (
        <textarea rows={rows} value={draft} onChange={(e) => setDraft(e.target.value)} {...rest} />
      ) : (
        <input value={draft} onChange={(e) => setDraft(e.target.value)} {...rest} />
      )}
      {suggestions && (
        <QuickChips
          chips={suggestions.map((s) => ({ label: s, value: s }))}
          current={draft}
          onPick={(picked) => {
            // A click is a decision, not a burst of typing, so it saves now.
            committed.current = picked;
            setDraft(picked);
            onCommit(picked);
          }}
        />
      )}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

const TABS = [
  { key: 'timeline', label: 'Timeline' },
  { key: 'rounds', label: 'Rounds' },
  { key: 'details', label: 'Details' },
];

export function ApplicationDrawer({
  app,
  board,
  busy,
  onClose,
  onPatch,
  onStage,
  onDelete,
  rounds,
  questions,
  touchpoints,
  onPostMortem,
}) {
  const panelRef = useRef(null);
  const titleRef = useRef(null);
  const [tab, setTab] = useState('timeline');
  const [openRound, setOpenRound] = useState(null);

  useDialog(panelRef, { onClose, initialFocus: titleRef });

  const closed = ['rejected', 'ghosted', 'withdrawn', 'accepted'].includes(app.stage);
  const hasOffer = Boolean(app.reached?.offer) || Boolean(app.comp);

  /* A round named from the timeline opens the Rounds tab with it expanded. */
  const openFromTimeline = (roundId) => {
    setTab('rounds');
    setOpenRound(roundId);
  };

  return (
    <>
      {/* onClick, not onMouseDown: the press must blur the field you were in first, so it saves. */}
      <div className="ap-drawer-scrim" onClick={onClose} aria-hidden="true" />

      <aside className="ap-drawer" ref={panelRef} role="dialog" aria-label={app.company}>
        <header className="ap-drawer-head" data-hue={stageHue(app.stage)}>
          <CompanyMark company={app.company} slug={app.logoSlug} size={30} />

          <div className="ap-drawer-name">
            <input
              ref={titleRef}
              className="ap-drawer-title"
              defaultValue={app.company}
              maxLength={120}
              aria-label="Company"
              onBlur={(e) =>
                e.target.value.trim() &&
                e.target.value !== app.company &&
                onPatch({ company: e.target.value.trim() })
              }
            />
            <input
              className="ap-drawer-sub"
              defaultValue={app.role}
              maxLength={140}
              placeholder="What role?"
              aria-label="Role"
              onBlur={(e) => e.target.value !== app.role && onPatch({ role: e.target.value })}
            />
          </div>

          {/*
            Every stage, not just the ones in this lane. Dragging is the fast
            path and this is the precise one — it is how a card becomes
            `ghosted` rather than `rejected`, which are the same lane and very
            different facts about a channel.
          */}
          <Dropdown
            ariaLabel="Stage"
            className="ap-drawer-stage"
            value={app.stage}
            options={ALL_STAGE_OPTIONS}
            onChange={(stage) => onStage(stage)}
          />

          <button type="button" className="icon-btn" title="Close" onClick={onClose}>
            <IconClose size={14} />
          </button>
        </header>

        <nav className="ap-tabs" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.key}
              type="button"
              role="tab"
              aria-selected={tab === item.key}
              className={`ap-tab ${tab === item.key ? 'on' : ''}`}
              onClick={() => setTab(item.key)}
            >
              {item.label}
              {item.key === 'rounds' && app.roundCount > 0 && (
                <span className="mono">{app.roundCount}</span>
              )}
            </button>
          ))}
        </nav>

        <div className="ap-drawer-body">
          {tab === 'timeline' && (
            <>
              <Timeline rows={app.timeline || []} onOpenRound={openFromTimeline} />
              <TouchpointList
                touchpoints={app.touchpoints}
                busy={busy}
                onAdd={touchpoints.add}
                onRemove={touchpoints.remove}
              />
            </>
          )}

          {tab === 'rounds' && (
            <RoundList
              app={app}
              busy={busy}
              openRound={openRound}
              setOpenRound={setOpenRound}
              onAdd={rounds.add}
              onEdit={rounds.edit}
              onDelete={rounds.remove}
              onQuestion={questions}
            />
          )}

          {tab === 'details' && (
            <div className="ap-details">
              <div className="field-row">
                <Debounced
                  label="Team"
                  value={app.team}
                  maxLength={120}
                  placeholder="Payments, Ads Ranking…"
                  onCommit={(team) => onPatch({ team })}
                />
                <Debounced
                  label="Level"
                  value={app.level}
                  maxLength={60}
                  placeholder="SDE-1, L4…"
                  suggestions={LEVEL_SUGGESTIONS}
                  onCommit={(level) => onPatch({ level })}
                />
              </div>

              <div className="field-row">
                <Debounced
                  label="Location"
                  value={app.location}
                  maxLength={120}
                  placeholder="Bengaluru"
                  onCommit={(location) => onPatch({ location })}
                />
                <label className="field">
                  <span>Work mode</span>
                  <Dropdown
                    ariaLabel="Work mode"
                    value={app.workMode || ''}
                    options={WORK_MODE_OPTIONS}
                    onChange={(workMode) => onPatch({ workMode })}
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Kind of role</span>
                  <Dropdown
                    ariaLabel="Employment type"
                    value={app.employment || 'full_time'}
                    options={EMPLOYMENT_OPTIONS}
                    onChange={(employment) => onPatch({ employment })}
                  />
                </label>
                <label className="field">
                  <span>Priority</span>
                  <Dropdown
                    ariaLabel="Priority"
                    value={app.priority || 'none'}
                    options={PRIORITY_OPTIONS}
                    onChange={(priority) => onPatch({ priority })}
                  />
                </label>
              </div>

              <div className="field-row">
                <label className="field">
                  <span>Where you found it</span>
                  <Dropdown
                    ariaLabel="Source"
                    value={app.source}
                    options={SOURCE_OPTIONS}
                    onChange={(source) => onPatch({ source })}
                    searchable
                  />
                </label>
                <label className="field">
                  <span>How you applied</span>
                  <Dropdown
                    ariaLabel="How you applied"
                    value={app.applyMethod || ''}
                    options={APPLY_METHOD_OPTIONS}
                    onChange={(applyMethod) => onPatch({ applyMethod })}
                  />
                  {/* Its own axis, not a source value — see the vocabulary. */}
                  <span className="field-hint">
                    Easy Apply and their own portal are the sharpest cut in the report.
                  </span>
                </label>
              </div>

              <Debounced
                label="Which one"
                value={app.sourceNote}
                maxLength={200}
                placeholder="Instahyre, the off-campus sheet…"
                suggestions={SOURCE_NOTE_SUGGESTIONS}
                onCommit={(sourceNote) => onPatch({ sourceNote })}
              />

              <div className="field-row">
                <QuickDate
                  label="Applied on"
                  value={app.appliedAt}
                  chips={APPLIED_CHIPS}
                  onChange={(appliedAt) => onPatch({ appliedAt })}
                  hint="Every number in the report counts from this date, so set it if you are logging an old one."
                />
                <QuickDate
                  label="Follow up by"
                  value={app.followUpBy}
                  chips={FOLLOW_UP_CHIPS}
                  clearable
                  onChange={(followUpBy) => onPatch({ followUpBy })}
                  hint="Overdue ones show in the top bar."
                />
              </div>

              {/* --------------------------------------------------- links */}

              <section className="ap-links">
                <header className="ap-section-head">
                  <h3>Links</h3>
                </header>
                {(app.links || []).map((link, index) => (
                  <div key={`${link.url}-${index}`} className="ap-link-row">
                    <a href={link.url} target="_blank" rel="noreferrer noopener">
                      <IconExternal size={11} />
                      {link.label || link.url}
                    </a>
                    <button
                      type="button"
                      className="icon-btn"
                      title="Remove this link"
                      onClick={() =>
                        onPatch({ links: app.links.filter((_, i) => i !== index) })
                      }
                    >
                      <IconTrash size={11} />
                    </button>
                  </div>
                ))}
                <form
                  className="ap-link-add"
                  onSubmit={(event) => {
                    event.preventDefault();
                    const url = event.target.elements.url.value.trim();
                    if (!url) return;
                    onPatch({ links: [...(app.links || []), { label: '', url }] });
                    event.target.reset();
                  }}
                >
                  <IconPlus size={11} />
                  <input name="url" placeholder="Another link…" maxLength={2000} />
                </form>
              </section>

              {/* ------------------------------------------------- the CV */}

              {/*
                Which version went out, so "the backend one gets replies and the
                general one does not" is something the report can one day say
                rather than something you half-remember.
              */}
              <section className="ap-cv">
                <header className="ap-section-head">
                  <h3>CV you sent</h3>
                </header>
                <ResumeField
                  value={app.resume}
                  disabled={busy}
                  onChange={(resumeId) => onPatch({ resumeId })}
                />
              </section>

              {/* ----------------------------------------------- the people */}

              <section className="ap-people">
                <header className="ap-section-head">
                  <h3>Who you know there</h3>
                </header>

                <div className="field-row">
                  <Debounced
                    label="Referred by"
                    value={app.referrer?.name}
                    maxLength={120}
                    placeholder="Nobody"
                    hint="Filling this in is what counts this as a referral in the report."
                    onCommit={(name) =>
                      onPatch({
                        referrer: name.trim()
                          ? { ...(app.referrer || {}), name: name.trim() }
                          : null,
                      })
                    }
                  />
                  <Debounced
                    label="Their role there"
                    value={app.referrer?.title}
                    maxLength={120}
                    placeholder="SDE-2"
                    suggestions={app.referrer?.name ? ROLE_SUGGESTIONS : undefined}
                    onCommit={(title) =>
                      app.referrer && onPatch({ referrer: { ...app.referrer, title } })
                    }
                  />
                </div>

                {app.referred && (
                  <div className="field-row">
                    <Debounced
                      label="How you know them"
                      value={app.referrer?.relationship}
                      maxLength={200}
                      placeholder="College senior, ex-colleague, Twitter mutual…"
                      onCommit={(relationship) =>
                        onPatch({ referrer: { ...app.referrer, relationship } })
                      }
                    />
                    <Debounced
                      label="How to reach them"
                      value={app.referrer?.contact}
                      maxLength={200}
                      onCommit={(contact) => onPatch({ referrer: { ...app.referrer, contact } })}
                    />
                  </div>
                )}

                <div className="field-row">
                  <Debounced
                    label="Recruiter"
                    value={app.contact?.name}
                    maxLength={120}
                    onCommit={(name) =>
                      onPatch({
                        contact: name.trim()
                          ? { ...(app.contact || {}), name: name.trim() }
                          : null,
                      })
                    }
                  />
                  <Debounced
                    label="Their email"
                    value={app.contact?.email}
                    maxLength={200}
                    onCommit={(email) =>
                      app.contact && onPatch({ contact: { ...app.contact, email } })
                    }
                  />
                </div>
              </section>

              <Debounced
                label="Notes"
                value={app.notes}
                textarea
                rows={5}
                maxLength={8000}
                placeholder="Anything worth remembering about this one."
                onCommit={(notes) => onPatch({ notes })}
              />

              <Debounced
                label="The job description"
                value={app.jdText}
                textarea
                rows={5}
                maxLength={20000}
                placeholder="Paste it here — useful to re-read the night before a round."
                onCommit={(jdText) => onPatch({ jdText })}
              />

              <footer className="ap-drawer-danger">
                <span className="ap-muted">
                  Added {ago(app.createdAt)}
                  {app.lastActivityAt ? ` · last activity ${ago(app.lastActivityAt)}` : ''}
                </span>
                <button type="button" className="btn danger" onClick={onDelete}>
                  <IconTrash size={12} />
                  Delete
                </button>
              </footer>
            </div>
          )}

          {/*
            Outside the tabs on purpose. An offer and a post-mortem are the two
            things you open this drawer *for* once they exist, and burying
            either behind a tab would be filing the conclusion under details.
          */}
          {tab !== 'details' && hasOffer && (
            <OfferPanel
              comp={app.comp}
              defaultCurrency={board?.defaultCurrency}
              busy={busy}
              onSave={(patch) => onPatch({ comp: { ...(app.comp || {}), ...patch } })}
            />
          )}

          {tab !== 'details' && closed && (
            <PostMortem
              app={app}
              busy={busy}
              onSave={onPostMortem}
              onSaveApplication={onPatch}
            />
          )}
        </div>
      </aside>
    </>
  );
}
