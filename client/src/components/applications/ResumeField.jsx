import { useEffect, useRef, useState } from 'react';

import { applicationsApi, authApi } from '../../api/index.js';
import { baseURL, errorMessage } from '../../api/http.js';
import { useToast } from '../../store/ToastContext.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import { IconExternal, IconFile, IconLink, IconUpload } from '../ui/Icons.jsx';

/**
 * Which CV this application went out with.
 *
 * Three ways to answer, in the order people actually need them: pick one you
 * have already sent somewhere (the common case — a hunt uses three or four CVs
 * across fifty applications), upload a new file, or paste a link to one that
 * lives in Drive.
 *
 * ---------------------------------------------------------------------------
 * The same file is never uploaded twice, and the check happens *before* any
 * bytes move.
 *
 * Picking a file hashes it here, in the browser, with the Web Crypto API, and
 * asks the server whether that hash is already in the library. On a hit the
 * existing row is attached and the upload never happens — so re-attaching the
 * CV you sent to nine other companies under a new filename is one small request
 * rather than a second copy in the cloud. Only a miss uploads, and the server
 * hashes what it receives again before storing, so the browser's answer is a
 * shortcut and never the thing that decides.
 *
 * `crypto.subtle` only exists on a secure origin — https, or localhost. On
 * anything else this skips straight to the upload and the server's own check
 * does the deduping, which costs the transfer and nothing else.
 * ---------------------------------------------------------------------------
 *
 * Controlled: `value` is the snapshot the application carries, and `onChange`
 * receives a library id (or `null`) and the row it names. The field never writes to the application
 * itself, so the add dialog and the drawer can both use it — one holds the id
 * until the card is created, the other saves it on the spot.
 */

/**
 * Open a CV in a new tab.
 *
 * An uploaded CV is never opened from its Cloudinary address. New Cloudinary
 * accounts refuse to deliver PDFs from the public CDN at all — the link answers
 * 401 and the browser says "Failed to load PDF document" — and a CV with your
 * phone number on it should not be readable by anyone the link reaches anyway.
 * So it opens through `/applications/resumes/:id/file`, which streams it from
 * behind this account's session. A pasted Drive link is opened as it is.
 *
 * Two details that each break it if dropped:
 *
 *   - The tab is opened *synchronously*, inside the click, and pointed at the
 *     file afterwards. A `window.open` after an `await` is no longer the user's
 *     gesture as far as a popup blocker is concerned.
 *   - The session is refreshed first. A plain navigation cannot replay itself
 *     after a silent token refresh the way an API call does, so fifteen minutes
 *     into a session the file route would answer 401. One cheap authenticated
 *     call through the API client renews the cookie before the tab asks.
 */
export async function openResume(resume) {
  if (!resume?.url) return;
  if (!resume.id) {
    /* Deleted from the library: the stored link is all there is. */
    window.open(resume.url, '_blank', 'noopener');
    return;
  }

  const tab = window.open('about:blank', '_blank');
  try {
    await authApi.me();
    const target = `${baseURL}/applications/resumes/${resume.id}/file`;
    if (tab) tab.location.href = target;
    else window.location.href = target;
  } catch {
    tab?.close();
  }
}

const ACCEPT = '.pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const MAX_BYTES = 8 * 1024 * 1024;

