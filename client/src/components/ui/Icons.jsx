// Inline strokes, currentColor, 1.6px — no icon font, no emoji.
const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Svg = ({ size = 14, children, ...rest }) => (
  <svg width={size} height={size} viewBox="0 0 16 16" {...base} {...rest} aria-hidden="true">
    {children}
  </svg>
);

/* System Design's side-menu glyph: two nodes and a wire — a diagram, not a
   drawing tool. The canvas's own icons live in components/design/icons.jsx,
   inside that module's lazy chunk. */
export const IconShapes = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="2" width="5" height="4.2" rx="1" />
    <circle cx="11.6" cy="11.4" r="2.6" />
    <path d="M4.3 6.2v3.3a1.9 1.9 0 001.9 1.9H9" />
  </Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}>
    <path d="M2 4h12M2 8h12M2 12h12" />
  </Svg>
);

export const IconChevronRight = (p) => (
  <Svg {...p}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </Svg>
);

export const IconArrowLeft = (p) => (
  <Svg {...p}>
    <path d="M13 8H3M6.6 4.4L3 8l3.6 3.6" />
  </Svg>
);

/* The mirror of the above. A chevron points; an arrow says "go", which is what
   a track card and the pager on a topic are actually offering. */
export const IconArrowRight = (p) => (
  <Svg {...p}>
    <path d="M3 8h10M9.4 4.4L13 8l-3.6 3.6" />
  </Svg>
);

export const IconCheck = (p) => (
  <Svg {...p} strokeWidth={2.2}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Svg>
);

export const IconFlag = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M4 14V2.8h8L10 5.6l2 2.8H4" />
  </Svg>
);

export const IconRotate = (p) => (
  <Svg {...p}>
    <path d="M13.5 8a5.5 5.5 0 11-1.7-3.96" />
    <path d="M13.8 2.2v3.1h-3.1" />
  </Svg>
);

export const IconNote = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M3 2.6h10v10.8H3z" />
    <path d="M5.4 5.6h5.2M5.4 8h5.2M5.4 10.4h3" stroke={filled ? 'var(--surface)' : 'currentColor'} />
  </Svg>
);

export const IconClock = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="5.8" />
    <path d="M8 4.6V8l2.4 1.6" />
  </Svg>
);

// The pips are filled because a 1.6px ring at 12px reads as noise, not as dots.
export const IconDice = (p) => (
  <Svg {...p}>
    <rect x="2.3" y="2.3" width="11.4" height="11.4" rx="2.6" />
    <circle cx="5.5" cy="5.5" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="10.5" cy="10.5" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}>
    <circle cx="7.2" cy="7.2" r="4.4" />
    <path d="M10.6 10.6l3 3" />
  </Svg>
);

export const IconExternal = (p) => (
  <Svg {...p}>
    <path d="M9.4 2.6H13.4V6.6" />
    <path d="M13.4 2.6L7.6 8.4" />
    <path d="M12.2 9.6v3.2a.9.9 0 01-.9.9H3.5a.9.9 0 01-.9-.9V5a.9.9 0 01.9-.9h3.2" />
  </Svg>
);

export const IconEye = (p) => (
  <Svg {...p}>
    <path d="M1.4 8s2.5-4.4 6.6-4.4S14.6 8 14.6 8s-2.5 4.4-6.6 4.4S1.4 8 1.4 8z" />
    <circle cx="8" cy="8" r="1.9" />
  </Svg>
);

export const IconEyeOff = (p) => (
  <Svg {...p}>
    <path d="M6.3 3.8A6.6 6.6 0 018 3.6c4.1 0 6.6 4.4 6.6 4.4a12 12 0 01-2.2 2.7" />
    <path d="M3.9 4.9A12 12 0 001.4 8s2.5 4.4 6.6 4.4a6.7 6.7 0 002.3-.4" />
    <path d="M6.7 6.7a1.9 1.9 0 002.6 2.6" />
    <path d="M2.4 2.4l11.2 11.2" />
  </Svg>
);

export const IconPlus = (p) => (
  <Svg {...p}>
    <path d="M8 3v10M3 8h10" />
  </Svg>
);

export const IconClose = (p) => (
  <Svg {...p}>
    <path d="M3.8 3.8l8.4 8.4M12.2 3.8l-8.4 8.4" />
  </Svg>
);

export const IconSun = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="3.1" />
    <path d="M8 1.4v1.6M8 13v1.6M1.4 8h1.6M13 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
  </Svg>
);

export const IconMoon = (p) => (
  <Svg {...p}>
    <path d="M13.4 9.6A5.8 5.8 0 016.4 2.6a5.9 5.9 0 107 7z" />
  </Svg>
);

