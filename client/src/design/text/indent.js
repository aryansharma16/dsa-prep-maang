/**
 * Tab and Shift+Tab in the code-like text boxes (DBML, data-structure items),
 * as the replacement to make rather than the new value: callers apply it with
 * `document.execCommand('insertText')`, which keeps the textarea's own undo
 * stack and caret — setting `value` directly loses both.
 *
 * - Tab with no selection, or inside one line: two spaces at the caret.
 * - Tab across lines: indents every selected line.
 * - Shift+Tab: outdents the selected lines (or the caret's line) by up to two spaces.
 *
 * Returns `{ start, end, insert, selection: [from, to] }`: replace `start…end`
 * with `insert`, then select `from…to`. Pure.
 */

const UNIT = '  ';

export function indentEdit(value, from, to, outdent = false) {
  const text = String(value ?? '');
  const multiLine = text.slice(from, to).includes('\n');
  if (!outdent && !multiLine) {
    return { start: from, end: to, insert: UNIT, selection: [from + UNIT.length, from + UNIT.length] };
  }
  const start = text.lastIndexOf('\n', from - 1) + 1;
  // A selection ending just after a newline does not include the next line.
  const last = to > from && text[to - 1] === '\n' ? to - 1 : to;
  let end = text.indexOf('\n', last);
  if (end < 0) end = text.length;
  const lines = text.slice(start, end).split('\n');
  let firstDelta = 0;
  let totalDelta = 0;
  const changed = lines.map((line, i) => {
    let next;
    if (outdent) {
      const remove = line.startsWith(UNIT) ? UNIT.length : line.startsWith(' ') || line.startsWith('\t') ? 1 : 0;
      next = line.slice(remove);
    } else {
      next = line.length ? UNIT + line : line;
    }
    const delta = next.length - line.length;
    if (i === 0) firstDelta = delta;
    totalDelta += delta;
    return next;
  });
  const insert = changed.join('\n');
  const selFrom = Math.max(start, from + firstDelta);
  const selTo = from === to ? selFrom : Math.max(selFrom, to + totalDelta);
  return { start, end, insert, selection: [selFrom, selTo] };
}

/** Applies an indent edit to a focused textarea, keeping native undo where the browser allows it. */
export function applyIndent(el, outdent) {
  const edit = indentEdit(el.value, el.selectionStart, el.selectionEnd, outdent);
  el.setSelectionRange(edit.start, edit.end);
  let done = false;
  try {
    done = document.execCommand('insertText', false, edit.insert);
  } catch {
    done = false;
  }
  if (!done) {
    el.setRangeText(edit.insert, edit.start, edit.end, 'end');
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.setSelectionRange(edit.selection[0], edit.selection[1]);
}
