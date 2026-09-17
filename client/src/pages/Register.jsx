import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { PasswordField } from '../components/ui/PasswordField.jsx';
import { IconCheck } from '../components/ui/Icons.jsx';
import { useAuth } from '../store/AuthContext.jsx';

const MIN_PASSWORD = 8;

/**
 * Asking for an account.
 *
 * Signing up does not create an account any more: it files a request the owner
 * approves or declines, and the page has to say so *before* the form rather
 * than after it. Someone who fills in five fields, presses the button and is
 * then told they cannot come in yet has been misled by the button — so the
 * heading, the subtitle and the submit label all say "request".
 *
 * Five fields, and the count is deliberate. Everything past the four the
 * account actually needs is a stranger being asked to prove themselves to a
 * form, and the one that earns its place is the last: it is what the owner
 * reads when deciding.
 */
export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [mobile, setMobile] = useState('');
  const [password, setPassword] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  // Set once the request is filed. The form is replaced rather than disabled:
  // there is nothing left to do on this page and re-submitting is refused.
  const [filed, setFiled] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await register({ name, email, mobile, password, reason });
      // The pinned owner on a fresh deployment is signed in outright; everyone
      // else gets a queued request and stays on this page.
      if (result?.user) navigate('/', { replace: true });
      else setFiled(result?.email || email);
    } catch (err) {
      setError(errorMessage(err, 'Could not send your request'));
    } finally {
      setBusy(false);
    }
  };

  // Untouched, too short, long enough — the meter says which without waiting
  // for the server to reject the form.
  const strength = password.length === 0 ? 0 : password.length < MIN_PASSWORD ? 1 : 2;

  if (filed) {
    return (
      <AuthLayout
        title="Request sent"
        subtitle="The owner has it. You will get an email when it is reviewed."
        footer={
          <>
            Already have an account? <Link to="/login">Sign in</Link>
          </>
        }
      >
        <div className="auth-done">
          <span className="auth-done-mark" aria-hidden="true">
            <IconCheck size={18} />
          </span>
          <p>
            We sent a note to <b>{filed}</b>. Approval is usually within a day, and a second email
            comes either way.
          </p>
          <p className="auth-done-sub">
            Nothing else to do — the password you chose is already set, so once you are approved you
            sign in with it.
          </p>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Request an account"
      subtitle="Every account is approved by hand. It takes about a day."
      footer={
        <>
          Already registered? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}

        <label className="field">
          <span>Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            autoFocus
            autoComplete="name"
            placeholder="Your name"
          />
        </label>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
          />
        </label>

        {/* `tel` rather than `number`: a phone number is not a quantity, and
            number inputs strip the leading + and offer a spinner. */}
        <label className="field">
          <span>Mobile</span>
          <input
            type="tel"
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            required
            autoComplete="tel"
            placeholder="+91 98765 43210"
          />
        </label>

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={MIN_PASSWORD}
          autoComplete="new-password"
          placeholder="Choose a password"
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

        <label className="field">
          <span>Why you want access</span>
          <textarea
            className="auth-textarea"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={2}
            maxLength={300}
            placeholder="One line — what you are preparing for"
          />
        </label>

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Sending request…' : 'Request access'}
        </button>
      </form>
    </AuthLayout>
  );
}
