/**
 * The little diagram on a project card.
 *
 * Not a thumbnail of the boards inside: a real one means rendering a board on
 * the server or storing an image on every save, for a picture that would be
 * unreadable at 220×110 anyway. What a card has to do is be *recognisable*, so
 * the diagram is chosen from the project's id — the same project always draws
 * the same shape, and two projects side by side are told apart by silhouette as
 * well as by colour and icon.
 *
 * Six architectures that anyone who has drawn a system will recognise, in a
 * 220×110 viewBox: `nodes` are the boxes, `links` the dashed paths that start
 * running when the card is hovered.
 */
export const BLUEPRINTS = [
  {
    id: 'fan-out',
    nodes: [
      [22, 36, 54, 36],
      [144, 16, 54, 30],
      [144, 66, 54, 30],
    ],
    links: [
      'M76 54 H108 Q116 54 116 46 V39 Q116 31 124 31 H144',
      'M76 54 H108 Q116 54 116 62 V73 Q116 81 124 81 H144',
    ],
  },
  {
    id: 'pipeline',
    nodes: [
      [10, 40, 52, 30],
      [84, 40, 52, 30],
      [158, 40, 52, 30],
    ],
    links: ['M62 55 H84', 'M136 55 H158'],
  },
  {
    id: 'fan-in',
    nodes: [
      [14, 14, 50, 26],
      [14, 70, 50, 26],
      [146, 42, 56, 30],
    ],
    links: [
      'M64 27 H104 Q112 27 112 35 V49 Q112 57 120 57 H146',
      'M64 83 H104 Q112 83 112 75 V65 Q112 57 120 57 H146',
    ],
  },
  {
    id: 'hub',
    nodes: [
      [12, 40, 46, 30],
      [90, 40, 44, 30],
      [166, 8, 44, 22],
      [166, 44, 44, 22],
      [166, 80, 44, 22],
    ],
    links: ['M58 55 H90', 'M134 55 H152 V19 H166', 'M134 55 H166', 'M134 55 H152 V91 H166'],
  },
  {
    id: 'layered',
    nodes: [
      [14, 42, 44, 26],
      [80, 14, 52, 24],
      [80, 70, 52, 24],
      [154, 42, 52, 26],
    ],
    links: ['M58 55 H70 V26 H80', 'M58 55 H70 V82 H80', 'M132 26 H142 V55 H154', 'M132 82 H142 V55 H154'],
  },
  {
    id: 'write-through',
    nodes: [
      [22, 10, 56, 26],
      [142, 10, 56, 26],
      [82, 66, 56, 28],
    ],
    links: ['M50 36 V52 H110 V66', 'M170 36 V52 H110 V66'],
  },
];

/** The same project always gets the same blueprint. */
export function blueprintFor(id = '') {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  return BLUEPRINTS[hash % BLUEPRINTS.length];
}
