/**
 * The System Design module's own glyphs.
 *
 * Same drawing rules as components/ui/Icons.jsx — a 16-unit box, currentColor,
 * a 1.6 stroke, round joins — so a toolbar here and a button elsewhere in the
 * app read as one family. Kept in this module rather than added to the shared
 * file because that file is imported eagerly by every page, and forty canvas
 * tools are forty icons nobody outside this chunk draws.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Svg = ({ size = 16, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" {...base} {...rest} aria-hidden="true">
    {children}
  </svg>
);

/* ------------------------------------------------------------ tree */

export const IconFolder = ({ open, ...p }) => (
  <Svg {...p}>
    {open ? (
      <path d="M1.8 12.6V4a1 1 0 011-1h3.1l1.4 1.5h5.4a1 1 0 011 1V6.4M1.8 12.6l1.6-5.4a1 1 0 011-.8h9.4a.8.8 0 01.8 1l-1.4 4.6a1 1 0 01-1 .7H2.8a1 1 0 01-1-.1" />
    ) : (
      <path d="M1.8 4a1 1 0 011-1h3.1l1.4 1.5h5.9a1 1 0 011 1V12a1 1 0 01-1 1H2.8a1 1 0 01-1-1z" />
    )}
  </Svg>
);

export const IconCanvasBoard = (p) => (
  <Svg {...p}>
    <rect x="2" y="2" width="12" height="12" rx="2" />
    <rect x="4.4" y="4.6" width="3.4" height="2.8" rx=".6" />
    <circle cx="10.6" cy="10.4" r="1.6" />
    <path d="M6.1 7.4v2.1a.9.9 0 00.9.9H9" />
  </Svg>
);

export const IconSchemaBoard = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.4" width="7" height="6.2" rx="1.2" />
    <path d="M2 4.8h7" />
    <rect x="9.6" y="8.2" width="4.4" height="5.4" rx="1" />
    <path d="M9 6.2h1.8a.8.8 0 01.8.8v1.2" />
  </Svg>
);

export const IconArchive = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="2.6" width="12.4" height="3.4" rx="1" />
    <path d="M2.8 6v6.4a1 1 0 001 1h8.4a1 1 0 001-1V6M6.4 8.6h3.2" />
  </Svg>
);

export const IconRestore = (p) => (
  <Svg {...p}>
    <path d="M2.6 8a5.4 5.4 0 101.7-3.9" />
    <path d="M2.4 2.4v3h3" />
  </Svg>
);

export const IconDuplicate = (p) => (
  <Svg {...p}>
    <rect x="5" y="5" width="9" height="9" rx="1.6" />
    <path d="M11 5V3.2A1.2 1.2 0 009.8 2H3.2A1.2 1.2 0 002 3.2v6.6A1.2 1.2 0 003.2 11H5" />
  </Svg>
);

export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M6.8 9.2a2.8 2.8 0 004 0l2.1-2.1a2.8 2.8 0 00-4-4l-.8.8" />
    <path d="M9.2 6.8a2.8 2.8 0 00-4 0L3.1 8.9a2.8 2.8 0 004 4l.8-.8" />
  </Svg>
);

export const IconChevronDown = (p) => (
  <Svg {...p}>
    <path d="M3.5 6L8 10.5 12.5 6" />
  </Svg>
);

export const IconCaret = ({ open, ...p }) => (
  <Svg {...p} strokeWidth={1.8}>
    <path d={open ? 'M4.5 6.5L8 10l3.5-3.5' : 'M6.5 4.5L10 8l-3.5 3.5'} />
  </Svg>
);

/* ------------------------------------------------------------ chrome */

export const IconBack = (p) => (
  <Svg {...p}>
    <path d="M10 3.5L5.5 8 10 12.5" />
  </Svg>
);

export const IconPanelLeft = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.6" width="12" height="10.8" rx="1.6" />
    <path d="M6.2 2.6v10.8" />
  </Svg>
);

