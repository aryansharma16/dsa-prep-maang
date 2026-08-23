import { daysUntil, isOverdue } from '../components/tasks/time.js';
import { defineFilters } from './spec.js';

/**
 * What you can narrow the board by.
 *
 * The second screen to use the filter engine, and the first to prove it
 * generalises — nothing was added to `spec.js` to make this work, and the
 * server change was one string in the scope allowlist.
 *
 * One thing is deliberately absent: a filter on column. The board *is* the
 * columns, so narrowing by one would empty three of the four panes it is made
 * of. In List and Table, where that argument does not hold, the grouping
 * already does the same job. What is here instead are the cuts the columns
 * cannot make.
 */

/** Shared with the drawer's dropdown, so the two cannot drift. */
export const PRIORITY_OPTIONS = [
  { value: 'none', label: 'None' },
  { value: 'low', label: 'Low' },
  { value: 'med', label: 'Medium' },
  { value: 'high', label: 'High' },
];

export const TASK_FILTERS = defineFilters([
  {
    id: 'priority',
    kind: 'one',
    label: 'Priority',
    control: 'segmented',
    options: [{ value: '', label: 'Any' }, ...PRIORITY_OPTIONS.filter((p) => p.value !== 'none')],
    match: (task, value) => task.priority === value,
  },
  {
    id: 'due',
    kind: 'one',
    label: 'Deadline',
    options: [
      { value: '', label: 'Any deadline' },
      { value: 'overdue', label: 'Overdue', note: 'Past its date and not finished' },
      { value: 'today', label: 'Due today' },
      { value: 'week', label: 'Due this week', note: 'The next seven days' },
      { value: 'none', label: 'No deadline', note: 'The default — most tasks' },
    ],
    match: (task, value) => {
      if (value === 'none') return !task.dueAt;
      if (value === 'overdue') return isOverdue(task);
      if (!task.dueAt) return false;
      const days = daysUntil(task.dueAt);
      if (value === 'today') return days === 0;
      // "This week" includes what is already late, because a filter for the
      // week you are planning that hides the thing you have already missed is
      // the opposite of useful.
      return days <= 7;
    },
  },
  {
    id: 'tags',
    kind: 'many',
    label: 'Tags',
    placeholder: 'Any tag',
    // Options come from the loaded board, so none are declared here.
    match: (task, values) => (task.tags || []).some((tag) => values.includes(tag)),
  },

  /*
    Three flags in the bar rather than the dialog, for the reason the roadmap
    gives: these are what you flip mid-session — look, flip back — which is a
    different gesture from setting up a view.
  */
  {
    id: 'questions',
    kind: 'flag',
    label: 'Has questions',
    place: 'bar',
    match: (task) => (task.questions || []).length > 0,
  },
  {
    id: 'tracked',
    kind: 'flag',
    label: 'Timed',
    place: 'bar',
    match: (task) => (task.trackedSeconds || 0) > 0 || Boolean(task.runningSince),
  },
  {
    id: 'attachments',
    kind: 'flag',
    label: 'Has files',
    place: 'bar',
    match: (task) => (task.attachments || []).length > 0,
  },
]);
