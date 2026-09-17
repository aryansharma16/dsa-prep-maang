import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { IconCheck } from '../components/ui/Icons.jsx';

/**
 * Asking for a password reset link.
 *
 * The confirmation says the same thing whether or not the address has an
 * account, and it has to: "no account with that email" would make this form a
 * free way to find out who uses the app. So the copy is written for both cases
 * at once — "if that email has an account" — rather than pretending to know.
 *
 * `?email=` is filled in from the approval and password-changed emails, which
 * link here, so someone arriving from their inbox does not retype the address
 * the email was sent to.
 */
export function ForgotPassword() {
  const [params] = useSearchParams();
  const [email, setEmail] = useState(params.get('email') || '');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await authApi.forgotPassword(email.trim());
      setSentTo(email.trim());
    } catch (err) {
      setError(errorMessage(err, 'Could not send the reset link'));
    } finally {
      setBusy(false);
    }
  };

  const footer = (
    <>
      Remembered it? <Link to="/login">Sign in</Link>
    </>
  );

  if (sentTo) {
    return (
      <AuthLayout title="Check your email" subtitle="The link works once, for an hour." footer={footer}>
        <div className="auth-done">
          <span className="auth-done-mark" aria-hidden="true">
            <IconCheck size={18} />
          </span>
          <p>
            If <b>{sentTo}</b> has an account, a link to set a new password is on its way. Check
            spam if it is not there in a minute.
          </p>
          <p className="auth-done-sub">
            Still nothing?{' '}
            <button type="button" className="auth-inline-btn" onClick={() => setSentTo('')}>
              Try a different address
            </button>
            . Asking again sends a new link and cancels the old one.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Reset your password"
      subtitle="We'll email you a link to choose a new one."
      footer={footer}
    >
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Sending link…' : 'Send reset link'}
        </button>
      </form>
    </AuthLayout>
  );
}
