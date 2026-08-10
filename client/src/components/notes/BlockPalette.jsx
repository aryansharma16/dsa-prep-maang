import { useEffect, useMemo, useRef, useState } from 'react';
import { IconSearch } from '../ui/Icons.jsx';
import { BLOCK_TYPES, GROUPS, hueOf } from './blockTypes.js';

/**
 * The "what do you want to add" picker.
 *
 * Rendered in the flow rather than portalled into a floating layer, and that is
 * the decision the whole component rests on. A floating menu has to be
 * positioned, flipped near the viewport edge, and closed on scroll — three
 * behaviours the app already pays for once in `Dropdown`. Here the panel simply
 * pushes the page down where it was opened, which means the blocks around it
 * stay visible and the thing you are inserting *between* is still on screen
 * while you choose. It also makes the whole control keyboard- and
 * touch-reachable with no maths.
 *
 * Search matches the label, the description and a keyword list, so "todo" finds
 * Points and "gotcha" finds Callout — the words people reach for are rarely the
 * words on the button.
 */
export function BlockPalette({ onPick, onClose, allow, autoFocus = true }) {
  const [query, setQuery] = useState('');
  const [cursor, setCursor] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  const types = useMemo(
    () => (allow ? BLOCK_TYPES.filter((t) => allow.includes(t.type)) : BLOCK_TYPES),
    [allow],
  );

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return types;
    return types.filter((t) =>
      `${t.label} ${t.hint} ${t.keywords} ${t.type}`.toLowerCase().includes(q),
    );
  }, [types, query]);

  // A filtered list is short; the cursor must not point past the end of it.
  useEffect(() => setCursor(0), [query]);

  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  // Keeps the highlighted row in view when arrowing past the fold.
  useEffect(() => {
    listRef.current?.querySelector('.on')?.scrollIntoView({ block: 'nearest' });
  }, [cursor]);

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      onClose?.();
      return;
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      const pick = matches[cursor];
      if (pick) onPick(pick.type);
      return;
    }
    // Down/Up only — the grid wraps at different widths per breakpoint, so
    // left/right would move by an amount that changes with the window.
    if (event.key === 'ArrowDown' || (event.key === 'Tab' && !event.shiftKey)) {
      event.preventDefault();
      setCursor((c) => Math.min(matches.length - 1, c + 1));
    }
    if (event.key === 'ArrowUp' || (event.key === 'Tab' && event.shiftKey)) {
      event.preventDefault();
      setCursor((c) => Math.max(0, c - 1));
    }
  };

  const groups = GROUPS.map((group) => ({
    group,
    items: matches.filter((t) => t.group === group),
  })).filter((g) => g.items.length);

  return (
    <div className="np" onKeyDown={onKeyDown}>
      <div className="np-search">
        <IconSearch size={13} />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search blocks — screenshot, checklist, stack trace…"
          aria-label="Search block types"
          spellCheck={false}
        />
        <kbd>esc</kbd>
      </div>

      <div className="np-list" ref={listRef}>
        {groups.map(({ group, items }) => (
          <div className="np-group" key={group}>
            <span className="np-group-label">{group}</span>
            {items.map((type) => {
              const index = matches.indexOf(type);
              const Icon = type.icon;
              return (
                <button
                  key={type.type}
                  type="button"
                  className={`np-item ${index === cursor ? 'on' : ''}`}
                  data-hue={hueOf(type.type)}
                  // Pointer rather than mouseenter so a touch drag does not
                  // repaint the whole list on the way to a tap.
                  onPointerMove={() => setCursor(index)}
                  onClick={() => onPick(type.type)}
                >
                  <span className="np-icon">
                    <Icon size={14} />
                  </span>
                  <span className="np-text">
                    <strong>{type.label}</strong>
                    <span>{type.hint}</span>
                  </span>
                </button>
              );
            })}
          </div>
        ))}

        {!matches.length && (
          <p className="np-none">
            Nothing matches “{query.trim()}”. Try “image”, “list”, “code” or “pdf”.
          </p>
        )}
      </div>
    </div>
  );
}