/* Opens the appearance menu. A palette rather than a sun, because the button
   holds a menu now — a sun that did not toggle on click would read as broken. */
export const IconPalette = (p) => (
  <Svg {...p}>
    <path d="M8 1.8a6.2 6.2 0 000 12.4c.9 0 1.4-.6 1.4-1.3 0-.6-.4-1-.4-1.5s.4-.9 1-.9h1.2a3 3 0 003-3c0-3.1-2.8-5.7-6.2-5.7z" />
    <circle cx="5.2" cy="7.1" r=".9" />
    <circle cx="8" cy="5.2" r=".9" />
    <circle cx="10.9" cy="7.1" r=".9" />
  </Svg>
);

export const IconGrid = (p) => (
  <Svg {...p}>
    <path d="M2.6 2.6h4.2v4.2H2.6zM9.2 2.6h4.2v4.2H9.2zM2.6 9.2h4.2v4.2H2.6zM9.2 9.2h4.2v4.2H9.2z" />
  </Svg>
);

export const IconChart = (p) => (
  <Svg {...p}>
    <path d="M2.4 13.6h11.2" />
    <path d="M4.4 13.6V7.2M8 13.6V3.4M11.6 13.6V9.4" />
  </Svg>
);

export const IconLogout = (p) => (
  <Svg {...p}>
    <path d="M6.2 13.4H3.4a.9.9 0 01-.9-.9V3.5a.9.9 0 01.9-.9h2.8" />
    <path d="M10 11.2L13.4 8 10 4.8M13.4 8H6.2" />
  </Svg>
);

export const IconTrash = (p) => (
  <Svg {...p}>
    <path d="M2.8 4.2h10.4M6.2 4.2V2.8h3.6v1.4M4.2 4.2l.6 9h6.4l.6-9" />
  </Svg>
);

export const IconPlay = (p) => (
  <Svg {...p} fill="currentColor" strokeWidth={1}>
    <path d="M5.4 3.4l6.4 4.6-6.4 4.6z" />
  </Svg>
);

export const IconMail = (p) => (
  <Svg {...p}>
    <rect x="2" y="3.5" width="12" height="9" rx="1.4" />
    <path d="M2.4 4.3L8 8.6l5.6-4.3" />
  </Svg>
);

export const IconPhone = (p) => (
  <Svg {...p}>
    <path d="M5.6 2.3l1.3 2.9a.9.9 0 01-.2 1L5.6 7.3a7.4 7.4 0 003.1 3.1l1.1-1.1a.9.9 0 011-.2l2.9 1.3a.9.9 0 01.5 1v1.3a1.2 1.2 0 01-1.3 1.2A11.3 11.3 0 012.1 3.6 1.2 1.2 0 013.3 2.3h1.3a.9.9 0 011 0z" />
  </Svg>
);

/* A plain "in" mark in a rounded square; a generic glyph, not the brand logo. */
export const IconLinkedin = (p) => (
  <Svg {...p}>
    <rect x="2" y="2" width="12" height="12" rx="2.2" />
    <path d="M5.3 7.2v3.9" />
    <path d="M5.3 4.9v.1" />
    <path d="M8 11.1V7.2M8 9a1.8 1.8 0 013.4.6v1.5" />
  </Svg>
);

export const IconCopy = (p) => (
  <Svg {...p}>
    <path d="M5.8 5.8h7.4v7.4H5.8z" />
    <path d="M10.2 5.8V2.8H2.8v7.4h3" />
  </Svg>
);

export const IconInfo = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6.2" />
    <path d="M8 7.2v4M8 4.9v.1" />
  </Svg>
);

export const IconPin = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M9.6 1.9l4.5 4.5-1.9.7-.9 2.8-4.2-4.2 2.8-.9z" />
    <path d="M6.4 9.6L2.2 13.8" fill="none" />
  </Svg>
);

export const IconColumns = (p) => (
  <Svg {...p}>
    <path d="M2.4 3h11.2v10H2.4zM6.1 3v10M9.9 3v10" />
  </Svg>
);

export const IconShield = (p) => (
  <Svg {...p}>
    <path d="M8 1.8l5 1.9v4.1c0 3-2.1 5.2-5 6.4-2.9-1.2-5-3.4-5-6.4V3.7z" />
  </Svg>
);

/* The singular of IconUsers, for the one account rather than the roll of them. */
export const IconUser = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="5.4" r="2.6" />
    <path d="M2.9 13.6c0-2.6 2.3-4.2 5.1-4.2s5.1 1.6 5.1 4.2" />
  </Svg>
);

