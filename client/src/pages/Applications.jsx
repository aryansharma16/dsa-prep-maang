import { useCallback, useEffect, useMemo, useState } from 'react';

import { applicationsApi } from '../api/index.js';
import { errorMessage } from '../api/http.js';
import { AddApplicationModal } from '../components/applications/AddApplicationModal.jsx';
import { ApplicationDrawer } from '../components/applications/ApplicationDrawer.jsx';
import { ColumnLabelsModal } from '../components/applications/ColumnLabelsModal.jsx';
import { PipelineView } from '../components/applications/PipelineView.jsx';
import { RoundModal } from '../components/applications/RoundModal.jsx';
import { columnOf, defaultStageFor } from '../components/applications/vocab.js';
import { CalendarView } from '../components/applications/views/CalendarView.jsx';
import { FeedView } from '../components/applications/views/FeedView.jsx';
import { InsightsView } from '../components/applications/views/InsightsView.jsx';
import { TableView } from '../components/applications/views/TableView.jsx';
import { FiltersModal } from '../components/filters/FiltersModal.jsx';
import { ConfirmDialog } from '../components/ui/ConfirmDialog.jsx';
import {
  IconBoard,
  IconCalendar,
  IconChart,
  IconEdit,
  IconFilter,
  IconList,
  IconPlus,
  IconSearch,
  IconTable,
} from '../components/ui/Icons.jsx';
import { APPLICATION_FILTERS } from '../filters/applications.js';
import { activeCount, clearPatch, matchesFilters } from '../filters/spec.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useSavedFilters } from '../hooks/useSavedFilters.js';
import { useToast } from '../store/ToastContext.jsx';

/**
 * The job hunt.
 *
 * One request paints the page — the lanes and every application together, with
 * the question bodies projected away, which is what makes embedding them safe.
 * Opening a card fetches that one record in full; everything else is derived
 * here from what already arrived.
 *
 * Writes are optimistic where the answer is obvious and not where it is not.
 * A drag is optimistic, because moving a card is a gesture whose result you can
 * see and a 200ms wait would make the board feel like it is arguing with you.
 * Everything inside the drawer takes the server's answer, because almost every
 * one of those writes changes something derived — `nextRoundAt`, the timeline,
 * `roundCount` — and guessing at four derived fields whose rules live on the
 * server is how a screen starts disagreeing with the database it is showing.
 */
/**
 * Five ways to look at the same applications.
 *
 * Every one reads the list this page already holds, after search and filters —
 * so narrowing to "referred only" narrows all five, and switching between them
 * is a re-render rather than a request. The one exception is the timeline,
 * which asks the server for the merged event feed so it words events exactly as
 * the drawer does; see FeedView.
 *
 * Board is first and the default because it is the one you act on. The other
 * four are for reading: a table to sort, a calendar for what is booked, a
 * timeline for what happened, and the numbers.
 */
const VIEWS = [
  { id: 'board', label: 'Board', Icon: IconBoard },
  { id: 'table', label: 'Table', Icon: IconTable },
  { id: 'calendar', label: 'Calendar', Icon: IconCalendar },
  { id: 'feed', label: 'Timeline', Icon: IconList },
  { id: 'insights', label: 'Insights', Icon: IconChart },
];

