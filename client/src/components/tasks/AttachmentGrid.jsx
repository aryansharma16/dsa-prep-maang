import { useRef, useState } from 'react';
import { IconExternal, IconFile, IconTrash, IconUpload } from '../ui/Icons.jsx';

/** 1.2 MB reads better than 1258291 bytes on a tile three inches wide. */
const size = (bytes) => {
  if (!bytes) return '';
  const mb = bytes / (1024 * 1024);
  return mb >= 1 ? `${mb.toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
};

/**
 * Screenshots and PDFs on a task.
 *
 * Drop, pick, or paste. Paste is the one worth having: the thing most often
 * attached to a task like this is a screenshot of a failing test, and the
 * shortest path from the screen to the task is Cmd-Shift-4 then Cmd-V — the
 * notes editor already makes exactly this argument.
 *
 * URLs here are signed and expire in fifteen minutes. They are refreshed every
 * time the task is read, which is why nothing tries to cache one.
 */
export function AttachmentGrid({ attachments, onUpload, onRemove, busy, progress }) {
  const [over, setOver] = useState(false);
  const fileRef = useRef(null);

  const take = (files) => {
    const list = [...(files || [])];
    if (list.length) onUpload(list);
  };

  return (
    <div className="tk-files">
      {attachments.length > 0 && (
        <ul className="tk-file-list">
          {attachments.map((file) => (
            <li key={file.id || file.url} className="tk-file">
              {file.kind === 'image' && file.url ? (
                <a href={file.url} target="_blank" rel="noreferrer" className="tk-file-thumb">
                  <img src={file.url} alt={file.name} loading="lazy" />
                </a>
              ) : (
                <span className="tk-file-thumb doc">
                  <IconFile size={16} />
                </span>
              )}

              <span className="tk-file-meta">
                <span className="tk-file-name" title={file.name}>
                  {file.name}
                </span>
                <span className="hint dim mono">{size(file.bytes)}</span>
              </span>

              {file.url && (
                <a
                  href={file.url}
                  target="_blank"
                  rel="noreferrer"
                  className="icon-btn"
                  aria-label={`Open ${file.name}`}
                  title="Open"
                >
                  <IconExternal size={12} />
                </a>
              )}
              <button
                type="button"
                className="icon-btn"
                aria-label={`Remove ${file.name}`}
                title="Remove"
                onClick={() => onRemove(file)}
              >
                <IconTrash size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      <div
        className={`tk-drop ${over ? 'over' : ''} ${busy ? 'busy' : ''}`}
        onDragOver={(event) => {
          event.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(event) => {
          event.preventDefault();
          setOver(false);
          take(event.dataTransfer.files);
        }}
      >
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="image/*,application/pdf"
          hidden
          onChange={(event) => {
            take(event.target.files);
            // Cleared so picking the same file twice in a row still fires.
            event.target.value = '';
          }}
        />
        <button
          type="button"
          className="btn ghost"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload size={12} />
          {busy ? `Uploading… ${progress || 0}%` : 'Attach files'}
        </button>
        <span className="hint dim">or drop them here — images and PDFs, up to 25MB each</span>
      </div>
    </div>
  );
}
