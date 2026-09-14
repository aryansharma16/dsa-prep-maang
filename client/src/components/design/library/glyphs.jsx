/**
 * Generic technology glyphs for the component library — the ones with no brand
 * logo, and the brands Simple Icons no longer carries.
 *
 * Drawn on a 24-unit box with a round 1.7 stroke in currentColor, the same family
 * as ../icons.jsx scaled up, so a Redis logo and a "Cache" glyph sit together on a
 * board without one looking pasted in. Each is a fragment; <TechGlyph> wraps it.
 */

const G = {
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4.5 20.5c.8-4 3.8-6.5 7.5-6.5s6.7 2.5 7.5 6.5" />
    </>
  ),
  browser: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2.5" />
      <path d="M2.5 8.5h19" />
      <path d="M5.5 6.25h.01M8 6.25h.01M10.5 6.25h.01" />
    </>
  ),
  mobile: (
    <>
      <rect x="6.5" y="2.5" width="11" height="19" rx="2.5" />
      <path d="M10.5 18.5h3" />
    </>
  ),
  desktop: (
    <>
      <rect x="2.5" y="3.5" width="19" height="13" rx="2" />
      <path d="M8.5 21h7M12 16.5V21" />
    </>
  ),
  iot: (
    <>
      <rect x="7.5" y="7.5" width="9" height="9" rx="1.5" />
      <path d="M10 7.5V4.5M14 7.5V4.5M10 19.5v-3M14 19.5v-3M7.5 10H4.5M7.5 14H4.5M19.5 10h-3M19.5 14h-3" />
    </>
  ),
  dns: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9S9.5 5.6 12 3z" />
    </>
  ),
  cdn: (
    <>
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="4.5" cy="6" r="1.8" />
      <circle cx="19.5" cy="6" r="1.8" />
      <circle cx="4.5" cy="18" r="1.8" />
      <circle cx="19.5" cy="18" r="1.8" />
      <path d="M6 7l4 3.4M18 7l-4 3.4M6 17l4-3.4M18 17l-4-3.4" />
    </>
  ),
  loadBalancer: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <path d="M12 7.5v3.5M12 11l-7 4.5M12 11v4.5M12 11l7 4.5" />
      <rect x="2.5" y="16" width="5" height="4.5" rx="1" />
      <rect x="9.5" y="16" width="5" height="4.5" rx="1" />
      <rect x="16.5" y="16" width="5" height="4.5" rx="1" />
    </>
  ),
  gateway: (
    <>
      <path d="M4 21V9.5L12 3l8 6.5V21" />
      <path d="M9 21v-6.5a3 3 0 016 0V21" />
      <path d="M2.5 21h19" />
    </>
  ),
  proxy: (
    <>
      <rect x="9" y="8" width="6" height="8" rx="1.5" />
      <path d="M2.5 12H9M15 12h6.5M18.5 9l3 3-3 3M5.5 9l-3 3 3 3" />
    </>
  ),
  firewall: (
    <>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <path d="M3 9.3h18M3 14.7h18M9 4v5.3M15 4v5.3M6 9.3v5.4M12 9.3v5.4M18 9.3v5.4M9 14.7V20M15 14.7V20" />
    </>
  ),
  rateLimiter: (
    <>
      <path d="M4.5 18a8.5 8.5 0 1115 0" />
      <path d="M12 13l4-4.5" />
      <circle cx="12" cy="13.5" r="1.3" />
      <path d="M3 21h18" />
    </>
  ),
  server: (
    <>
      <rect x="3" y="3.5" width="18" height="7" rx="1.8" />
      <rect x="3" y="13.5" width="18" height="7" rx="1.8" />
      <path d="M7 7h.01M7 17h.01M11 7h6M11 17h6" />
    </>
  ),
  service: (
    <>
      <path d="M12 2.5l8.5 4.8v9.4L12 21.5l-8.5-4.8V7.3z" />
      <path d="M12 12l8.5-4.7M12 12L3.5 7.3M12 12v9.5" />
    </>
  ),
  worker: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2.5v2.6M12 18.9v2.6M21.5 12h-2.6M5.1 12H2.5M18.7 5.3l-1.8 1.8M7.1 16.9l-1.8 1.8M18.7 18.7l-1.8-1.8M7.1 7.1L5.3 5.3" />
    </>
  ),
  function: (
    <>
      <path d="M13 2.5L5 13.5h6.5L10.5 21.5 19 10h-6.5z" />
    </>
  ),
  container: (
    <>
      <path d="M3 7.5L12 3l9 4.5v9L12 21l-9-4.5z" />
      <path d="M3 7.5L12 12l9-4.5M12 12v9M7.5 5.2l9 4.5" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="5.5" rx="8" ry="3" />
      <path d="M4 5.5v13c0 1.7 3.6 3 8 3s8-1.3 8-3v-13" />
      <path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3" />
    </>
  ),
  replica: (
    <>
      <ellipse cx="9" cy="5.5" rx="6" ry="2.3" />
      <path d="M3 5.5v10c0 1.3 2.7 2.3 6 2.3" />
      <path d="M15 5.5v4" />
      <ellipse cx="15.5" cy="12" rx="5.5" ry="2.1" />
      <path d="M10 12v7.5c0 1.2 2.5 2.1 5.5 2.1s5.5-.9 5.5-2.1V12" />
    </>
  ),
  keyValue: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M9.5 5v14M2.5 9.7h19M2.5 14.3h19" />
    </>
  ),
  document: (
    <>
      <path d="M14 2.5H6.5a2 2 0 00-2 2v15a2 2 0 002 2h11a2 2 0 002-2V8z" />
      <path d="M14 2.5V8h5.5M8.5 13h2.5M13 13h2.5M8.5 17h7" />
    </>
  ),
  wideColumn: (
    <>
      <rect x="2.5" y="4" width="19" height="16" rx="2" />
      <path d="M2.5 8.5h19M7.5 4v16M12.5 8.5V20M17 8.5V20" />
    </>
  ),
  graph: (
    <>
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="7" r="2.5" />
      <circle cx="7" cy="18" r="2.5" />
      <circle cx="17.5" cy="17.5" r="2.5" />
      <path d="M8.4 6.2l7.1.6M6.3 8.5l.4 7M9.4 17.8l5.6-.2M16.4 9.4l-7.6 6.9M18 9.5l-.3 5.5" />
    </>
  ),
  timeSeries: (
    <>
      <path d="M3 3.5v17h18" />
      <path d="M6.5 15l3.5-4.5 3 3 5-6.5" />
    </>
  ),
  cache: (
    <>
      <path d="M13 2.5L6 13h5l-1 8.5L18 11h-5z" />
      <path d="M3 21h4M17 21h4" />
    </>
  ),
  queue: (
    <>
      <rect x="2.5" y="7" width="4.5" height="10" rx="1" />
      <rect x="9.75" y="7" width="4.5" height="10" rx="1" />
      <rect x="17" y="7" width="4.5" height="10" rx="1" />
      <path d="M2.5 20.5h19M18.5 18.8l2 1.7-2 1.7" />
    </>
  ),
  topic: (
    <>
      <circle cx="5" cy="12" r="2.5" />
      <path d="M7.5 12h4M11.5 12l8-6.5M11.5 12h8M11.5 12l8 6.5" />
      <circle cx="19.5" cy="5.5" r="1.5" />
      <circle cx="19.5" cy="12" r="1.5" />
      <circle cx="19.5" cy="18.5" r="1.5" />
    </>
  ),
  stream: (
    <>
      <path d="M2.5 7.5h19M2.5 12h19M2.5 16.5h19" />
      <path d="M6 5.5v4M10.5 10v4M15 5.5v4M17.5 14.5v4M8 14.5v4" />
    </>
  ),
  bucket: (
    <>
      <ellipse cx="12" cy="6" rx="8.5" ry="3" />
      <path d="M3.5 6l2 13c.3 1.6 3 2.5 6.5 2.5s6.2-.9 6.5-2.5l2-13" />
    </>
  ),
  warehouse: (
    <>
      <path d="M2.5 9.5L12 3.5l9.5 6V21h-19z" />
      <path d="M6.5 21v-7.5h11V21M6.5 16h11M6.5 18.5h11" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5l5.5 5.5" />
    </>
  ),
  vector: (
    <>
      <path d="M3 21L21 3M3 21h7M3 21v-7" />
      <circle cx="16" cy="15" r="1.2" />
      <circle cx="9" cy="6.5" r="1.2" />
      <circle cx="19" cy="9" r="1.2" />
    </>
  ),
  batch: (
    <>
      <rect x="3" y="3" width="8" height="8" rx="1.5" />
      <rect x="13" y="3" width="8" height="8" rx="1.5" />
      <rect x="3" y="13" width="8" height="8" rx="1.5" />
      <rect x="13" y="13" width="8" height="8" rx="1.5" />
    </>
  ),
  streamProcessor: (
    <>
      <path d="M2.5 8h6M2.5 12h6M2.5 16h6M15.5 12h6M18.5 9l3 3-3 3" />
      <rect x="8.5" y="5.5" width="7" height="13" rx="1.8" />
    </>
  ),
  metrics: (
    <>
      <path d="M4 20.5V13M9.3 20.5V8M14.7 20.5V11M20 20.5V4" />
    </>
  ),
  logs: (
    <>
      <rect x="3.5" y="3" width="17" height="18" rx="2" />
      <path d="M7 8h10M7 12h10M7 16h6" />
    </>
  ),
  tracing: (
    <>
      <path d="M3 5.5h9M6 10h11M9 14.5h7M12 19h9" />
      <path d="M3 3v18" />
    </>
  ),
  alert: (
    <>
      <path d="M12 3.5L2.5 20h19z" />
      <path d="M12 10v4.5M12 17.2h.01" />
    </>
  ),
  cloud: (
    <>
      <path d="M7 18.5a4.5 4.5 0 01-.6-8.96A6 6 0 0118 8.5a5 5 0 01-.5 10z" />
    </>
  ),
  region: (
    <>
      <rect x="2.5" y="3.5" width="19" height="17" rx="2" strokeDasharray="3 2.5" />
      <path d="M8 10.5a4 4 0 118 0c0 3-4 6.5-4 6.5s-4-3.5-4-6.5z" />
    </>
  ),
  coordination: (
    <>
      <circle cx="12" cy="5" r="2.5" />
      <circle cx="5" cy="18" r="2.5" />
      <circle cx="19" cy="18" r="2.5" />
      <path d="M10.8 7.2l-4.6 8.6M13.2 7.2l4.6 8.6M7.5 18h9" />
      <path d="M12 2.5v-.01" />
    </>
  ),
  lock: (
    <>
      <rect x="4" y="10.5" width="16" height="11" rx="2" />
      <path d="M8 10.5V7a4 4 0 018 0v3.5M12 15v2.5" />
    </>
  ),
  key: (
    <>
      <circle cx="7.5" cy="15.5" r="4.5" />
      <path d="M10.7 12.3L20 3M16.5 6.5l3 3M14 9l2 2" />
    </>
  ),
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M2.5 9.5h19M6 15h4" />
    </>
  ),
  bell: (
    <>
      <path d="M6 16.5V11a6 6 0 0112 0v5.5l1.5 2h-15z" />
      <path d="M10 21h4" />
    </>
  ),
  mail: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2" />
      <path d="M3 6.5l9 6.5 9-6.5" />
    </>
  ),
  sms: (
    <>
      <path d="M4 4.5h16a1.5 1.5 0 011.5 1.5v10a1.5 1.5 0 01-1.5 1.5H9l-4.5 3.5v-3.5H4A1.5 1.5 0 012.5 16V6A1.5 1.5 0 014 4.5z" />
      <path d="M7.5 11h.01M12 11h.01M16.5 11h.01" />
    </>
  ),
  pin: (
    <>
      <path d="M5.5 9.5a6.5 6.5 0 1113 0c0 5-6.5 12-6.5 12s-6.5-7-6.5-12z" />
      <circle cx="12" cy="9.5" r="2.3" />
    </>
  ),
  api: (
    <>
      <path d="M8 7l-5 5 5 5M16 7l5 5-5 5M13.5 4.5l-3 15" />
    </>
  ),
  websocket: (
    <>
      <path d="M3 9h14.5M14.5 6l3 3-3 3M21 15H6.5M9.5 12l-3 3 3 3" />
    </>
  ),
  webhook: (
    <>
      <circle cx="12" cy="6" r="3" />
      <circle cx="5.5" cy="17.5" r="3" />
      <circle cx="18.5" cy="17.5" r="3" />
      <path d="M10.5 8.6L7 14.9M8.5 17.5h7M13.5 8.6l3.5 6.3" />
    </>
  ),
  box: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="3" />
    </>
  ),
};

export const GLYPH_NAMES = Object.keys(G);

export function TechGlyph({ name, size = 24, strokeWidth = 1.7, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {G[name] || G.box}
    </svg>
  );
}
