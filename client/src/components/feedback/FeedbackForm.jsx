import { useState } from 'react';
import { useLocation } from 'react-router-dom';
import { errorMessage } from '../../api/http.js';
import { feedbackApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import { FEEDBACK_TYPES, MAX_MESSAGE, MAX_TITLE } from './vocab.js';

/** Only worth showing once you are close enough for it to be a warning. */
const COUNTER_FROM = 0.8;

/**
 * The form, in both the places that draw one.
 *
 * `variant` changes the chrome and nothing else: in a modal the fields go in a
 * `.modal-body` and the button in a `.modal-foot`, both inside this component's
 * own `<form>` — which is the reason Modal renders its children raw rather than
 * wrapping them. On the page there is no foot, so the button sits under the
 * fields. The state, the validation and the request are identical, which is the
 * point of one component.
 */
export function FeedbackForm({ variant = 'page', onSent }) {
  const { pathname } = useLocation();
  const { success, error } = useToast();

  const [type, setType] = useState('suggestion');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const ready = title.trim().length >= 3 && message.trim().length >= 10;

  const submit = async (e) => {
    e.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    try {
      const res = await feedbackApi.create({
        type,
        title: title.trim(),
        message: message.trim(),
        path: pathname,
      });

      success('Sent. You can follow it under Yours.');
      setTitle('');
      setMessage('');
      onSent?.(res.submission);
    } catch (err) {
      error(errorMessage(err, 'Could not send that just now'));
    } finally {
      setBusy(false);
    }
  };

  const fields = (
    <>
      <label className="field">
        <span>What is this</span>
        <Dropdown value={type} onChange={setType} options={FEEDBACK_TYPES} ariaLabel="Kind of feedback" />
      </label>

      <label className="field">
        <span>One line</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, MAX_TITLE))}
          placeholder="Revision queue shows problems twice"
          maxLength={MAX_TITLE}
        />
      </label>

      <label className="field">
        <span>The detail</span>
        <textarea
          rows={variant === 'modal' ? 5 : 8}
          value={message}
          onChange={(e) => setMessage(e.target.value.slice(0, MAX_MESSAGE))}
          placeholder="What you did, what happened, and what you expected instead."
        />
        {message.length > MAX_MESSAGE * COUNTER_FROM && (
          <span className="fb-chars warn">
            {MAX_MESSAGE - message.length} characters left
          </span>
        )}
        {/* Said out loud because the form should not send something the person
            cannot see it sending. */}
        <span className="field-hint">
          The page you are on (<span className="mono">{pathname}</span>) is included.
        </span>
      </label>
    </>
  );

  const button = (
    <button type="submit" className="btn primary" disabled={!ready || busy}>
      {busy ? 'Sending...' : 'Send'}
    </button>
  );

  if (variant === 'modal') {
    return (
      <form onSubmit={submit}>
        <div className="modal-body">{fields}</div>
        <div className="modal-foot">{button}</div>
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="fb-form">
      {fields}
      <div className="fb-form-foot">{button}</div>
    </form>
  );
}
