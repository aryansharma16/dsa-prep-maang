import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/**
 * A dropdown that explains its choices: a button showing the current choice,
 * and a list where every option can carry a line saying what it does, grouped,
 * with an optional sentence at the top saying what the whole choice is about.
 *
 * For the choices a native `<select>` serves badly in the design workspace — it
 * cannot describe an option, and it renders in the operating system's colours
 * rather than the board's. Keyboard as a listbox: ↑ ↓ Home End move, Enter or
 * Space picks, Escape closes, typing a letter jumps.
 *
 *   <PickList label="Relation kind" value={op} onChange={setOp} intro="How many rows on each side"
 *     options={[{ value: '>', label: 'many → one', about: '…', group: 'Kinds', disabled: false }]} />
 */
export function PickList({ label, value, options, onChange, disabled, placeholder = 'Choose…', intro, title, display, className = '', mono = false }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const current = options.find((o) => o.value === value);
  const enabled = options.map((o, i) => (o.disabled ? -1 : i)).filter((i) => i >= 0);

  const show = () => {
    if (disabled) return;
    const at = options.findIndex((o) => o.value === value && !o.disabled);
    setActive(at >= 0 ? at : enabled[0] ?? 0);
    setOpen(true);
  };
  const pick = (option) => {
    if (!option || option.disabled) return;
    setOpen(false);
    buttonRef.current?.focus();
    if (option.value !== value) onChange(option.value);
  };

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return;
    const rect = buttonRef.current.getBoundingClientRect();
    const width = Math.max(rect.width, 270);
    const height = Math.min(360, window.innerHeight * 0.6);
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

  useEffect(() => {
    if (open) listRef.current?.querySelector(`[data-index="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [open, active]);

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
    const handled = true;
    if (event.key === 'ArrowDown') move(1);
    else if (event.key === 'ArrowUp') move(-1);
    else if (event.key === 'Home') setActive(enabled[0] ?? 0);
    else if (event.key === 'End') setActive(enabled.at(-1) ?? 0);
    else if (event.key === 'Enter' || event.key === ' ') pick(options[active]);
    else if (event.key === 'Escape') {
      event.stopPropagation();
      setOpen(false);
    } else if (event.key === 'Tab') {
      setOpen(false);
      return;
    } else if (event.key.length === 1) {
      const letter = event.key.toLowerCase();
      const next = enabled.find((i) => i > active && options[i].label.toLowerCase().startsWith(letter)) ?? enabled.find((i) => options[i].label.toLowerCase().startsWith(letter));
      if (next != null) setActive(next);
    } else return;
    if (handled) event.preventDefault();
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
        aria-activedescendant={open ? `${listId}-${active}` : undefined}
        title={title}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={onKeyDown}
      >
        <span className="sd-picklist-value">{display ?? current?.label ?? placeholder}</span>
        <span className="sd-picklist-caret" aria-hidden="true">
          ▾
        </span>
      </button>
      {open &&
        createPortal(
          <div
            ref={listRef}
            id={listId}
            className="sd-typelist sd-picklist-list"
            role="listbox"
            aria-label={label}
            style={pos ? { left: pos.left, width: pos.width, top: pos.top, bottom: pos.bottom } : { left: -9999, top: -9999 }}
            onPointerDown={(event) => event.preventDefault()}
          >
            {intro && <div className="sd-picklist-intro">{intro}</div>}
            {!options.length && <div className="sd-typelist-empty">Nothing to choose yet</div>}
            {options.map((option, i) => {
              const heading = option.group && option.group !== lastGroup ? option.group : null;
              lastGroup = option.group ?? lastGroup;
              return (
                <div key={`${option.group || ''}:${option.value}`}>
                  {heading && <div className="sd-typelist-group">{heading}</div>}
                  <div
                    id={`${listId}-${i}`}
                    data-index={i}
                    role="option"
                    aria-selected={option.value === value}
                    aria-disabled={option.disabled || undefined}
                    className={`sd-typelist-option ${i === active ? 'active' : ''} ${option.value === value ? 'current' : ''} ${option.disabled ? 'disabled' : ''}`}
                    onPointerMove={() => !option.disabled && i !== active && setActive(i)}
                    onClick={() => pick(option)}
                  >
                    <span className="sd-picklist-row">
                      <span className={`sd-typelist-name ${mono ? '' : 'plain'}`}>{option.label}</span>
                      {option.meta && <span className="sd-picklist-meta">{option.meta}</span>}
                    </span>
                    {option.about && <span className="sd-typelist-about">{option.about}</span>}
                  </div>
                </div>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
