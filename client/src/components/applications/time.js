import { daysUntil, deadlineLabel } from '../tasks/time.js';

/**
 * Dates, for the job hunt.
 *
 * The day-level helpers — `daysUntil`, `deadlineLabel`, `dateInputValue`,
 * `dateFromInput` — are the board's, imported rather than copied. They already
 * solve the two problems that bite here (comparing at local midnight so a
 * deadline four hours away that crosses midnight reads as "tomorrow", and
 * parsing `yyyy-mm-dd` locally so nobody west of Greenwich sees yesterday), and
 * a second copy is a pair that drifts on the first fix applied to one of them.
 *
 * What this file adds is the part a task never needed: an interview has a
 * *time*, not just a day. "Thu 4:00 pm" is the whole of what you want off a
 * card the morning of a round, and the day-level formatter cannot say it.
 */

export { daysUntil, dateFromInput, dateInputValue, deadlineLabel } from '../tasks/time.js';

/** The `<input type="datetime-local">` value for an instant, in local time. */
export function dateTimeInputValue(value) {
  if (!value) return '';
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}`;
}

/**
 * Back from that input.
 *
 * `new Date('2026-09-01T16:00')` is already parsed as local by every engine
 * — unlike the date-only form, which is UTC — so this is only a guard against
 * an empty or half-typed value reaching a request as `Invalid Date`.
 */
export function dateTimeFromInput(value) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(+date) ? null : date;
}

const time = (value) =>
  new Date(value).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

/**
 * When a round is, as it reads on a card.
 *
 * Near the present it is a weekday and a time, because that is what you act on
 * — "Thu 4:00 pm" needs no arithmetic and no calendar. Far enough away it falls
 * back to the board's own deadline wording, which switches to a date once
 * counting days stops helping.
 */
export function roundWhen(value) {
  const days = daysUntil(value);
  if (days === null) return '';

  if (days === 0) return `Today ${time(value)}`;
  if (days === 1) return `Tomorrow ${time(value)}`;
  if (days > 1 && days <= 6) {
    const weekday = new Date(value).toLocaleDateString(undefined, { weekday: 'short' });
    return `${weekday} ${time(value)}`;
  }
  return deadlineLabel(value);
}

/** `23 Aug` — a timeline node, where the year is noise until it is not. */
export function dayStamp(value) {
  if (!value) return '';
  const date = new Date(value);
  const sameYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/** `23 Aug, 4:02 pm` — where the exact time is the point. */
export function stamp(value) {
  if (!value) return '';
  return `${dayStamp(value)}, ${time(value)}`;
}

/**
 * How long something has been sitting: `12 days`, `3 weeks`, `2 months`.
 *
 * Coarsens as it grows, because the difference between 61 and 68 days of
 * silence is not information and reading "68 days" invites you to believe it
 * is.
 *
 * A bare duration, for the callers that supply their own preposition —
 * "quiet for 3 weeks". Under a day it is `''` rather than "0 days", so those
 * callers can fall back to a phrase instead of printing a zero.
 */
export function since(value) {
  if (!value) return '';
  const days = Math.max(0, -daysUntil(value));
  if (days === 0) return '';
  if (days === 1) return 'a day';
  if (days < 14) return `${days} days`;
  if (days < 60) return `${Math.round(days / 7)} weeks`;
  return `${Math.round(days / 30)} months`;
}

/**
 * The same span as a finished phrase: `today`, `yesterday`, `12 days ago`.
 *
 * Two functions rather than one because the two ends of the range take
 * different grammar, and gluing "ago" onto whatever `since` returned is how a
 * card ends up reading "Applied today ago". The nearest two days are words, not
 * durations, and there is no preposition that works for both.
 */
export function ago(value) {
  if (!value) return '';
  const days = Math.max(0, -daysUntil(value));
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  return `${since(value)} ago`;
}

/**
 * Money, as a line on a card.
 *
 * Amounts are stored in whole rupees (or dollars, or whatever `currency` says)
 * and read in lakhs, which is the unit anybody in this market actually
 * negotiates in — so INR is rendered as LPA and everything else is grouped
 * normally. The conversion lives here and in the offer form's parser, and
 * nowhere else.
 */
export function money(amount, currency = 'INR') {
  if (amount == null) return '';
  if (currency === 'INR') {
    const lpa = amount / 100000;
    const shown = lpa >= 10 ? Math.round(lpa) : Math.round(lpa * 10) / 10;
    return `₹${shown} LPA`;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

/** Lakhs back into rupees, for the offer form. Anything else passes through. */
export const fromLpa = (value, currency = 'INR') => {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  return currency === 'INR' ? Math.round(number * 100000) : Math.round(number);
};

export const toLpa = (amount, currency = 'INR') => {
  if (amount == null) return '';
  return currency === 'INR' ? String(Math.round((amount / 100000) * 100) / 100) : String(amount);
};
