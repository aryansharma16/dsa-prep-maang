import { useState } from 'react';
import { IconEye, IconEyeOff } from './Icons.jsx';

/**
 * A password input with a reveal toggle.
 *
 * The toggle is a button rather than a checkbox so it never enters the form's
 * value, and it stays out of the tab order: tabbing from the password field
 * should reach the submit button, not a control you only want on a mistyped
 * password. It is still reachable by pointer, and announces its state.
 */
export function PasswordField({ label, hint, ...props }) {
  const [shown, setShown] = useState(false);

  return (
    <label className="field">
      <span>{label}</span>
      <span className="field-with-action">
        <input {...props} type={shown ? 'text' : 'password'} />
        <button
          type="button"
          tabIndex={-1}
          onClick={() => setShown((v) => !v)}
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
          title={shown ? 'Hide password' : 'Show password'}
        >
          {shown ? <IconEyeOff size={14} /> : <IconEye size={14} />}
        </button>
      </span>
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}
