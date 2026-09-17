import { useDeferredValue, useMemo, useState } from 'react';
import { INLINE, safeHref } from '../chat/markdown.js';
import { FURTHER_READING, GLOSSARY, GLOSSARY_COUNT } from './designGlossary.generated.js';

/**
 * The component library as reference knowledge: what every technology, data
 * structure and database word on a design board actually is.
 *
 * The prose is not written here. It is generated out of the "Component
 * glossary" section of docs/design.md by scripts/build-docs-glossary.mjs, so
 * the definition a reader gets in /docs and the one the repo carries are the
 * same sentences — and the generator refuses to run if a component in the
 * library has no entry.
 *
 * Everything in this file is behind a dynamic import (see Docs.jsx). Docs.jsx
 * itself is in the main bundle, and 196 definitions are not something to make
 * every visitor download before they can read "Your first hour".
 */

/*
  The chat renderer's inline pattern, rendered again here rather than imported
  from ChatMarkdown: that module pulls in the syntax highlighter and the code
  block for its fences, none of which a glossary has, and its links are not
  written for a page that sends readers off to official docs.
*/
function inline(text) {
  const out = [];
  let last = 0;
  let match;
  // A fresh matcher per call, because emphasis recurses: INLINE is a global
  // regex, and sharing its `lastIndex` with a nested call skips half the text.
  const re = new RegExp(INLINE.source, INLINE.flags);

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) out.push(text.slice(last, match.index));
    const [raw, code, bold, em, link] = match;
    const key = `s${match.index}`;

    if (code) out.push(<code key={key}>{raw.slice(1, -1)}</code>);
    // Emphasis wraps a link often enough in this glossary — *[DDIA](url)* — that
    // not looking inside it prints the markdown to the page.
    else if (bold) out.push(<b key={key}>{inline(raw.slice(2, -2))}</b>);
    else if (em) out.push(<i key={key}>{inline(raw.slice(1, -1))}</i>);
    else {
      const cut = link.indexOf('](');
      const label = link.slice(1, cut);
      const href = link.slice(cut + 2, -1);
      out.push(
        safeHref(href) ? (
          <a key={key} href={href} target="_blank" rel="noreferrer noopener">
            {label || href}
          </a>
        ) : (
          label || href
        ),
      );
    }
    last = re.lastIndex;
  }

  if (last < text.length) out.push(text.slice(last));
  return out;
}

/** Every word typed has to appear somewhere in the entry, in any order. */
const matches = (item, terms) => {
  const hay = `${item.name || ''} ${item.lead || ''} ${item.body || item.note || ''}`.toLowerCase();
  return terms.every((term) => hay.includes(term));
};

/*
  Definition lists cannot hold a stray paragraph, and a category's asides
  ("Kafka or RabbitMQ?", "OLTP or OLAP?") are paragraphs. So consecutive entries
  are gathered into one <dl> and each aside breaks the run.
*/
function runs(items) {
  const out = [];
  for (const item of items) {
    if (item.note) out.push({ note: item.note });
    else if (out.at(-1)?.entries) out.at(-1).entries.push(item);
    else out.push({ entries: [item] });
  }
  return out;
}

export function DesignGlossary() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState(GLOSSARY[0].id);
  // The list is 196 entries; typing stays responsive if filtering is allowed to
  // lag a keystroke behind the field.
  const deferred = useDeferredValue(query);

  const terms = useMemo(
    () => deferred.toLowerCase().split(/\s+/).filter(Boolean),
    [deferred],
  );

  /* A search looks in every category — the whole point of a reference is that
     you do not know which drawer the thing is in. Without one, the chips are
     tabs. */
  const groups = useMemo(() => {
    if (!terms.length) return GLOSSARY.filter((c) => tab === 'all' || c.id === tab);
    return GLOSSARY.map((c) => ({ ...c, items: c.items.filter((item) => matches(item, terms)) })).filter(
      (c) => c.items.length,
    );
  }, [tab, terms]);

  const hits = useMemo(
    () => groups.reduce((n, c) => n + c.items.filter((i) => i.name).length, 0),
    [groups],
  );

  return (
    <div className="docs-gl">
      <div className="docs-gl-bar">
        <input
          type="search"
          className="docs-gl-search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search the reference — “queue”, “cache”, “LIFO”, “sharding”"
          aria-label="Search the component reference"
        />
        <span className="docs-gl-count">
          {terms.length ? `${hits} of ${GLOSSARY_COUNT}` : `${GLOSSARY_COUNT} entries`}
        </span>
      </div>

      <div className="docs-gl-chips">
        {GLOSSARY.map((c) => (
          <button
            key={c.id}
            type="button"
            className="docs-gl-chip"
            aria-pressed={!terms.length && tab === c.id}
            onClick={() => {
              setQuery('');
              setTab(c.id);
            }}
          >
            {c.title}
            <span>{c.items.filter((i) => i.name).length}</span>
          </button>
        ))}
        <button
          type="button"
          className="docs-gl-chip"
          aria-pressed={!terms.length && tab === 'all'}
          onClick={() => {
            setQuery('');
            setTab('all');
          }}
        >
          All
          <span>{GLOSSARY_COUNT}</span>
        </button>
      </div>

      {!groups.length && (
        <p className="docs-gl-empty">
          Nothing matches “{deferred}”. The reference covers the components on a board — try what a
          thing <i>does</i> (“cache”, “search”, “message”) rather than a product you have in mind.
        </p>
      )}

      {groups.map((c) => (
        <div className="docs-gl-group" key={c.id}>
          <h4>
            {c.title}
            <span>{c.items.filter((i) => i.name).length}</span>
          </h4>
          {runs(c.items).map((run, i) =>
            run.note ? (
              // eslint-disable-next-line react/no-array-index-key -- asides have no id
              <p className="docs-gl-note" key={`n${i}`}>
                {inline(run.note)}
              </p>
            ) : (
              // eslint-disable-next-line react/no-array-index-key
              <dl key={`d${i}`}>
                {run.entries.map((item) => (
                  <div className="docs-gl-item" key={item.name}>
                    <dt>
                      {/* The name can be markup too — the schema words are code
                          spans: `not null`, `unique`, `default`. */}
                      {item.href ? (
                        <a href={item.href} target="_blank" rel="noreferrer noopener">
                          {inline(item.name)}
                        </a>
                      ) : (
                        inline(item.name)
                      )}
                      {item.lead ? <span className="docs-gl-lead"> {inline(item.lead)}</span> : null}
                    </dt>
                    <dd>
                      <span className="docs-gl-dash"> — </span>
                      {inline(item.body)}
                    </dd>
                  </div>
                ))}
              </dl>
            ),
          )}
        </div>
      ))}

      {FURTHER_READING ? <p className="docs-gl-further">{inline(FURTHER_READING)}</p> : null}
    </div>
  );
}