async function sha256(file) {
  if (!globalThis.crypto?.subtle) return null;
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

const size = (bytes) =>
  bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.round(bytes / 1024)} KB`;

export function ResumeField({ value, onChange, disabled }) {
  const { success, error: toastError } = useToast();
  const fileRef = useRef(null);

  const [library, setLibrary] = useState(null);
  const [mode, setMode] = useState(null);
  const [link, setLink] = useState('');
  const [busy, setBusy] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let live = true;
    applicationsApi
      .resumes()
      .then((rows) => live && setLibrary(rows))
      .catch(() => live && setLibrary([]));
    return () => {
      live = false;
    };
  }, []);

  const remember = (resume) =>
    setLibrary((rows) => [resume, ...(rows || []).filter((row) => row.id !== resume.id)]);

  const choose = (resume) => {
    remember(resume);
    onChange(resume.id, resume);
    setMode(null);
  };

  const pickFile = async (file) => {
    if (!file) return;
    if (file.size > MAX_BYTES) {
      toastError(`That file is ${size(file.size)} — a CV should be under 8 MB.`);
      return;
    }

    try {
      setBusy('Checking…');
      const hash = await sha256(file);
      const known = hash ? await applicationsApi.checkResume(hash) : null;

      if (known) {
        /* The whole point of hashing first. */
        choose(known);
        success(`Already in your library as “${known.label}” — nothing uploaded.`);
        return;
      }

      setBusy('Uploading…');
      setProgress(0);
      const { resume, existed } = await applicationsApi.uploadResume(file, '', setProgress);
      choose(resume);
      success(existed ? `Matched “${resume.label}” — nothing new stored.` : `Uploaded “${resume.label}”.`);
    } catch (err) {
      toastError(errorMessage(err, 'Could not save that CV'));
    } finally {
      setBusy('');
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const saveLink = async () => {
    if (!link.trim()) return;
    try {
      setBusy('Saving…');
      const { resume, existed } = await applicationsApi.linkResume(link.trim());
      choose(resume);
      setLink('');
      if (existed) success(`That link is already saved as “${resume.label}”.`);
    } catch (err) {
      toastError(errorMessage(err, 'Could not save that link'));
    } finally {
      setBusy('');
    }
  };

  const options = (library || []).map((resume) => ({
    value: resume.id,
    label: resume.label,
    note: [
      resume.source === 'link' ? 'link' : resume.format?.toUpperCase(),
      resume.usedCount ? `sent to ${resume.usedCount}` : 'not used yet',
    ]
      .filter(Boolean)
      .join(' · '),
  }));

  return (
    <div className="ap-resume">
      {value?.url ? (
        <div className="ap-resume-current">
          <IconFile size={14} />
          <a
            href={value.url}
            target="_blank"
            rel="noreferrer noopener"
            title="Open it"
            onClick={(event) => {
              event.preventDefault();
              openResume(value);
            }}
          >
            {value.label || 'Your CV'}
            <IconExternal size={10} />
          </a>
          {/*
            A snapshot whose library row has been deleted still names the CV it
            was — see the note on the server model. Said here so a missing
            "change" target does not look like a bug.
          */}
          {!value.id && <span className="ap-muted">removed from your library</span>}
          <span className="spacer" />
          <button
            type="button"
            className="link-btn"
            disabled={disabled || Boolean(busy)}
            onClick={() => onChange(null, null)}
          >
            Remove
          </button>
        </div>
      ) : (
        <p className="ap-muted ap-resume-none">No CV recorded for this one.</p>
      )}

      <div className="ap-resume-actions">
        {options.length > 0 && (
          <Dropdown
            ariaLabel="Pick a CV you have used before"
            placeholder={value?.url ? 'Switch to another…' : 'Pick one you have sent before…'}
            value={value?.id || ''}
            options={options}
            onChange={(id) => onChange(id, library.find((row) => row.id === id) || null)}
            disabled={disabled || Boolean(busy)}
            searchable
          />
        )}

        <button
          type="button"
          className="btn sm"
          disabled={disabled || Boolean(busy)}
          onClick={() => fileRef.current?.click()}
        >
          <IconUpload size={11} />
          Upload
        </button>
        <button
          type="button"
          className={`btn sm ${mode === 'link' ? 'on' : ''}`}
          disabled={disabled || Boolean(busy)}
          onClick={() => setMode((current) => (current === 'link' ? null : 'link'))}
        >
          <IconLink size={11} />
          Paste a link
        </button>

        <input
          ref={fileRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(event) => pickFile(event.target.files?.[0])}
        />
      </div>

      {/*
        A row, not a <form>. This field also lives inside the add dialog, which
        is a form already, and a nested form's submit bubbles to the outer one
        in React — pressing Enter on the link would have created the
        application. Enter is handled here instead, and stopped here.
      */}
      {mode === 'link' && (
        <div className="ap-resume-link">
          <input
            autoFocus
            value={link}
            maxLength={2000}
            placeholder="https://drive.google.com/…"
            onChange={(event) => setLink(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              event.stopPropagation();
              saveLink();
            }}
          />
          <button
            type="button"
            className="btn primary sm"
            disabled={!link.trim() || Boolean(busy)}
            onClick={saveLink}
          >
            Save
          </button>
        </div>
      )}

      {busy && (
        <p className="ap-muted ap-resume-busy">
          {busy}
          {busy === 'Uploading…' && progress > 0 ? ` ${progress}%` : ''}
        </p>
      )}
    </div>
  );
}
