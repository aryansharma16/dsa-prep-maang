/**
 * The colours a column may wear, in the order the picker draws them.
 *
 * A mirror of `STATUS_HUES` in server/src/models/TaskBoard.js, kept here for
 * the same reason `MODULE_NAV` mirrors the server's module list: the server
 * owns which names are legal, the client owns how they are presented. A name
 * missing from the `[data-hue]` rules in styles/tokens.css resolves to no
 * colour at all, so all three lists have to agree — this file is the middle one.
 *
 * Ordered around the wheel from the board's own defaults rather than
 * alphabetically, so picking a colour is a spatial choice.
 */
export const STATUS_HUES = [
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
