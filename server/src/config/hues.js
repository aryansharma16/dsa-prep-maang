/**
 * The named colours anything in this app may be painted with.
 *
 * Named rather than stored as colour: the resolved value differs between light
 * and dark, and a stored `#26c281` would be a dark-theme green forever. The
 * client turns the name into a colour with `[data-hue='green']`, so everything
 * wearing a hue is drawn from one palette rather than a value per feature.
 *
 * Kept in sync with the `[data-hue]` rules at the foot of client/src/styles/
 * tokens.css. A name absent there resolves to no colour at all, so this list is
 * an enum rather than a suggestion.
 *
 * It lives here, and not on the first model that needed it, because it now has
 * two consumers with nothing else in common — a task board's columns and the
 * colour on a logged attempt. A second copy is a list that drifts.
 *
 * Ordered around the wheel rather than alphabetically, so picking a colour in
 * the swatch row is a spatial choice.
 */
export const HUES = [
  'slate',
  'amber',
  'orange',
  'red',
  'pink',
  'fuchsia',
  'violet',
  'indigo',
  'blue',
  'sky',
  'teal',
  'green',
  'lime',
];
