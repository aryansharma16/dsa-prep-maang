import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { interviewApi } from '../api/index.js';
import { CompanyMark } from '../components/applications/CompanyMark.jsx';
import { contactChecks } from '../interview/contactChecks.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import { Dropdown } from '../components/ui/Dropdown.jsx';
import {
  IconCopy,
  IconEdit,
  IconExternal,
  IconLinkedin,
  IconLock,
  IconMail,
  IconNote,
  IconPhone,
  IconTrash,
} from '../components/ui/Icons.jsx';
import { Modal } from '../components/ui/Modal.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * Interview Helper → MAANG Recruiter Directory.
 *
 * A private contact book of recruiters, one per account: the server filters
 * every read and write by owner, so nobody else using the app sees these rows.
 * Paged on the server, 20 contacts per request; search, company and status
 * filters run in the query, so the page only ever holds what it shows.
 *
 * The main 100 contacts are locked: everyone sees them, nobody can change them.
 * Users add their own on top and can edit or delete only those (the super
 * admin can edit any added contact). Status and note are per user, so each
 * person tracks their own outreach.
 */

const STATUS_LABEL = {
  new: 'Not contacted',
  messaged: 'Messaged',
  replied: 'Replied',
  call: 'Call / interview',
  closed: 'Closed',
};
const STATUSES = Object.keys(STATUS_LABEL);

const SENIORITY_LABEL = {
  entry: 'Recruiter',
  senior: 'Senior',
  partner: 'Partner',
  manager: 'Manager / Lead',
  director: 'Director',
  head: 'Head',
  vp: 'VP',
  other: 'Other',
};

const TIPS = [
  { title: 'Write to one person at a time', text: 'A short note that names their team beats the same message sent to twenty people.' },
  { title: 'Email or LinkedIn first', text: 'Phone numbers are for when you already have a reason to call, like a scheduled chat.' },
  { title: 'Ask for what your resume backs up', text: 'Check your level on Resume Building before you write.', link: '/interview/resume' },
  { title: 'Follow up once', text: 'One polite nudge after a week or so. If there is still no reply, move on.' },
];

const EMPTY_FORM = {
  name: '',
  title: '',
  company: '',
  location: '',
  email: '',
  phone: '',
  linkedin: '',
  seniority: 'other',
  visibility: 'shared',
};

