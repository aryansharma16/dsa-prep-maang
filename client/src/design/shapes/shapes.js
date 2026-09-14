import { defineShape } from './registry.js';

/**
 * The Phase 1 element types.
 *
 * Style values are names, never colours: `color: 'blue'` renders through the
 * app's `[data-hue]` palette, so the same board reads correctly in the dark and
 * light themes. Sizes are named steps (`s m l xl`) for the same reason Figma's
 * whiteboard tools use them — a board full of 13px, 14px and 15px labels is a
 * board nobody chose.
 */

export const COLORS = ['ink', 'slate', 'red', 'orange', 'amber', 'lime', 'green', 'teal', 'sky', 'blue', 'indigo', 'violet', 'fuchsia', 'pink'];
export const STICKY_COLORS = ['yellow', 'orange', 'pink', 'violet', 'blue', 'teal', 'green', 'grey'];
export const FONT_SIZES = { s: 12, m: 14, l: 18, xl: 24, xxl: 36 };
export const STROKE_WIDTHS = { s: 1, m: 2, l: 3.5 };
export const PEN_SIZES = { s: 2, m: 4, l: 8, xl: 16 };

const colorField = { key: 'color', kind: 'color', label: 'Colour' };
const fontSizeField = {
  key: 'fontSize',
  kind: 'segmented',
  label: 'Text size',
  options: [
    { value: 's', label: 'S' },
    { value: 'm', label: 'M' },
    { value: 'l', label: 'L' },
    { value: 'xl', label: 'XL' },
  ],
};
const alignField = {
  key: 'align',
  kind: 'segmented',
  label: 'Align',
  options: [
    { value: 'left', label: 'Left', icon: 'alignLeft' },
    { value: 'center', label: 'Centre', icon: 'alignCenter' },
    { value: 'right', label: 'Right', icon: 'alignRight' },
  ],
};

