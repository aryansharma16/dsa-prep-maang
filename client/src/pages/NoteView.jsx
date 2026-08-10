import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { errorMessage } from '../api/http.js';
import { notesApi } from '../api/index.js';
import { NoteReader } from '../components/notes/NoteReader.jsx';
import { IconArrowLeft, IconCopy, IconEdit } from '../components/ui/Icons.jsx';
import { useToast } from '../store/ToastContext.jsx';

/**
 * One note, read from inside the app.
 *
 * Serves other people's public notes as well as your own — the server decides
 * which, and `mine` in its response is what this page keys the Edit button off
 * rather than comparing ids itself. A client-side ownership check would be a
 * second opinion on a question only the server can answer.
 */
export function NoteView() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { success } = useToast();

  const [note, setNote] = useState(null);
  const [mine, setMine] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let live = true;
    notesApi
      .get(id)
      .then((data) => {
        if (!live) return;
        setNote(data.note);
        setMine(data.mine);
      })
      .catch((err) => live && setError(errorMessage(err, 'That note is not available')));
    return () => {
      live = false;
    };
  }, [id]);

  if (error) {
    return (
      <div className="empty">
        <h3>Not found</h3>
        <p>{error}</p>
        <button type="button" className="btn" onClick={() => navigate('/notes')}>
          Back to notes
        </button>
      </div>
    );
  }

  if (!note) return <div className="loading">Loading…</div>;

  const share =
    note.publicId && note.visibility !== 'private'
      ? `${window.location.origin}/n/${note.publicId}`
      : '';

  return (
    <div className="note-view">
      <NoteReader
        note={note}
        toolbar={
          <>
            <button type="button" className="btn ghost" onClick={() => navigate('/notes')}>
              <IconArrowLeft size={12} />
              Notes
            </button>
            {mine && (
              <button
                type="button"
                className="btn"
                onClick={() => navigate(`/notes/${note.id}/edit`)}
              >
                <IconEdit size={12} />
                Edit
              </button>
            )}
            {share && (
              <button
                type="button"
                className="btn"
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(share);
                    success('Link copied');
                  } catch {
                    // Clipboard needs a secure context; nothing useful to say.
                  }
                }}
              >
                <IconCopy size={12} />
                Copy link
              </button>
            )}
          </>
        }
      />
    </div>
  );
}
