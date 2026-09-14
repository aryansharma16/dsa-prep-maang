import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef } from 'react';
import { highlightDbml } from '../../../design/schema/highlight.js';
import { applyIndent } from '../../../design/text/indent.js';

/**
 * The DBML text on a schema board.
 *
 * The SQL Lab's technique (components/sql/SqlEditor.jsx): a real `<textarea>`
 * with transparent glyphs over a `<pre>` that draws the same text coloured, so
 * undo, IME, selection and find keep working. Wrapping is off so one line is one
 * row in the textarea, the mirror and the gutter alike.
 *
 * On top of that: diagnostics drawn as wavy underlines in the mirror (and marked
 * in the gutter, with the message on hover), the caret reported to the board so
 * the diagram can highlight the table and column under it, and an imperative
 * `reveal(span)` so clicking a column in the diagram jumps to its line.
 */

function segments(source, tokens, diagnostics) {
  // Boundaries where styling can change.
  const cuts = new Set([0, source.length]);
  for (const t of tokens) {
    cuts.add(t.start);
    cuts.add(t.end);
  }
  for (const d of diagnostics) {
    cuts.add(Math.min(source.length, d.span.start));
    cuts.add(Math.min(source.length, Math.max(d.span.end, d.span.start + 1)));
  }
  const points = [...cuts].sort((a, b) => a - b);
  let ti = 0;
  const sortedTokens = [...tokens].sort((a, b) => a.start - b.start);
  const out = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const start = points[i];
    const end = points[i + 1];
    while (ti < sortedTokens.length && sortedTokens[ti].end <= start) ti += 1;
    const token = sortedTokens[ti] && sortedTokens[ti].start <= start && sortedTokens[ti].end >= end ? sortedTokens[ti] : null;
    const diag = diagnostics.find((d) => d.span.start <= start && Math.max(d.span.end, d.span.start + 1) >= end);
    out.push({ start, end, kind: token?.kind || null, severity: diag?.severity || null });
  }
  return out;
}

export const DbmlEditor = forwardRef(function DbmlEditor({ value, onChange, onCaret, diagnostics = [], readOnly = false }, ref) {
  const areaRef = useRef(null);
  const mirrorRef = useRef(null);
  const gutterRef = useRef(null);

  const tokens = useMemo(() => highlightDbml(value), [value]);
  const parts = useMemo(() => segments(value, tokens, diagnostics), [value, tokens, diagnostics]);
  const lineStarts = useMemo(() => {
    const starts = [0];
    for (let i = 0; i < value.length; i += 1) if (value[i] === '\n') starts.push(i + 1);
    return starts;
  }, [value]);
  const lineOf = useCallback(
    (offset) => {
      let lo = 0;
      let hi = lineStarts.length - 1;
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (lineStarts[mid] <= offset) lo = mid;
        else hi = mid - 1;
      }
      return lo;
    },
    [lineStarts],
  );
  const problemLines = useMemo(() => {
    const map = new Map();
    for (const d of diagnostics) {
      const line = lineOf(d.span.start);
      if (!map.has(line) || d.severity === 'error') map.set(line, d);
    }
    return map;
  }, [diagnostics, lineOf]);

  useImperativeHandle(ref, () => ({
    /** Selects a span and scrolls it into view. */
    reveal(span) {
      const el = areaRef.current;
      if (!el) return;
      el.focus({ preventScroll: true });
      el.setSelectionRange(span.start, span.end);
      const line = lineOf(span.start);
      const lineHeight = parseFloat(getComputedStyle(el).lineHeight) || 20;
      el.scrollTop = Math.max(0, line * lineHeight - el.clientHeight / 3);
      onScroll();
    },
    focus: () => areaRef.current?.focus(),
  }));

  const onScroll = useCallback(() => {
    const el = areaRef.current;
    if (!el) return;
    if (mirrorRef.current) {
      mirrorRef.current.scrollTop = el.scrollTop;
      mirrorRef.current.scrollLeft = el.scrollLeft;
    }
    if (gutterRef.current) gutterRef.current.scrollTop = el.scrollTop;
  }, []);

  const reportCaret = () => {
    const el = areaRef.current;
    if (el && onCaret) onCaret(el.selectionStart);
  };

  const onKeyDown = (event) => {
    if (event.key === 'Tab' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      applyIndent(event.currentTarget, event.shiftKey);
    }
    // Keys typed here are text: never board shortcuts.
    event.stopPropagation();
  };

  return (
    <div className="sd-dbml">
      <div className="sd-dbml-gutter" ref={gutterRef} aria-hidden="true">
        {lineStarts.map((_, i) => {
          const problem = problemLines.get(i);
          return (
            <span key={i} className={problem ? `has-${problem.severity}` : undefined} title={problem?.message}>
              {i + 1}
            </span>
          );
        })}
      </div>
      <div className="sd-dbml-body">
        <pre className="sd-dbml-mirror" ref={mirrorRef} aria-hidden="true">
          {parts.map((part) => {
            const text = value.slice(part.start, part.end);
            if (!part.kind && !part.severity) return text;
            return (
              <span key={part.start} className={`${part.kind ? `sd-tk-${part.kind}` : ''} ${part.severity ? `sd-squiggle-${part.severity}` : ''}`}>
                {text}
              </span>
            );
          })}
          {'\n'}
        </pre>
        <textarea
          ref={areaRef}
          className="sd-dbml-input"
          value={value}
          wrap="off"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          readOnly={readOnly}
          aria-label="Schema in DBML"
          onChange={(event) => onChange(event.target.value)}
          onScroll={onScroll}
          onKeyDown={onKeyDown}
          onKeyUp={reportCaret}
          onClick={reportCaret}
          onSelect={reportCaret}
        />
      </div>
    </div>
  );
});
