/**
 * Keyboard shortcuts, as a table.
 *
 * One declarative list drives three things — the key handler, the tooltips on
 * toolbar buttons, and the shortcuts dialog — so a binding cannot be changed in
 * one place and described wrongly in another. The keys follow Figma and FigJam
 * wherever those have an answer, because that is the muscle memory people
 * bring to a canvas.
 *
 * `mod` is ⌘ on a Mac and Ctrl elsewhere. Letters are matched on `event.key`
 * (so a Dvorak or AZERTY layout gets the letter printed on its key); digits and
 * brackets on `event.code`, because Shift changes what `key` reports for them.
 */

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');

export const SHORTCUTS = [
  // Tools
  { keys: 'v', action: 'toolSelect', label: 'Select', group: 'Tools' },
  { keys: 'h', action: 'toolHand', label: 'Hand (hold Space)', group: 'Tools' },
  { keys: 'f', action: 'toolFrame', label: 'Frame', group: 'Tools' },
  { keys: 'r', action: 'toolRect', label: 'Rectangle', group: 'Tools' },
  { keys: 'o', action: 'toolEllipse', label: 'Ellipse', group: 'Tools' },
  { keys: 'd', action: 'toolDiamond', label: 'Diamond', group: 'Tools' },
  { keys: 'a', action: 'toolConnector', label: 'Connector', group: 'Tools' },
  { keys: 'l', action: 'toolConnector', label: 'Connector', group: 'Tools', hidden: true },
  { keys: 'p', action: 'toolPen', label: 'Pen', group: 'Tools' },
  { keys: 'shift+p', action: 'toolHighlighter', label: 'Highlighter', group: 'Tools' },
  { keys: 'e', action: 'toolEraser', label: 'Eraser', group: 'Tools' },
  { keys: 't', action: 'toolText', label: 'Text', group: 'Tools' },
  { keys: 'shift+t', action: 'toolParagraph', label: 'Paragraph', group: 'Tools' },
  { keys: 's', action: 'toolSticky', label: 'Sticky note', group: 'Tools' },
  { keys: 'q', action: 'toolLock', label: 'Keep tool selected', group: 'Tools' },

  // Edit
  { keys: 'mod+z', action: 'undo', label: 'Undo', group: 'Edit' },
  { keys: 'mod+shift+z', action: 'redo', label: 'Redo', group: 'Edit' },
  { keys: 'mod+y', action: 'redo', label: 'Redo', group: 'Edit', hidden: true },
  { keys: 'mod+d', action: 'duplicate', label: 'Duplicate', group: 'Edit' },
  { keys: 'delete', action: 'delete', label: 'Delete', group: 'Edit' },
  { keys: 'backspace', action: 'delete', label: 'Delete', group: 'Edit', hidden: true },
  { keys: 'mod+a', action: 'selectAll', label: 'Select all', group: 'Edit' },
  { keys: 'escape', action: 'escape', label: 'Deselect / cancel', group: 'Edit' },
  { keys: 'enter', action: 'editText', label: 'Edit text', group: 'Edit' },
  { keys: 'mod+c', action: 'copy', label: 'Copy', group: 'Edit', native: true },
  { keys: 'mod+x', action: 'cut', label: 'Cut', group: 'Edit', native: true },
  { keys: 'mod+v', action: 'paste', label: 'Paste', group: 'Edit', native: true },
  { keys: 'mod+s', action: 'save', label: 'Save now', group: 'Edit' },

  // Arrange
  { keys: 'arrowup', action: 'nudgeUp', label: 'Nudge', group: 'Arrange', display: '↑ ↓ ← →' },
  { keys: 'arrowdown', action: 'nudgeDown', hidden: true },
  { keys: 'arrowleft', action: 'nudgeLeft', hidden: true },
  { keys: 'arrowright', action: 'nudgeRight', hidden: true },
  { keys: 'shift+arrowup', action: 'nudgeUpBig', label: 'Nudge 10', group: 'Arrange', display: '⇧ + arrows' },
  { keys: 'shift+arrowdown', action: 'nudgeDownBig', hidden: true },
  { keys: 'shift+arrowleft', action: 'nudgeLeftBig', hidden: true },
  { keys: 'shift+arrowright', action: 'nudgeRightBig', hidden: true },
  { keys: 'mod+bracketright', action: 'bringForward', label: 'Bring forward', group: 'Arrange' },
  { keys: 'mod+bracketleft', action: 'sendBackward', label: 'Send backward', group: 'Arrange' },
  { keys: 'bracketright', action: 'bringToFront', label: 'Bring to front', group: 'Arrange' },
  { keys: 'bracketleft', action: 'sendToBack', label: 'Send to back', group: 'Arrange' },
  { keys: 'mod+alt+g', action: 'frameSelection', label: 'Frame selection', group: 'Arrange' },
  { keys: 'mod+shift+g', action: 'unframe', label: 'Remove frame', group: 'Arrange' },
  { keys: 'mod+shift+l', action: 'toggleLock', label: 'Lock / unlock', group: 'Arrange' },
  { keys: 'alt+a', action: 'alignLeft', label: 'Align left', group: 'Arrange' },
  { keys: 'alt+d', action: 'alignRight', label: 'Align right', group: 'Arrange' },
  { keys: 'alt+w', action: 'alignTop', label: 'Align top', group: 'Arrange' },
  { keys: 'alt+s', action: 'alignBottom', label: 'Align bottom', group: 'Arrange' },
  { keys: 'alt+h', action: 'alignCenterH', label: 'Align centres horizontally', group: 'Arrange' },
  { keys: 'alt+v', action: 'alignCenterV', label: 'Align centres vertically', group: 'Arrange' },
  { keys: 'alt+shift+h', action: 'distributeH', label: 'Distribute horizontally', group: 'Arrange' },
  { keys: 'alt+shift+v', action: 'distributeV', label: 'Distribute vertically', group: 'Arrange' },

  // View
  { keys: 'equal', action: 'zoomIn', label: 'Zoom in', group: 'View', display: '+' },
  { keys: 'shift+equal', action: 'zoomIn', hidden: true },
  { keys: 'mod+equal', action: 'zoomIn', hidden: true },
  { keys: 'minus', action: 'zoomOut', label: 'Zoom out', group: 'View', display: '−' },
  { keys: 'mod+minus', action: 'zoomOut', hidden: true },
  { keys: 'shift+digit0', action: 'zoom100', label: 'Zoom to 100%', group: 'View' },
  { keys: 'shift+digit1', action: 'zoomFit', label: 'Zoom to fit', group: 'View' },
  { keys: 'shift+digit2', action: 'zoomSelection', label: 'Zoom to selection', group: 'View' },
  { keys: 'shift+slash', action: 'shortcuts', label: 'Keyboard shortcuts', group: 'View', display: '?' },
];

