import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { sqlApi } from '../../api/index.js';
import { errorMessage } from '../../api/http.js';
import { useEditorialGate } from '../../hooks/useEditorialGate.js';
import { useLocalState } from '../../hooks/useLocalState.js';
import { compareResults, diffCells } from '../../sql/compare.js';
import { useSqlEngine } from '../../sql/useSqlEngine.js';
import { useSql } from '../../store/SqlContext.jsx';
import { useAttemptTimer } from '../../store/AttemptTimerContext.jsx';
import { inline } from '../problem/inline.jsx';
import { notePeek } from '../problem/peeks.js';
import { IconCheck, IconClose, IconExternal, IconLock } from '../ui/Icons.jsx';
import { useDialog } from '../ui/useDialog.js';
import { SqlBlock, SqlEditor } from './SqlEditor.jsx';
import { SqlResultGrid } from './SqlResultGrid.jsx';

/**
 * Where you actually write the query.
 *
 * The shell is the roadmap's own reader — `.reader-overlay` and the `.reader-*`
 * layout in app.css — rather than markup of its own, the same decision
 * `CPGuideReader` records: same job, same full-viewport reading problem, and an
 * earlier version of that file which invented its own class names shipped a
 * dialog no stylesheet had ever heard of. What is Lab-specific is the palette,
 * and that arrives through `.sql-root` on the overlay.
 *
 * Two panes rather than the reader's column-and-rail: the statement and its
 * tables on the left, the editor and what it returned on the right. That is the
 * one structural difference, and it is the point of the screen — you are meant
 * to be able to see the question and your answer at the same time.
 */
