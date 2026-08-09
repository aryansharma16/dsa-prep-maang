import { Link } from 'react-router-dom';
import { BRAND } from '../../brand.js';
import { IconCheck } from '../ui/Icons.jsx';
import { ParticleWeb } from './ParticleWeb.jsx';

/**
 * The shell both auth pages sit in: the form on the left, and on the right a
 * panel that says what the thing actually is.
 *
 * The showcase is built from the app's own vocabulary — pattern rows, progress
 * bars, a solved ring — rather than a stock illustration. It is the product,
 * drawn at rest, so signing in never shows you something the app does not
 * contain. It is also inert: no data, no requests, nothing to load before the
 * form is usable.
 */

// Numbers a real account sees on day one of week three. Specific enough to read
// as a product and not a wireframe.
const SAMPLE = [
  { step: '01', name: 'Arrays & Hashing', solved: 24, total: 32 },
  { step: '02', name: 'Two Pointers', solved: 11, total: 16 },
  { step: '03', name: 'Prefix Sum', solved: 6, total: 14 },
  { step: '04', name: 'Sliding Window', solved: 2, total: 18 },
];

const POINTS = [
  '22 patterns, 429 problems, ordered so each one builds on the last',
  'Revision that schedules itself — the ones you nearly missed come back',
  'Company tags, difficulty and sheet filters on every problem',
  'A written guide behind every pattern, with Java and C++ side by side',
];

function Showcase() {
  return (
    <aside className="auth-show" aria-hidden="true">
      <div className="auth-glow" />

      <div className="auth-show-inner">
        <p className="auth-kicker">The roadmap</p>
        <h2>
          Every pattern, in the order
          <br />
          that builds on itself.
        </h2>

        <div className="auth-mock">
          <div className="auth-mock-bar">
            <span />
            <span />
            <span />
          </div>
          <div className="auth-mock-body">
            {SAMPLE.map((row) => (
              <div className="auth-mock-row" key={row.step}>
                <span className="auth-mock-step mono">{row.step}</span>
                <span className="auth-mock-name">{row.name}</span>
                <span className="auth-mock-bar-track">
                  <span style={{ width: `${Math.round((row.solved / row.total) * 100)}%` }} />
                </span>
                <span className="auth-mock-frac mono">
                  {row.solved}/{row.total}
                </span>
              </div>
            ))}
          </div>
        </div>

        <ul className="auth-points">
          {POINTS.map((point) => (
            <li key={point}>
              <IconCheck size={11} />
              {point}
            </li>
          ))}
        </ul>

        <p className="auth-next">
          <span className="auth-badge">Next</span>
          System design, behavioural and more — the roadmap is the first module,
          not the last.
        </p>
      </div>
    </aside>
  );
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

        <div className="auth-card">
          <h1>{title}</h1>
          <p className="auth-sub">{subtitle}</p>
          {children}
        </div>

        <p className="auth-foot">{footer}</p>
      </div>

      <Showcase />
    </div>
  );
}