export const IconUsers = (p) => (
  <Svg {...p}>
    <circle cx="6.2" cy="5.6" r="2.4" />
    <path d="M1.8 13.4c0-2.4 2-3.9 4.4-3.9s4.4 1.5 4.4 3.9" />
    <path d="M10.8 3.6a2.4 2.4 0 010 4.5M11.8 9.9c1.5.4 2.6 1.6 2.6 3.5" />
  </Svg>
);

export const IconBook = (p) => (
  <Svg {...p}>
    <path d="M2.6 2.8h4a2 2 0 012 2v8.4a1.6 1.6 0 00-1.6-1.6H2.6z" />
    <path d="M13.4 2.8h-4a2 2 0 00-2 2v8.4a1.6 1.6 0 011.6-1.6h4.4z" />
  </Svg>
);

export const IconGrip = (p) => (
  <Svg {...p} fill="currentColor" strokeWidth={0}>
    <circle cx="6" cy="3.6" r="1.05" />
    <circle cx="10" cy="3.6" r="1.05" />
    <circle cx="6" cy="8" r="1.05" />
    <circle cx="10" cy="8" r="1.05" />
    <circle cx="6" cy="12.4" r="1.05" />
    <circle cx="10" cy="12.4" r="1.05" />
  </Svg>
);

export const IconChat = (p) => (
  <Svg {...p}>
    <path d="M13.4 9.6a1.6 1.6 0 01-1.6 1.6H5.8L2.6 13.8V4a1.6 1.6 0 011.6-1.6h7.6A1.6 1.6 0 0113.4 4z" />
  </Svg>
);

export const IconSparkle = (p) => (
  <Svg {...p}>
    <path d="M6.3 2.1l1.1 3 3 1.1-3 1.1-1.1 3-1.1-3-3-1.1 3-1.1z" />
    <path d="M11.8 9.4l.6 1.7 1.7.6-1.7.6-.6 1.7-.6-1.7-1.7-.6 1.7-.6z" />
  </Svg>
);

export const IconSend = (p) => (
  <Svg {...p}>
    <path d="M8 13.2V3.2" />
    <path d="M3.9 7.3L8 3.2l4.1 4.1" />
  </Svg>
);

export const IconPause = (p) => (
  <Svg {...p} fill="currentColor" strokeWidth={0}>
    <rect x="4.4" y="3.6" width="2.4" height="8.8" rx="0.9" />
    <rect x="9.2" y="3.6" width="2.4" height="8.8" rx="0.9" />
  </Svg>
);

export const IconStop = (p) => (
  <Svg {...p} fill="currentColor" strokeWidth={0}>
    <rect x="4.6" y="4.6" width="6.8" height="6.8" rx="1.4" />
  </Svg>
);

export const IconExpand = (p) => (
  <Svg {...p}>
    <path d="M9.8 2.4h3.8v3.8M6.2 13.6H2.4V9.8" />
    <path d="M13.6 2.4L9.2 6.8M2.4 13.6l4.4-4.4" />
  </Svg>
);

export const IconCollapse = (p) => (
  <Svg {...p}>
    <path d="M6.4 2.6v3.8H2.6M9.6 13.4V9.6h3.8" />
    <path d="M2.6 2.6l3.8 3.8M13.4 13.4L9.6 9.6" />
  </Svg>
);

export const IconFilter = (p) => (
  <Svg {...p}>
    <path d="M2.4 3.2h11.2l-4.3 5.1v4.5l-2.6 1.2V8.3z" />
  </Svg>
);

// Two chevrons apart / together — sections opening and closing, as distinct
// from IconExpand's corner arrows, which mean fullscreen.
export const IconChevronsDown = (p) => (
  <Svg {...p}>
    <path d="M3.6 3.4L8 7.2l4.4-3.8M3.6 8.8L8 12.6l4.4-3.8" />
  </Svg>
);

export const IconChevronsUp = (p) => (
  <Svg {...p}>
    <path d="M3.6 7.2L8 3.4l4.4 3.8M3.6 12.6L8 8.8l4.4 3.8" />
  </Svg>
);

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M11.1 2.5a1.5 1.5 0 012.1 2.1L5.6 12.2 2.6 13l.8-3z" />
  </Svg>
);

/* ------------------------------------------------------------------ notes */
/* The block palette needs a distinct silhouette per type — at 13px a reader
   picks the shape out before the label, which is what makes a fourteen-item
   menu scannable instead of a list to be read. */

