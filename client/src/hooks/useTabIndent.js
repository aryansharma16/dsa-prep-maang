import { useCallback, useRef } from 'react';

/**
 * The two behaviours that make a plain `<textarea>` usable for code.
 *
 * **Tab indents instead of leaving the field.** A textarea hands Tab to the
 * browser, which moves focus to the next control — in a dialog that is the
 * Cancel button, and you find out after typing three lines. Trapping it costs
 * the keyboard route out of the field, so Escape still closes the dialog and
 * Shift+Tab still steps backwards, which is the pair people actually reach for.
 *
 * **Selection is preserved.** Setting `value` on a controlled textarea moves the
 * caret to the end in every browser, so it is restored by hand after an indent.
 * Without that, every Tab throws you to the bottom of the file.
 *
 * Extracted from `SolutionEditor`'s `CodeEditor` when the SQL Lab needed the
 * same field with a different chrome around it. Two copies of caret arithmetic
 * would have drifted on the first fix to either — and the failure mode is a
 * cursor that jumps, which is the kind of thing everybody notices and nobody
 * reports.
 *
 * ```js
 * const [ref, onKeyDown] = useTabIndent(value, onChange);
 * <textarea ref={ref} value={value} onKeyDown={onKeyDown} onChange={...} />
 * ```
 */

/** How far one Tab moves. Two, matching the guides' own code samples. */
export const INDENT = '  ';

export function useTabIndent(value, onChange) {
  const ref = useRef(null);

  const onKeyDown = useCallback(
    (event) => {
      if (event.key !== 'Tab' || event.shiftKey) return;
      event.preventDefault();

      const el = ref.current;
      if (!el) return;

      const { selectionStart: start, selectionEnd: end } = el;
      onChange(`${value.slice(0, start)}${INDENT}${value.slice(end)}`);

      // After React has written the new value back into the field.
      requestAnimationFrame(() => {
        const at = start + INDENT.length;
        el.setSelectionRange(at, at);
      });
    },
    [value, onChange],
  );

  return [ref, onKeyDown];
}
