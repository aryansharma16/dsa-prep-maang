import { useNavigate, useParams } from 'react-router-dom';
import { NoteEditor } from '../components/notes/NoteEditor.jsx';

/**
 * `/notes/new` and `/notes/:id/edit` are the same screen.
 *
 * Keyed on the id so switching between two notes without unmounting the route
 * cannot carry the first one's blocks into the second — `NoteEditor` seeds its
 * state from props on mount, which is right for an editor and wrong without a
 * key.
 */
export function NoteEdit() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <NoteEditor
      key={id || 'new'}
      noteId={id || null}
      onExit={() => navigate(id ? `/notes/${id}` : '/notes')}
    />
  );
}
