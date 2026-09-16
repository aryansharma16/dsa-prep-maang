import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown that explains its choices: a button showing the current choice,
 * and a list where every option can carry a line saying what it does, an icon,
 * grouped, with an optional sentence at the top saying what the whole choice is
 * about.
 *
 * For the choices a native `<select>` serves badly in the design workspace — it
 * cannot describe an option, and it renders in the operating system's colours
 * rather than the board's. Keyboard as a listbox: ↑ ↓ Home End move, Enter or
 * Space picks, Escape closes, typing a letter jumps.
 *
 *   <PickList label="Relation kind" value={op} onChange={setOp} intro="How many rows on each side"
 *     options={[{ value: '>', label: 'many → one', about: '…', group: 'Kinds', disabled: false }]} />
 *
 * Long lists (`search`) get a search box at the top, focused when the list
 * opens; then ↑ ↓ and Enter still drive the list while the letters go into the
 * box. While a search is running the group headings come off — matches are
 * ranked across groups — and each row shows its group on the right instead.
 * `filter` replaces the plain label/description match with the catalogue's own
 * ranking (see `searchTech`).
 */

const matchOptions = (options, query) => {
  const q = query.toLowerCase();
  return options.filter((o) => `${o.label} ${o.about || ''} ${o.group || ''} ${o.meta || ''}`.toLowerCase().includes(q));
};