export const IconPanelRight = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.6" width="12" height="10.8" rx="1.6" />
    <path d="M9.8 2.6v10.8" />
  </Svg>
);

export const IconShare = (p) => (
  <Svg {...p}>
    <circle cx="11.8" cy="3.6" r="1.8" />
    <circle cx="4.2" cy="8" r="1.8" />
    <circle cx="11.8" cy="12.4" r="1.8" />
    <path d="M5.8 7.1l4.4-2.6M5.8 8.9l4.4 2.6" />
  </Svg>
);

export const IconExport = (p) => (
  <Svg {...p}>
    <path d="M8 2v8M4.8 5.2L8 2l3.2 3.2" />
    <path d="M2.6 9.6v2.8a1.4 1.4 0 001.4 1.4h8a1.4 1.4 0 001.4-1.4V9.6" />
  </Svg>
);

export const IconKeyboard = (p) => (
  <Svg {...p}>
    <rect x="1.6" y="3.6" width="12.8" height="8.8" rx="1.6" />
    <path d="M4.2 6.4h.01M6.8 6.4h.01M9.4 6.4h.01M12 6.4h.01M4.6 9.6h6.8" />
  </Svg>
);

export const IconUndo = (p) => (
  <Svg {...p}>
    <path d="M5.4 3.4L2.6 6.2 5.4 9" />
    <path d="M2.8 6.2h6.8a3.6 3.6 0 010 7.2H6" />
  </Svg>
);

export const IconRedo = (p) => (
  <Svg {...p}>
    <path d="M10.6 3.4l2.8 2.8L10.6 9" />
    <path d="M13.2 6.2H6.4a3.6 3.6 0 000 7.2H10" />
  </Svg>
);

export const IconMinus = (p) => (
  <Svg {...p}>
    <path d="M3.5 8h9" />
  </Svg>
);

export const IconPlusSmall = (p) => (
  <Svg {...p}>
    <path d="M8 3.5v9M3.5 8h9" />
  </Svg>
);

export const IconFit = (p) => (
  <Svg {...p}>
    <path d="M2.4 5.6V3.4a1 1 0 011-1h2.2M10.4 2.4h2.2a1 1 0 011 1v2.2M13.6 10.4v2.2a1 1 0 01-1 1h-2.2M5.6 13.6H3.4a1 1 0 01-1-1v-2.2" />
    <rect x="5.4" y="5.4" width="5.2" height="5.2" rx=".8" />
  </Svg>
);

export const IconFlow = ({ playing, ...p }) => (
  <Svg {...p}>
    {playing ? (
      <path d="M5.6 3.6v8.8M10.4 3.6v8.8" />
    ) : (
      <path d="M5 3.4l7.4 4.6L5 12.6z" />
    )}
  </Svg>
);

export const IconLock = ({ open, ...p }) => (
  <Svg {...p}>
    <rect x="3" y="7" width="10" height="7" rx="1.6" />
    <path d={open ? 'M5.4 7V4.8a2.6 2.6 0 015-.9' : 'M5.4 7V4.8a2.6 2.6 0 015.2 0V7'} />
  </Svg>
);

export const IconEye = ({ off, ...p }) => (
  <Svg {...p}>
    <path d="M1.6 8S4 3.6 8 3.6 14.4 8 14.4 8 12 12.4 8 12.4 1.6 8 1.6 8z" />
    <circle cx="8" cy="8" r="1.9" />
    {off && <path d="M2.6 2.6l10.8 10.8" />}
  </Svg>
);

/* ------------------------------------------------------------ tools */

export const IconSelect = (p) => (
  <Svg {...p}>
    <path d="M3.4 2.4l9.4 4.2-4 1.2-1.4 4z" />
    <path d="M8.8 7.8l3.6 3.6" />
  </Svg>
);