/*
  The same slug the server derives for company logos (companySlug in
  services/logo.service.js), so these hit the logo cache the roadmap's
  "Asked at" column already fills.
*/
const companySlug = (name) =>
  String(name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

function ContactForm({ initial, onClose, onSaved }) {
  const [form, setForm] = useState({ ...EMPTY_FORM, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const nameRef = useRef(null);
  const editing = Boolean(initial?.id);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    const body = {
      name: form.name,
      title: form.title,
      company: form.company,
      location: form.location,
      email: form.email.trim(),
      phone: form.phone,
      linkedin: form.linkedin.trim(),
      seniority: form.seniority,
      visibility: form.visibility,
    };
    try {
      const { recruiter } = editing
        ? await interviewApi.updateRecruiter(initial.id, body)
        : await interviewApi.addRecruiter(body);
      onSaved(recruiter, editing);
    } catch (err) {
      setError(errorMessage(err, 'That did not save'));
      setBusy(false);
    }
  };

  return (
    <Modal title={editing ? 'Edit contact' : 'Add a contact'} onClose={onClose} initialFocus={nameRef}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <div className="field-row">
            <label className="field">
              <span>Name</span>
              <input ref={nameRef} required maxLength={120} value={form.name} onChange={set('name')} />
            </label>
            <label className="field">
              <span>Company</span>
              <input required maxLength={80} value={form.company} onChange={set('company')} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Title</span>
              <input maxLength={160} value={form.title} onChange={set('title')} />
            </label>
            <label className="field">
              <span>Seniority</span>
              <Dropdown
                ariaLabel="Seniority"
                value={form.seniority}
                options={Object.entries(SENIORITY_LABEL).map(([value, label]) => ({ value, label }))}
                onChange={(seniority) => setForm((f) => ({ ...f, seniority }))}
              />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Email</span>
              <input type="email" maxLength={160} value={form.email} onChange={set('email')} />
            </label>
            <label className="field">
              <span>Phone</span>
              <input maxLength={40} value={form.phone} onChange={set('phone')} />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>LinkedIn URL</span>
              <input type="url" maxLength={300} placeholder="https://www.linkedin.com/in/…" value={form.linkedin} onChange={set('linkedin')} />
            </label>
            <label className="field">
              <span>Location</span>
              <input maxLength={120} value={form.location} onChange={set('location')} />
            </label>
          </div>
          <label className="rd-check">
            <input
              type="checkbox"
              checked={form.visibility === 'shared'}
              onChange={(e) => setForm((f) => ({ ...f, visibility: e.target.checked ? 'shared' : 'private' }))}
            />
            <span>
              Share with everyone
              <small>Others can see this contact. Only you can edit or delete it.</small>
            </span>
          </label>
          {error && <p className="rd-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : editing ? 'Save' : 'Add contact'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

const PAGE_SIZE = 20;

const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }));
const STATUS_FILTER_OPTIONS = [{ value: 'all', label: 'Any status' }, ...STATUS_OPTIONS];

/** Page numbers to draw: first, last, and two either side of the current one. */
const pageList = (page, pages) => {
  const out = [];
  for (let p = 1; p <= pages; p += 1) {
    if (p === 1 || p === pages || Math.abs(p - page) <= 1) out.push(p);
    else if (out[out.length - 1] !== '…') out.push('…');
  }
  return out;
};

/** Your own note on a contact. Nobody else sees it. */
function NoteForm({ row, onClose, onSaved }) {
  const [note, setNote] = useState(row.note || '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const ref = useRef(null);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await interviewApi.setOutreach(row.id, { note });
      onSaved(res);
    } catch (err) {
      setError(errorMessage(err, 'Note did not save'));
      setBusy(false);
    }
  };

  return (
    <Modal title={`Note · ${row.name}`} onClose={onClose} initialFocus={ref}>
      <form onSubmit={submit}>
        <div className="modal-body">
          <label className="field">
            <span>Only you can see this note</span>
            <textarea
              ref={ref}
              rows={4}
              maxLength={1000}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="What you sent, what they said, next step…"
            />
          </label>
          {error && <p className="rd-error">{error}</p>}
        </div>
        <div className="modal-foot">
          <button type="button" className="btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="btn primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save note'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

export function RecruiterDirectory() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [company, setCompany] = useState('All');
  const [status, setStatus] = useState('all');
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // `query`, once typing pauses
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState(null); // null | {} (new) | row
  const [deleting, setDeleting] = useState(null);
  const [noting, setNoting] = useState(null);
  const [mineOnly, setMineOnly] = useState(false);
  const requestId = useRef(0);

  // Wait for a pause in typing so each keystroke is not a request.
  useEffect(() => {
    const t = setTimeout(() => setSearch(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Any filter change goes back to page 1.
  useEffect(() => setPage(1), [company, status, search, mineOnly]);

  const load = useCallback(async () => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const res = await interviewApi.recruiters({
        page,
        limit: PAGE_SIZE,
        q: search || undefined,
        company: company === 'All' ? undefined : company,
        status: status === 'all' ? undefined : status,
        mine: mineOnly ? 'true' : undefined,
      });
      if (id !== requestId.current) return; // a newer request has been sent
      // Deleting the last row on a page leaves it empty; step back one.
      if (!res.recruiters.length && res.page > 1) {
        setPage(res.page - 1);
        return;
      }
      setData(res);
      setLoadError('');
    } catch (err) {
      if (id === requestId.current) setLoadError(errorMessage(err, 'Could not load the directory'));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [page, search, company, status, mineOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = data?.recruiters || [];
  const stats = data?.stats || { total: 0, contacted: 0, replied: 0 };
  const companies = data?.companies || [];
  const pages = data?.pages || 1;

  const replaceRow = (row) =>
    setData((prev) => prev && { ...prev, recruiters: prev.recruiters.map((r) => (r.id === row.id ? row : r)) });

  const changeStatus = async (row, next) => {
    if (next === row.status) return;
    replaceRow({ ...row, status: next });
    try {
      await interviewApi.setOutreach(row.id, { status: next });
      load(); // stat cards, and the row may now fall outside a status filter
    } catch (err) {
      replaceRow(row);
      toast(errorMessage(err, 'Status did not save'), 'error');
    }
  };

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text);
      toast(`${what} copied`, 'success');
    } catch {
      toast('Clipboard blocked', 'error');
    }
  };

  const onSaved = (_row, wasEdit) => {
    setEditing(null);
    toast(wasEdit ? 'Contact saved' : 'Contact added', 'success');
    load();
  };

  const onNoteSaved = (res) => {
    replaceRow({ ...noting, note: res.note });
    setNoting(null);
    toast('Note saved', 'success');
  };

  const confirmDelete = async () => {
    const row = deleting;
    try {
      await interviewApi.removeRecruiter(row.id);
      toast('Contact removed', 'success');
      load();
    } catch (err) {
      toast(errorMessage(err, 'Could not remove it'), 'error');
    }
    setDeleting(null);
  };

  const from = data && data.total ? (data.page - 1) * data.limit + 1 : 0;
  const to = data ? Math.min(data.page * data.limit, data.total) : 0;

  return (
    <div className="rd">
      <div className="rd-top">
        <div className="page-head">
          <h1>MAANG Recruiter Directory</h1>
          <p>Recruiters hiring engineers in India. Add your own on top. Your status and notes are private to you. Use it for one-to-one outreach, not bulk messages.</p>
        </div>
        <button type="button" className="btn primary" onClick={() => setEditing({})}>
          + Add contact
        </button>
      </div>

      <div className="rd-stats">
        <div className="rd-stat">
          <b>{stats.total}</b>
          <span>contacts</span>
        </div>
        <div className="rd-stat">
          <b>{companies.length}</b>
          <span>companies</span>
        </div>
        <div className="rd-stat">
          <b>{stats.contacted}</b>
          <span>contacted</span>
        </div>
        <div className="rd-stat">
          <b>{stats.replied}</b>
          <span>replied</span>
        </div>
      </div>

      <section className="panel rd-panel">
        <div className="rd-toolbar">
          <input
            className="rd-search"
            type="search"
            placeholder="Search name, title, city or email…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Dropdown
            variant="inline"
            ariaLabel="Filter by status"
            value={status}
            on={status !== 'all'}
            options={STATUS_FILTER_OPTIONS}
            onChange={setStatus}
          />
          <button
            type="button"
            className={`rd-chip ${mineOnly ? 'active' : ''}`}
            aria-pressed={mineOnly}
            onClick={() => setMineOnly((v) => !v)}
          >
            Added by me
          </button>
          <span className="rd-count">
            {loading && <span className="rd-spinner" aria-hidden="true" />}
            {data ? `${from}–${to} of ${data.total}` : ''}
          </span>
        </div>

        <div className="rd-companies" role="tablist" aria-label="Company">
          {[{ name: 'All', count: stats.total }, ...companies].map(({ name, count }) => (
            <button
              key={name}
              type="button"
              role="tab"
              aria-selected={company === name}
              className={`rd-chip ${company === name ? 'active' : ''}`}
              onClick={() => setCompany(name)}
            >
              {name !== 'All' && <CompanyMark company={name} slug={companySlug(name)} size={16} />}
              {name}
              <span>{count}</span>
            </button>
          ))}
        </div>

        {loadError ? (
          <p className="rd-empty">{loadError}</p>
        ) : !data ? (
          <p className="rd-empty">Loading…</p>
        ) : rows.length === 0 ? (
          <p className="rd-empty">
            {stats.total ? 'No contacts match these filters.' : 'No contacts yet. Add your first one.'}
          </p>
        ) : (
          <div className={`rd-table-wrap ${loading ? 'is-loading' : ''}`}>
            <table className="rd-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Company</th>
                  <th>Location</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>LinkedIn</th>
                  <th>Status</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const checks = contactChecks(r);
                  const warns = checks.filter((c) => c.level === 'warn');
                  const flag = (field) => checks.filter((c) => c.field === field && c.level === 'warn');
                  return (
                  <tr key={r.id}>
                    <td>
                      <div className="rd-person">
                        <span className="rd-avatar">{initials(r.name)}</span>
                        <div>
                          <div className="rd-name">
                            {r.name}
                            {r.locked ? (
                              <span className="rd-badge" title="Part of the main directory. Nobody can edit or delete it.">
                                <IconLock size={10} /> Main
                              </span>
                            ) : (
                              <span className={`rd-badge ${r.mine ? 'mine' : ''}`} title={r.visibility === 'private' ? 'Only you can see this' : 'Added by a user'}>
                                {r.mine ? 'Yours' : `Added by ${r.addedBy}`}
                                {r.visibility === 'private' && ' · private'}
                              </span>
                            )}
                            {checks.length > 0 && (
                              <span
                                className={`rd-check-badge ${warns.length ? 'warn' : 'info'}`}
                                title={checks.map((c) => `• ${c.text}`).join('\n')}
                                tabIndex={0}
                              >
                                {warns.length ? `⚠ Check ${warns.length}` : 'ⓘ Senior'}
                              </span>
                            )}
                          </div>
                          <div className="rd-title">
                            {r.title || '—'}
                            {r.seniority !== 'other' && <span className="rd-tag">{SENIORITY_LABEL[r.seniority]}</span>}
                          </div>
                          {r.note && <div className="rd-note">{r.note}</div>}
                        </div>
                      </div>
                    </td>
                    <td className="rd-company" data-label="Company">
                      <span className="rd-co">
                        <CompanyMark company={r.company} slug={companySlug(r.company)} size={20} />
                        {r.company}
                      </span>
                    </td>
                    <td className="rd-muted" data-label="Location">{r.location || '—'}</td>
                    <td>
                      {r.email ? (
                        <span
                          className={`rd-cell ${flag('email').length ? 'doubt' : ''}`}
                          title={flag('email').map((c) => c.text).join('\n') || undefined}
                        >
                          <IconMail size={13} />
                          <a href={`mailto:${r.email}`}>{r.email}</a>
                          <button type="button" className="rd-icon" onClick={() => copy(r.email, 'Email')} title="Copy email" aria-label="Copy email">
                            <IconCopy size={12} />
                          </button>
                        </span>
                      ) : (
                        <span className="rd-muted">—</span>
                      )}
                    </td>
                    <td>
                      {r.phone ? (
                        <span
                          className={`rd-cell ${flag('phone').length ? 'doubt' : ''}`}
                          title={flag('phone').map((c) => c.text).join('\n') || undefined}
                        >
                          <IconPhone size={13} />
                          <a href={`tel:${r.phone.replace(/[^0-9+]/g, '')}`}>{r.phone}</a>
                          <button type="button" className="rd-icon" onClick={() => copy(r.phone, 'Number')} title="Copy number" aria-label="Copy number">
                            <IconCopy size={12} />
                          </button>
                        </span>
                      ) : (
                        <span className="rd-muted">—</span>
                      )}
                    </td>
                    <td>
                      {r.linkedin ? (
                        <a className="rd-cell rd-li" href={r.linkedin} target="_blank" rel="noopener noreferrer">
                          <IconLinkedin size={13} />
                          Profile
                          <IconExternal size={11} />
                        </a>
                      ) : (
                        <span className="rd-muted">—</span>
                      )}
                    </td>
                    <td>
                      <Dropdown
                        variant="inline"
                        ariaLabel={`Status for ${r.name}`}
                        className={`rd-status s-${r.status}`}
                        value={r.status}
                        on={r.status !== 'new'}
                        options={STATUS_OPTIONS}
                        onChange={(next) => changeStatus(r, next)}
                      />
                    </td>
                    <td className="rd-actions">
                      <button
                        type="button"
                        className="rd-msg"
                        onClick={() =>
                          navigate(
                            `/interview/messages?${new URLSearchParams({
                              to: r.name,
                              company: r.company,
                              ...(r.email ? { theirEmail: r.email } : {}),
                              ...(r.phone ? { theirPhone: r.phone } : {}),
                            })}`,
                          )
                        }
                        title="Write a message to this recruiter"
                      >
                        Message
                      </button>
                      <button
                        type="button"
                        className={`rd-icon ${r.note ? 'has-note' : ''}`}
                        onClick={() => setNoting(r)}
                        title={r.note ? 'Edit your note' : 'Add a note'}
                        aria-label={`Note for ${r.name}`}
                      >
                        <IconNote size={14} filled={Boolean(r.note)} />
                      </button>
                      {r.canEdit && (
                        <>
                          <button type="button" className="rd-icon" onClick={() => setEditing(r)} title="Edit" aria-label={`Edit ${r.name}`}>
                            <IconEdit size={14} />
                          </button>
                          <button type="button" className="rd-icon danger" onClick={() => setDeleting(r)} title="Delete" aria-label={`Delete ${r.name}`}>
                            <IconTrash size={14} />
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {data && pages > 1 && (
          <nav className="rd-pager" aria-label="Pages">
            <button type="button" className="btn" disabled={page <= 1 || loading} onClick={() => setPage(page - 1)}>
              ← Prev
            </button>
            <div className="rd-pages">
              {pageList(page, pages).map((p, i) =>
                p === '…' ? (
                  <span key={`gap-${i}`} className="rd-gap">…</span>
                ) : (
                  <button
                    key={p}
                    type="button"
                    className={`rd-page ${p === page ? 'active' : ''}`}
                    aria-current={p === page ? 'page' : undefined}
                    disabled={loading}
                    onClick={() => setPage(p)}
                  >
                    {p}
                  </button>
                ),
              )}
            </div>
            <button type="button" className="btn" disabled={page >= pages || loading} onClick={() => setPage(page + 1)}>
              Next →
            </button>
          </nav>
        )}
      </section>

      <section className="panel">
        <div className="panel-body">
          <h3 className="rd-section-title">Before you reach out</h3>
          <div className="rd-tips">
            {TIPS.map((t) => (
              <div key={t.title} className="rd-tip">
                <b>{t.title}</b>
                <p>
                  {t.text} {t.link && <Link to={t.link}>Open it</Link>}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {editing && <ContactForm initial={editing} onClose={() => setEditing(null)} onSaved={onSaved} />}
      {noting && <NoteForm row={noting} onClose={() => setNoting(null)} onSaved={onNoteSaved} />}
      {deleting && (
        <ConfirmDialog
          title="Remove this contact?"
          message={`${deleting.name} (${deleting.company}) will be removed from your directory.`}
          confirmLabel="Remove"
          tone="danger"
          onConfirm={confirmDelete}
          onCancel={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
