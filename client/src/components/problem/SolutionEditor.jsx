import { useMemo, useRef } from 'react';
import { SOLUTION_LANGS, langLabel } from './attempts.js';
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

/** How far one Tab moves. Two, matching the guides' own code samples. */
const INDENT = '  ';

/**
 * The textarea, with the two behaviours that make it usable for code.
 *
 * **Tab indents instead of leaving the field.** A plain textarea hands Tab to
 * the browser, which moves focus to the next control — in a dialog, that is the
 * Cancel button, and you discover it after typing three lines. Trapping it costs
 * the keyboard route out of the field, so Escape still closes the dialog and
 * Shift+Tab still steps backwards, which is the pair people actually reach for.
 *
 * **Selection is preserved.** Setting `value` moves the caret to the end in
 * every browser, so the caret is restored by hand after an indent. Without it
 * every Tab throws you to the bottom of the file.
 */
export function CodeEditor({ value, lang, onChange, onLang, placeholder, rows = 10 }) {
  const ref = useRef(null);

  const onKeyDown = (event) => {
    if (event.key !== 'Tab' || event.shiftKey) return;
    event.preventDefault();

    const el = ref.current;
    const { selectionStart: start, selectionEnd: end } = el;
    const next = `${value.slice(0, start)}${INDENT}${value.slice(end)}`;
    onChange(next);

    // After React has written the new value back into the field.
    requestAnimationFrame(() => {
      const at = start + INDENT.length;
      el.setSelectionRange(at, at);
    });
  };

  return (
    <div className="sol-editor">
      <div className="sol-langs size-group filter-seg" role="group" aria-label="Language">
        {SOLUTION_LANGS.map((option) => (
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
