import { useEffect, useRef, useState } from 'react';
import { useAppearance } from '../../store/AppearanceContext.jsx';
import { ACCENTS, CUSTOM, hexToRgb } from '../../theme/accents.js';
import { IconMoon, IconPalette, IconSun } from '../ui/Icons.jsx';

/**
 * Theme and accent colour, in one menu off the topbar.
 *
 * Applies live rather than behind a Save, unlike the columns dialog it borrows
 * its segmented control from. Colour is the one setting where seeing it *is*
 * the decision, and there is nothing here to undo — every option is one more
 * click away.
 *
 * A menu, not a modal: it does not register with useDialog, so it never blocks
 * the global shortcuts behind it. Those already ignore keys typed into an input,
 * which is what the hex field is.
 */
/* Must match `grid-template-columns` on .appearance-swatches, or Up and Down
   land a row off. */
const COLUMNS = 7;
const STEPS = { ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLUMNS, ArrowUp: -COLUMNS };

export function AppearancePicker() {
  const { theme, accent, custom, setTheme, setAccent, setCustom } = useAppearance();
  const [open, setOpen] = useState(false);
  const [hex, setHex] = useState(custom);
  const ref = useRef(null);
  const triggerRef = useRef(null);

  // The stored value is canonicalised (#rrggbb) and may differ from what was
  // typed, so the field follows it rather than owning it.
  useEffect(() => setHex(custom), [custom]);

  useEffect(() => {
    if (!open) return undefined;

    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key !== 'Escape') return;
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

  /* Arrows walk the swatches. A radiogroup that only answered to Tab would make
     the colours the slowest part of the menu to reach, and there are fourteen. */
  const onSwatchKeys = (e) => {
    const step = STEPS[e.key];
    if (!step) return;
    e.preventDefault();
    const items = [...ref.current.querySelectorAll('.appearance-swatches .appearance-swatch')];
    const at = items.indexOf(document.activeElement);
    items[(at + step + items.length) % items.length]?.focus();
  };

  const onHex = (e) => {
    const value = e.target.value;
    setHex(value);
    // Only commit once it parses, or every keystroke of "#ff5c8a" would repaint
    // the app in whatever partial colour had been typed so far.
    if (hexToRgb(value)) setCustom(value);
  };

  return (
    <div className="appearance-wrap" ref={ref}>
      <button
        type="button"
        ref={triggerRef}
        className={`icon-btn ${open ? 'on' : ''}`}
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Theme and accent colour"
      >
        <IconPalette size={15} />
        <span className="sr-only">Appearance</span>
      </button>

      {open && (
        <div className="appearance-menu" role="dialog" aria-label="Appearance">
          <p className="appearance-label">Theme</p>
          <div className="size-group appearance-themes">
            <button
              type="button"
              className={theme === 'light' ? 'on' : ''}
              onClick={() => setTheme('light')}
              aria-pressed={theme === 'light'}
            >
              <IconSun size={11} />
              Light
            </button>
            <button
              type="button"
              className={theme === 'dark' ? 'on' : ''}
              onClick={() => setTheme('dark')}
              aria-pressed={theme === 'dark'}
            >
              <IconMoon size={11} />
              Dark
            </button>
          </div>

          <p className="appearance-label">Accent</p>
          {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- roving focus lives on the swatches */}
          <div
            className="appearance-swatches"
            role="radiogroup"
            aria-label="Accent colour"
            onKeyDown={onSwatchKeys}
          >
            {ACCENTS.map((a) => (
              <button
                key={a.id}
                type="button"
                role="radio"
                aria-checked={accent === a.id}
                aria-label={a.label}
                title={a.label}
                /* Its own literal, not var(--accent) — all six have to show
                   their true colour at once, and only one of them is current. */
                style={{ '--swatch': a[theme] }}
                className={`appearance-swatch ${accent === a.id ? 'on' : ''}`}
                onClick={() => setAccent(a.id)}
              />
            ))}
          </div>

          <div className="appearance-custom">
            <button
              type="button"
              role="radio"
              aria-checked={accent === CUSTOM}
              aria-label="Custom colour"
              title="Custom"
              style={{ '--swatch': custom }}
              className={`appearance-swatch ${accent === CUSTOM ? 'on' : ''}`}
              onClick={() => setCustom(custom)}
            />
            <span className="appearance-custom-name">Custom</span>
            <input
              className="appearance-hex mono"
              value={hex}
              onChange={onHex}
              spellCheck="false"
              maxLength={7}
              aria-label="Custom accent hex"
            />
            {/* The native swatch. color-scheme is set per theme in tokens.css,
                so the picker it opens is painted to match. */}
            <input
              type="color"
              className="appearance-native"
              value={hexToRgb(hex) ? custom : '#ffa116'}
              onChange={(e) => setCustom(e.target.value)}
              aria-label="Pick a custom accent colour"
            />
          </div>

          <p className="appearance-note">
            Saved to your account, so it follows you to another browser.
          </p>
        </div>
      )}
    </div>
  );
}
