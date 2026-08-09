import { useRef, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { authApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { AvatarButton } from '../ui/PhotoPreview.jsx';

const MAX_MB = 5;
const ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/avif';

/**
 * The profile picture, and the controls for changing it.
 *
 * `children` is the identity text — name and email — because it belongs in the
 * same column as the buttons: the card is under 300px wide, and picture, text
 * and actions as three side-by-side columns leaves none of them enough room.
 *
 * The file is checked here before it is sent — not because the server trusts
 * the browser, but because a five-megabyte upload that ends in a 400 wastes the
 * user's bandwidth to tell them something both ends already knew.
 */
export function AvatarUpload({ size = 72, children }) {
  const { user, applyUser } = useAuth();
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState('');
  // Shown while the upload is in flight, so the new picture appears the moment
  // it is picked instead of a second later.
  const [preview, setPreview] = useState('');

  const run = async (task) => {
    setBusy(true);
    setError('');
    try {
      applyUser(await task);
    } catch (err) {
      setError(errorMessage(err, 'Could not update your picture'));
    } finally {
      setBusy(false);
      setProgress(0);
      setPreview((url) => {
        if (url) URL.revokeObjectURL(url);
        return '';
      });
    }
  };

  const onPick = (event) => {
    const file = event.target.files?.[0];
    // Reset immediately, or picking the same file twice in a row fires nothing.
    event.target.value = '';
    if (!file) return;

    if (!ACCEPT.split(',').includes(file.type)) {
      setError('Pick a JPEG, PNG, WebP, GIF or AVIF image');
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setError(`That image is ${(file.size / 1024 / 1024).toFixed(1)}MB — the limit is ${MAX_MB}MB`);
      return;
    }

    setPreview(URL.createObjectURL(file));
    run(authApi.uploadAvatar(file, setProgress));
  };

  return (
    <div className="avatar-edit">
      <div className="avatar-edit-img">
        {/* Clicking it opens the picture full size. Nothing to guard while an
            upload is in flight — the veil below sits over the button. */}
        <AvatarButton
          name={user?.name}
          email={user?.email}
          src={preview || user?.avatar?.url}
          size={size}
        />
        {busy && (
          <span className="avatar-edit-veil" role="progressbar" aria-valuenow={progress}>
            {progress > 0 && progress < 100 ? `${progress}%` : '…'}
          </span>
        )}
      </div>

      <div className="avatar-edit-body">
        {children}

        <div className="avatar-edit-actions">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            onChange={onPick}
            className="sr-only"
            tabIndex={-1}
            aria-hidden="true"
          />
          <button
            type="button"
            className="link-btn"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
          >
            {user?.avatar?.url ? 'Change photo' : 'Add photo'}
          </button>
          {user?.avatar?.url && (
            <>
              <span className="avatar-edit-dot">·</span>
              <button
                type="button"
                className="link-btn danger"
                onClick={() => run(authApi.removeAvatar())}
                disabled={busy}
              >
                Remove
              </button>
            </>
          )}
        </div>

        {error && <p className="avatar-edit-error">{error}</p>}
      </div>
    </div>
  );
}
