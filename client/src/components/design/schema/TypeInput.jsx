import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { describeType, filterTypeGroups, typeGroups, validTypeText } from '../../../design/schema/assist.js';

/**
 * A column type: type anything DBML allows, or pick from a list of the usual
 * types with a line on what each is for (and the schema's own enums first).
 *
 * A combobox — the text stays free, because `varchar(100)`, `numeric(20,6)` or
 * a type the list does not know are all fine. Clicking it (or ↓) shows every
 * suggestion; typing narrows them, searching the descriptions too, so "money"
 * finds `decimal`. Enter or a click picks; Escape closes, then reverts.
 *
 * Two ways to use it:
 *  - `onCommit(text)` alone: an existing column. Picks, Enter and leaving the
 *    field commit a changed, valid type; anything else goes back to `value`.
 *  - `onChange(text)` too: a form field whose parent holds the text. Enter with
 *    the list closed submits the form.
 */

function bestIndex(flat, query, current) {
  const q = query.trim().toLowerCase();
  if (!q) return Math.max(0, flat.findIndex((t) => t.name === current));
  let best = 0;
  let rank = 9;
  flat.forEach((t, i) => {
    const name = t.name.toLowerCase();
    const r = name === q ? 0 : name.startsWith(q) ? 1 : name.includes(q) ? 2 : 3;
    if (r < rank) {
      rank = r;
      best = i;
    }
  });
  return best;
}

export function TypeInput({ value, onCommit, onChange, model, disabled, label = 'Column type', inputClassName = '' }) {
  const controlled = Boolean(onChange);
  const [draft, setDraft] = useState(value);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const wrapRef = useRef(null);
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const focused = useRef(false);
  const listId = useId();

  useEffect(() => {
    if (!focused.current || controlled) setDraft(value);
  }, [value, controlled]);

  const groups = useMemo(() => filterTypeGroups(typeGroups(model), query), [model, query]);
  const flat = useMemo(() => groups.flatMap((g) => g.types), [groups]);

  const openList = (q) => {
    setQuery(q);
    setOpen(true);
  };

  useEffect(() => {
    if (open) setActive(bestIndex(flat, query, value));
    // Only when the list or the query changes — not on every value keystroke in a controlled field.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, flat]);

  useLayoutEffect(() => {
    if (!open || !wrapRef.current) return;
    const rect = wrapRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 260);
    const height = Math.min(320, window.innerHeight * 0.5);
    const below = rect.bottom + 4 + height <= window.innerHeight - 8;
    setPos({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
      ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
    });
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event?.type === 'scroll' && listRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [open]);

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

  const commit = (text) => {
    const next = text.trim();
    if (!next || !validTypeText(next)) return false;
    if (next !== value) onCommit?.(next);
    return true;
  };

  const pick = (name) => {
    setDraft(name);
    onChange?.(name);
    commit(name);
    setOpen(false);
  };

  const onKeyDown = (event) => {
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (!open) return openList('');
      if (!flat.length) return undefined;
      const step = event.key === 'ArrowDown' ? 1 : -1;
      return setActive((i) => (i + step + flat.length) % flat.length);
    }
    if (event.key === 'Enter') {
      if (open && flat[active]) {
        event.preventDefault();
        return pick(flat[active].name);
      }
      if (controlled) return undefined; // the form submits
      event.preventDefault();
      if (commit(draft)) inputRef.current?.blur();
      return undefined;
    }
    if (event.key === 'Tab' && open && query.trim() && flat[active]) return pick(flat[active].name);
    if (event.key === 'Escape') {
      event.stopPropagation();
      if (open) return setOpen(false);
      if (!controlled) {
        setDraft(value);
        inputRef.current?.blur();
      }
    }
    return undefined;
  };

  const about = describeType(draft, model);
  const invalid = Boolean(draft.trim()) && !validTypeText(draft);

  return (
    <div ref={wrapRef} className={`sd-typeinput ${invalid ? 'invalid' : ''}`}>
      <input
        ref={inputRef}
        className={`sd-input mono ${inputClassName}`}
        value={draft}
        disabled={disabled}
        spellCheck={false}
        autoComplete="off"
        role="combobox"
        aria-label={label}
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={open && flat[active] ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        title={invalid ? `"${draft}" is not a type DBML can read` : about ? `${draft} — ${about}` : draft ? `${draft} — Click for common types` : undefined}
        onFocus={() => {
          focused.current = true;
        }}
        onClick={() => !open && openList('')}
        onChange={(event) => {
          setDraft(event.target.value);
          onChange?.(event.target.value);
          openList(event.target.value);
        }}
        onBlur={() => {
          focused.current = false;
          setOpen(false);
          if (!commit(draft) && !controlled) setDraft(value);
        }}
        onKeyDown={onKeyDown}
      />
      <button
        type="button"
        className="sd-typeinput-caret"
        tabIndex={-1}
        disabled={disabled}
        aria-label="Show common types"
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => {
          inputRef.current?.focus();
          if (open) setOpen(false);
          else openList('');
        }}
      >
        ▾
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className="sd-typelist"
            role="listbox"
            aria-label={label}
            style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom } : { left: -9999, top: -9999 }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {!flat.length && (
              <div className="sd-typelist-empty">{invalid ? 'Not a type yet — keep typing, e.g. varchar(100)' : `No suggestions. Enter uses "${draft.trim()}".`}</div>
            )}
            {(() => {
              let index = -1;
              return groups.map((group) => (
                <div key={group.id} role="group" aria-label={group.label}>
                  <div className="sd-typelist-group">{group.label}</div>
                  {group.types.map((type) => {
                    index += 1;
                    const i = index;
                    return (
                      <div
                        key={type.name}
                        id={`${listId}-${i}`}
                        data-index={i}
                        role="option"
                        aria-selected={i === active}
                        className={`sd-typelist-option ${i === active ? 'active' : ''} ${type.name === value ? 'current' : ''}`}
                        onPointerMove={() => i !== active && setActive(i)}
                        onClick={() => pick(type.name)}
                      >
                        <span className="sd-typelist-name">{type.name}</span>
                        <span className="sd-typelist-about">{type.about}</span>
                      </div>
                    );
                  })}
                </div>
              ));
            })()}
          </div>,
          document.body,
        )}
    </div>
  );
}
