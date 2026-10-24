import { useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../../api/http.js';
import { resumeBankApi } from '../../api/index.js';
import { useToast } from '../../store/ToastContext.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { Dropdown } from '../ui/Dropdown.jsx';
import { IconEdit, IconExternal, IconFile, IconLink, IconTrash } from '../ui/Icons.jsx';
import { Modal } from '../ui/Modal.jsx';

/**
 * Resume Studio → My Resumes.
 *
 * Every resume saved on the account (the same library Applications attaches
 * to job applications), grouped into version lines: the newest version is the
 * card, older ones sit underneath it. Each line says what it is for: general,
 * a specific company, or a specific role.
 */

const KINDS = [
  { value: 'general', label: 'General' },
  { value: 'company', label: 'Company-specific' },
  { value: 'role', label: 'Role-specific' },
];
const kindLabel = Object.fromEntries(KINDS.map((k) => [k.value, k.label]));

const date = (d) => new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const size = (b) => (b ? (b > 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`) : '');

/*
  One download per file per visit: the card thumbnail, the full preview and
  Open all reuse the same object URL. Kept for the page's lifetime; a few PDFs
  of tens of KB each is nothing to hold.
*/
const blobUrls = new Map();

const isPdfResume = (r) => r.source !== 'link' && (r.format || '').toLowerCase() === 'pdf';

/*
  The server pulls each CV from storage on every request, and that can take
  well over ten seconds on a slow link. One attempt gets this long; a request
  that has gone silent past it is dropped and tried again, rather than leaving
  the card on a spinner forever.
*/
const ATTEMPT_LIMIT_MS = 60_000;
/** Waits between attempts: 1s, 2s, 4s, 8s, then every 15s for as long as the card is on screen. */
const retryDelay = (attempt) => Math.min(15_000, 1000 * 2 ** (attempt - 1));

async function resumeObjectUrl(resume) {
  if (blobUrls.has(resume.id)) return blobUrls.get(resume.id);
  const controller = new AbortController();
  const limit = setTimeout(() => controller.abort(), ATTEMPT_LIMIT_MS);
  const pending = resumeBankApi
    .blob(resume.id, { signal: controller.signal })
    .then((data) => {
      const type = isPdfResume(resume) ? 'application/pdf' : data.type || 'application/octet-stream';
      return URL.createObjectURL(new Blob([data], { type }));
    })
    .finally(() => clearTimeout(limit));
  blobUrls.set(resume.id, pending);
  try {
    const url = await pending;
    blobUrls.set(resume.id, url);
    return url;
  } catch (err) {
    blobUrls.delete(resume.id);
    throw err;
  }
}

/**
 * The object URL for a PDF resume, retried until it arrives.
 *
 * Never gives up while mounted: a failed or timed-out attempt waits a little
 * (longer each time, capped at 15s) and goes again. `attempt` and `error` are
 * there so the loader can say it is retrying rather than look stuck.
 */
function useResumeUrl(resume) {
  const [state, setState] = useState({ url: null, error: '', attempt: 1 });
  useEffect(() => {
    if (!isPdfResume(resume)) return undefined;
    let cancelled = false;
    let timer;
    const tryLoad = (attempt) => {
      resumeObjectUrl(resume)
        .then((url) => !cancelled && setState({ url, error: '', attempt }))
        .catch((err) => {
          if (cancelled) return;
          setState({ url: null, error: errorMessage(err, 'Could not load the file'), attempt: attempt + 1 });
          timer = setTimeout(() => tryLoad(attempt + 1), retryDelay(attempt));
        });
    };
    setState({ url: null, error: '', attempt: 1 });
    tryLoad(1);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [resume.id]); // eslint-disable-line react-hooks/exhaustive-deps
  return state;
}

const BUILD_STEPS = [
  'Collecting your details',
  'Laying out experience',
  'Lining up projects',
  'Polishing bullet points',
  'Setting the type',
  'Rendering the page',
];

/**
 * What shows while a resume is on its way: a little page that writes itself —
 * name, contact line, sections, bullets — with a status line underneath. It
 * keeps going through retries, and says so, so a slow file reads as work in
 * progress rather than a broken card.
 */
function ResumeBuilding({ attempt = 1, error = '', large = false }) {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % BUILD_STEPS.length), 1600);
    return () => clearInterval(id);
  }, []);
  const retrying = attempt > 1;
  return (
    <span className={`rbk-build ${large ? 'large' : ''}`} role="status" aria-live="polite">
      <span className="rbk-build-page" aria-hidden="true">
        <span className="rbk-build-line name" />
        <span className="rbk-build-line contact" />
        <span className="rbk-build-line head" />
        <span className="rbk-build-line" />
        <span className="rbk-build-line short" />
        <span className="rbk-build-line" />
        <span className="rbk-build-line head" />
        <span className="rbk-build-line" />
        <span className="rbk-build-line short" />
        <span className="rbk-build-scan" />
      </span>
      <span className="rbk-build-status">
        {retrying ? (
          <>
            <b>Storage is slow — trying again</b>
            <small title={error}>attempt {attempt}</small>
          </>
        ) : (
          <b key={step} className="rbk-build-step">
            {BUILD_STEPS[step]}
            <span className="rbk-build-dots" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
          </b>
        )}
      </span>
    </span>
  );
}

/**
 * A PDF in the browser's viewer, with the builder over it until the viewer has
 * actually drawn — the file arriving is not the same as the page being on
 * screen, and a blank white box in between is the annoying part.
 */
function PdfFrame({ url, title, hash, attempt, error, large }) {
  const [drawn, setDrawn] = useState(false);
  useEffect(() => setDrawn(false), [url]);
  return (
    <>
      {url && (
        <iframe
          title={title}
          src={`${url}${hash}`}
          tabIndex={large ? 0 : -1}
          aria-hidden={large ? undefined : 'true'}
          className={drawn ? 'drawn' : ''}
          // The PDF viewer fires load a beat before it paints; a short grace hides the white flash.
          onLoad={() => setTimeout(() => setDrawn(true), 350)}
        />
      )}
      {!drawn && <ResumeBuilding attempt={attempt} error={error} large={large} />}
    </>
  );
}

/**
 * The first page of the resume, small, inside the card. The browser's PDF
 * viewer with its toolbar and side panel hidden; a transparent button on top
 * takes the click, so the whole thumbnail opens the full preview.
 */
function Thumb({ resume, onOpen }) {
  const pdf = isPdfResume(resume);
  const { url, error, attempt } = useResumeUrl(resume);
  return (
    <button type="button" className="rbk-thumb" onClick={onOpen} title="Open the full preview">
      {pdf ? (
        <PdfFrame
          url={url}
          title={`Thumbnail of ${resume.label}`}
          hash="#toolbar=0&navpanes=0&scrollbar=0&view=FitH"
          attempt={attempt}
          error={error}
        />
      ) : (
        <span className="rbk-thumb-none">
          <IconFile size={26} />
          <small>
            {resume.source === 'link'
              ? 'Link · click to open'
              : `${(resume.format || 'File').toUpperCase()} · no preview`}
          </small>
        </span>
      )}
      <span className="rbk-thumb-hint">Click to preview</span>
    </button>
  );
}

/**
 * Open a resume in a new tab. Uploaded files are fetched through the app's HTTP
 * client (which refreshes an expired session) and opened as a blob; the tab is
 * opened first, synchronously, so popup blockers allow it.
 */
async function openResume(resume) {
  if (resume.source === 'link') {
    window.open(resume.url, '_blank', 'noopener');
    return;
  }
  const tab = window.open('', '_blank');
  try {
    const url = await resumeObjectUrl(resume);
    if (tab) tab.location.href = url;
    else window.location.href = url;
  } catch {
    tab?.close();
    window.alert('Could not open that resume. Try again in a moment.');
  }
}

/** Group resumes into version lines, newest first in each and across lines. */
const toLines = (resumes) => {
  const byRoot = new Map();
  for (const r of resumes) {
    const root = r.family || r.id;
    if (!byRoot.has(root)) byRoot.set(root, []);
    byRoot.get(root).push(r);
  }
  return [...byRoot.values()]
    .map((list) => list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)))
    .sort((a, b) => new Date(b[0].createdAt) - new Date(a[0].createdAt));
};

/**
 * The resume, shown inside the app. PDFs render in the browser's own viewer
 * from the same streamed file endpoint the Open button uses; Word files and
 * links cannot be displayed inline by a browser, so they get Open instead.
 */
function Preview({ resume, onClose }) {
  const isPdf = isPdfResume(resume);
  const { url, error, attempt } = useResumeUrl(resume);

  return (
    <Modal title={resume.label} onClose={onClose} size="xl">
      <div className="rbk-preview">
        {isPdf ? (
          <PdfFrame
            url={url}
            title={`Preview of ${resume.label}`}
            hash="#view=FitH"
            attempt={attempt}
            error={error}
            large
          />
        ) : (
          <div className="rbk-preview-none">
            <IconFile size={28} />
            <p>
              {resume.source === 'link'
                ? 'This resume is a link to another site, which cannot be shown inside the app.'
                : `${(resume.format || 'This file').toUpperCase()} files cannot be previewed in the browser. Upload a PDF version to preview it here.`}
            </p>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn" onClick={() => openResume(resume)}>
          Open in new tab <IconExternal size={11} />
        </button>
        <button type="button" className="btn primary" onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}

function ResumeForm({ initial, lines, onClose, onSaved }) {
  const { toast } = useToast();
  const editing = Boolean(initial?.id);
  const [mode, setMode] = useState('file');
  const [file, setFile] = useState(null);
  const [url, setUrl] = useState('');
  const [form, setForm] = useState({
    label: initial?.label || '',
    kind: initial?.kind || 'general',
    company: initial?.company || '',
    role: initial?.role || '',
    notes: initial?.notes || '',
    versionOf: initial?.versionOf || '',
  });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const titleRef = useRef(null);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    const meta = {
      label: form.label.trim() || undefined,
      kind: form.kind,
      company: form.kind === 'company' || form.company ? form.company : '',
      role: form.role,
      notes: form.notes,
    };
    try {
      if (editing) {
        const saved = await resumeBankApi.update(initial.id, meta);
        onSaved(saved, 'Saved');
      } else {
        const body = { ...meta, versionOf: form.versionOf || undefined };
        const res =
          mode === 'file'
            ? await resumeBankApi.upload(file, body, setProgress)
            : await resumeBankApi.link({ url, ...body });
        onSaved(res.resume, res.existed ? 'You already had this file; details updated' : 'Resume added');
      }
    } catch (err) {
      toast(errorMessage(err, 'Could not save'), 'error');
      setBusy(false);
    }
  };

  const canSave = editing || (mode === 'file' ? Boolean(file) : Boolean(url.trim()));
  const lineOptions = [
    { value: '', label: 'No, this is a new resume' },
    ...lines.map((l) => ({ value: l[0].id, label: `New version of "${l[0].label}"`, note: `${l.length} version${l.length > 1 ? 's' : ''}` })),
  ];

  return (
    <Modal title={editing ? 'Edit resume details' : initial?.versionOf ? 'Upload a new version' : 'Add a resume'} onClose={onClose} initialFocus={titleRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          {!editing && (
            <>
              <div className="mb-seg small rbk-mode">
                <button type="button" className={mode === 'file' ? 'active' : ''} onClick={() => setMode('file')}>
                  Upload file
                </button>
                <button type="button" className={mode === 'link' ? 'active' : ''} onClick={() => setMode('link')}>
                  Paste a link
                </button>
              </div>
              {mode === 'file' ? (
                <label className="rbk-drop">
                  <input
                    type="file"
                    accept=".pdf,.doc,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword"
                    onChange={(e) => {
                      const f = e.target.files?.[0] || null;
                      setFile(f);
                      if (f && !form.label) setForm((x) => ({ ...x, label: f.name.replace(/\.[^.]+$/, '') }));
                    }}
                  />
                  <IconFile size={18} />
                  <span>{file ? `${file.name} · ${size(file.size)}` : 'Choose a PDF or Word file (up to 8 MB)'}</span>
                </label>
              ) : (
                <label className="field">
                  <span>Link (Google Drive, Dropbox…)</span>
                  <input type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
                </label>
              )}
            </>
          )}

          <label className="field">
            <span>Title</span>
            <input ref={titleRef} maxLength={80} placeholder="e.g. Backend SDE II, payments focus" value={form.label} onChange={set('label')} />
          </label>

          <div className="field">
            <span>Type</span>
            <div className="mb-seg small">
              {KINDS.map((k) => (
                <button key={k.value} type="button" className={form.kind === k.value ? 'active' : ''} onClick={() => setForm((f) => ({ ...f, kind: k.value }))}>
                  {k.label}
                </button>
              ))}
            </div>
          </div>

          <div className="field-row">
            <label className="field">
              <span>For company {form.kind === 'company' ? '' : '(optional)'}</span>
              <input maxLength={80} placeholder="Google" value={form.company} onChange={set('company')} required={form.kind === 'company'} />
            </label>
            <label className="field">
              <span>For role {form.kind === 'role' ? '' : '(optional)'}</span>
              <input maxLength={80} placeholder="SDE II, Backend" value={form.role} onChange={set('role')} required={form.kind === 'role'} />
            </label>
          </div>

          {!editing && lines.length > 0 && (
            <div className="field">
              <span>Is this a newer version of a resume you already have?</span>
              <Dropdown ariaLabel="Version of" value={form.versionOf} options={lineOptions} onChange={(v) => setForm((f) => ({ ...f, versionOf: v }))} />
            </div>
          )}

          <label className="field">
            <span>Notes (optional)</span>
            <textarea rows={2} maxLength={300} placeholder="What changed, where you sent it…" value={form.notes} onChange={set('notes')} />
          </label>
          {busy && mode === 'file' && !editing && <div className="rbk-progress"><span style={{ width: `${progress}%` }} /></div>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy || !canSave}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add resume'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function ResumeBank() {
  const { toast } = useToast();
  const [resumes, setResumes] = useState(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(null); // null | {} | { versionOf } | resume
  const [open, setOpen] = useState({});
  const [deleting, setDeleting] = useState(null);
  const [previewing, setPreviewing] = useState(null);

  const load = () =>
    resumeBankApi
      .list()
      .then(setResumes)
      .catch((err) => toast(errorMessage(err, 'Could not load your resumes'), 'error'));

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const lines = useMemo(() => toLines(resumes || []), [resumes]);
  const shown = lines.filter((l) => filter === 'all' || l[0].kind === filter);
  const counts = useMemo(() => {
    const c = { all: lines.length, general: 0, company: 0, role: 0 };
    for (const l of lines) c[l[0].kind] += 1;
    return c;
  }, [lines]);

  const onSaved = (_resume, message) => {
    setForm(null);
    toast(message, 'success');
    load();
  };

  /*
    A direct link to the resume. For a resume saved as a link, the original
    URL. For an uploaded file, the app's own file address: it opens straight
    to the PDF, but only for someone signed in to this account, because a CV
    carries your phone number and email and should not be readable by anyone
    the link is pasted to.
  */
  const copyUrl = async (resume) => {
    const url = resume.source === 'link' ? resume.url : new URL(resumeBankApi.fileUrl(resume.id), window.location.origin).href;
    try {
      await navigator.clipboard.writeText(url);
      toast(resume.source === 'link' ? 'Link copied' : 'URL copied (opens when you are signed in)', 'success');
    } catch {
      toast('Clipboard blocked', 'error');
    }
  };

  const remove = async () => {
    try {
      await resumeBankApi.remove(deleting.id);
      toast('Resume deleted', 'success');
      load();
    } catch (err) {
      toast(errorMessage(err, 'Could not delete'), 'error');
    }
    setDeleting(null);
  };

  return (
    <div className="rbk">
      <div className="rbk-bar">
        <div className="mb-seg small" role="tablist" aria-label="Type">
          {[{ value: 'all', label: 'All' }, ...KINDS].map((k) => (
            <button key={k.value} type="button" className={filter === k.value ? 'active' : ''} onClick={() => setFilter(k.value)}>
              {k.label} <span className="rbk-n">{counts[k.value]}</span>
            </button>
          ))}
        </div>
        <button type="button" className="btn primary" onClick={() => setForm({})}>
          + Add resume
        </button>
      </div>

      {!resumes ? (
        <p className="rbk-empty">Loading your resumes…</p>
      ) : shown.length === 0 ? (
        <p className="rbk-empty">
          {lines.length ? 'No resumes of this type yet.' : 'No resumes saved yet. Add your first one: a general version you can tailor later.'}
        </p>
      ) : (
        <div className="rbk-grid">
          {shown.map((line) => {
            const [latest, ...older] = line;
            const expanded = open[latest.id];
            return (
              <article key={latest.id} className="panel rbk-card">
                <Thumb resume={latest} onOpen={() => (latest.source === 'link' ? openResume(latest) : setPreviewing(latest))} />
                <div className="panel-body">
                  <div className="rbk-head">
                    <div className="rbk-title">
                      <button type="button" className="rbk-name" title={`Preview ${latest.label}`} onClick={() => setPreviewing(latest)}>
                        {latest.label}
                      </button>
                      <small>
                        {date(latest.createdAt)}
                        {latest.format ? ` · ${latest.format.toUpperCase()}` : ''}
                        {latest.bytes ? ` · ${size(latest.bytes)}` : ''}
                        {line.length > 1 ? ` · v${line.length}` : ''}
                      </small>
                    </div>
                  </div>

                  <div className="rbk-tags">
                    <span className={`rbk-kind ${latest.kind}`}>{kindLabel[latest.kind]}</span>
                    {latest.company && <span className="rbk-tag">{latest.company}</span>}
                    {latest.role && <span className="rbk-tag">{latest.role}</span>}
                    {latest.usedCount > 0 && <span className="rbk-tag muted">Used in {latest.usedCount} application{latest.usedCount > 1 ? 's' : ''}</span>}
                  </div>
                  {latest.notes && <p className="rbk-notes">{latest.notes}</p>}

                  <div className="rbk-actions">
                    <button type="button" className="btn rbk-open" onClick={() => openResume(latest)} title="Open in a new tab">
                      Open <IconExternal size={11} />
                    </button>
                    <button type="button" className="btn" onClick={() => copyUrl(latest)} title="Copy a direct link to this resume">
                      <IconLink size={12} /> Copy URL
                    </button>
                    <button type="button" className="btn" onClick={() => setForm({ versionOf: latest.id, kind: latest.kind, company: latest.company, role: latest.role, label: latest.label })}>
                      New version
                    </button>
                    {/* Edit and Delete as icons on the right, so the row never wraps. */}
                    <span className="rbk-actions-end">
                      <button type="button" className="rbk-iconbtn" onClick={() => setForm(latest)} title="Edit details" aria-label={`Edit ${latest.label}`}>
                        <IconEdit size={14} />
                      </button>
                      <button type="button" className="rbk-iconbtn danger" onClick={() => setDeleting(latest)} title="Delete" aria-label={`Delete ${latest.label}`}>
                        <IconTrash size={14} />
                      </button>
                    </span>
                  </div>

                  {older.length > 0 && (
                    <div className="rbk-older">
                      <button type="button" className="mb-link" onClick={() => setOpen((o) => ({ ...o, [latest.id]: !expanded }))}>
                        {expanded ? '▾' : '▸'} Older versions ({older.length})
                      </button>
                      {expanded && (
                        <ul>
                          {older.map((r, i) => (
                            <li key={r.id}>
                              <span>
                                v{older.length - i} · {r.label} <small>{date(r.createdAt)}</small>
                              </span>
                              <span className="rbk-older-actions">
                                <button type="button" className="mb-link" onClick={() => setPreviewing(r)}>
                                  Preview
                                </button>
                                <button type="button" className="mb-link" onClick={() => openResume(r)}>
                                  Open
                                </button>
                                <button type="button" className="mb-link" onClick={() => setDeleting(r)}>
                                  Delete
                                </button>
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {form && (
        <ResumeForm
          initial={form.id ? form : { ...form, label: form.versionOf ? '' : form.label }}
          lines={lines}
          onClose={() => setForm(null)}
          onSaved={onSaved}
        />
      )}
      {previewing && <Preview resume={previewing} onClose={() => setPreviewing(null)} />}
      {deleting && (
        <ConfirmDialog
          title="Delete this resume?"
          message={`"${deleting.label}" will be deleted.${deleting.usedCount ? ' Applications that used it keep their record of it.' : ''}`}
          confirmLabel="Delete"
          tone="danger"
          onConfirm={remove}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