export function PickList({
  label,
  value,
  options,
  onChange,
  disabled,
  placeholder = 'Choose…',
  intro,
  title,
  display,
  leading,
  className = '',
  mono = false,
  search = false,
  filter,
  listWidth = 270,
  empty = 'Nothing to choose yet',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const searchRef = useRef(null);
  const listId = useId();

  // What the search box narrows the list to; without `search` it is every option.
  const visible = (text) => {
    const q = search ? text.trim() : '';
    if (!q) return options;
    return filter ? filter(options, q) : matchOptions(options, q);
  };
  const searching = Boolean(search && query.trim());
  const shown = visible(query);
  const current = options.find((o) => o.value === value);
  const enabled = shown.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const show = () => {
    if (disabled) return;
    setQuery('');
    // Indices are into the shown list, which a cleared query makes `options` again.
    const at = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(at >= 0 ? at : Math.max(0, options.findIndex((o) => !o.disabled)));
    setOpen(true);
  };
  const close = () => {
    setOpen(false);
    buttonRef.current?.focus();
  };
  const pick = (option) => {
    if (!option || option.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  };
  const onSearch = (text) => {
    setQuery(text);
    const next = visible(text);
    const first = next.findIndex((o) => !o.disabled);
    setActive(first >= 0 ? first : 0);
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, listWidth);
    const height = Math.min(360, window.innerHeight * 0.6);
    const below = rect.bottom + 4 + height <= window.innerHeight - 8;
    setPos({
      left: Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8)),
      width,
      ...(below ? { top: rect.bottom + 4 } : { bottom: window.innerHeight - rect.top + 4 }),
    });
  }, [open, listWidth]);

  useEffect(() => {
    if (open && search) searchRef.current?.focus();
  }, [open, search]);

  useEffect(() => {
    if (!open) return undefined;
    const close = (event) => {
      if (event?.type === 'scroll' && listRef.current?.contains(event.target)) return;
      if (event?.type === 'pointerdown' && (listRef.current?.contains(event.target) || buttonRef.current?.contains(event.target))) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', close, true);
    document.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    window.addEventListener('blur', close);
    return () => {
      document.removeEventListener('pointerdown', close, true);
      document.removeEventListener('scroll', close, true);
      window.removeEventListener('resize', close);
      window.removeEventListener('blur', close);
    };
  }, [open]);

  // `pos` too: the list is parked off screen for one commit, where scrolling it would measure nothing.
  useEffect(() => {
    if (open && pos) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active, pos]);

  const move = (step) => {
    if (!enabled.length) return;
    const at = enabled.indexOf(active);
    setActive(enabled[(at + step + enabled.length) % enabled.length]);
  };

  const onKeyDown = (event) => {
    if (!open) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(event.key)) {
        event.preventDefault();
        show();
      }
      return;
    }
    if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    // With a search box, Home/End and the letters belong to the text being typed.
    else if (event.key === 'Home' && !search) setActive(enabled[0] ?? 0);
    else if (event.key === 'End' && !search) setActive(enabled.at(-1) ?? 0);
    else if (event.key === 'Enter' || (event.key === ' ' && !search)) pick(shown[active]);
    else if (event.key === 'Escape') {
      event.stopPropagation();
      close();
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else if (!search && event.key.length === 1) {
      const letter = event.key.toLowerCase();
      const next = enabled.find((i) => i > active && shown[i].label.toLowerCase().startsWith(letter)) ?? enabled.find((i) => shown[i].label.toLowerCase().startsWith(letter));
      if (next != null) setActive(next);
    } else return;
    event.preventDefault();
  };

  let lastGroup = null;
  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`sd-input sd-picklist ${mono ? 'mono' : ''} ${current ? '' : 'placeholder'} ${className}`}
        disabled={disabled}
        aria-label={label}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-activedescendant={open && !search && shown[active] ? `${listId}-${active}` : undefined}
        title={title}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        {leading && (
          <span className="sd-picklist-icon" aria-hidden="true">
            {leading}
          </span>
        )}
        <span className="sd-picklist-value">{display ?? current?.label ?? placeholder}</span>
        <span className="sd-picklist-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            className="sd-typelist sd-picklist-list"
            style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom } : { left: -9999, top: -9999 }}
            // Keeps the button focused when the list is clicked — except in the search box, which needs the caret.
            onPointerDown={(event) => event.target !== searchRef.current && event.preventDefault()}
          >
            {intro && <div className="sd-picklist-intro">{intro}</div>}
            {search && (
              <div className="sd-picklist-search">
                <input
                  ref={searchRef}
                  className="sd-input"
                  value={query}
                  placeholder={typeof search === 'string' ? search : 'Search…'}
                  role="combobox"
                  aria-label={`Search ${label}`}
                  aria-expanded="true"
                  aria-controls={listId}
                  aria-autocomplete="list"
                  aria-activedescendant={shown[active] ? `${listId}-${active}` : undefined}
                  spellCheck={false}
                  autoComplete="off"
                  onChange={(event) => onSearch(event.target.value)}
                  onKeyDown={onKeyDown}
                />
              </div>
            )}
            <div
              id={listId}
              className="sd-picklist-options"
              role="listbox"
              aria-label={label}
            >
              {!shown.length && <div className="sd-typelist-empty">{searching ? `Nothing matches “${query.trim()}”` : empty}</div>}
              {shown.map((option, i) => {
                const heading = !searching && option.group && option.group !== lastGroup ? option.group : null;
                lastGroup = option.group ?? lastGroup;
                // Ranked matches cut across groups, so a match says which group it came from.
                const meta = option.meta ?? (searching ? option.group : null);
                return (
                  <div key={`${option.group || ''}:${option.value}`}>
                    {heading && <div className="sd-typelist-group">{heading}</div>}
                    <div
                      id={`${listId}-${i}`}
                      data-index={i}
                      role="option"
                      aria-selected={option.value === value}
                      aria-disabled={option.disabled || undefined}
                      className={`sd-typelist-option ${option.icon ? 'with-icon' : ''} ${i === active ? 'active' : ''} ${option.value === value ? 'current' : ''} ${option.disabled ? 'disabled' : ''}`}
                      onPointerMove={() => !option.disabled && i !== active && setActive(i)}
                      onClick={() => pick(option)}
                    >
                      {option.icon && (
                        <span className="sd-picklist-icon" aria-hidden="true">
                          {option.icon}
                        </span>
                      )}
                      <span className="sd-picklist-text">
                        <span className="sd-picklist-row">
                          <span className={`sd-typelist-name ${mono ? '' : 'plain'}`}>{option.label}</span>
                          {meta && <span className={`sd-picklist-meta ${option.meta ? '' : 'plain'}`}>{meta}</span>}
                        </span>
                        {option.about && <span className="sd-typelist-about">{option.about}</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
