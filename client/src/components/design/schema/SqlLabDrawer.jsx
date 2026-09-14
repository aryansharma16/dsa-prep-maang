import { useMemo, useState } from 'react';
import { toDdl } from '../../../design/schema/ddl.js';
import { useSqlEngine } from '../../../sql/useSqlEngine.js';
import { SqlEditor } from '../../sql/SqlEditor.jsx';
import { SqlResultGrid } from '../../sql/SqlResultGrid.jsx';

/**
 * "Try in SQL Lab": the board's schema, created in SQLite in the browser, with a
 * query box — the SQL Lab's own engine (a worker running sql.js) and editor.
 *
 * Every run starts from a fresh database built from the current schema, so what
 * you query is always what the diagram shows. Nothing is sent to the server.
 * Foreign keys are enforced, so an insert that breaks one fails the way it would
 * in production.
 */

const STARTER = `-- The schema below is created fresh for every run.
-- Try an INSERT and a SELECT, or check a constraint:
SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name;`;

export function SqlLabDrawer({ model, onClose, left = 12 }) {
  const { run, busy } = useSqlEngine();
  const [sql, setSql] = useState(STARTER);
  const [outcome, setOutcome] = useState(null);
  const [showDdl, setShowDdl] = useState(false);
  const setupSql = useMemo(() => `PRAGMA foreign_keys = ON;\n${toDdl(model, 'sqlite')}`, [model]);

  const execute = async () => {
    const result = await run({ setupSql, sql });
    setOutcome(result);
  };

  const rows = outcome?.result?.values || [];
  return (
    // Over the diagram only, never over the DBML text beside it.
    <section className="sd-sqllab" aria-label="SQL Lab" data-sd-control style={{ left }}>
      <div className="sd-sqllab-head">
        <b>SQL Lab</b>
        <small>SQLite in your browser · {model.tables.length} tables · nothing leaves this page</small>
        <span className="sd-grow" />
        <button type="button" className="btn ghost sm" onClick={() => setShowDdl((v) => !v)}>
          {showDdl ? 'Hide DDL' : 'Show DDL'}
        </button>
        <button type="button" className="sd-icon-btn" onClick={onClose} aria-label="Close SQL Lab">
          ×
        </button>
      </div>
      <div className="sd-sqllab-body">
        <div className="sd-sqllab-editor">
          <SqlEditor value={sql} onChange={setSql} onRun={execute} busy={busy} />
        </div>
        <div className="sd-sqllab-output">
          {showDdl && <pre className="sd-sqllab-ddl mono">{setupSql}</pre>}
          {outcome?.error && <div className="sd-sqllab-error mono">{outcome.error.replace("The problem's setup failed to load", 'SQLite could not create this schema')}</div>}
          {outcome?.ok && outcome.result && <SqlResultGrid caption="Result" columns={outcome.result.columns} rows={rows} tone="data" note={`${rows.length} row${rows.length === 1 ? '' : 's'} · ${outcome.ms}ms`} />}
          {outcome?.ok && !outcome.result && <div className="sd-sqllab-note">Done in {outcome.ms}ms — the statement returned no rows.</div>}
          {!outcome && !showDdl && <div className="sd-sqllab-note">Run a query with ⌘/Ctrl + Enter.</div>}
        </div>
      </div>
    </section>
  );
}
