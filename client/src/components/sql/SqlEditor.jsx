import { Fragment, useCallback, useMemo, useRef } from 'react';
import { useTabIndent } from '../../hooks/useTabIndent.js';
import { highlight } from '../problem/highlight.js';

/**
 * The query box.
 *
 * Still a `<textarea>`, like the roadmap's solution editor and for the reason
 * stated there: this repo has four runtime dependencies and a code editor would
 * be the largest of them by a wide margin. Tab-indent and caret restore come
 * from `useTabIndent`, which was extracted from `CodeEditor` for exactly this.
 *
 * ---------------------------------------------------------------------------
 * How it is highlighted without becoming a code editor.
 *
 * The textarea is layered **over** a `<pre>` that renders the same text through
 * the same `highlight()` the Learn track and `SqlBlock` use. The textarea's own
 * glyphs are `color: transparent` and only its caret and selection are drawn, so
 * what you read is the coloured copy underneath and what you type into is the
 * real form control.
 *
 * That buys the colours while keeping every native behaviour a textarea has and
 * a re-implementation loses: undo, spellcheck control, autofill, IME
 * composition, mobile keyboards, find-in-page, and select-all.
 *
 * The layers only stay aligned if they agree on every metric that affects text
 * layout, which is why the font, size, line-height, letter-spacing, tab-size and
 * padding are all set on `.sql-editor-body` and inherited by both. The one that
 * is easy to miss is `wrap="off"`: a soft-wrapped line occupies two visual rows
 * in the textarea, and any line-number gutter beside it immediately starts
 * counting the wrong thing. Turning wrapping off makes one logical line exactly
 * one visual row in all three layers, which is what a code editor does anyway.
 * ---------------------------------------------------------------------------
 */
export function SqlEditor({ value, onChange, onRun, busy, disabled, placeholder }) {
  const [ref, onTab] = useTabIndent(value, onChange);
  const mirrorRef = useRef(null);
  const gutterRef = useRef(null);

  const lines = useMemo(() => highlight(value, 'sql'), [value]);

  /*
    Counted from the raw text, not from `lines`. `highlight()` drops the empty
    line a trailing newline leaves behind — right for a printed block, wrong
    here, because the caret is sitting on that line and it needs a number.
  */
  const lineCount = value ? value.split('\n').length : 1;

  /*
    The two layers under the textarea do not scroll themselves — they are
    `overflow: hidden` and moved to wherever the textarea has been scrolled to.
    Driving them from the one element that actually has a scrollbar is what
    keeps them from ever disagreeing about the position.
  */
  const onScroll = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = el.scrollTop;
      mirrorRef.current.scrollLeft = el.scrollLeft;
    }
    /* The gutter follows vertically only — it must not slide out sideways. */
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
  }, [ref]);

  const onKeyDown = (event) => {
    /*
      Cmd/Ctrl+Enter runs. Plain Enter must not — a query is several lines and
      the newline is the common keystroke, so binding Enter to Run would fight
      the reader on every line break.
    */
    if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!busy && !disabled) onRun();
      return;
    }
    onTab(event);
  };

  return (
    <div className="sql-editor">
      <div className="sql-editor-bar">
        <span className="sql-lang mono">SQL</span>
        <span className="spacer" />
        {value.length > 0 && (
          <span className="sql-chars mono">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'}
          </span>
        )}
        {/* The one action on this half of the screen, so it is filled rather
            than outlined — with nothing typed it is disabled, which is the
            only state where a primary button here would be a lie. */}
        <button
          type="button"
          className="btn primary sql-run"
          onClick={onRun}
          disabled={busy || disabled || !value.trim()}
        >
          {busy ? 'Running…' : 'Run'}
          <kbd className="mono">⌘↵</kbd>
        </button>
      </div>

      <div className="sql-editor-body">
        {/* Both layers are decoration for the field beside them, so neither is
            announced — a screen reader gets the textarea and its value, once. */}
        <div className="sql-gutter" ref={gutterRef} aria-hidden="true">
          {Array.from({ length: lineCount }, (_, i) => (
            <span key={i}>{i + 1}</span>
          ))}
        </div>

        <pre className="sql-mirror" ref={mirrorRef} aria-hidden="true">
          {lines.map((tokens, i) => (
            <Fragment key={i}>
              {tokens.map((token, j) =>
                token.c ? (
                  <span className={token.c} key={j}>
                    {token.t}
                  </span>
                ) : (
                  token.t
                ),
              )}
              {/* The newline is a character in the stream rather than a block
                  boundary, so the mirror wraps and breaks exactly as the
                  textarea does instead of merely close to it. */}
              {i < lines.length - 1 ? '\n' : null}
            </Fragment>
          ))}
        </pre>

        <textarea
          ref={ref}
          className="sql-code"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          placeholder={placeholder}
          wrap="off"
          spellCheck="false"
          autoCapitalize="off"
          autoCorrect="off"
          autoComplete="off"
          maxLength={20000}
        />
      </div>
    </div>
  );
}

/**
 * A read-only query, highlighted — the reference answer, and your own passing
 * one when you come back to it.
 *
 * Uses the same `highlight()` the Learn track's SQL code blocks go through, so
 * the answer you read in the notes and the answer you read here are drawn by
 * one tokeniser and look like the same kind of object.
 */
export function SqlBlock({ code, caption }) {
  const lines = highlight(code || '', 'sql');

  return (
    <div className="sql-block">
      {caption && <span className="sql-block-cap mono">{caption}</span>}
      <pre>
        <code>
          {lines.map((tokens, i) => (
            <span className="cl" key={i}>
              {tokens.map((token, j) =>
                token.c ? (
                  <span className={token.c} key={j}>
                    {token.t}
                  </span>
                ) : (
                  token.t
                ),
              )}
            </span>
          ))}
        </code>
      </pre>
    </div>
  );
}