export const IconHand = (p) => (
  <Svg {...p}>
    <path d="M5.2 8.6V3.4a1.1 1.1 0 012.2 0v4.2M7.4 7.2V2.6a1.1 1.1 0 012.2 0v4.6M9.6 7.2V3.6a1.1 1.1 0 012.2 0V9.4a4.6 4.6 0 01-4.6 4.6h-.4a4.4 4.4 0 01-3.4-1.6L1.8 10a1.2 1.2 0 011.8-1.5l1.6 1.4" />
  </Svg>
);

export const IconFrame = (p) => (
  <Svg {...p}>
    <path d="M4.6 1.6v12.8M11.4 1.6v12.8M1.6 4.6h12.8M1.6 11.4h12.8" />
  </Svg>
);

export const IconRect = (p) => (
  <Svg {...p}>
    <rect x="2.2" y="3.4" width="11.6" height="9.2" rx="1.6" />
  </Svg>
);

export const IconEllipse = (p) => (
  <Svg {...p}>
    <ellipse cx="8" cy="8" rx="6" ry="5" />
  </Svg>
);

export const IconDiamond = (p) => (
  <Svg {...p}>
    <path d="M8 1.8L14.2 8 8 14.2 1.8 8z" />
  </Svg>
);

export const IconCylinder = (p) => (
  <Svg {...p}>
    <ellipse cx="8" cy="3.8" rx="5" ry="1.8" />
    <path d="M3 3.8v8.4c0 1 2.2 1.8 5 1.8s5-.8 5-1.8V3.8" />
  </Svg>
);

export const IconShapesMenu = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="1.8" width="6" height="6" rx="1.2" />
    <circle cx="11.2" cy="11.2" r="3" />
    <path d="M11.2 1.8l3 5h-6z" />
  </Svg>
);

export const IconConnector = (p) => (
  <Svg {...p}>
    <path d="M2.6 13.4L13 3" />
    <path d="M8.6 3H13v4.4" />
  </Svg>
);

export const IconElbow = (p) => (
  <Svg {...p}>
    <path d="M2.4 3.4h5.2v9.2h4.8" />
    <path d="M10.6 10.6l2 2-2 2" />
  </Svg>
);

export const IconCurve = (p) => (
  <Svg {...p}>
    <path d="M2.4 12.8C4 4 12 12 13.4 3.4" />
  </Svg>
);

export const IconStraight = (p) => (
  <Svg {...p}>
    <path d="M2.6 13.4L13.4 2.6" />
  </Svg>
);

export const IconPen = (p) => (
  <Svg {...p}>
    <path d="M10.6 2.6l2.8 2.8-7.8 7.8-3.4.6.6-3.4z" />
    <path d="M9.2 4l2.8 2.8" />
  </Svg>
);

export const IconHighlighter = (p) => (
  <Svg {...p}>
    <path d="M9.6 2.2l4.2 4.2-5.6 5.6-4.2-4.2z" />
    <path d="M4 7.8L2.2 12.4l1.4 1.4L8.2 12" />
  </Svg>
);

export const IconEraser = (p) => (
  <Svg {...p}>
    <path d="M6.6 13.6l-4-4a1.4 1.4 0 010-2L8.4 1.8a1.4 1.4 0 012 0l3.8 3.8a1.4 1.4 0 010 2L7.6 14.2" />
    <path d="M5 5.2l5.8 5.8M6.6 13.6h7" />
  </Svg>
);

export const IconDraw = IconPen;

export const IconText = (p) => (
  <Svg {...p}>
    <path d="M3 3.6h10M8 3.6v9.4M6.2 13h3.6" />
  </Svg>
);

export const IconParagraph = (p) => (
  <Svg {...p}>
    <path d="M2.6 3.6h10.8M2.6 6.6h10.8M2.6 9.6h10.8M2.6 12.6h6.4" />
  </Svg>
);

export const IconSticky = (p) => (
  <Svg {...p}>
    <path d="M2.6 3.6a1 1 0 011-1h8.8a1 1 0 011 1V9l-4.4 4.4H3.6a1 1 0 01-1-1z" />
    <path d="M13.4 9H10a1 1 0 00-1 1v3.4" />
  </Svg>
);

