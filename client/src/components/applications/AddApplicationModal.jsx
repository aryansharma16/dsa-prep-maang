import { useEffect, useRef, useState } from 'react';

import { applicationsApi } from '../../api/index.js';
import { Dropdown } from '../ui/Dropdown.jsx';
import { Modal } from '../ui/Modal.jsx';
import { ResumeField } from './ResumeField.jsx';
import {
  ALL_STAGE_OPTIONS,
  APPLY_METHOD_OPTIONS,
  METHOD_HINTS,
  METHOD_MATTERS,
  SOURCE_OPTIONS,
  readLink,
  stageLabel,
} from './vocab.js';
import { dayStamp } from './time.js';

/**
 * Adding an application.
 *
 * Create only — editing happens inline in the drawer, on the fields themselves.
 * Two surfaces that both edit the same twenty fields is a pair that drifts, and
 * the two jobs are not alike anyway: creating is a thirty-second act you repeat
 * five times in an evening, and editing is something you do to one field at a
 * time, weeks later, with the record open in front of you.
 *
 * So this asks for as little as it can get away with. The company name is the
 * only required field; everything else is optional here and fill-as-you-learn
 * afterwards. A form that demanded a role, a level, a location and a source
 * before it would accept anything is a form that gets used twice.
 *
 * The link paste is the one piece of cleverness, and the same one
 * `AddProblemModal` plays with a LeetCode URL: most of what you know when you
 * create a card is already in the link you just copied. It only ever pre-fills
 * — nothing it guesses is locked, and an unrecognised host fills nothing rather
 * than guessing, because a wrong answer you have to notice and undo is worse
 * than a blank one you expected.
 */
