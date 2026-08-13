import { useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { IconCheck, IconChevronRight, IconSearch } from './Icons.jsx';

/**
 * The app's dropdown, replacing <select> wherever the list is worth looking at.
 *
 * A native select is painted by the engine, not by this stylesheet: it ignores
 * the theme, the accent and the surface it drops out of, and it has nowhere to
 * put a second line. This is the same control the model picker introduced,
 * generalised — one implementation rather than a second one per feature.
 *
 * Three things it does that the chat menu did not have to:
 *
 * Portalled. An absolutely positioned menu is clipped by the nearest scrolling
 * ancestor, and `.modal` is one — max-height with overflow-y makes overflow-x
 * compute to auto, so a menu opened inside a dialog would be sliced at its
 * edge. Rendering into <body> and positioning from the trigger's rect is what
 * makes this safe to drop anywhere.
 *
 * Flips. It opens downward until there is not room, then upward — the chat
 * menu could hard-code "up" because it is always on the floor of the window.
 *
 * Searchable past a threshold. Every company in the roadmap is a scroll a
 * fingertip cannot aim at.
 *
 * Keyboard follows the listbox pattern: focus stays in one place and
 * aria-activedescendant moves. Roving focus would fight the search field for
 * it, and the field has to keep focus to be typed into.
 *
 * `multiple` turns it into a set picker: `value` is an array, clicking toggles,
 * and the menu stays open with the search text intact — picking four companies
 * is one gesture, and a menu that closed and forgot what you had typed would
 * make it four. Nothing else changes, which is the point: the portalling, the
 * flipping and the keyboard are the hard parts and they are already here.
 *
 * @param options {{value: string, label: string, note?: string, disabled?: boolean}[]}
 * @param value   {string | string[]} an array when `multiple`
 */

/** Past this many, scrolling costs more than typing. */
const SEARCH_FROM = 8;

/** Enough for six rows; below this the menu flips rather than squeeze. */
const MIN_ROOM = 220;

/** An inline trigger is as wide as its current label, which is routinely
    narrower than the options it lists. The menu does not have to be. */
const INLINE_MIN = 210;

/** Clearance from the window edge, both sides. */
const GUTTER = 8;

export function Dropdown({
  value,
  options,
  onChange,
  placeholder = 'Select…',
  ariaLabel,
  searchable,
  disabled,
  /** Set picker rather than a choice: `value` is an array and the menu stays
      open across picks. */
  multiple = false,
  /** 'field' fills its form row; 'inline' is the compact filter-bar shape. */
  variant = 'field',
  /** Marks an inline trigger as narrowing something. Defaults to "has a
      value", which is what every filter bar in the app already meant. */
  on,
  className = '',
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const wrapRef = useRef(null);
  const triggerRef = useRef(null);
  const menuRef = useRef(null);
  const searchRef = useRef(null);
  const optionRefs = useRef([]);
  const baseId = useId();

  const inline = variant === 'inline';
  const withSearch = searchable ?? options.length >= SEARCH_FROM;

  const picked = useMemo(() => (multiple ? new Set(value || []) : null), [multiple, value]);
  const isPicked = (option) => (multiple ? picked.has(option.value) : option.value === value);

  const selected = multiple ? null : options.find((o) => o.value === value);
  const chosen = multiple ? picked.size : 0;
  // A multi-select is marked in either variant: unlike a single choice, whose
  // label already says what is chosen, its trigger only shows a count.
  const marked = on ?? (multiple ? chosen > 0 : inline && Boolean(value));

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  /*
    Measured from the trigger every time, because between opening and now the
    page may have scrolled underneath a fixed menu. Flips to open upward only
    when below is genuinely too tight *and* above is roomier, so a menu near
    the middle of a short window does not flap between the two.
  */
  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const above = r.top;
    const up = below < MIN_ROOM && above > below;

    /*
      A field menu matches its trigger, which is already the width of the form
      row. An inline one gets a floor instead, because its trigger is only as
      wide as the word currently in it.

      Settled here rather than left to the content: keeping a fixed element on
      screen means knowing how wide it is before it paints, and `max-content`
      would only be measurable afterwards.
    */
    const width = inline ? Math.max(r.width, INLINE_MIN) : r.width;
    const left = Math.max(GUTTER, Math.min(r.left, window.innerWidth - width - GUTTER));

    setPos({
      left,
      width,
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      maxHeight: Math.max(150, (up ? above : below) - 16),
    });
  }, [inline]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    // Capture phase: the scroll that matters is usually an ancestor's, and
    // those do not bubble.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  /*
    Opening lands on what is already chosen, so Enter is a no-op rather than a
    surprise and arrowing starts from where you are.

    Keyed on `open` alone, with the inputs read through a ref. Callers build
    their option arrays inline, so `options` is a new identity on every parent
    render — in the deps this effect would re-run mid-use and wipe a filter
    halfway through being typed.
  */
  const latest = useRef({ options, value });
  latest.current = { options, value };

  useEffect(() => {
    if (!open) return;
    // In multi mode there is no single "what is chosen" to land on, so the
    // cursor starts at the top of the list.
    const at = multiple
      ? -1
      : latest.current.options.findIndex((o) => o.value === latest.current.value);
    setActive(at < 0 ? 0 : at);
    setQuery('');
    // The field only exists once the portal has rendered.
    requestAnimationFrame(() => searchRef.current?.focus() ?? menuRef.current?.focus());
  }, [open, multiple]);

  // A filtered list can be shorter than where the cursor was standing.
  useEffect(() => {
    setActive((a) => (a >= shown.length ? Math.max(0, shown.length - 1) : a));
  }, [shown.length]);

  useEffect(() => {
    if (open) optionRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current?.contains(e.target)) return;
      // The menu is not inside the wrapper any more — it is in <body>.
      if (menuRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  /*
    Escape is taken here rather than in the React handler, and on `window`
    rather than on `document`, for one reason: Modal's own Escape listener is a
    capture-phase listener on `document`. Capture runs window → document →
    … → target, so a React onKeyDown — which is bubble-phase, at the very end —
    could never beat it, and a dropdown open inside a dialog would close the
    dialog out from under itself. One step earlier in the path is the only
    place from which stopping it is possible.
  */
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      close();
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [open, close]);

  /*
    A choice is a decision and closes; a set is a session and does not. Leaving
    the search text alone matters as much as leaving the menu open — "goog",
    tick, "amaz", tick is the actual gesture, and a field that cleared itself
    after every pick would make it twice the typing.
  */
  const pick = (option) => {
    if (option.disabled) return;
    if (!multiple) {
      onChange(option.value);
      close();
      return;
    }
    const current = value || [];
    onChange(
      picked.has(option.value)
        ? current.filter((v) => v !== option.value)
        : [...current, option.value],
    );
  };

  const onKeyDown = (e) => {
    if (!open) {
      if (e.key === 'ArrowDown' || e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }

    // Escape never reaches here — the window listener above swallows it.
    if (e.key === 'Enter') {
      e.preventDefault();
      if (shown[active]) pick(shown[active]);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }

    const step = { ArrowDown: 1, ArrowUp: -1, PageDown: 5, PageUp: -5 }[e.key];
    if (step) {
      e.preventDefault();
      if (!shown.length) return;
      setActive((a) => Math.min(shown.length - 1, Math.max(0, a + step)));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : shown.length - 1);
    }
  };

  const menu = pos && (
    <div
      ref={menuRef}
      className="dd-menu"
      style={{
        left: pos.left,
        width: pos.width,
        top: pos.top,
        bottom: pos.bottom,
        maxHeight: pos.maxHeight,
      }}
      onKeyDown={onKeyDown}
    >
      {withSearch && (
        <div className="dd-search">
          <IconSearch size={12} />
          <input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Type to filter"
            aria-label="Filter options"
            aria-controls={`${baseId}-list`}
            aria-activedescendant={shown[active] ? `${baseId}-o${active}` : undefined}
            spellCheck="false"
          />
        </div>
      )}

      <div
        id={`${baseId}-list`}
        className="dd-list"
        role="listbox"
        aria-multiselectable={multiple || undefined}
        aria-label={ariaLabel}
        // Only focusable when there is no field to hold focus instead.
        tabIndex={withSearch ? -1 : 0}
        aria-activedescendant={shown[active] ? `${baseId}-o${active}` : undefined}
      >
        {shown.map((option, i) => (
          <div
            key={option.value}
            id={`${baseId}-o${i}`}
            ref={(el) => {
              optionRefs.current[i] = el;
            }}
            role="option"
            aria-selected={isPicked(option)}
            aria-disabled={option.disabled || undefined}
            className={`dd-item ${isPicked(option) ? 'on' : ''} ${i === active ? 'active' : ''} ${
              option.disabled ? 'off' : ''
            }`}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick(option)}
          >
            <span className={`dd-tick ${multiple ? 'box' : ''}`}>
              {isPicked(option) && <IconCheck size={11} />}
            </span>
            <span className="dd-text">
              <span className="nm">{option.label}</span>
              {option.note && <span className="dd-note">{option.note}</span>}
            </span>
          </div>
        ))}

        {shown.length === 0 && <p className="dd-empty">Nothing matches “{query.trim()}”</p>}
      </div>
    </div>
  );

  return (
    <div className={`dd ${inline ? 'inline' : ''} ${marked ? 'on' : ''} ${className}`} ref={wrapRef}>
      <button
        type="button"
        ref={triggerRef}
        className={`dd-trigger ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={onKeyDown}
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
      >
        {/* In multi mode the trigger says how many, not which — the chips below
            it are the list, and repeating four company names inside a control
            this narrow would only ever show the first one and a half. */}
        <span className={`nm ${selected || chosen ? '' : 'dd-placeholder'}`}>
          {multiple
            ? chosen
              ? `${chosen} selected`
              : placeholder
            : selected
              ? selected.label
              : placeholder}
        </span>
        <IconChevronRight size={11} className="dd-caret" />
      </button>

      {open && createPortal(menu, document.body)}
    </div>
  );
}
