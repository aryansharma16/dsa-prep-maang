import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocalState } from '../../hooks/useLocalState.js';
import { IconSearch } from './Icons.jsx';
import { EMOJI_GROUPS, searchEmoji } from './emojiData.js';

/**
 * The emoji popover.
 *
 * It replaces a `window.prompt`, which was wrong for three reasons that are
 * worth naming, because they are the reasons this file exists rather than a
 * one-line handler:
 *
 * A native dialog is painted by the browser, not by this stylesheet — it says
 * "localhost:5173 says" over a form the app has no say in, and it blocks the
 * main thread while it is open. It also asked people to *type* an emoji, which
 * means knowing the shortcode or leaving the app to find one. And it had no
 * answer for the most common intent of all: clearing the one already set.
 *
 * Portalled and fixed, like Dropdown, because a scrolling ancestor would clip
 * an absolutely positioned panel at its edge. Same reason the position is
 * measured from the trigger on every scroll and resize.
 *
 * Recents are local rather than on the account. Picking an icon is a per-machine
 * habit, and a round trip to store one would be a request per pick.
 */

/** The grid is a fixed eight across, so arrow-down is a row and not a guess. */
const COLUMNS = 8;

const RECENT_KEY = 'emoji.recent';
const RECENT_MAX = 16;

/** Panel geometry. Fixed so the position can be settled before it paints. */
const PANEL_W = 340;
const PANEL_H = 372;
const GUTTER = 8;

