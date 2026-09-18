import {
  APPLY_METHOD_OPTIONS,
  PRIORITY_OPTIONS,
  ROUND_TYPE_OPTIONS,
  SOURCE_OPTIONS,
  outcomeSettled,
} from '../components/applications/vocab.js';
import { daysUntil } from '../components/tasks/time.js';
import { defineFilters } from './spec.js';

/**
 * What you can narrow the pipeline by.
 *
 * One thing is deliberately absent, the same omission the task board makes and
 * for the same reason: there is no filter on stage. The board *is* the stages,
 * so narrowing by one would empty five of the six lanes it is made of. What is
 * here instead are the cuts the lanes cannot make.
 *
 * `roundType` is the one worth pointing at. It asks a question about the
 * *inside* of an application — "show me everywhere a system design round is
 * coming up" — which is exactly the cut you want on a Sunday when you are
 * deciding what to study, and there is no arrangement of columns that produces
 * it.
 */
export const APPLICATION_FILTERS = defineFilters([
  {
    id: 'source',
    kind: 'many',
    label: 'Where you found it',
    placeholder: 'Any source',
    options: SOURCE_OPTIONS,
    match: (app, values) => values.includes(app.source),
  },
  {
    id: 'referred',
    kind: 'one',
    label: 'Referral',
    control: 'segmented',
    options: [
      { value: '', label: 'Any' },
      { value: 'yes', label: 'Referred' },
      { value: 'no', label: 'Applied cold' },
    ],
    /*
      A cut across every source rather than a value inside one — see the note in
      the server's config about why `referral` is not a channel. This is the
      filter that argument exists to make possible.
    */
    match: (app, value) => (value === 'yes' ? app.referred : !app.referred),
  },
  {
    id: 'applyMethod',
    kind: 'many',
    label: 'How you applied',
    placeholder: 'Any way',
    options: APPLY_METHOD_OPTIONS,
    /* `''` is a real, selectable value here — "the ones I never recorded" is a
       list you want, because it is the list to go back and fill in. */
    match: (app, values) => values.includes(app.applyMethod || ''),
  },
  {
    id: 'roundType',
    kind: 'many',
    label: 'Has a round of this kind',
    placeholder: 'Any kind',
    options: ROUND_TYPE_OPTIONS,
    match: (app, values) => (app.rounds || []).some((round) => values.includes(round.type)),
  },
  {
    id: 'priority',
    kind: 'one',
    label: 'Priority',
    control: 'segmented',
    options: [
      { value: '', label: 'Any' },
      ...PRIORITY_OPTIONS.filter((option) => option.value !== 'none'),
    ],
    match: (app, value) => app.priority === value,
  },
  {
    id: 'when',
    kind: 'one',
    label: 'Coming up',
    options: [
      { value: '', label: 'Any time' },
      { value: 'week', label: 'A round this week' },
      { value: 'today', label: 'A round today or tomorrow' },
      { value: 'none', label: 'Nothing booked' },
    ],
    match: (app, value) => {
      if (value === 'none') return !app.nextRoundAt;
      if (!app.nextRoundAt) return false;
      const days = daysUntil(app.nextRoundAt);
      if (value === 'today') return days <= 1;
      return days <= 7;
    },
  },
  {
    id: 'tags',
    kind: 'many',
    label: 'Tags',
    placeholder: 'Any tag',
    /* Options come from the loaded board, so none are declared here. */
    match: (app, values) => (app.tags || []).some((tag) => values.includes(tag)),
  },

  /*
    Three flags in the bar rather than the dialog, the reason the roadmap gives:
    these are what you flip mid-session — look, flip back — which is a different
    gesture from setting up a view.
  */
  {
    id: 'stale',
    kind: 'flag',
    label: 'Gone quiet',
    place: 'bar',
    match: (app) => app.stale,
  },
  {
    id: 'owed',
    kind: 'flag',
    label: 'Needs chasing',
    place: 'bar',
    /*
      Two different kinds of owing, and they belong under one flag because the
      action is the same: a follow-up date that has passed, or a round you sat
      and have heard nothing about. The second is the one people forget, because
      nothing on the card looks wrong.
    */
    match: (app) =>
      (Boolean(app.followUpBy) && daysUntil(app.followUpBy) <= 0) ||
      (app.rounds || []).some((round) => round.outcome === 'awaiting'),
  },
  {
    id: 'booked',
    kind: 'flag',
    label: 'Has a round booked',
    place: 'bar',
    match: (app) =>
      (app.rounds || []).some((round) => round.scheduledAt && !outcomeSettled(round.outcome)),
  },
]);
