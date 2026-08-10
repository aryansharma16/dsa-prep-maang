import { Link } from 'react-router-dom';
import { IconClock, IconGlobe, IconLink, IconLock } from '../ui/Icons.jsx';

/**
 * One note in the library grid.
 *
 * The visibility mark is the only badge, and it earns the space: in a grid of
 * thirty personal notes the question people actually have is "wait, which of
 * these can other people see". Everything else — word count, date, folder — is
 * secondary text.
 */

const MARK = {
  private: { Icon: IconLock, label: 'Only you' },
  unlisted: { Icon: IconLink, label: 'Anyone with the link' },
  public: { Icon: IconGlobe, label: 'Public' },
};

const when = (value) => {
  if (!value) return '';
  const days = Math.round((Date.now() - new Date(value)) / 86400000);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30) return `${days}d ago`;
  if (days < 365) return `${Math.round(days / 30)}mo ago`;
  return `${Math.round(days / 365)}y ago`;
};

export function NoteCard({ note, to, byline }) {
  const mark = MARK[note.visibility];

  return (
    <Link className="nc" to={to}>
      {note.cover?.url && (
        <span className="nc-cover">
          <img src={note.cover.url} alt="" loading="lazy" />
        </span>
      )}

      <span className="nc-top">
        {note.icon && <span className="nc-icon">{note.icon}</span>}
        <span className="nc-title">{note.title}</span>
        {mark && (
          <span className={`nc-vis ${note.visibility}`} title={mark.label}>
            <mark.Icon size={11} />
          </span>
        )}
      </span>

      {note.summary && <span className="nc-summary">{note.summary}</span>}

      {note.tags?.length > 0 && (
        <span className="nc-tags">
          {note.tags.slice(0, 3).map((tag) => (
            <span key={tag}>#{tag}</span>
          ))}
          {note.tags.length > 3 && <span className="more">+{note.tags.length - 3}</span>}
        </span>
      )}

      <span className="nc-foot">
        {byline && <span className="nc-by">{byline}</span>}
        {note.status === 'draft' && <span className="nc-draft">Draft</span>}
        <span className="nc-when">
          <IconClock size={10} />
          {when(note.updatedAt || note.publishedAt)}
        </span>
        {note.readingMinutes > 0 && <span className="nc-read">{note.readingMinutes} min</span>}
      </span>
    </Link>
  );
}
