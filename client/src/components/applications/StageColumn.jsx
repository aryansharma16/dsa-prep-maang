import { useEffect, useRef, useState } from 'react';

import { IconPlus } from '../ui/Icons.jsx';
import { ApplicationCard } from './ApplicationCard.jsx';

/**
 * One lane: its header, its cards, and the box that adds another.
 *
 * Unlike the task board's column there is no edit or delete control here, and
 * that absence is the design rather than an omission. A lane cannot be created
 * or removed — the six are the vocabulary the funnel is computed in, and a
 * seventh one somebody invented is a stage no report can classify. Renaming is
 * the one thing you *can* do, and it lives in one dialog off the toolbar rather
 * than as a pencil on each of six headers.
 */
export function StageColumn({ column, apps, drag, onAdd, onOpen }) {
  const [adding, setAdding] = useState(false);
  const [company, setCompany] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const submit = (event) => {
    event.preventDefault();
    const value = company.trim();
    if (!value) {
      setAdding(false);
      return;
    }
    onAdd(value);
    /*
      Stays open. Adding applications is something people do in a run of five
      after an evening of scrolling LinkedIn, and closing after each one would
      make the second cost two clicks.
    */
    setCompany('');
  };

  return (
    <section
      className="ap-col"
      data-hue={column.hue}
      aria-label={column.label}
      {...drag.columnProps(column.key, apps.length)}
    >
      <header className="ap-col-head">
        <i className="ap-col-dot" aria-hidden="true" />
        <h2>{column.label}</h2>
        <span className="ap-col-count mono">{apps.length}</span>
        <button
          type="button"
          className="icon-btn"
          title={`Add an application to ${column.label}`}
          aria-label={`Add an application to ${column.label}`}
          onClick={() => setAdding(true)}
        >
          <IconPlus size={12} />
        </button>
      </header>

      <div className="ap-col-body">
        {apps.map((app, index) => (
          <div key={app.id} className="ap-slot">
            {drag.gapAt(column.key, index) && <div className="ap-gap" aria-hidden="true" />}
            <ApplicationCard
              app={app}
              dragging={drag.dragging?.id === app.id}
              dragProps={drag.cardProps(app.id, index, column.key)}
              onOpen={() => onOpen(app)}
            />
          </div>
        ))}

        {drag.gapAt(column.key, apps.length) && <div className="ap-gap" aria-hidden="true" />}

        {adding ? (
          <form className="ap-add" onSubmit={submit}>
            {/*
              A company name and nothing else. Everything a job has — role,
              level, source, the link you found it through — is optional and
              filled in as you learn it, which is the difference between a
              tracker you keep up and one you abandon in week two.
            */}
            <input
              ref={inputRef}
              value={company}
              maxLength={120}
              placeholder="Company name…"
              onChange={(event) => setCompany(event.target.value)}
              onBlur={() => !company.trim() && setAdding(false)}
              onKeyDown={(event) => event.key === 'Escape' && setAdding(false)}
            />
          </form>
        ) : (
          !apps.length && (
            <button type="button" className="ap-col-empty" onClick={() => setAdding(true)}>
              <IconPlus size={12} />
              Add one
            </button>
          )
        )}
      </div>
    </section>
  );
}
