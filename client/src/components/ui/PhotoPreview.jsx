import { useRef, useState } from 'react';
import { Avatar } from './Avatar.jsx';
import { IconClose } from './Icons.jsx';
import { useDialog } from './useDialog.js';

/**
 * One picture, as big as it actually is.
 *
 * Not a Modal: a modal is a card with a titled header, and wrapping a photo in
 * chrome shrinks the only thing anyone opened it for. It still goes through
 * `useDialog`, which is what suppresses the page's single-key shortcuts and
 * handles Escape — an overlay that skips that hook is invisible to the guard,
 * and pressing "s" here would toggle a problem on the roadmap behind it.
 *
 * Avatars are stored as a 512px square, so the image is capped there rather
 * than stretched to the viewport: past its real size there is nothing more to
 * see, only a softer version of the same face.
 */
export function PhotoPreview({ src, name, caption, onClose }) {
  const panelRef = useRef(null);
  useDialog(panelRef, { onClose });

  return (
    <div
      className="overlay photo-overlay"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <figure
        className="photo-preview"
        role="dialog"
        aria-modal="true"
        aria-label={name ? `${name}’s profile picture` : 'Profile picture'}
        ref={panelRef}
        tabIndex={-1}
      >
        <button type="button" className="photo-close" onClick={onClose} aria-label="Close preview">
          <IconClose size={14} />
        </button>

        <img src={src} alt={name ? `${name}’s profile picture` : 'Profile picture'} />

        {(name || caption) && (
          <figcaption>
            {name && <b>{name}</b>}
            {caption && <span>{caption}</span>}
          </figcaption>
        )}
      </figure>
    </div>
  );
}

/**
 * An avatar you can click to see properly.
 *
 * Falls back to a plain `Avatar` when there is no picture — enlarging two
 * generated initials is a dead end, and a button that opens nothing is worse
 * than no button. So the pointer cursor and the hover ring only ever appear on
 * avatars that have something behind them.
 */
export function AvatarButton({ name, email, src, size = 28, className = '', caption }) {
  const [open, setOpen] = useState(false);

  if (!src) return <Avatar name={name} email={email} size={size} className={className} />;

  return (
    <>
      <button
        type="button"
        className="avatar-zoom"
        style={{ borderRadius: size >= 48 ? 10 : 6 }}
        onClick={() => setOpen(true)}
        title={`View ${name || 'profile'} photo`}
        aria-label={`View ${name ? `${name}’s` : ''} profile picture`}
      >
        <Avatar name={name} email={email} src={src} size={size} className={className} />
      </button>

      {open && (
        <PhotoPreview
          src={src}
          name={name}
          caption={caption ?? email}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
