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

export const IconEdit = (p) => (
  <Svg {...p}>
    <path d="M11.1 2.5a1.5 1.5 0 012.1 2.1L5.6 12.2 2.6 13l.8-3z" />
  </Svg>
);
