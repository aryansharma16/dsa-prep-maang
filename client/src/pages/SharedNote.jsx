import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BRAND } from '../brand.js';
import { errorMessage } from '../api/http.js';
import { notesApi } from '../api/index.js';
import { NoteReader } from '../components/notes/NoteReader.jsx';
import { useAuth } from '../store/AuthContext.jsx';

/**
 * A shared note, at `/n/:publicId`.
 *
 * Outside the app shell and outside the auth gate on both sides of the wire —
 * this is the page a link opens for someone who has never signed in, and it has
 * to render for them or sharing does not work. No sidebar, no chat launcher,
 * nothing that would need a session.
 *
 * It renders for signed-in readers too rather than redirecting them into the
 * app: the URL somebody was sent is the URL that should work, and bouncing it
 * to an in-app route would break the back button and every copy of that link.
 */
export function SharedNote() {
  const { publicId } = useParams();
  const { user } = useAuth();

  const [note, setNote] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    notesApi
      .shared(publicId)
      .then((data) => live && setNote(data))
      .catch((err) => live && setError(errorMessage(err, 'This note is not available')));
    return () => {
      live = false;
    };
  }, [publicId]);

  return (
    <div className="shared">
      <header className="shared-head">
        <Link to={user ? '/' : '/login'} className="brand">
          <span className="brand-mark">{BRAND.mark}</span>
          <span>{BRAND.name}</span>
        </Link>
        <span className="spacer" />
        {user ? (
          <Link className="btn ghost" to="/notes">
            My notes
          </Link>
        ) : (
          <>
            <span className="hint">{BRAND.tagline}</span>
            <Link className="btn primary" to="/register">
              Get started
            </Link>
          </>
        )}
      </header>

      {error ? (
        <div className="empty">
          <h3>Not available</h3>
          {/*
            The server answers 404 for a private note, a draft and a link that
            was never real — deliberately the same answer, so this page cannot
            confirm a note exists to someone who is not allowed to read it.
          */}
          <p>{error}</p>
        </div>
      ) : !note ? (
        <div className="loading">Loading…</div>
      ) : (
        <NoteReader note={note} />
      )}
    </div>
  );
}
