import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { PasswordField } from '../components/ui/PasswordField.jsx';
import { useAuth } from '../store/AuthContext.jsx';

const MIN_PASSWORD = 8;

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await register({ name, email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not create your account'));
    } finally {
      setBusy(false);
    }
  };

  // Untouched, too short, long enough — the meter says which without waiting
  // for the server to reject the form.
  const strength = password.length === 0 ? 0 : password.length < MIN_PASSWORD ? 1 : 2;

  return (
    <AuthLayout
      title="Create your account"
      subtitle="Free, and your progress is yours to keep."
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

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </AuthLayout>
  );
}
