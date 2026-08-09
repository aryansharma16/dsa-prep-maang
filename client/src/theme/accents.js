/**
 * The accent palette, and the colour maths behind the custom option.
 *
 * Everything visual lives in tokens.css — this module never sets a colour on a
 * component. It owns three things: the list the picker draws swatches from, the
 * arithmetic that fits an arbitrary hex to each theme, and the one function that
 * writes the result onto <html>.
 */

/**
 * Preset ids. These have to match the `[data-accent='…']` rules at the foot of
 * tokens.css: that stylesheet is what actually paints, and these hexes only
 * fill the picker's swatch circles. Adding a palette is two edits, here and
 * there — the server deliberately does not validate against this list, so it is
 * never a third.
 */
export const ACCENTS = [
  { id: 'amber', label: 'Amber', dark: '#ffa116', light: '#e08600' },
  { id: 'orange', label: 'Orange', dark: '#ff7849', light: '#c2410c' },
  { id: 'red', label: 'Red', dark: '#ff4d4d', light: '#d1293d' },
  { id: 'pink', label: 'Pink', dark: '#ff5c8a', light: '#d6336c' },
  { id: 'fuchsia', label: 'Fuchsia', dark: '#e879f9', light: '#a21caf' },
  { id: 'violet', label: 'Violet', dark: '#b58cff', light: '#7c3aed' },
  { id: 'indigo', label: 'Indigo', dark: '#818cf8', light: '#4f46e5' },
  { id: 'blue', label: 'Blue', dark: '#4c9aff', light: '#0b66e4' },
  { id: 'sky', label: 'Sky', dark: '#38bdf8', light: '#0369a1' },
  { id: 'cyan', label: 'Cyan', dark: '#22d3ee', light: '#0e7490' },
  { id: 'teal', label: 'Teal', dark: '#00c2b8', light: '#00786f' },
  { id: 'green', label: 'Green', dark: '#26c281', light: '#00875a' },
  { id: 'lime', label: 'Lime', dark: '#a3e635', light: '#4d7c0f' },
  { id: 'slate', label: 'Slate', dark: '#9aa4b2', light: '#55606e' },
];

export const CUSTOM = 'custom';
const DEFAULT_ACCENT = 'amber';
const DEFAULT_CUSTOM = '#ffa116';

export const DEFAULT_APPEARANCE = {
  theme: 'dark',
  accent: DEFAULT_ACCENT,
  custom: DEFAULT_CUSTOM,
};

/* The two surfaces the accent has to hold up against. Mirrors --bg. */
const SURFACE = { dark: [26, 26, 26], light: [255, 255, 255] };
const INK = '#1a1a1a';
const PAPER = '#ffffff';

/*
  What "readable enough" means per theme.

  4.5:1 on dark, where the accent is a bright mark on near-black and there is
  room to hit the text threshold. 3:1 on light, the WCAG bar for UI components,
  because that is mostly what the accent is on a white surface — borders, fills,
  indicators. Holding custom colours to 4.5 there would drag a mid-tone pick
  visibly darker than the shipped amber, which is itself 2.77:1.
*/
const TARGET = { dark: 4.5, light: 3 };

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** `#abc` / `#aabbcc` → `[r, g, b]`, or null if it is not a hex colour. */
export function hexToRgb(value) {
  const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value ?? '').trim());
  if (!match) return null;
  const hex =
    match[1].length === 3
      ? match[1]
          .split('')
          .map((c) => c + c)
          .join('')
      : match[1];
  const n = Number.parseInt(hex, 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

const rgbToHex = (rgb) =>
  `#${rgb.map((c) => clamp(Math.round(c), 0, 255).toString(16).padStart(2, '0')).join('')}`;

const linear = (c) => {
  const s = c / 255;
  return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
};

/** WCAG relative luminance. */
const luminance = ([r, g, b]) => 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);

/** WCAG contrast ratio between two luminances. */
const contrast = (a, b) => (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

function rgbToHsl([r, g, b]) {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];

  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [h / 6, s, l];
}

