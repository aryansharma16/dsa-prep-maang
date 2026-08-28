import { useMemo } from 'react';
import { useTabIndent } from '../../hooks/useTabIndent.js';
import { PROBLEM_LANGS, langLabel } from './attempts.js';
import { highlight } from './highlight.js';

/**
 * Writing a solution down, and reading one back.
 *
 * Two components because they are two different jobs on the same field: the
 * editor is a textarea you type into while logging, the block is what the log
 * draws afterwards. They share this file so the language list and the class
 * names cannot drift apart between them.
 *
 * Neither runs anything. This is storage, not a judge — the value is in being
 * able to read what you wrote six weeks later and see whether the second
 * attempt fixed the bug or repeated it.
 */

/**
 * The textarea, with the two behaviours that make it usable for code — both of
 * them in `useTabIndent`, which the SQL Lab's editor shares.
 *
 * `langs` is the picker's list. It defaults to `PROBLEM_LANGS` — the three a
 * roadmap or ladder problem is solved in — and the SQL Lab passes `SQL_ONLY`.
 * Defaulting to the full `SOLUTION_LANGS` instead would put a SQL button on
 * every graph problem's attempt dialog, which is the bug this prop exists to
 * avoid rather than the reason it was added.
 */
export function CodeEditor({
  value,
  lang,
  onChange,
  onLang,
  placeholder,
  rows = 10,
  langs = PROBLEM_LANGS,
}) {
  const [ref, onKeyDown] = useTabIndent(value, onChange);

  return (
    <div className="sol-editor">
      <div className="sol-langs size-group filter-seg" role="group" aria-label="Language">
        {langs.map((option) => (
          <button
            key={option.id}
            type="button"
            className={lang === option.id ? 'on' : ''}
            aria-pressed={lang === option.id}
            onClick={() => onLang(option.id)}
          >
            {option.label}
          </button>
        ))}
        {/* Only once there is something to count. A "0 chars" on an empty box
            is a number nobody asked for. */}
        {value.length > 0 && (
          <span className="sol-count mono" title="Characters, of 20,000">
            {value.length.toLocaleString()}
          </span>
        )}
      </div>

      <textarea
        ref={ref}
        className="sol-code mono"
        value={value}
        rows={rows}
        maxLength={20000}
        spellCheck="false"
        autoCapitalize="off"
        autoCorrect="off"
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
      />
    </div>
  );
}

/**
 * A stored solution, highlighted, read-only.
 *
 * Uses the same `highlight()` the pattern guides render through, so a solution
 * you wrote and a solution the guide shows you are drawn by one tokeniser and
 * look like the same kind of object. It is a deliberately plain block — no copy
 * button, no tabs, no line-number gutter — because it sits inside a log entry
 * that is already a list item, and the guides' full treatment would make each
 * attempt look like a document.
 */
export function SolutionBlock({ code, lang }) {
  const lines = useMemo(() => (code ? highlight(code, lang) : []), [code, lang]);
  if (!code) return null;

  return (
    <div className="sol-block">
      <span className="sol-block-lang mono">{langLabel(lang)}</span>
      <pre className="sol-pre mono">
        {lines.map((line, i) => (
          // eslint-disable-next-line react/no-array-index-key -- lines have no id
          <span className="cl" key={i}>
            {line.map((token, j) => (
              // eslint-disable-next-line react/no-array-index-key
              <span className={token.c} key={j}>
                {token.t}
              </span>
            ))}
          </span>
        ))}
      </pre>
    </div>
  );
}
