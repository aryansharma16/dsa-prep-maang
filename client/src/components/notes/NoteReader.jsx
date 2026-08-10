import { useEffect, useMemo, useState } from 'react';
import { NoteBlocks, noteHeadings } from './NoteBlocks.jsx';

/**
 * A note, read.
 *
 * Shared by the signed-in reader and the public share page, which is the whole
 * point of it: a link sent to a colleague has to render exactly what its author
 * sees, or "preview" was a lie. The two pages differ only in the toolbar above
 * this component.
 *
 * The contents rail mirrors the structure the editor already shows — headings,
 * in order — and is derived from the blocks rather than stored, so it can never
 * disagree with the document.
 */
export function NoteReader({ note, toolbar }) {
  const headings = useMemo(() => noteHeadings(note.blocks), [note.blocks]);
  const [active, setActive] = useState('');

  /*
    IntersectionObserver rather than a scroll handler: the rail only has to know
    which heading is currently topmost, and recomputing that from
    getBoundingClientRect on every scroll frame is the classic way to make a long
    page stutter.

    `rootMargin` pulls the trigger line down to just under the sticky header, so
    a heading counts as current when it reaches the top of the readable area
    rather than the top of the window.
  */
  useEffect(() => {
    if (!headings.length) return undefined;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      { rootMargin: '-72px 0px -70% 0px', threshold: 0 },
    );

    for (const heading of headings) {
      const node = document.getElementById(heading.id);
      if (node) observer.observe(node);
    }
    return () => observer.disconnect();
  }, [headings]);

  return (
    <div className="nr-page">
      <article className="nr">
        {note.cover?.url && (
          <div className="nr-cover">
            <img src={note.cover.url} alt="" />
          </div>
        )}

        <div className="nr-lede">
          {note.icon && <span className="nr-icon">{note.icon}</span>}
          <h1>{note.title}</h1>
          {note.summary && <p>{note.summary}</p>}

          <div className="nr-meta">
            {note.author?.name && <span className="nr-author">{note.author.name}</span>}
            {note.readingMinutes > 0 && <span>{note.readingMinutes} min read</span>}
            {note.wordCount > 0 && <span>{note.wordCount} words</span>}
            {note.updatedAt && (
              <span>
                Updated{' '}
                {new Date(note.updatedAt).toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })}
              </span>
            )}
          </div>

          {note.tags?.length > 0 && (
            <div className="nr-tags">
              {note.tags.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>
          )}
        </div>

        <NoteBlocks blocks={note.blocks} />
      </article>

      <aside className="nr-rail">
        {toolbar && <div className="nr-rail-tools">{toolbar}</div>}

        {headings.length > 1 && (
          <nav className="nr-toc" aria-label="On this page">
            <span className="nr-toc-label">On this page</span>
            {headings.map((heading) => (
              <a
                key={heading.id}
                href={`#${heading.id}`}
                className={`lvl-${heading.level} ${active === heading.id ? 'on' : ''}`}
                onClick={(event) => {
                  // Smooth scroll without pushing a hash onto the history stack
                  // — otherwise Back walks up the note one heading at a time.
                  event.preventDefault();
                  document.getElementById(heading.id)?.scrollIntoView({ behavior: 'smooth' });
                }}
              >
                {heading.text}
              </a>
            ))}
          </nav>
        )}
      </aside>
    </div>
  );
}