export function EmojiPicker({
  value,
  onChange,
  /** Rendered when nothing is picked yet. */
  placeholder = '＋',
  className = '',
  title = 'Pick an emoji',
  disabled,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const [tab, setTab] = useState(EMOJI_GROUPS[0].id);
  const [pos, setPos] = useState(null);
  const [recent, setRecent] = useLocalState(RECENT_KEY, []);

  const triggerRef = useRef(null);
  const panelRef = useRef(null);
  const searchRef = useRef(null);
  const scrollRef = useRef(null);
  const sectionRefs = useRef({});
  const cellRefs = useRef([]);
  // Set while a tab click is animating the scroller, so the spy below does not
  // fight it and repaint the tab you just pressed.
  const jumping = useRef(false);

  const results = useMemo(() => searchEmoji(query), [query]);
  const searching = query.trim().length > 0;

  /**
   * What is on screen, in the order it is on screen — one list, so the keyboard
   * can walk it without knowing which section a cell came from.
   */
  const sections = useMemo(() => {
    if (searching) {
      return [{ id: 'results', label: `${results.length} match${results.length === 1 ? '' : 'es'}`, chars: results.map((r) => r.char) }];
    }
    return [
      ...(recent.length ? [{ id: 'recent', label: 'Recent', chars: recent }] : []),
      ...EMOJI_GROUPS.map((g) => ({ id: g.id, label: g.label, chars: g.emoji.map(([char]) => char) })),
    ];
  }, [searching, results, recent]);

  const flat = useMemo(() => sections.flatMap((s) => s.chars), [sections]);

  /* ------------------------------------------------------------- placement */

  const place = useCallback(() => {
    const el = triggerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    const up = below < PANEL_H + GUTTER && r.top > below;

    // PANEL_W is a preference, not a promise: on a 320px phone a 340px panel
    // hangs off the screen no matter where it is placed, and the clamp below
    // would only pin it to the left gutter and let it overflow the right one.
    const width = Math.min(PANEL_W, window.innerWidth - GUTTER * 2);

    setPos({
      left: Math.max(GUTTER, Math.min(r.left, window.innerWidth - width - GUTTER)),
      top: up ? undefined : r.bottom + 6,
      bottom: up ? window.innerHeight - r.top + 6 : undefined,
      height: Math.min(PANEL_H, Math.max(240, (up ? r.top : below) - 14)),
      width,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return undefined;
    place();
    // Capture: the scroll that moves this trigger is an ancestor's, and those
    // do not bubble.
    window.addEventListener('scroll', place, true);
    window.addEventListener('resize', place);
    return () => {
      window.removeEventListener('scroll', place, true);
      window.removeEventListener('resize', place);
    };
  }, [open, place]);

  /* --------------------------------------------------------------- opening */

  useEffect(() => {
    if (!open) return;
    setQuery('');
    setActive(0);
    setTab(recent.length ? 'recent' : EMOJI_GROUPS[0].id);
    // The field only exists once the portal has rendered.
    requestAnimationFrame(() => searchRef.current?.focus());
    // Deliberately keyed on `open` alone — re-running when `recent` changes
    // would reset the tab under someone mid-scroll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // A filtered list can be shorter than where the cursor was standing.
  useEffect(() => {
    setActive((a) => (a >= flat.length ? Math.max(0, flat.length - 1) : a));
  }, [flat.length]);

  useEffect(() => {
    if (open) cellRefs.current[active]?.scrollIntoView({ block: 'nearest' });
  }, [active, open]);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (triggerRef.current?.contains(e.target)) return;
      // The panel is not inside the trigger's tree any more — it is in <body>.
      if (panelRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  /*
    Escape on `window`, capture phase, for the reason Dropdown documents: Modal
    listens on `document` in capture, and a bubble-phase handler could never
    beat it — a picker opened inside a dialog would close the dialog instead of
    itself.
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

  /* ---------------------------------------------------------------- choose */

  const pick = (char) => {
    onChange(char);
    setRecent((prev) => [char, ...prev.filter((c) => c !== char)].slice(0, RECENT_MAX));
    close();
  };

  const clear = () => {
    onChange('');
    close();
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (flat[active]) pick(flat[active]);
      return;
    }
    if (e.key === 'Tab') {
      setOpen(false);
      return;
    }
    const step = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS }[e.key];
    if (step) {
      e.preventDefault();
      if (!flat.length) return;
      setActive((a) => Math.min(flat.length - 1, Math.max(0, a + step)));
      return;
    }
    if (e.key === 'Home' || e.key === 'End') {
      e.preventDefault();
      setActive(e.key === 'Home' ? 0 : flat.length - 1);
    }
  };

  /* ------------------------------------------------------------------ tabs */

  const jumpTo = (id) => {
    setTab(id);
    const target = sectionRefs.current[id];
    const scroller = scrollRef.current;
    if (!target || !scroller) return;
    jumping.current = true;
    scroller.scrollTo({ top: target.offsetTop - 4, behavior: 'smooth' });
    setTimeout(() => {
      jumping.current = false;
    }, 320);
  };

  // Which section the scroller is actually sitting in, so the tab row stays
  // honest when you scroll past one rather than jumping to it.
  const onScroll = () => {
    if (jumping.current || searching) return;
    const scroller = scrollRef.current;
    if (!scroller) return;
    let current = sections[0]?.id;
    for (const section of sections) {
      const el = sectionRefs.current[section.id];
      if (el && el.offsetTop - 12 <= scroller.scrollTop) current = section.id;
    }
    setTab((t) => (t === current ? t : current));
  };

  /* ----------------------------------------------------------------- paint */

  let index = -1;

  const panel = pos && (
    <div
      ref={panelRef}
      className="emo-panel"
      style={{ left: pos.left, top: pos.top, bottom: pos.bottom, width: pos.width, height: pos.height }}
      onKeyDown={onKeyDown}
    >
      <div className="emo-search">
        <IconSearch size={12} />
        <input
          ref={searchRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActive(0);
            scrollRef.current?.scrollTo({ top: 0 });
          }}
          placeholder="Search emoji"
          aria-label="Search emoji"
          spellCheck="false"
          autoComplete="off"
        />
        {value && (
          <button type="button" className="emo-clear" onClick={clear} title="Remove the emoji">
            Remove
          </button>
        )}
      </div>

      {!searching && (
        <div className="emo-tabs" role="tablist" aria-label="Emoji categories">
          {recent.length > 0 && (
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'recent'}
              className={`emo-tab ${tab === 'recent' ? 'on' : ''}`}
              onClick={() => jumpTo('recent')}
              title="Recent"
            >
              🕘
            </button>
          )}
          {EMOJI_GROUPS.map((group) => (
            <button
              key={group.id}
              type="button"
              role="tab"
              aria-selected={tab === group.id}
              className={`emo-tab ${tab === group.id ? 'on' : ''}`}
              onClick={() => jumpTo(group.id)}
              title={group.label}
            >
              {group.tab}
            </button>
          ))}
        </div>
      )}

      <div className="emo-scroll" ref={scrollRef} onScroll={onScroll} role="listbox" aria-label="Emoji">
        {sections.map((section) => (
          <section
            key={section.id}
            ref={(el) => {
              sectionRefs.current[section.id] = el;
            }}
          >
            <h4 className="emo-label">{section.label}</h4>
            <div className="emo-grid">
              {section.chars.map((char) => {
                index += 1;
                const at = index;
                return (
                  <button
                    key={`${section.id}-${char}`}
                    type="button"
                    role="option"
                    aria-selected={char === value}
                    ref={(el) => {
                      cellRefs.current[at] = el;
                    }}
                    className={`emo-cell ${at === active ? 'active' : ''} ${char === value ? 'on' : ''}`}
                    onMouseEnter={() => setActive(at)}
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pick(char)}
                    tabIndex={-1}
                  >
                    {char}
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        {searching && results.length === 0 && (
          <p className="emo-empty">Nothing matches “{query.trim()}”</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        ref={triggerRef}
        className={`${className} ${open ? 'on' : ''}`}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-label={value ? `${title} — ${value} selected` : title}
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
      >
        {value || placeholder}
      </button>

      {open && createPortal(panel, document.body)}
    </>
  );
}
