import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../components/ui/Modal.jsx';
import { FIELDS, PRINCIPLES, SCENARIOS, fill } from '../interview/negotiation.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Interview Helper → Offer Negotiation.
 *
 * Seven moments in a negotiation, each a script you fill once and copy. Same
 * one-screen layout as Outreach Messages (it reuses the `mb-` classes): the
 * moment and its details on the left, the editable message on the right.
 * What you type is remembered in this browser only.
 */
const STORE_KEY = 'offer-negotiation';

const readStore = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

export function OfferNegotiation() {
  const { user } = useAuth();
  const { toast } = useToast();
  const stored = useMemo(readStore, []);
  const [scenarioId, setScenarioId] = useState(stored.scenarioId || SCENARIOS[0].id);
  const [values, setValues] = useState(() => ({ me: user?.name || '', ...(stored.values || {}) }));
  const [edited, setEdited] = useState(null);
  const [showTips, setShowTips] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ scenarioId, values }));
    } catch {
      // Remembering is a convenience only.
    }
  }, [scenarioId, values]);

  const scenario = SCENARIOS.find((s) => s.id === scenarioId) || SCENARIOS[0];
  const generated = {
    subject: scenario.subject ? fill(scenario.subject, values) : '',
    body: fill(scenario.body, values),
  };
  const message = edited || generated;
  const gaps = (`${message.subject}\n${message.body}`.match(/\[[^\]]+\]/g) || []).length;

  const pick = (id) => {
    setScenarioId(id);
    setEdited(null);
  };
  const setField = (key) => (e) => setValues((v) => ({ ...v, [key]: e.target.value }));
  const editPart = (part) => (e) => setEdited((prev) => ({ ...(prev || generated), [part]: e.target.value }));

  const copy = async () => {
    const text = message.subject ? `Subject: ${message.subject}\n\n${message.body}` : message.body;
    try {
      await navigator.clipboard.writeText(text);
      toast('Copied', 'success');
    } catch {
      toast('Clipboard blocked', 'error');
    }
  };

  return (
    <div className="mb">
      <header className="mb-head">
        <div>
          <h1>Offer Negotiation</h1>
          <p>Scripts for each moment of an offer, from buying time to getting it in writing. Fill once, copy, send.</p>
        </div>
        <div className="mb-head-right">
          <button type="button" className="btn" onClick={() => setShowTips(true)}>
            Rules of the game
          </button>
        </div>
      </header>

      <div className="mb-body">
        <aside className="mb-side">
          <div className="mb-block">
            <span className="mb-label">Moment</span>
            <div className="ng-moments">
              {SCENARIOS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`ng-moment ${s.id === scenario.id ? 'active' : ''}`}
                  aria-pressed={s.id === scenario.id}
                  onClick={() => pick(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <p className="ng-when">{scenario.when}</p>
          </div>

          <div className="mb-block">
            <span className="mb-label">Details</span>
            <div className="mb-inputs">
              {scenario.fields.map((key) => (
                <input
                  key={key}
                  className="mb-input"
                  maxLength={160}
                  aria-label={FIELDS[key].label}
                  title={FIELDS[key].label}
                  placeholder={`${FIELDS[key].label}${FIELDS[key].placeholder ? ` · ${FIELDS[key].placeholder}` : ''}`}
                  value={values[key] || ''}
                  onChange={(e) => {
                    setField(key)(e);
                    setEdited(null);
                  }}
                />
              ))}
            </div>
          </div>
        </aside>

        <section className="mb-out">
          <div className="mb-out-bar">
            <div className="mb-meta">
              {gaps > 0 ? <span className="mb-gaps">{gaps} to fill</span> : <span className="mb-ready">Ready</span>}
              {edited && (
                <button type="button" className="mb-link" onClick={() => setEdited(null)}>
                  Reset
                </button>
              )}
            </div>
            <div className="mb-actions">
              <button type="button" className="btn primary" onClick={copy}>
                Copy
              </button>
            </div>
          </div>
          {!scenario.script && (
            <input className="mb-subject" aria-label="Subject" value={message.subject} onChange={editPart('subject')} />
          )}
          <textarea
            className={`mb-text ${scenario.script ? 'script' : ''}`}
            value={message.body}
            onChange={editPart('body')}
            spellCheck
            aria-label="Message"
          />
        </section>
      </div>

      {showTips && (
        <Modal title="Rules of the game" onClose={() => setShowTips(false)}>
          <div className="modal-body">
            <ul className="mb-tips">
              {PRINCIPLES.map((p) => (
                <li key={p.title}>
                  <b>{p.title}</b>
                  <span>{p.text}</span>
                </li>
              ))}
            </ul>
            <p className="mb-tips-note">
              A script opens the conversation. What you end up with still depends on knowing your market and your
              walk-away number.
            </p>
          </div>
        </Modal>
      )}
    </div>
  );
}
