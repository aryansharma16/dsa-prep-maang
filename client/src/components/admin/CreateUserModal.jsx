import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { ASSIGNABLE_ROLES, ROLE_LABEL } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { IconCopy } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';
import { PasswordField } from '../ui/PasswordField.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';

/**
 * Making an account for someone.
 *
 * There is no invite email in this app, so the password is the deliverable: the
 * dialog does not close on success, it turns into the credentials to hand over.
 * Closing straight away would be the one failure this form cannot recover from
 * — the account exists, and nobody knows how to sign in to it.
 */

/** What each role actually means, in the words the panel elsewhere uses. */
const ROLE_NOTE = {
  user: 'A learner. No admin panel.',
  dev_member: 'Edits pattern guides and account details. No passwords, no curriculum.',
  admin: 'Everything a dev member can do, plus setting passwords.',
};

const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * A password worth the trouble of copying.
 *
 * `crypto.getRandomValues` rather than `Math.random`, and the alphabet drops
 * the characters that are read wrong when this gets sent over chat — no l/1/I,
 * no O/0. Modulo bias over 56 symbols is not worth a rejection loop here.
 */
function generatePassword(length = 16) {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return [...bytes].map((b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function CreateUserModal({ onClose, onCreated }) {
  const { success, error } = useToast();

  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'user' });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState('');
  // Set once the account exists. Holds the password, which the server will
  // never give back — this state is the only copy left.
  const [done, setDone] = useState(null);
  const [copied, setCopied] = useState(false);

  const set = (patch) => setForm((f) => ({ ...f, ...patch }));

  const ready =
    form.name.trim().length > 0 && form.email.trim().length > 3 && form.password.length >= 8;

  const submit = async (event) => {
    event.preventDefault();
    if (!ready || busy) return;

    setBusy(true);
    setFailed('');
    try {
      const user = await adminApi.createUser({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
      });
      success(`${user.email} created`);
      setDone({ user, password: form.password });
      // Refresh the list behind the dialog now, not on close — the new row
      // should be there the moment it is dismissed.
      onCreated?.();
    } catch (err) {
      setFailed(errorMessage(err, 'Could not create that account'));
    } finally {
      setBusy(false);
    }
  };

  const copyCredentials = async () => {
    try {
      await navigator.clipboard.writeText(`${done.user.email}\n${done.password}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      error('Your browser would not let the page copy that');
    }
  };

  const another = () => {
    setForm({ name: '', email: '', password: '', role: form.role });
    setDone(null);
    setFailed('');
  };

  if (done) {
    return (
      <Modal title="Account created" onClose={onClose}>
        <div className="modal-body">
          <p className="confirm-message">
            <b>{done.user.name}</b> can sign in now as{' '}
            <span className={`role-pill ${done.user.role}`}>{ROLE_LABEL[done.user.role]}</span>
          </p>
          <p className="hint">
            This password is not stored anywhere you can read it back. Send it on before you close
            this, and ask them to change it.
          </p>

          <div className="cred-block">
            <div className="cred-row">
              <span className="k">Email</span>
              <span className="v mono">{done.user.email}</span>
            </div>
            <div className="cred-row">
              <span className="k">Password</span>
              <span className="v mono">{done.password}</span>
            </div>
            <button type="button" className="btn" onClick={copyCredentials}>
              <IconCopy size={13} />
              {copied ? 'Copied' : 'Copy both'}
            </button>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={another}>
            Create another
          </button>
          <button type="button" className="btn primary" onClick={onClose}>
            Done
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title="New account" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {failed && <div className="alert">{failed}</div>}

          <label className="field">
            <span>Name</span>
            <input
              value={form.name}
              disabled={busy}
              placeholder="Aryan Sharma"
              onChange={(e) => set({ name: e.target.value })}
            />
          </label>

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              value={form.email}
              disabled={busy}
              autoComplete="off"
              spellCheck={false}
              placeholder="them@example.com"
              onChange={(e) => set({ email: e.target.value })}
            />
            <span className="field-hint">This is what they sign in with.</span>
          </label>

          <PasswordField
            label="First password"
            value={form.password}
            disabled={busy}
            autoComplete="new-password"
            placeholder="At least 8 characters"
            onChange={(e) => set({ password: e.target.value })}
          />
          <button
            type="button"
            className="link-btn"
            style={{ marginTop: -6 }}
            disabled={busy}
            onClick={() => set({ password: generatePassword() })}
          >
            Generate one
          </button>

          <div className="field" style={{ marginTop: 14, marginBottom: 0 }}>
            <span>Role</span>
            <Dropdown
              ariaLabel="Role"
              value={form.role}
              disabled={busy}
              onChange={(v) => set({ role: v })}
              options={ASSIGNABLE_ROLES.map((role) => ({
                value: role,
                label: ROLE_LABEL[role],
                note: ROLE_NOTE[role],
              }))}
            />
            <span className="field-hint">{ROLE_NOTE[form.role]}</span>
          </div>
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose} disabled={busy}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={!ready || busy}>
            {busy ? 'Creating...' : 'Create account'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