export function SqlWorkbench({ problem: row, onClose }) {
  const { markSolved, setProgress } = useSql();
  const { run, warm, busy } = useSqlEngine();
  const timer = useAttemptTimer();

  const panelRef = useRef(null);
  const titleId = useId();
  useDialog(panelRef, { onClose });

  /** The full problem — schema, sample rows, expected grid — fetched on open. */
  const [full, setFull] = useState(null);
  const [loadError, setLoadError] = useState(null);

  /*
    The draft is kept per problem rather than per session: closing the workbench
    to go and read a Learn topic and coming back to an empty box is the one way
    this screen could lose somebody's work.
  */
  const [drafts, setDrafts] = useLocalState('sql-drafts', {});
  const draft = drafts[row._id] ?? '';
  const setDraft = useCallback(
    (value) => setDrafts((prev) => ({ ...prev, [row._id]: value })),
    [row._id, setDrafts],
  );

  const [result, setResult] = useState(null);
  const [verdict, setVerdict] = useState(null);
  const [runError, setRunError] = useState(null);
  const [hintsShown, setHintsShown] = useState(0);
  const [showSolution, setShowSolution] = useState(false);
  const [justSolved, setJustSolved] = useState(false);

  const progress = row.progress || {};
  const gate = useEditorialGate(row._id, progress);

  useEffect(() => {
    let live = true;
    sqlApi
      .problem(row._id)
      .then((p) => live && setFull(p))
      .catch((err) => live && setLoadError(errorMessage(err, 'Could not load this problem')));
    return () => {
      live = false;
    };
  }, [row._id]);

  /*
    Start fetching the engine as soon as the problem is on screen. It is ~700 KB
    and it is wanted a minute later, so overlapping the download with reading
    the statement is the difference between Run being instant and Run having a
    visible pause the first time.
  */
  useEffect(() => {
    warm();
  }, [warm]);

  const onRun = useCallback(async () => {
    if (!full) return;
    setRunError(null);

    const { ok, error, result: got } = await run({
      setupSql: full.setupSql,
      sql: draft,
      checkSql: full.checkSql || undefined,
    });

    if (!ok) {
      setResult(null);
      setVerdict(null);
      setRunError(error);
      return;
    }

    setResult(got);

    const expected = { columns: full.expected?.columns || [], values: full.expected?.rows || [] };
    const outcome = compareResults(got, expected, { orderMatters: full.orderMatters });
    setVerdict(outcome);

    if (outcome.pass) {
      const saved = await markSolved(row._id, draft, 0);
      /*
        Only the *first* pass says so. Re-running a solved problem is an
        ordinary thing to do here — the query is right there and running it is
        free — and celebrating it every time would make the message mean
        nothing.
      */
      if (saved?.firstSolve) setJustSolved(true);
    } else if (progress.status !== 'solved') {
      /*
        A failed run marks the problem attempted, which is what starts the
        editorial clock. It is deliberately not a full logged sitting: that is
        an act you take, with minutes and an outcome on it, and a wrong query
        is not a sitting.
      */
      setProgress(row._id, { status: 'attempted' });
    }
  }, [draft, full, markSolved, progress.status, row._id, run, setProgress]);

  const marks =
    verdict && !verdict.pass && full
      ? diffCells(
          result,
          { columns: full.expected?.columns || [], values: full.expected?.rows || [] },
          { orderMatters: full.orderMatters },
        )
      : [];

  const revealSolution = () => {
    setShowSolution(true);
    if (progress.status !== 'solved') notePeek(row._id);
  };

  const expectedRows = full?.expected?.rows?.length ?? 0;

  return (
    <div className="reader-overlay sql-root sql-workbench">
      <div className="reader" role="dialog" aria-modal="true" aria-labelledby={titleId} ref={panelRef} tabIndex={-1}>
        <header className="reader-head">
          <button type="button" className="reader-back" onClick={onClose}>
            ← SQL Lab
          </button>

          <span className="reader-crumb">
            <span className={`sql-diff-tag diff-${row.difficulty.toLowerCase()}`}>{row.difficulty}</span>
            <span className="sql-cat-tag mono" data-category={row.category}>
              {row.category}
            </span>
          </span>

          <span className="spacer" />

          {progress.status === 'solved' && (
            <span className="sql-solved-tag mono">
              <IconCheck size={11} /> solved
            </span>
          )}

          {/*
            `pause` rather than `reset`: banking the minutes is the point — they
            are what opens the solution, and they become the `minutes` on a
            logged sitting. Discarding them on a second click would make the
            clock a thing you have to be careful with.
          */}
          <button
            type="button"
            className={`sql-clock ${timer.isOn(row._id) ? 'on' : ''}`}
            onClick={() => (timer.isOn(row._id) ? timer.pause() : timer.start(row._id, row.title))}
            title={
              timer.isOn(row._id)
                ? 'Pause the clock — the minutes are kept'
                : 'Start the clock — it counts towards unlocking the solution'
            }
          >
            {timer.isOn(row._id) ? 'Pause' : 'Clock'}
          </button>

          <span className="reader-esc">
            <kbd className="mono">Esc</kbd>
          </span>
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={14} />
          </button>
        </header>

        <div className="sql-bench">
          {/* ------------------------------------------------------ the question */}
          <section className="sql-pane sql-pane-left">
            <h1 id={titleId} className="sql-title">
              {row.title}
            </h1>

            <div className="sql-statement">
              {(full?.statement || row.statement || '').split('\n\n').map((para, i) => (
                <p key={i}>{inline(para)}</p>
              ))}
            </div>

            {loadError && <p className="sql-error">{loadError}</p>}

            {!full && !loadError && (
              <div className="sql-loading">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div className="skeleton" key={i} />
                ))}
              </div>
            )}

            {full?.tables?.map((t) => (
              <SqlResultGrid
                key={t.name}
                caption={t.name}
                columns={t.columns}
                rows={t.rows}
                tone="data"
                note={t.truncated ? 'first rows' : ''}
              />
            ))}

            {full && (
              <SqlResultGrid
                caption="Expected"
                columns={full.expected?.columns || []}
                rows={full.expected?.rows || []}
                tone="expected"
                note={`${expectedRows} row${expectedRows === 1 ? '' : 's'}${full.orderMatters ? ' · order matters' : ''}`}
              />
            )}

            {full?.dialectNote && (
              <aside className="sql-note">
                <span className="sql-note-tag mono">Dialect</span>
                <p>{inline(full.dialectNote)}</p>
              </aside>
            )}

            {/* --------------------------------------------------------- hints */}
            {full?.hints?.length > 0 && (
              <div className="sql-hints">
                {full.hints.slice(0, hintsShown).map((h, i) => (
                  <p className="sql-hint" key={i}>
                    <span className="mono">{i + 1}</span>
                    {inline(h)}
                  </p>
                ))}
                {hintsShown < full.hints.length && (
                  <button
                    type="button"
                    className="btn ghost"
                    onClick={() => setHintsShown((n) => n + 1)}
                  >
                    {hintsShown === 0 ? 'Show a hint' : 'Another hint'}
                    <span className="mono dim"> {hintsShown}/{full.hints.length}</span>
                  </button>
                )}
              </div>
            )}

            {/* ------------------------------------------------------ solution */}
            {full && (
              <div className="sql-solution">
                {showSolution ? (
                  <>
                    <SqlBlock code={full.solutionSql} caption="One way to write it" />
                    {full.explanation && (
                      <div className="sql-explain">
                        {full.explanation.split('\n\n').map((para, i) => (
                          <p key={i}>{inline(para)}</p>
                        ))}
                      </div>
                    )}
                  </>
                ) : gate.unlocked ? (
                  <button type="button" className="btn" onClick={revealSolution}>
                    Show a solution
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn ghost sql-locked"
                    onClick={(e) => e.preventDefault()}
                    title={`${gate.minutesLeft} more ${gate.minutesLeft === 1 ? 'minute' : 'minutes'} on this problem first. ${
                      gate.running ? 'The clock is running.' : 'Start the clock and it counts.'
                    }`}
                  >
                    <IconLock size={11} /> Solution — {gate.minutesLeft} min
                  </button>
                )}

                {full.learnTopic && (
                  <a
                    className="sql-learn-link"
                    href={`/learn/${full.learnTopic}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Read the topic <IconExternal size={11} />
                  </a>
                )}
                {full.source?.url && (
                  <a className="sql-learn-link" href={full.source.url} target="_blank" rel="noreferrer">
                    Original <IconExternal size={11} />
                  </a>
                )}
              </div>
            )}
          </section>

          {/* -------------------------------------------------------- the answer */}
          <section className="sql-pane sql-pane-right">
            <SqlEditor
              value={draft}
              onChange={setDraft}
              onRun={onRun}
              busy={busy}
              disabled={!full}
              placeholder={full ? 'SELECT …' : 'Loading the problem…'}
            />

            {runError && (
              <div className="sql-verdict tone-error">
                <span className="sql-verdict-tag mono">Error</span>
                <p className="mono">{runError}</p>
              </div>
            )}

            {verdict && !runError && (
              <div className={`sql-verdict ${verdict.pass ? 'tone-pass' : 'tone-fail'}`}>
                <span className="sql-verdict-tag mono">{verdict.pass ? 'Correct' : 'Not yet'}</span>
                <p>{verdict.detail}</p>
                {justSolved && verdict.pass && (
                  <p className="sql-first">
                    First solve — it is on the revision ladder now.
                  </p>
                )}
              </div>
            )}

            {result && (
              <SqlResultGrid
                caption="Your result"
                columns={result.columns}
                rows={result.values}
                tone="result"
                marks={marks}
                note={`${result.values.length} row${result.values.length === 1 ? '' : 's'}`}
              />
            )}

            {progress.status === 'solved' && !result && (
              <p className="sql-idle">
                You have solved this one. Run it again to see the rows, or open another.
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
