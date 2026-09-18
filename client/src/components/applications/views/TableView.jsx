import { useMemo, useState } from 'react';

import { IconChevronsDown, IconChevronsUp, IconUser } from '../../ui/Icons.jsx';
import { CompanyMark } from '../CompanyMark.jsx';
import { openResume } from '../ResumeField.jsx';
import { dayStamp, roundWhen } from '../time.js';
import {
  applyMethodLabel,
  isOneClick,
  nextRound,
  sourceLabel,
  stageHue,
  stageLabel,
} from '../vocab.js';

/**
 * Every application as one row.
 *
 * The board answers "where is everything"; this answers "show me all of it at
 * once, in an order I choose" — sorted by when you applied, by what is coming
 * up, by how long it has gone quiet. It is also the densest view, which is what
 * you want on the evening you sit down to chase ten companies in a row.
 *
 * Sorting is local and not saved, the way the page search is not: it is a
 * question you ask for a minute and then stop asking, and a table that
 * reopened in last Tuesday's order would be a table that looked shuffled.
 *
 * Reads the same card list the board does. Nothing here fetches, so switching
 * between the two is a re-render rather than a request.
 */

const STAGE_ORDER = [
  'wishlist',
  'applied',
  'screening',
  'in_process',
  'offer',
  'accepted',
  'rejected',
  'ghosted',
  'withdrawn',
];

const time = (value) => (value ? +new Date(value) : null);

/**
 * The next round that is actually still coming, for the "Next" column.
 *
 * `nextRoundAt` is the server's answer and the one to prefer; `nextRound` is
 * the fallback for a card written before that field existed, and it applies the
 * same rule — ahead of now, not merely unsettled.
 */
const nextOf = (app) => app.nextRoundAt || nextRound(app.rounds)?.scheduledAt || null;

const COLUMNS = [
  {
    key: 'company',
    label: 'Company',
    sort: (app) => app.company.toLowerCase(),
    cell: (app) => (
      <span className="ap-t-company">
        <CompanyMark company={app.company} slug={app.logoSlug} size={18} />
        <span>
          <strong>{app.company}</strong>
          {app.role && <em>{app.role}</em>}
        </span>
      </span>
    ),
  },
  {
    key: 'stage',
    label: 'Stage',
    sort: (app) => STAGE_ORDER.indexOf(app.stage),
    cell: (app) => (
      <span className="ap-chip ap-chip-stage" data-hue={stageHue(app.stage)}>
        {stageLabel(app.stage)}
      </span>
    ),
  },
  {
    key: 'source',
    label: 'Found on',
    sort: (app) => sourceLabel(app.source),
    cell: (app) => sourceLabel(app.source),
  },
  {
    key: 'method',
    label: 'Applied via',
    sort: (app) => app.applyMethod || '~',
    cell: (app) =>
      app.applyMethod ? (
        <span className={isOneClick(app.applyMethod) ? 'ap-muted' : ''}>
          {applyMethodLabel(app.applyMethod)}
        </span>
      ) : (
        <span className="ap-muted">—</span>
      ),
  },
  {
    key: 'referred',
    label: 'Referral',
    sort: (app) => (app.referred ? 0 : 1),
    cell: (app) =>
      app.referred ? (
        <span className="ap-chip ap-chip-ref">
          <IconUser size={10} />
          {app.referrer?.name?.split(' ')[0] || 'Yes'}
        </span>
      ) : (
        <span className="ap-muted">—</span>
      ),
  },
  {
    key: 'applied',
    label: 'Applied',
    sort: (app) => time(app.appliedAt),
    cell: (app) => (app.appliedAt ? dayStamp(app.appliedAt) : <span className="ap-muted">—</span>),
  },
  {
    key: 'next',
    label: 'Next',
    sort: (app) => time(nextOf(app)),
    cell: (app) => {
      const next = nextOf(app);
      return next ? roundWhen(next) : <span className="ap-muted">—</span>;
    },
  },
  {
    key: 'quiet',
    label: 'Last activity',
    /* Oldest first when ascending — the quiet ones are the ones you sort for. */
    sort: (app) => time(app.lastActivityAt),
    cell: (app) =>
      app.lastActivityAt ? (
        <span className={app.stale ? 'ap-stale-text' : ''}>{dayStamp(app.lastActivityAt)}</span>
      ) : (
        <span className="ap-muted">—</span>
      ),
  },
  {
    key: 'rounds',
    label: 'Rounds',
    numeric: true,
    sort: (app) => app.roundCount || 0,
    cell: (app) => app.roundCount || <span className="ap-muted">0</span>,
  },
  {
    key: 'cv',
    label: 'CV',
    sort: (app) => app.resume?.label || '~',
    cell: (app) =>
      app.resume?.url ? (
        <a
          href={app.resume.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            openResume(app.resume);
          }}
        >
          {app.resume.label}
        </a>
      ) : (
        <span className="ap-muted">—</span>
      ),
  },
];

/**
 * Nulls last in both directions. "Sort by next round" is asking which is
 * soonest, and forty rows with nothing booked at the top would answer a
 * different question.
 */
function compare(a, b, dir) {
  if (a === b) return 0;
  if (a === null || a === undefined) return 1;
  if (b === null || b === undefined) return -1;
  return (a < b ? -1 : 1) * dir;
}

export function TableView({ apps, onOpen }) {
  const [sort, setSort] = useState({ key: 'applied', dir: -1 });

  const rows = useMemo(() => {
    const column = COLUMNS.find((item) => item.key === sort.key) || COLUMNS[0];
    return [...apps].sort((a, b) => compare(column.sort(a), column.sort(b), sort.dir));
  }, [apps, sort]);

  /*
    The first click sorts the way the question is usually asked: A to Z for a
    name, soonest first for what is coming up, and newest first for everything
    that is a date in the past.
  */
  const ASCENDING_FIRST = ['company', 'next', 'quiet'];
  const toggle = (key) =>
    setSort((current) =>
      current.key === key
        ? { key, dir: -current.dir }
        : { key, dir: ASCENDING_FIRST.includes(key) ? 1 : -1 },
    );

  return (
    <div className="ap-table-wrap">
      <table className="ap-table">
        <thead>
          <tr>
            {COLUMNS.map((column) => (
              <th
                key={column.key}
                className={column.numeric ? 'num' : ''}
                aria-sort={
                  sort.key === column.key ? (sort.dir > 0 ? 'ascending' : 'descending') : 'none'
                }
              >
                <button type="button" onClick={() => toggle(column.key)}>
                  {column.label}
                  {sort.key === column.key &&
                    (sort.dir > 0 ? <IconChevronsUp size={10} /> : <IconChevronsDown size={10} />)}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((app) => (
            <tr
              key={app.id}
              data-hue={stageHue(app.stage)}
              tabIndex={0}
              onClick={() => onOpen(app)}
              onKeyDown={(event) => event.key === 'Enter' && onOpen(app)}
            >
              {COLUMNS.map((column) => (
                <td key={column.key} className={column.numeric ? 'num mono' : ''}>
                  {column.cell(app)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
