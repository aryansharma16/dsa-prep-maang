import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { cpApi, sqlApi } from '../../api/index.js';
import { useAuth } from '../../store/AuthContext.jsx';
import { MODULE_NAV, moduleVisible } from '../../store/modules.js';
import { useRoadmap } from '../../store/RoadmapContext.jsx';

/**
 * The solved counter in the top bar, for every curriculum rather than one.
 *
 * There are three now — the roadmap, the Pro Coder ladder and the SQL Lab — and
 * the bar has room for one. Three counters side by side would be three numbers
 * competing at the end of a bar that already holds two timers, a button, a
 * theme picker and an avatar; so they take turns instead, one every six
 * seconds.
 *
 * ---------------------------------------------------------------------------
 * Why the shell fetches these itself.
 *
 * `RoadmapProvider` wraps the whole app, so its totals are free. `CPProvider`
 * and `SqlProvider` are mounted **per route** — see App.jsx — precisely so that
 * loading the app does not pull down two problem banks nobody asked for. That
 * decision is right and this component does not get to undo it, so it reads the
 * roadmap from context and asks the two `/stats` endpoints for the others.
 *
 * Those endpoints exist for exactly this shape of question: they count on the
 * server and return totals, rather than shipping 1,100 rows so the client can
 * call `.length`. One request each, once per mount.
 * ---------------------------------------------------------------------------
 *
 * A module the super admin has hidden is not fetched and not shown — the same
 * `moduleVisible` gate the sidebar's own links go through.
 */

/** How long each curriculum holds the slot. */
const DWELL_MS = 6000;

/**
 * The label and destination for a module, read from the same list the sidebar's
 * links are built from.
 *
 * Hard-coding `'Pro Coder'` and `/cp` here would be two more places to remember
 * on the day a module is renamed or remounted — and the key is not the path
 * (`procoder` lives at `/cp`), which is exactly the kind of mismatch a second
 * copy gets wrong.
 */
const moduleNav = (key) => MODULE_NAV.find((m) => m.key === key);

export function ProgressRotator() {
  const { totals } = useRoadmap();
  const { modules } = useAuth();
  const navigate = useNavigate();

  const hasCp = moduleVisible(modules, 'procoder');
  const hasSql = moduleVisible(modules, 'sql');

  const [cp, setCp] = useState(null);
  const [sql, setSql] = useState(null);
  const [at, setAt] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    let live = true;
    /*
      Failure is silent on purpose. This is a counter in a chrome bar: if the
      ladder's stats do not come back, the right outcome is a rotation with one
      fewer slide, not an error toast over somebody's work.
    */
    if (hasCp) cpApi.stats().then((d) => live && setCp(d.totals)).catch(() => {});
    if (hasSql) {
      sqlApi
        .stats()
        .then((d) => {
          if (!live) return;
          /*
            `/sql/stats` answers per category, because that is what the Lab's
            rail draws. The bar wants one number, and summing the categories is
            the only place in the app that needs it — not worth a second
            endpoint, and not worth widening the first one.
          */
          const sum = (d.categories || []).reduce(
            (acc, c) => ({ total: acc.total + c.total, solved: acc.solved + c.solved }),
            { total: 0, solved: 0 },
          );
          setSql(sum);
        })
        .catch(() => {});
    }
    return () => {
      live = false;
    };
  }, [hasCp, hasSql]);

  /*
    Only curriculums that have something to count. A deck entry for a module
    whose bank has not been seeded would rotate to `0 / 0 solved`, which reads
    as a bug rather than as an empty state.
  */
  const decks = useMemo(
    () =>
      [
        { key: 'roadmap', label: 'Roadmap', to: '/', ...totals },
        hasCp && cp
          ? { key: 'procoder', label: moduleNav('procoder')?.label, to: moduleNav('procoder')?.to, ...cp }
          : null,
        hasSql && sql
          ? { key: 'sql', label: moduleNav('sql')?.label, to: moduleNav('sql')?.to, ...sql }
          : null,
      ].filter((d) => d && d.total > 0),
    [totals, cp, sql, hasCp, hasSql],
  );

  /*
    A deck arriving late must not leave the index pointing past the end — the
    two fetches resolve after the first render, so the list grows underneath
    this. Clamping on read rather than in an effect avoids a frame of nothing.
  */
  const index = decks.length ? at % decks.length : 0;
  const deck = decks[index];

  const advance = useCallback(() => setAt((n) => n + 1), []);

  useEffect(() => {
    /*
      Held while the pointer or the keyboard is on it, which is the pause this
      needs to have: auto-advancing text that cannot be stopped is unreadable
      to anyone who needs longer than six seconds, and unclickable to anyone
      who reached for the slide that just left.
    */
    if (decks.length < 2 || held) return undefined;
    const id = setInterval(advance, DWELL_MS);
    return () => clearInterval(id);
  }, [decks.length, held, advance]);

  if (!deck) return null;

  const pct = deck.total ? Math.round((deck.solved / deck.total) * 100) : 0;

  return (
    <div
      className="overall rotator"
      onMouseEnter={() => setHeld(true)}
      onMouseLeave={() => setHeld(false)}
      onFocus={() => setHeld(true)}
      onBlur={() => setHeld(false)}
    >
      <button
        type="button"
        className="rotator-slide"
        /* `key` on the slide, so React swaps the element rather than mutating
           it — which is what lets the fade actually run on every change. */
        key={deck.key}
        onClick={() => navigate(deck.to)}
        title={`${deck.label} — ${deck.solved} of ${deck.total} solved (${pct}%). Click to open.${
          decks.length > 1 ? ' Hover to hold.' : ''
        }`}
      >
        <span className="rotator-label">{deck.label}</span>
        <span>
          <b>{deck.solved}</b> / {deck.total} solved
        </span>
        <span className="bar" style={{ width: 64 }}>
          <span style={{ width: `${pct}%` }} />
        </span>
      </button>

      {/* One pip per curriculum, so the slot reads as a rotation rather than as
          a number that changed on its own while you were looking away. */}
      {decks.length > 1 && (
        <span className="rotator-pips" aria-hidden="true">
          {decks.map((d, i) => (
            <span key={d.key} className={i === index ? 'on' : ''} />
          ))}
        </span>
      )}

      {/*
        The rotation is decoration; this is the accessible reading of it. A live
        region would announce every six seconds and make the bar unusable with a
        screen reader on, so the full picture is stated once, politely, and does
        not move.
      */}
      <span className="sr-only">
        {decks.map((d) => `${d.label}: ${d.solved} of ${d.total} solved.`).join(' ')}
      </span>
    </div>
  );
}
