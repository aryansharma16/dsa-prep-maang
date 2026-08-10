import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { notesApi } from '../api/index.js';
import { NoteCard } from '../components/notes/NoteCard.jsx';
import { Dropdown } from '../components/ui/Dropdown.jsx';
import {
  IconGlobe,
  IconLock,
  IconPlus,
  IconSearch,
} from '../components/ui/Icons.jsx';
import { useAuth } from '../store/AuthContext.jsx';

/**
 * The library.
 *
 * Two tabs over one grid: your own notes, and what other people published. The
 * second is not a separate page because the thing it is for — "has anyone
 * already written this up" — is the same reach as "did I already write this up",
 * and a link in a nav somewhere else is a link nobody clicks.
 *
 * Filtering is server-side. A local filter would be instant and would quietly
 * stop finding things once a library outgrew the first page, which is exactly
 * when search starts to matter.
 */

const VIEWS = [
  { value: 'all', label: 'All notes' },
  { value: 'private', label: 'Only me' },
  { value: 'unlisted', label: 'Shared by link' },
  { value: 'public', label: 'Public' },
];

export function Notes() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [tab, setTab] = useState('mine');
  const [query, setQuery] = useState('');
  const [view, setView] = useState('all');
  const [tag, setTag] = useState('');
  const [notes, setNotes] = useState([]);
  const [tags, setTags] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Debounced so typing a word is one request rather than one per letter.
  const [debounced, setDebounced] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query.trim()), 260);
    return () => clearTimeout(timer);
  }, [query]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        limit: 40,
        ...(debounced ? { q: debounced } : {}),
        ...(tag ? { tag } : {}),
      };
      const data =
        tab === 'mine'
          ? await notesApi.list({ ...params, ...(view === 'all' ? {} : { visibility: view }) })
          : await notesApi.browse(params);

      setNotes(data.notes);
      setTotal(data.total);
      setError('');
    } catch (err) {
      setError(errorMessage(err, 'Could not load your notes'));
    } finally {
      setLoading(false);
    }
  }, [tab, debounced, view, tag]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    notesApi.tags().then(setTags).catch(() => {});
  }, []);

  const grouped = useMemo(() => {
    if (tab !== 'mine') return null;
    // Pinned first, then whatever folder they are in. The server already sorts
    // pinned-then-recent, so this only has to keep that order within a group.
    const folders = new Map();
    for (const note of notes) {
      const key = note.category || '';
      if (!folders.has(key)) folders.set(key, []);
      folders.get(key).push(note);
    }
    return [...folders.entries()].sort(([a], [b]) => (a === '' ? 1 : b === '' ? -1 : a.localeCompare(b)));
  }, [notes, tab]);

  return (
    <div className="notes-page">
      <header className="notes-head">
        <div className="notes-title">
          <h1>Notes</h1>
          <p>
            The things you worked out the hard way — kept, searchable, and shared only if you
            say so.
          </p>
        </div>
        <button type="button" className="btn primary" onClick={() => navigate('/notes/new')}>
          <IconPlus size={12} />
          New note
        </button>
      </header>

      <div className="notes-bar">
        <div className="notes-tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'mine'}
            className={tab === 'mine' ? 'on' : ''}
            onClick={() => setTab('mine')}
          >
            <IconLock size={12} />
            Mine
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'browse'}
            className={tab === 'browse' ? 'on' : ''}
            onClick={() => setTab('browse')}
          >
            <IconGlobe size={12} />
            Published
          </button>
        </div>

        <label className="notes-search">
          <IconSearch size={13} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={tab === 'mine' ? 'Search your notes…' : 'Search published notes…'}
            aria-label="Search notes"
          />
        </label>

        {tab === 'mine' && (
          <Dropdown
            ariaLabel="Visibility"
            variant="inline"
            value={view}
            options={VIEWS}
            onChange={setView}
            on={view !== 'all'}
          />
        )}
      </div>

      {tags.length > 0 && (
        <div className="notes-tags">
          <button
            type="button"
            className={`toggle-chip ${tag ? '' : 'on'}`}
            onClick={() => setTag('')}
          >
            Everything
          </button>
          {tags.map((entry) => (
            <button
              key={entry.tag}
              type="button"
              className={`toggle-chip ${tag === entry.tag ? 'on' : ''}`}
              onClick={() => setTag(tag === entry.tag ? '' : entry.tag)}
            >
              #{entry.tag}
              <span className="mono">{entry.count}</span>
            </button>
          ))}
        </div>
      )}

      {error && <div className="alert">{error}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : !notes.length ? (
        <Empty tab={tab} filtered={Boolean(debounced || tag || view !== 'all')} />
      ) : tab === 'mine' ? (
        grouped.map(([folder, items]) => (
          <section className="notes-folder" key={folder || '_'}>
            {grouped.length > 1 && (
              <h2 className="notes-folder-label">
                {folder || 'Unfiled'}
                <span>{items.length}</span>
              </h2>
            )}
            <div className="notes-grid">
              {items.map((note) => (
                <NoteCard key={note.id} note={note} to={`/notes/${note.id}`} />
              ))}
            </div>
          </section>
        ))
      ) : (
        <div className="notes-grid">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              to={`/n/${note.publicId}`}
              byline={note.author?.id === user?._id ? 'You' : note.author?.name}
            />
          ))}
        </div>
      )}

      {total > notes.length && (
        <p className="hint" style={{ textAlign: 'center' }}>
          Showing {notes.length} of {total}. Narrow it with search or a tag.
        </p>
      )}
    </div>
  );
}

function Empty({ tab, filtered }) {
  if (filtered) {
    return (
      <div className="empty">
        <h3>Nothing matches</h3>
        <p>Try a different word, or clear the filters.</p>
      </div>
    );
  }
  return tab === 'mine' ? (
    <div className="empty">
      <h3>No notes yet</h3>
      <p>
        Write up the next thing that costs you an afternoon —{' '}
        <Link to="/notes/new">start one</Link>.
      </p>
    </div>
  ) : (
    <div className="empty">
      <h3>Nothing published yet</h3>
      <p>Notes people set to “Everyone” and published show up here.</p>
    </div>
  );
}
