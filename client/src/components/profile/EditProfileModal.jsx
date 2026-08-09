import { useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { authApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { useToast } from '../../store/ToastContext.jsx';
import { Modal } from '../ui/Modal.jsx';
import { ProfileFields } from './ProfileFields.jsx';

/** The signed-in user editing their own details. */
export function EditProfileModal({ onClose }) {
  const { user, applyUser } = useAuth();
  const { success, error } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [profile, setProfile] = useState(() => ({ ...(user?.profile || {}) }));
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) return error('Give yourself a name');

    setBusy(true);
    try {
      // Returns the whole user, so the sidebar and topbar update with it.
      applyUser(await authApi.updateMe({ name: name.trim(), profile }));
      success('Profile updated');
      onClose();
    } catch (err) {
      error(errorMessage(err, 'Could not save your profile'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal title="Edit your profile" onClose={onClose} size="lg">
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} autoFocus />
          </label>

          <ProfileFields value={profile} onChange={setProfile} />
        </div>

        <div className="modal-foot">
          <button type="button" className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving...' : 'Save profile'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
