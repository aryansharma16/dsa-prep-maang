import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { authApi, learnApi, statsApi } from '../api/index.js';
import { Dropdown } from '../components/ui/Dropdown.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import {
  FIELD_META,
  LIMITS,
  LINKEDIN_MODES,
  PLATFORMS,
  TYPES,
  TYPE_FIELDS,
  choicesFor,
  derive,
  fill,
  formatFor,
} from '../interview/messageBuilder.js';
import { TIPS } from '../interview/outreachTemplates.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Interview Helper → Outreach Messages (the builder; Outreach Templates was
 * merged into it, and its messages are the "Classic" and "Kit" choices).
 *
 * Pick a platform and a purpose, fill in who it is for, and get a message
 * written from your profile. Your own details and pitches come from your
 * account profile (and can be saved back to it); the message itself stays
 * editable. The recruiter directory links here with the name and company
 * already filled in.
 *
 * Laid out to fit one screen: compact controls on the left, the message filling
 * the right. Your own details live behind a small dialog, not on the page.
 */
const STORE_KEY = 'message-builder';

const readStore = () => {
  try {
    const raw = JSON.parse(localStorage.getItem(STORE_KEY));
    return raw && typeof raw === 'object' ? raw : {};
  } catch {
    return {};
  }
};

const ME_KEYS = ['me', 'myTitle', 'myCompany', 'years', 'stack', 'notice', 'phone', 'email', 'linkedin', 'portfolio'];

const fromProfile = (user) => {
  const p = user?.profile || {};
  return {
    me: user?.name || '',
    myTitle: p.currentTitle || '',
    myCompany: p.currentCompany || '',
    years: p.yearsExp || '',
    notice: p.noticePeriod || '',
    phone: p.phone || '',
    email: user?.email || '',
    linkedin: p.linkedin || '',
    portfolio: p.website || p.github || '',
    // Not on the profile; kept in this browser with the rest of the form.
    stack: 'Node.js, TypeScript and AWS',
  };
};

const digits = (s) => String(s || '').replace(/[^0-9]/g, '');

/**
 * Proof points built from your real Ember progress, so they are always true and
 * grow as you practise. Nothing here is invented: no progress, no point.
 */
const liveProofs = (stats, learn) => {
  const out = [];
  const solved = stats?.totals?.solved || 0;
  if (solved > 0) {
    const by = Object.fromEntries((stats.byDifficulty || []).map((d) => [String(d.difficulty).toLowerCase(), d.solved]));
    const patterns = (stats.byPattern || []).filter((p) => p.solved > 0).length;
    const split = ['easy', 'medium', 'hard'].filter((k) => by[k]).map((k) => `${by[k]} ${k}`).join(', ');
    out.push({
      id: 'live-dsa',
      text: `have solved ${solved} DSA problems on a structured interview roadmap${split ? ` (${split})` : ''}${
        patterns ? ` across ${patterns} pattern${patterns > 1 ? 's' : ''}` : ''
      }`,
    });
  }
  const hld = (learn || []).filter((t) => t.track === 'hld' && t.readAt).length;
  if (hld > 0) {
    out.push({
      id: 'live-hld',
      text: `have worked through ${hld} system-design topic${hld > 1 ? 's' : ''} alongside designing production systems at work`,
    });
  }
  return out;
};