const boxStyle = (extra = []) => [
  {
    title: 'Style',
    fields: [
      colorField,
      {
        key: 'fillStyle',
        kind: 'segmented',
        label: 'Fill',
        options: [
          { value: 'tint', label: 'Tint' },
          { value: 'solid', label: 'Solid' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        key: 'strokeStyle',
        kind: 'segmented',
        label: 'Border',
        options: [
          { value: 'solid', label: 'Solid' },
          { value: 'dashed', label: 'Dashed' },
          { value: 'dotted', label: 'Dotted' },
          { value: 'none', label: 'None' },
        ],
      },
      {
        key: 'strokeWidth',
        kind: 'segmented',
        label: 'Weight',
        options: [
          { value: 's', label: 'Thin' },
          { value: 'm', label: 'Medium' },
          { value: 'l', label: 'Bold' },
        ],
      },
      ...extra,
    ],
  },
  { title: 'Label', fields: [fontSizeField, alignField] },
];

const boxDefaults = (w, h, extra = {}) => () => ({
  w,
  h,
  color: 'blue',
  fillStyle: 'tint',
  strokeStyle: 'solid',
  strokeWidth: 's',
  label: '',
  fontSize: 'm',
  align: 'center',
  ...extra,
});

export const rect = defineShape({
  type: 'rect',
  label: 'Rectangle',
  outline: 'rect',
  defaults: boxDefaults(160, 88, { radius: 10 }),
  caps: { text: 'label' },
  inspector: boxStyle([{ key: 'radius', kind: 'number', label: 'Corners', min: 0, max: 200 }]),
});

export const ellipse = defineShape({
  type: 'ellipse',
  label: 'Ellipse',
  outline: 'ellipse',
  defaults: boxDefaults(120, 120),
  caps: { text: 'label' },
  inspector: boxStyle(),
});

export const diamond = defineShape({
  type: 'diamond',
  label: 'Diamond',
  outline: 'diamond',
  defaults: boxDefaults(140, 110),
  caps: { text: 'label' },
  inspector: boxStyle(),
});

/** A database, a queue, a store — the one shape every architecture diagram draws. */
export const cylinder = defineShape({
  type: 'cylinder',
  label: 'Cylinder',
  outline: 'rect',
  defaults: boxDefaults(110, 130, { color: 'violet' }),
  caps: { text: 'label' },
  inspector: boxStyle(),
});

export const text = defineShape({
  type: 'text',
  label: 'Text',
  outline: 'rect',
  minW: 16,
  minH: 16,
  defaults: () => ({ w: 40, h: 24, text: '', color: 'ink', fontSize: 'l', align: 'left', weight: 'normal', autoWidth: true }),
  caps: { text: 'text', resize: 'width' },
  inspector: [
    {
      title: 'Text',
      fields: [
        colorField,
        { ...fontSizeField, options: [...fontSizeField.options, { value: 'xxl', label: '2XL' }] },
        alignField,
        {
          key: 'weight',
          kind: 'segmented',
          label: 'Weight',
          options: [
            { value: 'normal', label: 'Regular' },
            { value: 'bold', label: 'Bold' },
          ],
        },
      ],
    },
  ],
});

/** Notes, requirements, trade-offs — a block of markdown-lite text with a fixed width. */
export const paragraph = defineShape({
  type: 'paragraph',
  label: 'Paragraph',
  outline: 'rect',
  minW: 80,
  minH: 24,
  defaults: () => ({ w: 320, h: 120, text: '', color: 'ink', fontSize: 'm', align: 'left' }),
  caps: { text: 'text', resize: 'width' },
  inspector: [{ title: 'Text', fields: [colorField, fontSizeField, alignField] }],
});

export const sticky = defineShape({
  type: 'sticky',
  label: 'Sticky note',
  outline: 'rect',
  minW: 60,
  minH: 60,
  defaults: () => ({ w: 200, h: 200, text: '', color: 'yellow', align: 'center' }),
  caps: { text: 'text', resize: 'aspect' },
  inspector: [{ title: 'Note', fields: [{ key: 'color', kind: 'sticky', label: 'Colour' }, alignField] }],
});

/**
 * A frame groups a region of the board — "Write path", "Read path", "Region
 * us-east-1" — and carries what is inside it when moved. Its children's
 * coordinates are relative to it, so moving a frame is one change.
 */
export const frame = defineShape({
  type: 'frame',
  label: 'Frame',
  outline: 'rect',
  minW: 40,
  minH: 40,
  defaults: () => ({ w: 560, h: 380, name: 'Frame', color: 'slate', fillStyle: 'tint', clip: false }),
  caps: { container: true, rotate: false, hitInterior: false, text: 'name', bindable: true, erasable: false },
  inspector: [
    {
      title: 'Frame',
      fields: [
        { key: 'name', kind: 'text', label: 'Name' },
        colorField,
        {
          key: 'fillStyle',
          kind: 'segmented',
          label: 'Background',
          options: [
            { value: 'tint', label: 'Tint' },
            { value: 'none', label: 'None' },
          ],
        },
        { key: 'clip', kind: 'toggle', label: 'Clip content' },
      ],
    },
  ],
});

export const connector = defineShape({
  type: 'connector',
  label: 'Connector',
  kind: 'connector',
  defaults: () => ({
    route: 'elbow',
    startCap: 'none',
    endCap: 'arrow',
    color: 'slate',
    strokeStyle: 'solid',
    strokeWidth: 'm',
    flow: null,
    label: null,
  }),
  caps: { resize: 'none', rotate: false, bindable: false, text: 'label' },
  inspector: [
    {
      title: 'Line',
      fields: [
        {
          key: 'route',
          kind: 'segmented',
          label: 'Route',
          options: [
            { value: 'straight', label: 'Straight', icon: 'straight' },
            { value: 'elbow', label: 'Elbow', icon: 'elbow' },
            { value: 'curve', label: 'Curve', icon: 'curve' },
          ],
        },
        colorField,
        {
          key: 'strokeStyle',
          kind: 'segmented',
          label: 'Style',
          options: [
            { value: 'solid', label: 'Solid' },
            { value: 'dashed', label: 'Dashed' },
            { value: 'dotted', label: 'Dotted' },
          ],
        },
        {
          key: 'strokeWidth',
          kind: 'segmented',
          label: 'Weight',
          options: [
            { value: 's', label: 'Thin' },
            { value: 'm', label: 'Medium' },
            { value: 'l', label: 'Bold' },
          ],
        },
        { key: 'startCap', kind: 'cap', label: 'Start' },
        { key: 'endCap', kind: 'cap', label: 'End' },
      ],
    },
    { title: 'Flow', fields: [{ key: 'flow', kind: 'flow', label: 'Animate traffic' }] },
  ],
});

export const stroke = defineShape({
  type: 'stroke',
  label: 'Drawing',
  kind: 'stroke',
  minW: 1,
  minH: 1,
  defaults: () => ({ kind: 'pen', color: 'ink', size: 'm', points: [] }),
  caps: { rotate: false, bindable: false, snaps: false, resize: 'free' },
  inspector: [
    {
      title: 'Ink',
      fields: [
        colorField,
        {
          key: 'size',
          kind: 'segmented',
          label: 'Size',
          options: [
            { value: 's', label: 'S' },
            { value: 'm', label: 'M' },
            { value: 'l', label: 'L' },
            { value: 'xl', label: 'XL' },
          ],
        },
      ],
    },
  ],
});