const CODE_KEYS = new Set(['bracketleft', 'bracketright', 'equal', 'minus', 'slash']);

function parse(keys) {
  const parts = keys.split('+');
  const key = parts.pop();
  return { key, mod: parts.includes('mod'), shift: parts.includes('shift'), alt: parts.includes('alt') };
}

const PARSED = SHORTCUTS.map((s) => ({ ...s, parsed: parse(s.keys) }));

function eventKey(event) {
  const code = (event.code || '').toLowerCase();
  if (code.startsWith('digit')) return code;
  if (CODE_KEYS.has(code)) return code;
  return (event.key || '').toLowerCase();
}

/** The action for a keydown, or null. Opacity digits (1–0) are handled here too. */
export function matchShortcut(event) {
  const key = eventKey(event);
  const mod = isMac ? event.metaKey : event.ctrlKey;
  const other = isMac ? event.ctrlKey : event.metaKey;
  if (other) return null;

  for (const shortcut of PARSED) {
    const p = shortcut.parsed;
    if (p.key === key && p.mod === mod && p.shift === event.shiftKey && p.alt === event.altKey) {
      return shortcut.native ? null : shortcut.action;
    }
  }

  if (!mod && !event.altKey && !event.shiftKey && /^digit[0-9]$/.test(key)) {
    return `opacity${key.slice(5)}`;
  }
  return null;
}

/** How a binding is written in the UI: ⌘⇧Z on a Mac, Ctrl+Shift+Z elsewhere. */
export function displayKeys(keys) {
  const { key, mod, shift, alt } = parse(keys);
  const names = {
    arrowup: '↑',
    arrowdown: '↓',
    arrowleft: '←',
    arrowright: '→',
    bracketleft: '[',
    bracketright: ']',
    equal: '+',
    minus: '−',
    slash: '/',
    escape: 'Esc',
    enter: 'Enter',
    delete: 'Del',
    backspace: '⌫',
  };
  const label = names[key] || (key.startsWith('digit') ? key.slice(5) : key.toUpperCase());
  if (isMac) return `${mod ? '⌘' : ''}${alt ? '⌥' : ''}${shift ? '⇧' : ''}${label}`;
  return [mod && 'Ctrl', alt && 'Alt', shift && 'Shift', label].filter(Boolean).join('+');
}

export const shortcutFor = (action) => {
  const found = SHORTCUTS.find((s) => s.action === action && !s.hidden);
  return found ? found.display || displayKeys(found.keys) : '';
};
