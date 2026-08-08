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
