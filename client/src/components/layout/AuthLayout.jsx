import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motivationApi } from '../../api/index.js';
import { BRAND } from '../../brand.js';
import { IconBook } from '../ui/Icons.jsx';
import { randomAuthLine } from './authLines.js';
import { AuthShowcase } from './AuthShowcase.jsx';
import { ParticleWeb } from './ParticleWeb.jsx';

/**
 * The shell both auth pages sit in: the form on the left, and on the right the
 * showcase — one slide per module, each drawn from the app's own vocabulary
 * rather than a stock illustration (see AuthShowcase.jsx). It is the product,
 * drawn at rest, and it is inert: no data, no requests.
 *
 * The one line under the form is the single exception, and it is built not to
 * cost anything. A bundled line paints on the first frame, so the form is
 * usable immediately whatever the network is doing; the public motivation
 * endpoint then replaces it if and when it answers. Nothing waits, nothing
 * moves — the strip is the same height either way — and with the server
 * unreachable the page is exactly what it was before.
 */

/**
 * The line under the form.
 *
 * State is seeded from the bundle in a lazy initialiser, so the first paint
 * already has text — there is no empty frame and no layout shift when the
 * request lands. The fetch is fire-and-forget with no loading state and no
 * error state, because both would be worse than the fallback that is already
 * on screen.
 */
function AuthLine() {
  const [text, setText] = useState(randomAuthLine);

  useEffect(() => {
    let live = true;
    motivationApi
      .login()
      .then((line) => live && line?.text && setText(line.text))
      .catch(() => {});
    return () => {
      live = false;
    };
  }, []);

  return <p className="auth-line">{text}</p>;
}

export function AuthLayout({ title, subtitle, children, footer }) {
  return (
    <div className="auth">
      <div className="auth-form-col">
        <ParticleWeb />

        <Link to="/login" className="auth-brand">
          <span className="brand-mark">{BRAND.mark}</span>
          {BRAND.name}
        </Link>

        {/* The only link on this page that goes somewhere other than into an
            account. Someone who has not decided yet needs to be able to read
            what this is without making one up first. */}
        <Link to="/docs" className="auth-docs">
          <IconBook size={12} />
          What is {BRAND.name}?
        </Link>

        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
          <AuthLine />
        </div>

        <p className="auth-foot">{footer}</p>
      </div>

      <AuthShowcase />
    </div>
  );
}
