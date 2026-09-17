import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { AuthLayout } from '../components/layout/AuthLayout.jsx';
import { PasswordField } from '../components/ui/PasswordField.jsx';
import { useAuth } from '../store/AuthContext.jsx';

export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const justReset = params.get('reset') === '1';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login({ email, password });
      navigate('/', { replace: true });
    } catch (err) {
      setError(errorMessage(err, 'Could not sign in'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Pick up where the roadmap left off."
      footer={
        <>
          No account yet? <Link to="/register">Create one</Link>
        </>
      }
    >
      <form onSubmit={submit}>
        {/* Arriving from a reset: say why they are signed out, not just that they are. */}
        {justReset && !error && (
          <div className="alert alert-ok">Password changed, and every device was signed out. Sign in with your new password.</div>
        )}
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

        <PasswordField
          label="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="current-password"
          placeholder="Your password"
        />

        {/* Carries the address already typed, so the reset form does not ask for it twice. */}
        <div className="auth-forgot">
          <Link to={`/forgot-password${email ? `?email=${encodeURIComponent(email)}` : ''}`}>
            Forgot password?
          </Link>
        </div>

        <button className="btn primary auth-submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </AuthLayout>
  );
}
