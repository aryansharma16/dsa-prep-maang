import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { PasswordField } from '../components/ui/PasswordField.jsx';
import { useAuth } from '../store/AuthContext.jsx';

const MIN_PASSWORD = 8;

/**
 * Choosing a new password from an emailed link.
 *
 * Asked twice, because there is no old password to fall back on: a typo here
 * locks the person out of an account they just recovered, and sends them round
 * the email loop again.
 *
 * It does not sign in afterwards. The server has just ended every session the
 * account had — including, if this browser was signed in, this one — and typing
 * the new password once more on the login page is the check that they know
 * what they set. The login page says why they are there.
 *
 * Reachable signed in as well as signed out (see App.jsx): a reset link opened
 * in a browser that is still signed in must not bounce to the roadmap and lose
 * the token.
 */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const footer = (
    <>
      Remembered it? <Link to="/login">Sign in</Link>
    </>
  );

  if (!token) {
    return (
      <AuthLayout title="This link is incomplete" subtitle="It is missing the part that proves it came from us." footer={footer}>
        <p className="auth-done-sub">
          Open the link straight from the email rather than copying part of it, or{' '}
          <Link to="/forgot-password">ask for a new one</Link>.
        </p>
      </AuthLayout>
    );
  }

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    if (password !== confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      // The server already cleared the cookies; this drops the in-memory session too.
      if (user) await logout();
      navigate('/login?reset=1', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not change your password'));
      setBusy(false);
    }
  };

  const strength = password.length === 0 ? 0 : password.length < MIN_PASSWORD ? 1 : 2;
  const expired = /invalid or has expired/i.test(error);

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle="Every device signed in to your account will be signed out."
      footer={footer}
    >
      <form onSubmit={submit}>
        {error && (
          <div className="alert">
            {error}
            {expired && (
              <>
                {' '}
                <Link to="/forgot-password">Send a new link</Link>
              </>
            )}
          </div>
        )}

        <PasswordField
          label="New password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoFocus
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder="At least 8 characters"
          hint={
            <>
              <span className={`pw-meter s${strength}`} aria-hidden="true">
                <span />
                <span />
              </span>
              {strength === 2 ? 'Long enough' : `At least ${MIN_PASSWORD} characters`}
            </>
          }
        />

        <PasswordField
          label="Type it again"
          value={confirm}
          onChange={(e) => setConfirm(e.target.value)}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder="The same password"
        />

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Saving…' : 'Set new password'}
        </button>
      </form>
    </AuthLayout>
  );
}
