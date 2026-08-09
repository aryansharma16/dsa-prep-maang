/**
 * The sign-in page's line, before the network has said anything.
 *
 * These ship in the bundle so the auth pages keep the promise AuthLayout makes:
 * nothing to wait for before the form is usable. One is picked and painted on
 * the first frame; if the public endpoint answers, its line — which an admin
 * can actually edit — replaces it, and if it never answers nobody notices.
 *
 * Deliberately a handful rather than a copy of the seeded pool. This is a
 * fallback, and a fallback that has to stay in sync with the database is a
 * second source of truth waiting to disagree with the first.
 */
export const AUTH_LINES = [
  'The offer is decided in the interview. The interview is decided months earlier.',
  'The engineer you want to be is built one difficult problem at a time.',
  'Do not chase the company. Chase the capability that makes the company come looking.',
  'Nobody sees the hundreds you solved before the one you solve in the room.',
  'You do not need to change your life today. You need to win today.',
  'Your competition is not the person who solved 500. It is the one who understood 200.',
];

/** A different one per page load. There is no context here to be stable for. */
export const randomAuthLine = () => AUTH_LINES[Math.floor(Math.random() * AUTH_LINES.length)];
