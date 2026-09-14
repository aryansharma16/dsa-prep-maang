import { FONT_SIZES } from '../shapes/shapes.js';

/**
 * Measures text the way the canvas will draw it.
 *
 * Auto-sizing text (a text element grows as you type; a paragraph's height
 * follows its content) has to know the rendered size before the element is
 * drawn at it. A hidden element carrying the same class as the real text view
 * is the only measurement that is exactly right — the same font stack, the same
 * line height, the same wrapping — so that is what this uses, rather than a
 * canvas `measureText` that knows nothing about CSS.
 */

let measurer = null;

function node() {
  if (measurer && document.body.contains(measurer)) return measurer;
  measurer = document.createElement('div');
  measurer.setAttribute('aria-hidden', 'true');
  measurer.className = 'sd-measure';
  document.body.appendChild(measurer);
  return measurer;
}

const LINE_HEIGHT = 1.35;
const PAD = { text: [2, 2], paragraph: [4, 4] };

export function fontPx(record) {
  return FONT_SIZES[record.data.fontSize] || (record.type === 'text' ? FONT_SIZES.l : FONT_SIZES.m);
}

/**
 * The box a text-bearing element needs. `width` fixes the width (wrapping);
 * omitted, a text element with `autoWidth` takes its natural width.
 */
export function measureTextBox(record, width) {
  if (typeof document === 'undefined') return { w: width || record.data.w || 40, h: record.data.h || 24 };
  const el = node();
  const size = fontPx(record);
  const [padX, padY] = PAD[record.type] || [2, 2];
  const auto = width == null && record.data.autoWidth;
  el.style.fontSize = `${size}px`;
  el.style.lineHeight = String(LINE_HEIGHT);
  el.style.fontWeight = record.data.weight === 'bold' ? '650' : '400';
  el.style.padding = `${padY}px ${padX}px`;
  el.style.width = auto ? 'auto' : `${Math.max(16, width ?? record.data.w ?? 200)}px`;
  el.style.whiteSpace = auto ? 'pre' : 'pre-wrap';
  // A trailing newline has no height of its own in the DOM; a zero-width space gives it one.
  el.textContent = `${record.data.text || ''}​`;
  const rect = el.getBoundingClientRect();
  return {
    w: Math.ceil(auto ? Math.max(24, rect.width + 2) : width ?? record.data.w),
    h: Math.ceil(Math.max(size * LINE_HEIGHT + padY * 2, rect.height)),
  };
}

/** The largest sticky-note font step at which the text fits, from 24px down to 12px. */
export function stickyFontSize(text, w, h) {
  if (typeof document === 'undefined') return 18;
  const el = node();
  const steps = [24, 20, 18, 16, 14, 12];
  el.style.width = `${Math.max(20, w - 28)}px`;
  el.style.whiteSpace = 'pre-wrap';
  el.style.padding = '0';
  el.style.fontWeight = '450';
  el.style.lineHeight = String(LINE_HEIGHT);
  el.textContent = `${text || ''}​`;
  for (const size of steps) {
    el.style.fontSize = `${size}px`;
    if (el.getBoundingClientRect().height <= h - 28) return size;
  }
  return 12;
}
