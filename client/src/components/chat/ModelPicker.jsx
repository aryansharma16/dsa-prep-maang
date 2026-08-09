import { useEffect, useRef, useState } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { IconCheck, IconChevronRight } from '../ui/Icons.jsx';
import { reasonLabel } from './time.js';

/**
 * Which model answers.
 *
 * A menu rather than a <select>, for two reasons. The list is not a list of
 * words: half of it is unavailable at any moment and the *reason* is the useful
 * part — "daily limit reached" and "needs credit" call for completely different
 * actions — and an <option> is one line of plain text with nowhere to put it.
 * And a native popup is painted by the engine, not by this stylesheet, so it
 * ignores the panel it drops out of.
 *
 * Opens upward. The composer is on the floor of the window, so a menu that
 * dropped down would open off-screen exactly when the thread is longest.
 */

const AUTO = {
  id: '',
  label: 'Auto',
  note: 'Picks a model per question, from whichever are available',
  available: true,
};

export function ModelPicker() {
  const { models, model, setModel } = useChat();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  const options = [AUTO, ...models];
  const current = options.find((m) => m.id === model) ?? AUTO;

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
      // The dock closes on Escape too. Closing the menu is the nearer of the
      // two intentions, so it eats the key and leaves the panel open.
      e.stopPropagation();
      setOpen(false);
      triggerRef.current?.focus();
    };

    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  /* Arrows walk the menu. Without this the only way through it is Tab, which on
     a list this long is worse than the <select> this replaced. */
  const onMenuKeyDown = (e) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('.chat-menu-item:not(:disabled)')];
    const at = items.indexOf(document.activeElement);
    const next = e.key === 'ArrowDown' ? at + 1 : at - 1;
    items[(next + items.length) % items.length]?.focus();
  };

  const pick = (id) => {
    setModel(id);
    setOpen(false);
    triggerRef.current?.focus();
  };

  return (
    <div className="chat-menu-wrap" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={`chat-menu-trigger ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Model: ${current.label}`}
        title={model ? 'This model is used for every message' : AUTO.note}
      >
        <span className="nm">{current.label}</span>
        <IconChevronRight size={11} className="chat-menu-caret" />
      </button>

      {open && (
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- roving focus lives on the items
        <div className="chat-menu" role="listbox" onKeyDown={onMenuKeyDown}>
          {options.map((m) => (
            <button
              key={m.id || 'auto'}
              type="button"
              role="option"
              aria-selected={m.id === model}
              className={`chat-menu-item ${m.id === model ? 'on' : ''}`}
              disabled={!m.available}
              onClick={() => pick(m.id)}
            >
              <span className="chat-menu-tick">{m.id === model && <IconCheck size={11} />}</span>
              <span className="chat-menu-text">
                <span className="nm">{m.label}</span>
                {/* Auto explains itself; a named model only needs a line when it
                    cannot be picked, and then the line is the whole point. */}
                {m.note && <span className="chat-menu-note">{m.note}</span>}
                {!m.available && <span className="chat-menu-note">{reasonLabel(m.reason)}</span>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
