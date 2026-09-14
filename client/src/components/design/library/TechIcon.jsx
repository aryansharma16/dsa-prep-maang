import { TECH_BY_ID } from '../../../design/library/tech.js';
import { TechGlyph } from './glyphs.jsx';
import { useBrandPaths } from './useBrandPaths.js';

/** Relative luminance of a #rrggbb colour (WCAG). */
function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  const channel = (v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255);
}

/**
 * Very dark or very light brand colours disappear on one of the two themes; they are
 * mixed with the text colour (dark on light, light on dark), which keeps the hue.
 */
export function readableColor(hex) {
  if (!/^#[0-9a-f]{6}$/i.test(hex || '')) return 'currentColor';
  const l = luminance(hex);
  if (l < 0.09) return `color-mix(in oklab, ${hex} 55%, currentColor)`;
  if (l > 0.55) return `color-mix(in oklab, ${hex} 70%, currentColor)`;
  return hex;
}

/**
 * The picture for a catalogue entry: its brand logo (filled, in the brand's
 * colour) or its glyph (stroked). `mono` draws either in the current text
 * colour, for boards that should not look like a sticker sheet.
 */
export function TechIcon({ tech, size = 28, mono = false }) {
  const entry = TECH_BY_ID[tech];
  const paths = useBrandPaths();
  const color = mono ? 'currentColor' : readableColor(entry?.color);
  if (entry?.brand) {
    const d = paths?.[entry.brand];
    if (!d) return <span className="sd-tech-icon-wait" style={{ width: size, height: size }} aria-hidden="true" />;
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" style={{ fill: color }} aria-hidden="true">
        <path d={d} />
      </svg>
    );
  }
  return <TechGlyph name={entry?.glyph || 'box'} size={size} style={{ color }} />;
}