export function AddApplicationModal({ stage = 'applied', defaults = {}, onCreate, onClose }) {
  const companyRef = useRef(null);

  const [link, setLink] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [source, setSource] = useState(defaults.source || 'company_site');
  const [applyMethod, setApplyMethod] = useState(METHOD_HINTS[defaults.source] || '');
  const [referrer, setReferrer] = useState('');
  /* The row itself, not just its id, so the field can show what was picked
     before there is an application to hang the snapshot on. */
  const [resume, setResume] = useState(null);
  const [where, setWhere] = useState(stage);
  const [prior, setPrior] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  /*
    "Have I applied here before", asked while you are still typing. A warning
    and never a block: two roles at one company and re-applying six months
    later are both normal, and the second outcome is the only way to learn
    whether the first rejection stuck.
  */
  useEffect(() => {
    const name = company.trim();
    if (name.length < 2) {
      setPrior([]);
      return undefined;
    }
    const timer = setTimeout(() => {
      applicationsApi.lookup(name).then(setPrior).catch(() => setPrior([]));
    }, 350);
    return () => clearTimeout(timer);
  }, [company]);

  const pasteLink = (value) => {
    setLink(value);
    const guess = readLink(value);
    if (guess.source) pickSource(guess.source);
    /* Never overwrites something already typed — the guess is the weaker claim. */
    if (guess.company && !company.trim()) setCompany(guess.company);
  };

  /*
    Picking a source suggests a method, because on most of them there is only
    one way in and confirming it is busywork. On the handful where both answers
    genuinely exist — LinkedIn above all — it deliberately suggests nothing and
    the field is promoted instead, because that is the one case where the answer
    carries information and a guess would destroy it.
  */
  const pickSource = (value) => {
    setSource(value);
    setApplyMethod(METHOD_HINTS[value] || '');
  };

  const submit = async (event) => {
    event.preventDefault();
    const name = company.trim();
    if (!name) return;

    setBusy(true);
    setError('');

    try {
      await onCreate({
        company: name,
        role: role.trim(),
        source,
        applyMethod,
        stage: where,
        links: link.trim() ? [{ label: 'Posting', url: link.trim() }] : [],
        referrer: referrer.trim() ? { name: referrer.trim() } : undefined,
        resumeId: resume?.id || undefined,
      });
      onClose();
    } catch (err) {
      setError(err.message || 'That did not save');
      setBusy(false);
    }
  };

  return (
    <Modal title="Add an application" onClose={onClose} initialFocus={companyRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Paste the link, if you have one</span>
            <input
              value={link}
              maxLength={2000}
              placeholder="https://…"
              onChange={(event) => pasteLink(event.target.value)}
            />
            <span className="field-hint">Fills in where you found it, and often who.</span>
          </label>

          <div className="field-row">
            <label className="field">
              <span>Company</span>
              <input
                ref={companyRef}
                value={company}
                maxLength={120}
                placeholder="Razorpay"
                onChange={(event) => setCompany(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Role</span>
              <input
                value={role}
                maxLength={140}
                placeholder="SDE-1"
                onChange={(event) => setRole(event.target.value)}
              />
            </label>
          </div>

          {prior.length > 0 && (
            <div className="alert">
              You have {prior.length === 1 ? 'an earlier application' : 'earlier applications'} here:{' '}
              {prior
                .map(
                  (row) =>
                    `${row.role || 'unspecified role'} — ${stageLabel(row.stage)}${
                      row.appliedAt ? `, ${dayStamp(row.appliedAt)}` : ''
                    }`,
                )
                .join('; ')}
              . Adding another is fine.
            </div>
          )}

          <div className="field-row">
            <label className="field">
              <span>Where you found it</span>
              <Dropdown
                ariaLabel="Source"
                value={source}
                options={SOURCE_OPTIONS}
                onChange={pickSource}
                searchable
              />
            </label>
            <label className="field">
              <span>Stage</span>
              <Dropdown
                ariaLabel="Stage"
                value={where}
                options={ALL_STAGE_OPTIONS}
                onChange={setWhere}
              />
            </label>
          </div>

          {/*
            How you sent it — its own field, not a source value, because "found
            it on LinkedIn" and "pressed Easy Apply" are two different facts and
            one dropdown would make you throw away whichever one it did not
            hold.

            Promoted on the platforms where both answers exist, and quiet
            elsewhere. Easy Apply against the company's own portal is the
            sharpest cut in the whole report — the same profile into four
            hundred applicants, or a form you actually filled in — and it is
            worth one extra click at the moment you still remember which you
            did.
          */}
          <label className={`field ${METHOD_MATTERS.includes(source) ? 'is-strong' : ''}`}>
            <span>How you applied</span>
            <Dropdown
              ariaLabel="How you applied"
              value={applyMethod}
              options={APPLY_METHOD_OPTIONS}
              onChange={setApplyMethod}
            />
            {METHOD_MATTERS.includes(source) && (
              <span className="field-hint">
                Easy Apply and their own site convert completely differently — this is what lets
                the report tell them apart.
              </span>
            )}
          </label>

          {/*
            Not in the source list, and that is the point: being referred is
            something that happened *as well as* finding the job somewhere, so
            it is its own field. Filling it in is what makes this application
            count as referred in the report.
          */}
          <label className="field">
            <span>Referred by</span>
            <input
              value={referrer}
              maxLength={120}
              placeholder="Leave empty if nobody referred you"
              onChange={(event) => setReferrer(event.target.value)}
            />
          </label>

          {/*
            Optional, and here because this is the moment you know the answer —
            you just attached it on their form. Picking one you have used before
            is one click; a new file is hashed first and only uploaded if it is
            genuinely new. See ResumeField.
          */}
          <div className="field">
            <span>CV you sent</span>
            <ResumeField value={resume} onChange={(_id, row) => setResume(row)} />
          </div>

          {error && <div className="alert">{error}</div>}
        </div>

        <div className="modal-foot">
          <span className="spacer" />
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!company.trim() || busy}>
            {busy ? 'Adding…' : 'Add'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