export const IconImage = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.8" width="12" height="10.4" rx="1.6" />
    <circle cx="5.6" cy="6.2" r="1.2" />
    <path d="M2.4 11.6l3.4-3.2 2.6 2.4 2-1.8 3.4 3" />
  </Svg>
);

export const IconEmbed = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="3" width="12.4" height="10" rx="1.8" />
    <path d="M6.6 6.2v3.6L9.8 8z" />
  </Svg>
);

export const IconTable = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.6" width="12" height="10.8" rx="1.4" />
    <path d="M2 6.2h12M2 9.8h12M6.4 2.6v10.8" />
  </Svg>
);

export const IconLibrary = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="1.8" width="5.4" height="5.4" rx="1.2" />
    <rect x="8.8" y="1.8" width="5.4" height="5.4" rx="1.2" />
    <rect x="1.8" y="8.8" width="5.4" height="5.4" rx="1.2" />
    <path d="M11.5 9v4.6M9.2 11.3h4.6" />
  </Svg>
);

export const IconInsert = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 5v6M5 8h6" />
  </Svg>
);

export const IconToolLock = ({ on, ...p }) => (
  <Svg {...p}>
    <path d="M6 1.8h4l-.6 4.4 2.4 2v1.4H4.2V8.2l2.4-2z" fill={on ? 'currentColor' : 'none'} />
    <path d="M8 9.6v4.6" />
  </Svg>
);

export const IconGrid = (p) => (
  <Svg {...p}>
    <circle cx="4" cy="4" r=".7" fill="currentColor" />
    <circle cx="8" cy="4" r=".7" fill="currentColor" />
    <circle cx="12" cy="4" r=".7" fill="currentColor" />
    <circle cx="4" cy="8" r=".7" fill="currentColor" />
    <circle cx="8" cy="8" r=".7" fill="currentColor" />
    <circle cx="12" cy="8" r=".7" fill="currentColor" />
    <circle cx="4" cy="12" r=".7" fill="currentColor" />
    <circle cx="8" cy="12" r=".7" fill="currentColor" />
    <circle cx="12" cy="12" r=".7" fill="currentColor" />
  </Svg>
);

/* ------------------------------------------------------------ arrange */

export const IconBringFront = (p) => (
  <Svg {...p}>
    <rect x="5" y="5" width="8.6" height="8.6" rx="1.4" fill="currentColor" fillOpacity=".25" />
    <path d="M10.8 5V3.4A1 1 0 009.8 2.4H3.4a1 1 0 00-1 1v6.4a1 1 0 001 1H5" />
  </Svg>
);

export const IconSendBack = (p) => (
  <Svg {...p}>
    <rect x="2.4" y="2.4" width="8.6" height="8.6" rx="1.4" fill="currentColor" fillOpacity=".25" />
    <path d="M5 11v1.6a1 1 0 001 1h6.6a1 1 0 001-1V6a1 1 0 00-1-1H11" />
  </Svg>
);

export const IconAlignLeft = (p) => (
  <Svg {...p}>
    <path d="M2.4 2v12M5 5h8M5 11h5" />
  </Svg>
);

export const IconAlignCenterH = (p) => (
  <Svg {...p}>
    <path d="M8 2v12M3.4 5h9.2M5.4 11h5.2" />
  </Svg>
);

export const IconAlignRight = (p) => (
  <Svg {...p}>
    <path d="M13.6 2v12M3 5h8M6 11h5" />
  </Svg>
);

export const IconAlignTop = (p) => (
  <Svg {...p}>
    <path d="M2 2.4h12M5 5v8M11 5v5" />
  </Svg>
);

export const IconAlignMiddleV = (p) => (
  <Svg {...p}>
    <path d="M2 8h12M5 3.4v9.2M11 5.4v5.2" />
  </Svg>
);

export const IconAlignBottom = (p) => (
  <Svg {...p}>
    <path d="M2 13.6h12M5 3v8M11 6v5" />
  </Svg>
);