export function Applications() {
  const { success, error: toastError } = useToast();

  const [board, setBoard] = useState(null);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);

  const [query, setQuery] = useState('');
  const [filters, setFilters] = useSavedFilters('applications', APPLICATION_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [openId, setOpenId] = useState(null);
  const [record, setRecord] = useState(null);
  const [adding, setAdding] = useState(null);
  const [editingRound, setEditingRound] = useState(null);
  const [renaming, setRenaming] = useState(false);
  /* Remembered per browser, the way the task board's view is — it is how you
     like to look at things, not a fact about the applications. */
  const [view, setView] = useLocalState('applications:view', 'board');
  const current = VIEWS.some((item) => item.id === view) ? view : 'board';
  const [confirm, setConfirm] = useState(null);

  /* ------------------------------------------------------------------ load */

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await applicationsApi.board();
      setBoard(data.board);
      setApps(data.applications);
      setLoadError('');
    } catch (err) {
      setLoadError(errorMessage(err, 'Could not load your applications'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /*
    The drawer's record is the full one and the board's is the card. Keeping
    both means a write from the drawer can update the card in place without a
    second request, and the card list stays the single source for what is drawn
    behind the drawer.
  */
  useEffect(() => {
    if (!openId) {
      setRecord(null);
      return;
    }
    let live = true;
    applicationsApi
      .get(openId)
      .then((data) => live && setRecord(data.application))
      .catch((err) => {
        if (!live) return;
        toastError(errorMessage(err, 'Could not open that application'));
        setOpenId(null);
      });
    return () => {
      live = false;
    };
  }, [openId, toastError]);

  /** One answer from the server replaces both copies. */
  const absorb = useCallback((application) => {
    setRecord(application);
    setApps((prev) =>
      prev.map((app) => (app.id === application.id ? { ...app, ...application } : app)),
    );
  }, []);

  const run = useCallback(
    async (work, message) => {
      setBusy(true);
      try {
        const application = await work();
        if (application) absorb(application);
        return application;
      } catch (err) {
        toastError(errorMessage(err, message || 'That did not save'));
        return null;
      } finally {
        setBusy(false);
      }
    },
    [absorb, toastError],
  );

  /* --------------------------------------------------------------- shaping */

  const columns = useMemo(
    () => (board?.columns || []).filter((column) => !column.hidden),
    [board],
  );

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return apps.filter((app) => {
      if (!matchesFilters(APPLICATION_FILTERS, filters, app)) return false;
      if (!needle) return true;
      /*
        Searches what is on the card plus the two things you actually try to
        find an application by months later: who referred you, and the team.
        Not the question text — that lives behind a projection and is not
        loaded here, and a search box that silently covers some records and not
        others is worse than one with a stated reach.
      */
      return [app.company, app.role, app.team, app.level, app.location, app.referrer?.name]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [apps, filters, query]);

  const byColumn = useMemo(() => {
    const map = new Map(columns.map((column) => [column.key, []]));
    visible.forEach((app) => {
      const key = app.column || columnOf(app.stage);
      if (map.has(key)) map.get(key).push(app);
    });
    map.forEach((list) => list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0)));
    return map;
  }, [columns, visible]);

  const tagOptions = useMemo(() => {
    const seen = new Set();
    apps.forEach((app) => (app.tags || []).forEach((tag) => seen.add(tag)));
    return [...seen].sort().map((tag) => ({ value: tag, label: tag }));
  }, [apps]);

  const filterCount = activeCount(APPLICATION_FILTERS, filters);
  const narrowing = activeCount(APPLICATION_FILTERS, filters, 'dialog');
  const patchFilters = (changes) => setFilters((prev) => ({ ...prev, ...changes }));

  /* The drawer must close if its record disappears — deleted here or elsewhere. */
  useEffect(() => {
    if (openId && !loading && !apps.some((app) => app.id === openId)) setOpenId(null);
  }, [openId, apps, loading]);

  /* --------------------------------------------------------------- writing */

  const create = async (body) => {
    const data = await applicationsApi.create(body);
    setApps((prev) => [data.application, ...prev]);
    setOpenId(data.application.id);
    return data.application;
  };

  /**
   * A drag.
   *
   * Optimistic, and the only write here that is. `useBoardDrag` hands back the
   * destination lane in the order it was drawn, which is exactly what the
   * server takes — so the local list is rewritten to match and the request goes
   * out behind it. A failure reloads rather than trying to invert the move: a
   * board is a whole arrangement, and unwinding one card of it by hand is how
   * you end up with a local order nothing agrees with.
   */
  const move = async ({ id, status: column, ids }) => {
    const before = apps;
    setApps((prev) =>
      prev.map((app) => {
        const index = ids.indexOf(app.id);
        if (app.id === id) return { ...app, column, order: index };
        return index === -1 ? app : { ...app, order: index };
      }),
    );

    try {
      const application = await applicationsApi.move({ id, column, ids });
      absorb(application);
    } catch (err) {
      setApps(before);
      toastError(errorMessage(err, 'Could not move that'));
    }
  };

  const remove = (app) =>
    setConfirm({
      title: `Delete ${app.company}?`,
      message: 'The rounds and every question you logged against them go with it.',
      detail: 'You can put it back from the toast that follows.',
      confirmLabel: 'Delete',
      tone: 'danger',
      run: async () => {
        try {
          await applicationsApi.remove(app.id);
          setApps((prev) => prev.filter((row) => row.id !== app.id));
          setOpenId(null);
          success(`${app.company} deleted`);
        } catch (err) {
          toastError(errorMessage(err, 'Could not delete that'));
        }
      },
    });

  const rounds = {
    add: () => setEditingRound({ applicationId: openId, round: null }),
    edit: (round) => setEditingRound({ applicationId: openId, round }),
    remove: (round) =>
      setConfirm({
        title: 'Delete this round?',
        message: 'Its questions and your answers go with it.',
        /*
          Worth saying, because it is the one thing people expect to break: a
          post-mortem that named this round keeps saying which *kind* of round
          it was, because the type is stored beside the reference.
        */
        detail: 'A post-mortem pointing at it will still say which kind of round it was.',
        confirmLabel: 'Delete',
        tone: 'danger',
        run: () =>
          run(
            () => applicationsApi.removeRound(openId, round.id),
            'Could not delete that round',
          ),
      }),
  };

  const questions = {
    add: (roundId, text) =>
      run(() => applicationsApi.addQuestion(openId, roundId, { text }), 'Could not add that'),
    update: (roundId, questionId, patch) =>
      run(
        () => applicationsApi.updateQuestion(openId, roundId, questionId, patch),
        'Could not save that',
      ),
    remove: (roundId, questionId) =>
      run(
        () => applicationsApi.removeQuestion(openId, roundId, questionId),
        'Could not remove that',
      ),
  };

  const touchpoints = {
    add: (body) => run(() => applicationsApi.addTouchpoint(openId, body), 'Could not save that'),
    remove: (touchpointId) =>
      run(() => applicationsApi.removeTouchpoint(openId, touchpointId), 'Could not remove that'),
  };

  /* ----------------------------------------------------------------- render */

  const total = apps.length;
  const live = apps.filter((app) => !['rejected', 'ghosted', 'withdrawn'].includes(app.stage))
    .length;

  return (
    <div className="ap-page">
      <header className="ap-head">
        {/*
          A static line rather than a `MotivationLine`. The motivational corpus
          is written against the curriculum — what you have solved, which
          patterns are weak — and none of its triggers knows anything about a
          job hunt. A line chosen from your roadmap progress under a page about
          rejections would be the app talking about something else.
        */}
        <div className="page-head">
          <h1>Applications</h1>
          <p>Where every company is, what they asked, and what you said.</p>
        </div>

        <div className="ap-head-actions">
          <button type="button" className="btn primary" onClick={() => setAdding('applied')}>
            <IconPlus size={12} />
            Add application
          </button>
        </div>
      </header>

      <div className="ap-bar">
        <div className="ap-views" role="tablist" aria-label="View">
          {VIEWS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={current === id}
              className={current === id ? 'on' : ''}
              onClick={() => setView(id)}
            >
              <Icon size={12} />
              <span>{label}</span>
            </button>
          ))}
        </div>

        <label className="ap-search">
          <IconSearch size={13} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search company, role, referrer…"
            aria-label="Search applications"
          />
        </label>

        {APPLICATION_FILTERS.fields
          .filter((field) => field.place === 'bar')
          .map((field) => (
            <button
              key={field.id}
              type="button"
              className={`toggle-chip ${filters[field.id] ? 'on' : ''}`}
              onClick={() => patchFilters({ [field.id]: !filters[field.id] })}
            >
              {field.label}
            </button>
          ))}

        <button
          type="button"
          className={`toggle-chip ${narrowing ? 'on' : ''}`}
          onClick={() => setFiltersOpen(true)}
        >
          <IconFilter size={12} />
          Filters
          {narrowing > 0 && <span className="mono">{narrowing}</span>}
        </button>

        {filterCount > 0 && (
          <button
            type="button"
            className="link-btn"
            onClick={() => patchFilters(clearPatch(APPLICATION_FILTERS))}
          >
            Clear all
          </button>
        )}

        <span className="spacer" />

        <span className="ap-count ap-muted">
          {live} live · {total} total
        </span>

        {current === 'board' && (
          <button
            type="button"
            className="icon-btn"
            title="Rename the columns"
            onClick={() => setRenaming(true)}
          >
            <IconEdit size={13} />
          </button>
        )}
      </div>

      {loadError && <div className="alert">{loadError}</div>}

      {loading ? (
        <div className="loading">Loading…</div>
      ) : !total ? (
        <div className="empty">
          <h3>Nothing here yet</h3>
          <p>
            Add the first company you applied to. A name is all it needs — the role, the link and
            who referred you can follow.
          </p>
          <button type="button" className="btn primary" onClick={() => setAdding('applied')}>
            <IconPlus size={12} />
            Add application
          </button>
        </div>
      ) : !visible.length ? (
        <div className="empty">
          <h3>Nothing matches</h3>
          <p>Try a different word, or clear the filters.</p>
        </div>
      ) : current === 'table' ? (
        <TableView apps={visible} onOpen={(app) => setOpenId(app.id)} />
      ) : current === 'calendar' ? (
        <CalendarView apps={visible} onOpen={(app) => setOpenId(app.id)} />
      ) : current === 'feed' ? (
        <FeedView apps={visible} onOpen={(app) => setOpenId(app.id)} />
      ) : current === 'insights' ? (
        <InsightsView apps={visible} />
      ) : (
        <PipelineView
          columns={columns}
          byColumn={byColumn}
          onMove={move}
          onAdd={(company, column) =>
            create({ company, stage: defaultStageFor(column) }).catch((err) =>
              toastError(errorMessage(err, 'Could not add that')),
            )
          }
          onOpen={(app) => setOpenId(app.id)}
        />
      )}

      {record && (
        <ApplicationDrawer
          app={record}
          board={board}
          busy={busy}
          onClose={() => setOpenId(null)}
          onPatch={(patch) =>
            run(() => applicationsApi.update(record.id, patch), 'Could not save that')
          }
          onStage={(stage) =>
            run(() => applicationsApi.setStage(record.id, { stage }), 'Could not change that')
          }
          onDelete={() => remove(record)}
          onPostMortem={(body) =>
            run(() => applicationsApi.setPostMortem(record.id, body), 'Could not save that')
          }
          rounds={rounds}
          questions={questions}
          touchpoints={touchpoints}
        />
      )}

      {adding && (
        <AddApplicationModal
          stage={adding}
          onCreate={create}
          onClose={() => setAdding(null)}
        />
      )}

      {editingRound && (
        <RoundModal
          round={editingRound.round}
          onSave={(body) =>
            editingRound.round
              ? applicationsApi
                  .updateRound(editingRound.applicationId, editingRound.round.id, body)
                  .then(absorb)
              : applicationsApi.addRound(editingRound.applicationId, body).then(absorb)
          }
          onClose={() => setEditingRound(null)}
        />
      )}

      {renaming && board && (
        <ColumnLabelsModal
          board={board}
          onSave={(body) => applicationsApi.updateBoard(body).then(setBoard)}
          onClose={() => setRenaming(false)}
        />
      )}

      {filtersOpen && (
        <FiltersModal
          spec={APPLICATION_FILTERS}
          value={filters}
          options={{ tags: tagOptions }}
          shown={visible.length}
          total={total}
          onChange={patchFilters}
          onClose={() => setFiltersOpen(false)}
          title="Filter applications"
        />
      )}

      {confirm && (
        <ConfirmDialog
          title={confirm.title}
          message={confirm.message}
          detail={confirm.detail}
          confirmLabel={confirm.confirmLabel}
          tone={confirm.tone}
          onConfirm={async () => {
            await confirm.run();
            setConfirm(null);
          }}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  );
}
