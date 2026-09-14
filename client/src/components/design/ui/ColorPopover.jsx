import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { hexToHsv, hsvToHex, normalizeHex } from '../../../design/core/color.js';

/**
 * A colour picker that opens where you clicked and stays on screen: a
 * saturation/brightness square, a hue strip and a hex field.
 *
 * The browser's own `<input type="color">` places its popup wherever the
 * operating system likes — off the right edge of the window, from a panel on
 * the right — and cannot be styled. This one is positioned from its anchor and
 * clamped to the viewport.
 *
 * `onChange(hex, live)`: `live` is true while dragging, so the caller can fold a
 * drag into one undo step. Closes on Escape, a click outside, or Done.
 */

const WIDTH = 232;

export function ColorPopover({ anchor, value, onChange, onClose, label = 'Colour' }) {
  const ref = useRef(null);
  const [hsv, setHsv] = useState(() => hexToHsv(normalizeHex(value) || '#3b82f6'));
  const [hex, setHex] = useState(() => normalizeHex(value) || '#3b82f6');
  const [pos, setPos] = useState(null);

  useLayoutEffect(() => {
    const panel = ref.current;
    if (!panel || !anchor) return;
    const rect = anchor.getBoundingClientRect();
    const { height } = panel.getBoundingClientRect();
    const edge = 8;
    const left = Math.min(window.innerWidth - WIDTH - edge, Math.max(edge, rect.right - WIDTH));
    let top = rect.bottom + 6;
    if (top + height > window.innerHeight - edge) top = Math.max(edge, rect.top - height - 6);
    setPos({ left, top });
  }, [anchor]);

  useEffect(() => {
    const onDown = (event) => {
      if (ref.current?.contains(event.target) || anchor?.contains(event.target)) return;
      onClose();
    };
    const onKey = (event) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
      anchor?.focus?.();
    };
    document.addEventListener('pointerdown', onDown, true);
    document.addEventListener('keydown', onKey, true);
    window.addEventListener('resize', onClose);
    return () => {
      document.removeEventListener('pointerdown', onDown, true);
      document.removeEventListener('keydown', onKey, true);
      window.removeEventListener('resize', onClose);
    };
  }, [anchor, onClose]);

  const apply = (next, live) => {
    setHsv(next);
    const nextHex = hsvToHex(next);
    setHex(nextHex);
    onChange(nextHex, live);
  };

  /** Pointer drag on an area: `read(x01, y01)` → the next HSV. */
  const drag = (read) => (event) => {
    if (event.button !== 0) return;
    event.preventDefault();
    const target = event.currentTarget;
    target.setPointerCapture(event.pointerId);
    const at = (e) => {
      const r = target.getBoundingClientRect();
      return read(Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)));
    };
    apply(at(event), true);
    const move = (e) => apply(at(e), true);
    const up = (e) => {
      apply(at(e), true);
      target.removeEventListener('pointermove', move);
      target.removeEventListener('pointerup', up);
      target.removeEventListener('pointercancel', up);
    };
    target.addEventListener('pointermove', move);
    target.addEventListener('pointerup', up);
    target.addEventListener('pointercancel', up);
  };

  const nudge = (event, key, step) => {
    const deltas = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[event.key];
    if (!deltas) return;
    event.preventDefault();
    const [dx, dy] = deltas;
    if (key === 'sv') apply({ ...hsv, s: Math.min(1, Math.max(0, hsv.s + dx * step)), v: Math.min(1, Math.max(0, hsv.v - dy * step)) }, true);
    else apply({ ...hsv, h: Math.min(359, Math.max(0, hsv.h + (dx || -dy) * step)) }, true);
  };

  return createPortal(
    <div ref={ref} className="sd-colorpop" role="dialog" aria-label={label} style={pos ? { left: pos.left, top: pos.top, width: WIDTH } : { left: -9999, top: -9999, width: WIDTH }}>
      <div
        className="sd-colorpop-sv"
        style={{ '--hue': `hsl(${hsv.h} 100% 50%)` }}
        role="slider"
        tabIndex={0}
        aria-label="Saturation and brightness"
        aria-valuetext={hex}
        onPointerDown={drag((x, y) => ({ ...hsv, s: x, v: 1 - y }))}
        onKeyDown={(e) => nudge(e, 'sv', 0.02)}
      >
        <span className="sd-colorpop-knob" style={{ left: `${hsv.s * 100}%`, top: `${(1 - hsv.v) * 100}%`, background: hex }} />
      </div>
      <div
        className="sd-colorpop-hue"
        role="slider"
        tabIndex={0}
        aria-label="Hue"
        aria-valuemin={0}
        aria-valuemax={360}
        aria-valuenow={Math.round(hsv.h)}
        onPointerDown={drag((x) => ({ ...hsv, h: Math.min(359.9, x * 360) }))}
        onKeyDown={(e) => nudge(e, 'hue', 4)}
      >
        <span className="sd-colorpop-knob hue" style={{ left: `${(hsv.h / 360) * 100}%`, background: `hsl(${hsv.h} 100% 50%)` }} />
      </div>
      <div className="sd-colorpop-row">
        <span className="sd-colorpop-preview" style={{ background: hex }} />
        <input
          className="sd-input mono"
          value={hex}
          spellCheck={false}
          aria-label="Hex colour"
          maxLength={7}
          onChange={(e) => {
            setHex(e.target.value);
            const valid = normalizeHex(e.target.value);
            if (valid && valid.length === 7 && e.target.value.replace('#', '').length === 6) {
              setHsv(hexToHsv(valid));
              onChange(valid, true);
            }
          }}
          onBlur={() => setHex(hsvToHex(hsv))}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            const valid = normalizeHex(hex);
            if (valid) {
              setHsv(hexToHsv(valid));
              onChange(valid, false);
            }
            onClose();
          }}
        />
        <button type="button" className="btn ghost sm" onClick={onClose}>
          Done
        </button>
      </div>
    </div>,
    document.body,
  );
}