export function MessageBuilder() {
  const { user, applyUser } = useAuth();
  const { toast } = useToast();
  const [params] = useSearchParams();
  const stored = useMemo(readStore, []);
  const pitches = user?.profile?.pitches || [];

  const [platform, setPlatform] = useState(stored.platform || 'linkedin');
  const [linkedinMode, setLinkedinMode] = useState(stored.linkedinMode || 'chat');
  const [type, setType] = useState(stored.type || 'referral');
  const [pitchKey, setPitchKey] = useState(stored.pitchKey || pitches[0]?.key || '');
  // Proof point ids: `p<n>` for a pitch's proofs, `live-*` for live progress.
  // Older saves stored plain indexes; read those as `p<n>`.
  const [proofIdx, setProofIdx] = useState(() =>
    (stored.proofIdx || ['p0', 'p1']).map((v) => (typeof v === 'number' ? `p${v}` : v)),
  );
  const [live, setLive] = useState([]);

  // Your real progress, for the live proof points. Either module may be hidden;
  // a failed request just means no live point from it.
  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([statsApi.get(), learnApi.progress()]).then(([stats, learn]) => {
      if (cancelled) return;
      setLive(liveProofs(stats.value, learn.value));
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const [choice, setChoice] = useState('pro');

  // About them: remembered, but a link from the directory wins.
  const [them, setThem] = useState(() => {
    const base = { ...(stored.them || {}) };
    for (const key of ['to', 'company', 'theirEmail', 'theirPhone']) {
      const v = params.get(key);
      if (v) base[key] = key === 'to' ? v.split(/\s+/)[0] : v;
    }
    return base;
  });
  const [mine, setMine] = useState(() => ({ ...fromProfile(user), ...(stored.mine || {}) }));
  const [showMe, setShowMe] = useState(false);
  const [showTips, setShowTips] = useState(false);
  const [saving, setSaving] = useState(false);

  // The message: generated until you type in it, then yours.
  const [edited, setEdited] = useState(null); // { subject, body } once edited

  useEffect(() => {
    try {
      localStorage.setItem(
        STORE_KEY,
        JSON.stringify({ platform, linkedinMode, type, pitchKey, proofIdx, them, mine }),
      );
    } catch {
      // A remembered form is a convenience only.
    }
  }, [platform, linkedinMode, type, pitchKey, proofIdx, them, mine]);

  const format = formatFor(platform, linkedinMode);
  const choices = choicesFor(type, format);
  const active = choices.find((c) => c.id === choice) || choices[0];
  const pitch = pitches.find((p) => p.key === pitchKey) || pitches[0];
  const proofs = pitch?.proofs || [];
  const proofItems = [
    ...proofs.map((text, i) => ({ id: `p${i}`, text })),
    ...live,
  ];
  const proofText = (id) => proofItems.find((p) => p.id === id)?.text || '';

  const values = derive({
    ...them,
    ...mine,
    headline: pitch?.headline || '',
    short: pitch?.short || '',
    proof1: proofText(proofIdx[0]),
    proof2: proofText(proofIdx[1]),
  });

  const generated = {
    subject: active?.template.subject ? fill(active.template.subject, values, active.template.hints) : '',
    body: active ? fill(active.template.body, values, active.template.hints) : '',
  };
  const message = edited || generated;
  const stale = edited && (edited.base !== `${generated.subject}\n${generated.body}`);

  const limit = LIMITS[format];
  const over = limit && message.body.length > limit;
  const gaps = (`${message.subject}\n${message.body}`.match(/\[[^\]]+\]/g) || []).length;

  const setThemField = (key) => (e) => setThem((t) => ({ ...t, [key]: e.target.value }));
  const setMineField = (key) => (e) => setMine((m) => ({ ...m, [key]: e.target.value }));

  const editMessage = (part) => (e) =>
    setEdited((prev) => ({
      ...(prev || { ...generated, base: `${generated.subject}\n${generated.body}` }),
      [part]: e.target.value,
    }));

  const full = message.subject ? `Subject: ${message.subject}\n\n${message.body}` : message.body;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(platform === 'email' ? full : message.body);
      toast('Message copied', 'success');
    } catch {
      toast('Clipboard blocked', 'error');
    }
  };

  const reloadProfile = () => {
    setMine(fromProfile(user));
    toast('Your details reloaded from your profile', 'success');
  };

  const saveProfile = async () => {
    setSaving(true);
    try {
      const updated = await authApi.updateMe({
        profile: {
          currentTitle: mine.myTitle,
          currentCompany: mine.myCompany,
          yearsExp: mine.years,
          noticePeriod: mine.notice,
          phone: mine.phone,
          linkedin: mine.linkedin,
        },
      });
      applyUser(updated);
      toast('Saved to your profile', 'success');
    } catch (err) {
      toast(errorMessage(err, 'Could not save'), 'error');
    }
    setSaving(false);
  };

  const whatsappLink =
    platform === 'whatsapp' && digits(them.theirPhone)
      ? `https://wa.me/${digits(them.theirPhone)}?text=${encodeURIComponent(message.body)}`
      : null;
  const mailLink =
    platform === 'email' && them.theirEmail
      ? `mailto:${them.theirEmail}?subject=${encodeURIComponent(message.subject)}&body=${encodeURIComponent(message.body)}`
      : null;

  const clip = (t) => (t.length > 80 ? `${t.slice(0, 78)}…` : t);
  const proofOptions = proofItems.map((p) => ({
    value: p.id,
    label: p.id.startsWith('live') ? `Live · ${clip(p.text)}` : clip(p.text),
  }));
  const typeMeta = TYPES.find((t) => t.id === type);

  const typeOptions = TYPES.map((t) => ({ value: t.id, label: t.label, note: t.who }));
  const meMissing = ['me', 'myTitle', 'myCompany', 'years'].filter((k) => !mine[k]?.trim()).length;
  const reset = () => setEdited(null);

  return (
    <div className="mb">
      <header className="mb-head">
        <div>
          <h1>Outreach Messages</h1>
          <p>
            Written from your profile, editable before you send. Need a contact?{' '}
            <Link to="/interview/recruiters">Recruiter Directory</Link>
          </p>
        </div>
        <div className="mb-head-right">
        <button type="button" className="btn" onClick={() => setShowTips(true)}>
          Tips
        </button>
        <button type="button" className="mb-me" onClick={() => setShowMe(true)}>
          <span className="mb-me-avatar">{(mine.me || '?').trim()[0]?.toUpperCase()}</span>
          <span>
            <b>{mine.me || 'Your details'}</b>
            <small>{meMissing ? `${meMissing} detail${meMissing > 1 ? 's' : ''} missing` : `${mine.myTitle} · ${mine.myCompany}`}</small>
          </span>
        </button>
        </div>
      </header>

      <div className="mb-body">
        {/* ---- controls ---- */}
        <aside className="mb-side">
          <div className="mb-block">
            <span className="mb-label">Platform</span>
            <div className="mb-seg">
              {PLATFORMS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={platform === p.id ? 'active' : ''}
                  aria-pressed={platform === p.id}
                  onClick={() => {
                    setPlatform(p.id);
                    reset();
                  }}
                >
                  {p.label}
                </button>
              ))}
            </div>
            {platform === 'linkedin' && (
              <div className="mb-seg small">
                {LINKEDIN_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    className={linkedinMode === m.id ? 'active' : ''}
                    aria-pressed={linkedinMode === m.id}
                    title={m.hint}
                    onClick={() => {
                      setLinkedinMode(m.id);
                      reset();
                    }}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="mb-block">
            <span className="mb-label">Purpose</span>
            <Dropdown
              ariaLabel="Purpose"
              value={type}
              options={typeOptions}
              onChange={(v) => {
                setType(v);
                reset();
              }}
            />
          </div>

          <div className="mb-block mb-pair">
            {pitches.length > 0 && (
              <div>
                <span className="mb-label">Pitch</span>
                <div className="mb-seg small">
                  {pitches.map((p) => (
                    <button
                      key={p.key}
                      type="button"
                      className={pitch?.key === p.key ? 'active' : ''}
                      aria-pressed={pitch?.key === p.key}
                      title={p.headline}
                      onClick={() => {
                        setPitchKey(p.key);
                        setProofIdx(['p0', 'p1']);
                        reset();
                      }}
                    >
                      {p.label.split(' · ')[0]}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {choices.length > 1 && (
              <div>
                <span className="mb-label">Template</span>
                <div className="mb-seg small">
                  {choices.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      className={active?.id === c.id ? 'active' : ''}
                      aria-pressed={active?.id === c.id}
                      onClick={() => {
                        setChoice(c.id);
                        reset();
                      }}
                    >
                      {c.label.replace(' (original)', '')}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="mb-block">
            <span className="mb-label">To · {typeMeta?.who}</span>
            <div className="mb-inputs">
              {TYPE_FIELDS[type].map((key) => (
                <input
                  key={key}
                  className="mb-input"
                  maxLength={160}
                  aria-label={FIELD_META[key].label}
                  title={FIELD_META[key].label}
                  placeholder={`${FIELD_META[key].label.replace(' (optional)', '')}${
                    FIELD_META[key].placeholder ? ` · ${FIELD_META[key].placeholder}` : ''
                  }`}
                  value={them[key] || ''}
                  onChange={setThemField(key)}
                />
              ))}
              {platform === 'whatsapp' && (
                <input
                  className="mb-input"
                  aria-label="Their WhatsApp number"
                  placeholder="Their WhatsApp number (optional)"
                  value={them.theirPhone || ''}
                  onChange={setThemField('theirPhone')}
                />
              )}
              {platform === 'email' && (
                <input
                  className="mb-input"
                  type="email"
                  aria-label="Their email"
                  placeholder="Their email (optional)"
                  value={them.theirEmail || ''}
                  onChange={setThemField('theirEmail')}
                />
              )}
            </div>
          </div>

          {proofItems.length > 0 && (
            <div className="mb-block">
              <span className="mb-label">Proof points</span>
              <div className="mb-proofs">
                {[0, 1].map((slot) => (
                  <Dropdown
                    key={slot}
                    ariaLabel={slot === 0 ? 'Lead with' : 'Back it up with'}
                    value={proofIdx[slot]}
                    options={proofOptions}
                    onChange={(v) => {
                      setProofIdx((prev) => {
                        const next = [...prev];
                        next[slot] = v;
                        return next;
                      });
                      reset();
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ---- message ---- */}
        <section className="mb-out">
          <div className="mb-out-bar">
            <div className="mb-meta">
              {limit && (
                <span className={over ? 'mb-over' : ''}>
                  {message.body.length}/{limit}
                </span>
              )}
              {gaps > 0 ? <span className="mb-gaps">{gaps} to fill</span> : <span className="mb-ready">Ready</span>}
              {stale && (
                <button type="button" className="mb-link" onClick={reset} title="Your edits are kept until you regenerate">
                  Regenerate
                </button>
              )}
              {edited && !stale && (
                <button type="button" className="mb-link" onClick={reset}>
                  Reset
                </button>
              )}
            </div>
            <div className="mb-actions">
              {whatsappLink && (
                <a className="btn" href={whatsappLink} target="_blank" rel="noopener noreferrer">
                  WhatsApp
                </a>
              )}
              {mailLink && (
                <a className="btn" href={mailLink}>
                  Open in mail
                </a>
              )}
              <button type="button" className="btn primary" onClick={copy}>
                Copy
              </button>
            </div>
          </div>

          {platform === 'email' && (
            <input
              className="mb-subject"
              aria-label="Subject"
              value={message.subject}
              onChange={editMessage('subject')}
              placeholder="Subject"
            />
          )}
          <textarea
            className={`mb-text ${format === 'call' ? 'script' : ''}`}
            value={message.body}
            onChange={editMessage('body')}
            spellCheck
            aria-label="Message"
          />
        </section>
      </div>

      {showTips && (
        <Modal title="Before you send" onClose={() => setShowTips(false)}>
          <div className="modal-body">
            <ul className="mb-tips">
              {TIPS.map((t) => (
                <li key={t.title}>
                  <b>{t.title}</b>
                  <span>
                    {t.text}{' '}
                    {t.link && (
                      <Link to={t.link} onClick={() => setShowTips(false)}>
                        Open it
                      </Link>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mb-tips-note">A template only starts the message. The details in it have to be true and yours.</p>
          </div>
        </Modal>
      )}
      {showMe && (
        <Modal title="Your details" onClose={() => setShowMe(false)}>
          <div className="modal-body">
            <div className="mb-me-grid">
              {ME_KEYS.map((key) => (
                <label key={key} className="field">
                  <span>{FIELD_META[key].label}</span>
                  <input
                    maxLength={160}
                    placeholder={FIELD_META[key].placeholder}
                    value={mine[key] || ''}
                    onChange={setMineField(key)}
                  />
                </label>
              ))}
            </div>
          </div>
          <div className="modal-foot">
            <button type="button" className="btn" onClick={reloadProfile}>
              Reload from profile
            </button>
            <button type="button" className="btn primary" onClick={saveProfile} disabled={saving}>
              {saving ? 'Saving…' : 'Save to profile'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
