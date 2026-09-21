/**
 * The shapes this track draws more than once.
 *
 * The same idea as `../sql/sample-data.js`: a SQL topic is three grids in a row
 * and every one of them refers to the same six employees, so the employees are
 * written once. Here it is pictures. Nineteen real-world systems all begin with
 * a request walking the same path, and nineteen hand-drawn copies of that path
 * is nineteen chances for one of them to put the cache on the wrong side of the
 * service.
 *
 * Everything here is a *factory*, not a constant. Blocks are plain objects and
 * the seeder walks them; handing the same object to two topics would put one
 * object in two documents, which works today and is the kind of sharing that
 * stops working the moment anything mutates a block in place.
 *
 * Nothing in here is mandatory. A topic whose path genuinely differs draws its
 * own — `standardPath()` is a default, not a house style to bend a system into.
 */

import { flow, note } from '../blocks.js';

/**
 * A pointer at another Learn track.
 *
 * Sections 2, 3 and 6 of this track deliberately overlap Computer Networks and
 * SQL, and they stay short because those tracks already explain the mechanism.
 * What is missing is a way to say so — `links()` takes absolute URLs only, and
 * a Learn topic has no public one, so a cross-reference cannot be a link.
 *
 * So it is a callout naming the track and the topic, which is enough: the
 * reader types it into the search box on the hub and lands on the page. Written
 * once here rather than phrased eleven different ways across the track.
 */
export const seeAlso = (track, topic, what) =>
  note(`Deeper on the mechanism: the **${track}** track's **${topic}** topic covers ${what}. This page is about where it sits in an architecture and what it costs you.`);

/**
 * The request path almost every user-facing system starts from.
 *
 * Worth having in one place because the *order* is the teaching: the CDN is in
 * front of the load balancer (it answers without ever reaching you), the cache
 * is behind the service and not in front of it (the service decides what is
 * cacheable), and the database is last because everything above it exists to
 * keep traffic away from it.
 */
export const standardPath = () =>
  flow(
    ['Client', 'DNS', 'CDN', 'Load balancer', 'API gateway', 'Service', 'Cache', 'Database'],
    'The usual path',
  );

/** The same, minus the edge — for an internal or API-only system. */
export const apiPath = () =>
  flow(['Client', 'Load balancer', 'API gateway', 'Service', 'Cache', 'Database'], 'Request path');

/**
 * The write path that produces almost every "and then it happens eventually".
 *
 * A write lands in the database, an event lands on a log, and everything that
 * is not needed to answer the user happens on the other side of it.
 */
export const asyncWritePath = () =>
  flow(['Client', 'Service', 'Database', 'Event log', 'Consumers'], 'Write path');

/**
 * The disclaimer every real-world topic closes on.
 *
 * It is not modesty. These architectures are what you would defend on a
 * whiteboard in forty-five minutes; the real ones are not public, are twenty
 * years old in places, and contain decisions that only make sense with the
 * company's own history attached. A reader who mistakes one for the other will
 * confidently tell an interviewer something that is not true.
 */
export const interviewLevel = (company) =>
  note(
    `An **interview-level architecture** — the design you would draw and defend, not a claim about what ${company} actually runs. Their real system is not public, and it would not fit in forty-five minutes if it were.`,
  );
