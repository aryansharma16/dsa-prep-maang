import { useState } from 'react';

import { Dropdown } from '../ui/Dropdown.jsx';
import { CLOSED_REASON_OPTIONS, roundTypeLabel } from './vocab.js';

/**
 * Why it ended, written down while you still remember.
 *
 * Three fields, and the argument for keeping them three is the whole of this
 * screen:
 *
 *   the reason      a bucket, so the report can count it
 *   what they said  their words, verbatim — usually worthless
 *   what you think  the one sentence here worth re-reading in six months
 *
 * The last two are a pair, and collapsing them into one box loses the second
 * one. Given a single field labelled "reason", everybody types the rejection
 * email — it is right there, it sounds official, and it costs nothing. The
 * honest read only ever gets written if there is a box visibly not for their
 * answer sitting underneath it.
 *
 * The round picker stores the round's *type*, not its id, on the server. A
 * post-mortem that dangles when you delete the round it points at is a record
 * that corrupts itself; "died at the system design round" is still true after
 * the round is gone, and it is the fact the kill report counts anyway.
 */
export function PostMortem({ app, onSave, onSaveApplication, busy }) {
  const postMortem = app.postMortem;
  const [theirWord, setTheirWord] = useState(postMortem?.theirWord || '');
  const [myRead, setMyRead] = useState(postMortem?.myRead || '');

  const roundOptions = [
    { value: '', label: 'No particular round' },
    ...(app.rounds || []).map((round) => ({
      value: round.id,
      label: round.label || roundTypeLabel(round.type),
      note: round.label ? roundTypeLabel(round.type) : undefined,
    })),
  ];

  const save = (patch) =>
    onSave({
      roundId: postMortem?.roundId || null,
      theirWord,
      myRead,
      ...patch,
    });

  return (
    <section className="ap-postmortem">
      <header className="ap-section-head">
        <h3>What happened</h3>
      </header>

      <div className="field-row">
        <label className="field">
          <span>Why it ended</span>
          <Dropdown
            ariaLabel="Reason it closed"
            value={app.closedReason || ''}
            options={CLOSED_REASON_OPTIONS}
            onChange={(value) => onSaveApplication({ closedReason: value })}
          />
        </label>
        <label className="field">
          <span>Where it died</span>
          <Dropdown
            ariaLabel="The round it died at"
            value={postMortem?.roundId || ''}
            options={roundOptions}
            onChange={(value) => save({ roundId: value || null })}
          />
          {/*
            The round it names may since have been deleted, which is exactly
            what the stored snapshot is for — so this says the type in plain
            text rather than pretending there is something to click.
          */}
          {!postMortem?.roundId && postMortem?.roundType && (
            <span className="field-hint">
              Recorded as the {roundTypeLabel(postMortem.roundType)} round, which has since been
              deleted.
            </span>
          )}
        </label>
      </div>

      <label className="field">
        <span>What they said</span>
        <textarea
          rows={2}
          value={theirWord}
          maxLength={2000}
          disabled={busy}
          placeholder="Paste the rejection, or what the recruiter told you."
          onChange={(event) => setTheirWord(event.target.value)}
          onBlur={() => theirWord !== (postMortem?.theirWord || '') && save({ theirWord })}
        />
      </label>

      <label className="field">
        <span>What you think actually happened</span>
        <textarea
          rows={3}
          value={myRead}
          maxLength={2000}
          disabled={busy}
          placeholder="Be honest — this is the part you will come back and read."
          onChange={(event) => setMyRead(event.target.value)}
          onBlur={() => myRead !== (postMortem?.myRead || '') && save({ myRead })}
        />
      </label>
    </section>
  );
}