export const IconHeading = (p) => (
  <Svg {...p}>
    <path d="M3.5 3v10M10 3v10M3.5 8H10" />
    <path d="M12.4 6.6h1.3v6.4" />
  </Svg>
);

export const IconText = (p) => (
  <Svg {...p}>
    <path d="M2.5 3.5h11M2.5 7h11M2.5 10.5h7.5" />
  </Svg>
);

export const IconList = (p) => (
  <Svg {...p}>
    <path d="M6 4h8M6 8h8M6 12h8" />
    <circle cx="3" cy="4" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="3" cy="8" r="0.9" fill="currentColor" stroke="none" />
    <circle cx="3" cy="12" r="0.9" fill="currentColor" stroke="none" />
  </Svg>
);

export const IconQuote = (p) => (
  <Svg {...p}>
    <path d="M3 4h3v4a2.5 2.5 0 01-2.5 2.5H3" />
    <path d="M9.5 4h3v4A2.5 2.5 0 0110 10.5h-.5" />
  </Svg>
);

export const IconCode = (p) => (
  <Svg {...p}>
    <path d="M5.4 4L2 8l3.4 4M10.6 4L14 8l-3.4 4" />
  </Svg>
);

export const IconImage = (p) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.6" />
    <circle cx="5.8" cy="6.4" r="1.1" />
    <path d="M2.6 11.4l3.2-3 2.4 2.2 2.2-2 3 2.8" />
  </Svg>
);

export const IconGallery = (p) => (
  <Svg {...p}>
    <rect x="1.5" y="4.5" width="9" height="8" rx="1.4" />
    <path d="M4.5 4.5V3a.9.9 0 01.9-.9h8.1a.9.9 0 01.9.9v7.3" />
  </Svg>
);

export const IconFile = (p) => (
  <Svg {...p}>
    <path d="M9 1.8H4.6a1.2 1.2 0 00-1.2 1.2v10a1.2 1.2 0 001.2 1.2h6.8a1.2 1.2 0 001.2-1.2V5.3z" />
    <path d="M9 1.8v3.5h3.6" />
  </Svg>
);

export const IconLink = (p) => (
  <Svg {...p}>
    <path d="M6.6 9.4a2.6 2.6 0 003.9.3l1.9-1.9a2.6 2.6 0 00-3.7-3.7l-1 1" />
    <path d="M9.4 6.6a2.6 2.6 0 00-3.9-.3L3.6 8.2a2.6 2.6 0 003.7 3.7l1-1" />
  </Svg>
);

export const IconTable = (p) => (
  <Svg {...p}>
    <rect x="2" y="3" width="12" height="10" rx="1.4" />
    <path d="M2 6.4h12M6.6 6.4V13" />
  </Svg>
);

/*
  The database cylinder, for the SQL Lab's side-menu row.

  `IconTable` above is already the Learn SQL track's, and the two rows sit six
  apart in the same menu — one grid glyph for both would make the notes and the
  Lab look like the same destination.
*/
export const IconDatabase = (p) => (
  <Svg {...p}>
    <ellipse cx="8" cy="4" rx="5.2" ry="2.1" />
    <path d="M2.8 4v8c0 1.16 2.33 2.1 5.2 2.1s5.2-.94 5.2-2.1V4" />
    <path d="M2.8 8c0 1.16 2.33 2.1 5.2 2.1s5.2-.94 5.2-2.1" />
  </Svg>
);

export const IconDivider = (p) => (
  <Svg {...p}>
    <path d="M2 8h12" />
    <path d="M4 4.6h8M4 11.4h8" opacity="0.4" />
  </Svg>
);

export const IconToggle = (p) => (
  <Svg {...p}>
    <path d="M5.5 4.5L9 8l-3.5 3.5" />
    <path d="M11.5 4.5v7" opacity="0.45" />
  </Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}>
    <path d="M8 2.4l6 10.2H2z" />
    <path d="M8 6.4v3M8 11.2v.1" />
  </Svg>
);

export const IconLock = (p) => (
  <Svg {...p}>
    <rect x="3.2" y="7" width="9.6" height="7" rx="1.4" />
    <path d="M5.4 7V5.2a2.6 2.6 0 015.2 0V7" />
  </Svg>
);

export const IconGlobe = (p) => (
  <Svg {...p}>
    <circle cx="8" cy="8" r="6" />
    <path d="M2.2 6.4h11.6M2.2 9.6h11.6" />
    <path d="M8 2a9 9 0 000 12A9 9 0 008 2z" />
  </Svg>
);

