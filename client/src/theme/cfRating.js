/**
 * Codeforces' rating colours, which are the CP module's primary colour language.
 *
 * Not a decorative choice. Everybody who has spent a week on Codeforces reads
 * these colours before they read the number — grey is a beginner problem, cyan
 * is a Specialist one, orange is hard, red is very hard — and inventing a
 * different palette for the same axis would make the app harder to read than the
 * site it is about.
 *
 * The names match Codeforces' own rank names, and the thresholds match the ones
 * `server/src/config/cpTiers.js` uses for a *user's* rank. That agreement is
 * deliberate: a 1600-rated problem and a 1600-rated person wear the same colour,
 * which is what makes "this problem is above me" legible at a glance.
 *
 * Values resolve against `--cf-*` tokens defined in styles/cp.css, so the
 * palette is themed in one place rather than as hexes scattered through JSX.
 */

const BANDS = [
  { min: 3000, key: 'lgm', label: 'Legendary Grandmaster' },
  { min: 2600, key: 'gm', label: 'International Grandmaster' },
  { min: 2400, key: 'gm', label: 'Grandmaster' },
  { min: 2300, key: 'im', label: 'International Master' },
  { min: 2200, key: 'master', label: 'Master' },
  { min: 1900, key: 'cm', label: 'Candidate Master' },
  { min: 1600, key: 'expert', label: 'Expert' },
  { min: 1400, key: 'specialist', label: 'Specialist' },
  { min: 1200, key: 'pupil', label: 'Pupil' },
  { min: 0, key: 'newbie', label: 'Newbie' },
];

/**
 * The band a rating falls in, or null.
 *
 * Null rather than a default band for a missing rating, because "unrated" is a
 * real and different state from "rated 0" — a CodeChef problem has no Codeforces
 * rating at all, and painting it grey would claim it is a beginner problem.
 */
export function ratingBand(rating) {
  const value = Number(rating);
  if (!Number.isFinite(value) || value <= 0) return null;
  return BANDS.find((b) => value >= b.min) || BANDS[BANDS.length - 1];
}

/** The CSS custom property holding this band's colour. */
export const ratingColour = (rating) => {
  const band = ratingBand(rating);
  return band ? `var(--cf-${band.key})` : 'var(--text-3)';
};

export const ratingLabel = (rating) => ratingBand(rating)?.label || 'Unrated';

/** The `data-band` attribute value, for rules that tint a whole row. */
export const ratingKey = (rating) => ratingBand(rating)?.key || '';

/**
 * How a problem's rating sits against the reader's own.
 *
 * The one piece of arithmetic worth doing in the UI, because it is the question
 * a person on a ladder is actually asking — not "how hard is this" but "should I
 * be able to do this yet". The thresholds match what the AI coach is told, so
 * the badge and the chat cannot disagree about what counts as a stretch.
 */
export function relativeDifficulty(problemRating, userRating) {
  if (!Number.isFinite(userRating) || !problemRating) return null;
  const gap = problemRating - userRating;
  if (gap > 400) return { key: 'far', label: 'Far above you', gap };
  if (gap > 150) return { key: 'stretch', label: 'Stretch', gap };
  if (gap < -300) return { key: 'easy', label: 'Below you', gap };
  return { key: 'target', label: 'On target', gap };
}

/**
 * The rating bands a ladder filter offers as one-tap presets.
 *
 * Aligned to the tier boundaries rather than to round hundreds, so picking
 * "Specialist" from the filter and opening the Specialist tier show the same
 * problems.
 */
export const RATING_PRESETS = [
  { label: '800–1000', min: 800, max: 1000 },
  { label: '1100–1300', min: 1100, max: 1300 },
  { label: '1400–1500', min: 1400, max: 1500 },
  { label: '1600–1800', min: 1600, max: 1800 },
  { label: '1900–2100', min: 1900, max: 2100 },
  { label: '2200+', min: 2200, max: null },
];
