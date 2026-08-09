import { useEffect, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { adminApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { ASSIGNABLE_ROLES, ROLE_LABEL, can } from '../../store/caps.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ProfileFields } from '../profile/ProfileFields.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { Modal } from '../ui/Modal.jsx';
import { PasswordField } from '../ui/PasswordField.jsx';
import { AvatarButton } from '../ui/PhotoPreview.jsx';

/**
 * Everything you can do to one account.
 *
 * The confirmations here are tiered on purpose. Editing a name is not
 * confirmed; changing the email that someone signs in with is; deleting the
 * account needs that email typed out. A dialog on every action would train the
 * reflex that defeats the one dialog that matters.
 */
export function UserDetailModal({ userId, onClose, onChanged }) {
  const { user: me, applyUser } = useAuth();
  const { success, error } = useToast();

  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState(null);
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(null);

  useEffect(() => {
    adminApi
      .user(userId)
      .then((res) => {
        setData(res);
        setForm({
          name: res.user.name,
          email: res.user.email,
          profile: { ...(res.user.profile || {}) },
        });
      })
      .catch((err) => setLoadError(errorMessage(err, 'Could not load that account')));
  }, [userId]);

  const isSelf = data?.user?._id === me._id;
  const isSuper = data?.user?.role === 'super_admin';
  // The pinned owner is unmanageable from here — the server refuses it too.
  const locked = isSuper && !isSelf;

  const run = async (task, message) => {
    setBusy(true);
    try {
      const result = await task;
      success(message);
      setConfirming(null);
      onChanged?.();
      return result;
    } catch (err) {
      error(errorMessage(err, 'That did not work'));
      return null;
    } finally {
      setBusy(false);
    }
  };

  const saveDetails = async () => {
    const updated = await run(
      adminApi.updateUser(userId, {
        name: form.name.trim(),
        email: form.email.trim(),
        profile: form.profile,
      }),
      'Details saved',
    );
    // Editing yourself must refresh the session copy, or the sidebar and topbar
    // keep showing the old name until a reload.
    if (updated && isSelf) applyUser({ ...me, ...updated, caps: me.caps });
  };

  if (loadError) {
    return (
      <Modal title="Account" onClose={onClose}>
        <div className="modal-body">
          <div className="alert">{loadError}</div>
        </div>
      </Modal>
    );
  }
  if (!data) {
    return (
      <Modal title="Account" onClose={onClose}>
        <div className="modal-body">
          <div className="loading">Loading...</div>
        </div>
      </Modal>
    );
  }

  const { user, stats } = data;
  const emailChanged = form.email.trim() !== user.email;
  const canWrite = can(me, 'user:write') && !locked;

  return (
    <>
      <Modal title={user.name} onClose={onClose} size="lg">
        <div className="modal-body">
          <div className="admin-person admin-person-lg">
            <AvatarButton name={user.name} email={user.email} src={user.avatar?.url} size={56} />
            <div>
              <b>{user.email}</b>
              <span className="hint">
                <span className={`role-pill ${user.role}`}>{ROLE_LABEL[user.role]}</span>
                {stats.solved} solved · {stats.attempted} attempted · {stats.problemsAdded} added
              </span>
            </div>
          </div>

          {locked && (
            <div className="alert" style={{ marginTop: 12 }}>
              This is the super admin account. It is pinned to an address in the server’s
              environment and cannot be changed from here.
            </div>
          )}

          <div className="field-row" style={{ marginTop: 14 }}>
            <label className="field" style={{ flex: 1 }}>
              <span>Name</span>
              <input
                value={form.name}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </label>
            <label className="field" style={{ flex: 1 }}>
              <span>Email</span>
              <input
                value={form.email}
                disabled={!canWrite}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              {emailChanged && (
                <span className="field-hint warn">This is how they sign in.</span>
              )}
            </label>
          </div>

          {/* The same component the user's own edit dialog uses, so the two
              forms cannot disagree about what a profile contains. */}
          <ProfileFields
            value={form.profile}
            disabled={!canWrite}
            onChange={(profile) => setForm({ ...form, profile })}
          />

          {canWrite && (
            <button
              className="btn primary"
              disabled={busy}
              onClick={() => (emailChanged ? setConfirming('email') : saveDetails())}
            >
              {busy ? 'Saving...' : 'Save details'}
            </button>
          )}

          {/* --- role --- */}
          {can(me, 'user:role') && !locked && (
            <div className="admin-zone">
              <div className="admin-zone-head">Role</div>
              {isSelf ? (
                <p className="hint">
                  You cannot change your own role — that is how someone locks themselves out.
                </p>
              ) : (
                <div className="filterbar" style={{ padding: 0 }}>
                  <select
                    className="select"
                    value={user.role}
                    disabled={busy}
                    onChange={(e) => setConfirming({ kind: 'role', role: e.target.value })}
                  >
                    {ASSIGNABLE_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {ROLE_LABEL[r]}
                      </option>
                    ))}
                  </select>
                  <span className="hint">Super admin is pinned in the server’s environment.</span>
                </div>
              )}
            </div>
          )}

          {/* --- danger zone --- */}
          {(can(me, 'user:password') || can(me, 'user:delete')) && !locked && (
            <div className="admin-zone danger">
              <div className="admin-zone-head">Danger zone</div>

              {can(me, 'user:password') && (
                <>
                  <PasswordField
                    label="Set a new password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    hint="Signs them out of every device within 15 minutes."
                  />
                  <div className="admin-zone-acts">
                    <button
                      className="btn"
                      disabled={busy || password.length < 8}
                      onClick={() => setConfirming('password')}
                    >
                      Set password
                    </button>
                    <button className="btn" disabled={busy} onClick={() => setConfirming('revoke')}>
                      Sign out everywhere
                    </button>
                  </div>
                </>
              )}

              {can(me, 'user:delete') && !isSelf && (
                <div className="admin-zone-acts" style={{ marginTop: 10 }}>
                  <button className="btn danger" disabled={busy} onClick={() => setConfirming('delete')}>
                    Delete this account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Close
          </button>
        </div>
      </Modal>

      {confirming === 'email' && (
        <ConfirmDialog
          title="Change their sign-in email?"
          message={`${user.email} becomes ${form.email.trim()}.`}
          detail="This is the address they sign in with. If they did not ask for this, they will be locked out of their account."
          confirmLabel="Change email"
          busy={busy}
          onConfirm={saveDetails}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming?.kind === 'role' && (
        <ConfirmDialog
          title="Change this role?"
          message={`${user.name} becomes ${ROLE_LABEL[confirming.role]}.`}
          detail={
            confirming.role === 'user'
              ? 'They lose access to the admin panel entirely.'
              : `They will be able to open the admin panel${
                  confirming.role === 'admin' ? ', manage accounts and set passwords' : ' and edit pattern guides'
                }.`
          }
          confirmLabel="Change role"
          busy={busy}
          onConfirm={() => run(adminApi.setRole(userId, confirming.role), 'Role changed')}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'password' && (
        <ConfirmDialog
          title="Set a new password?"
          message={`${user.email} will only be able to sign in with the password you just typed.`}
          detail="Every device they are signed in on is signed out within 15 minutes. They are not told this happened."
          confirmLabel="Set password"
          tone="danger"
          busy={busy}
          onConfirm={() =>
            run(adminApi.setPassword(userId, password), 'Password set').then(() => setPassword(''))
          }
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'revoke' && (
        <ConfirmDialog
          title="Sign them out everywhere?"
          message={`${user.email} is signed out on every device.`}
          detail="Takes effect within 15 minutes. Their password still works, so they can sign straight back in."
          confirmLabel="Sign out everywhere"
          busy={busy}
          onConfirm={() => run(adminApi.revokeSessions(userId), 'Sessions revoked')}
          onCancel={() => setConfirming(null)}
        />
      )}

      {confirming === 'delete' && (
        <ConfirmDialog
          title="Delete this account?"
          message={`Permanently deletes ${user.email}.`}
          detail={`Their ${stats.solved + stats.attempted} progress rows, notes, attempts and profile picture go with it. Problems they contributed to the shared list stay. This cannot be undone.`}
          confirmLabel="Delete account"
          tone="danger"
          confirmText={user.email}
          busy={busy}
          onConfirm={() =>
            run(adminApi.deleteUser(userId), 'Account deleted').then((ok) => ok && onClose())
          }
          onCancel={() => setConfirming(null)}
        />
      )}
    </>
  );
}