function hslToRgb([h, s, l]) {
  if (!s) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const at = (t) => {
    const u = t < 0 ? t + 1 : t > 1 ? t - 1 : t;
    if (u < 1 / 6) return p + (q - p) * 6 * u;
    if (u < 1 / 2) return q;
    if (u < 2 / 3) return p + (q - p) * (2 / 3 - u) * 6;
    return p;
  };
  return [at(h + 1 / 3), at(h), at(h - 1 / 3)].map((v) => Math.round(v * 255));
}

/**
 * Walk a colour's lightness until it clears the theme's contrast target.
 *
 * One hex cannot serve both themes — a colour tuned to glow on #1a1a1a
 * disappears on white, and the reverse. Rather than making the user pick twice,
 * the hue and saturation they chose are kept and only lightness moves: down
 * toward white on the light theme, up away from black on the dark one.
 *
 * A colour too desaturated to ever reach the target (a mid grey) walks to the
 * rail and stops. Best effort beats an infinite loop or a rejected pick.
 */
function fitForTheme(rgb, theme) {
  const surface = luminance(SURFACE[theme]);
  const target = TARGET[theme];
  const step = theme === 'light' ? -0.02 : 0.02;

  const [h, s, start] = rgbToHsl(rgb);
  let l = start;
  let out = rgb;

  for (let i = 0; i < 40; i += 1) {
    if (contrast(luminance(out), surface) >= target) break;
    const next = clamp(l + step, 0.06, 0.96);
    if (next === l) break;
    l = next;
    out = hslToRgb([h, s, l]);
  }
  return out;
}

/** Ink or paper on top of a solid accent fill, whichever reads better. */
const inkFor = (rgb) => {
  const l = luminance(rgb);
  return contrast(l, luminance(SURFACE.dark)) >= contrast(l, luminance(SURFACE.light)) ? INK : PAPER;
};

/**
 * A custom hex, resolved for both themes.
 *
 * The result is cached into the stored preference rather than recomputed on
 * demand, because the pre-paint script in index.html has to apply it before any
 * module loads and cannot run this file.
 */
function deriveCustom(hex) {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  return ['dark', 'light'].reduce((out, theme) => {
    const fitted = fitForTheme(rgb, theme);
    out[theme] = { rgb: fitted.join(' '), ink: inkFor(fitted) };
    return out;
  }, {});
}

const isPreset = (id) => ACCENTS.some((a) => a.id === id);

/**
 * Anything that came out of localStorage or off the account, made safe.
 *
 * A palette dropped in a later deploy leaves accounts pointing at an id that no
 * longer has a rule, which would render an accent-less UI. Falling back to the
 * default here is the same move `reconcile` makes in useTableLayout for a stale
 * column layout.
 */
export function normalize(value) {
  const raw = value && typeof value === 'object' ? value : {};
  const theme = raw.theme === 'light' ? 'light' : 'dark';
  // Canonicalised to #rrggbb, so `f0a` typed into the hex field is still a
  // valid CSS colour downstream and still passes the server's regex.
  const picked = hexToRgb(raw.custom);
  const custom = picked ? rgbToHex(picked) : DEFAULT_CUSTOM;
  const accent = raw.accent === CUSTOM || isPreset(raw.accent) ? raw.accent : DEFAULT_ACCENT;

  const out = { theme, accent, custom };
  // Only the custom option needs derived values, and only it pays for them.
  if (accent === CUSTOM) out.derived = deriveCustom(custom);
  return out;
}

/**
 * Write the appearance onto <html>.
 *
 * Presets are attributes only, so the stylesheet stays the single source of
 * truth. A custom colour is an inline property, which outranks every rule in
 * tokens.css — and has to be cleared again on the way back to a preset, or it
 * would outrank that too.
 */
export function applyAppearance(value) {
  const { theme, accent, derived } = normalize(value);
  const root = document.documentElement;

  root.setAttribute('data-theme', theme);
  root.setAttribute('data-accent', accent);

  const custom = accent === CUSTOM ? derived?.[theme] : null;
  if (custom) {
    root.style.setProperty('--accent-rgb', custom.rgb);
    root.style.setProperty('--accent-text', custom.ink);
  } else {
    root.style.removeProperty('--accent-rgb');
    root.style.removeProperty('--accent-text');
  }
}