/*
  One node above, two below, joined — the shape a network diagram is drawn in.

  Not IconGlobe, which the Node track already wears: a globe says "the internet"
  and this track is about the machinery under it, most of which is a subnet in a
  building somewhere.
*/
export const IconNetwork = (p) => (
  <Svg {...p}>
    <rect x="5.8" y="1.6" width="4.4" height="3.4" rx="1" />
    <rect x="1.4" y="11" width="4.4" height="3.4" rx="1" />
    <rect x="10.2" y="11" width="4.4" height="3.4" rx="1" />
    <path d="M8 5v3.2M3.6 11V8.2h8.8V11" />
  </Svg>
);

export const IconUpload = (p) => (
  <Svg {...p}>
    <path d="M8 10.5V2.6M5 5.6L8 2.6l3 3" />
    <path d="M2.6 10v2.6a1 1 0 001 1h8.8a1 1 0 001-1V10" />
  </Svg>
);

export const IconStar = ({ filled, ...p }) => (
  <Svg {...p} fill={filled ? 'currentColor' : 'none'}>
    <path d="M8 1.9l1.85 3.9 4.15.6-3 3 .71 4.28L8 11.66 4.29 13.68 5 9.4l-3-3 4.15-.6z" />
  </Svg>
);

export const IconLayers = (p) => (
  <Svg {...p}>
    <path d="M8 1.9l6 3.2-6 3.2-6-3.2z" />
    <path d="M2 8.6l6 3.2 6-3.2" />
    <path d="M2 11.6l6 3.2 6-3.2" opacity="0.45" />
  </Svg>
);

export const IconMegaphone = (p) => (
  <Svg {...p}>
    <path d="M13.1 3.1v9.8L5.6 10.3H3.4a1.4 1.4 0 01-1.4-1.4V7.1a1.4 1.4 0 011.4-1.4h2.2z" />
    <path d="M5.6 10.4l.8 3.2h2.1l-.8-3" />
  </Svg>
);

/**
 * Three columns of unequal fill — a board, as distinct from `IconColumns`,
 * which is a table's columns and is already spoken for by the layout editor.
 * The uneven heights are what make it read as cards rather than as a grid.
 */
export const IconBoard = (p) => (
  <Svg {...p}>
    <rect x="2" y="2.6" width="3.4" height="10.8" rx="1" />
    <rect x="6.3" y="2.6" width="3.4" height="7.2" rx="1" />
    <rect x="10.6" y="2.6" width="3.4" height="5" rx="1" />
  </Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}>
    <rect x="2.2" y="3.2" width="11.6" height="10.6" rx="1.4" />
    <path d="M2.2 6.4h11.6M5.4 1.9v2.6M10.6 1.9v2.6" />
  </Svg>
);

export const IconPaperclip = (p) => (
  <Svg {...p}>
    <path d="M11.9 7.4l-4.6 4.6a2.8 2.8 0 01-4-4l5.1-5.1a1.9 1.9 0 012.7 2.7l-5 5a1 1 0 01-1.4-1.4l4.5-4.5" />
  </Svg>
);

/** The job hunt: a case with a handle. Applications wear this in the menu. */
export const IconBriefcase = (p) => (
  <Svg {...p}>
    <rect x="1.8" y="4.8" width="12.4" height="8.6" rx="1.4" />
    <path d="M5.8 4.8V3.4a1.2 1.2 0 011.2-1.2h2a1.2 1.2 0 011.2 1.2v1.4M1.8 8.2h12.4" />
  </Svg>
);

/** A company, where there is no logo to draw instead. */
export const IconBuilding = (p) => (
  <Svg {...p}>
    <rect x="2.6" y="2.2" width="7" height="11.6" rx="1" />
    <path d="M9.6 6.4h3.8v7.4M4.8 5h2.6M4.8 7.6h2.6M4.8 10.2h2.6" />
  </Svg>
);

/** A checklist item, for subtasks — a box that has been ticked. */
export const IconCheckSquare = (p) => (
  <Svg {...p}>
    <path d="M13.6 7.6v4.6a1.4 1.4 0 01-1.4 1.4H3.8a1.4 1.4 0 01-1.4-1.4V3.8a1.4 1.4 0 011.4-1.4h6.4" />
    <path d="M5.6 7.6l2.2 2.2 6-6.4" strokeWidth={1.9} />
  </Svg>
);

/** The overflow affordance on a card. */
export const IconMore = (p) => (
  <Svg {...p}>
    <circle cx="3.2" cy="8" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="8" cy="8" r="1.15" fill="currentColor" stroke="none" />
    <circle cx="12.8" cy="8" r="1.15" fill="currentColor" stroke="none" />
  </Svg>
);
