import { useEffect, useMemo, useRef, useState } from 'react';
import { toDdl } from '../../../design/schema/ddl.js';
import { useLocalState } from '../../../hooks/useLocalState.js';
import { Modal } from '../../ui/Modal.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';
import { useEditor, useUi } from '../canvas/hooks.js';
import { PanelSplitter } from '../workspace/PanelSplitter.jsx';
import { DbmlEditor } from './DbmlEditor.jsx';
import { SqlLabDrawer } from './SqlLabDrawer.jsx';
import { useSchemaModel, useSchemaText } from './useSchema.js';

/**
 * The text half of a schema board: DBML on the left, the diagram on the right,
 * one source of truth.
 *
 * Typing edits the text (the diagram follows); the caret highlights the table
 * and column it is in; double-clicking a table in the diagram jumps here.
 * Import turns pasted SQL into DBML, Export produces DBML or DDL, Auto-arrange
 * lays the tables out again, and SQL Lab runs the schema in SQLite in the
 * browser to try queries against it.
 */

function download(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** The table and column whose text contains `offset`. */
function locate(model, offset) {
  for (const table of model.tables) {
    if (!table.span || offset < table.span.start || offset > table.span.end) continue;
    const column = table.columns.find((c) => c.span && offset >= c.span.start && offset <= c.span.end);
    return { table: table.key, column: column?.name || null };
  }
  return null;
}

export function SchemaPanel({ boardName }) {
  const editor = useEditor();
  const schema = editor.schema;
  const text = useSchemaText();
  const model = useSchemaModel();
  const readOnly = useUi((s) => s.readOnly);
  const reveal = useUi((s) => s.schemaReveal);
  const [width, setWidth] = useLocalState('sd-schema-w', 400);
  const [open, setOpen] = useLocalState('sd-schema-open', true);
  const [exportMenu, setExportMenu] = useState(false);
  const [importing, setImporting] = useState(false);
  const [lab, setLab] = useState(false);
  const editorRef = useRef(null);
  const exportRef = useRef(null);

  useEffect(() => {
    if (!reveal) return;
    if (!open) setOpen(true);
    requestAnimationFrame(() => editorRef.current?.reveal(reveal));
    editor.ui.set({ schemaReveal: null });
  }, [reveal, open, setOpen, editor]);

  const problems = useMemo(() => model.diagnostics.filter((d) => d.severity === 'error'), [model]);
  const warnings = model.diagnostics.length - problems.length;
  const slug = (boardName || 'schema').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'schema';

  if (!open) {
    return (
      <button type="button" className="sd-schema-reopen" onClick={() => setOpen(true)} title="Show the DBML text" aria-label="Show the DBML text" data-sd-control>
        DBML
      </button>
    );
  }

  return (
    <>
      <aside className="sd-schema-panel" style={{ width }} aria-label="Schema text">
        <div className="sd-schema-head">
          <div className="sd-schema-title">
            <b>DBML</b>
            <small>
              {model.tables.length} table{model.tables.length === 1 ? '' : 's'} · {model.relations.length} relation{model.relations.length === 1 ? '' : 's'}
            </small>
          </div>
          <div className="sd-schema-actions">
            {!readOnly && (
              <button type="button" className="btn ghost sm" onClick={() => setImporting(true)}>
                Import SQL
              </button>
            )}
            <button ref={exportRef} type="button" className="btn ghost sm" aria-haspopup="menu" aria-expanded={exportMenu} onClick={() => setExportMenu((v) => !v)}>
              Export
            </button>
            <button type="button" className={`btn ${lab ? 'primary' : 'ghost'} sm`} onClick={() => setLab((v) => !v)} title="Run this schema in SQLite and query it">
              SQL Lab
            </button>
            <button type="button" className="sd-icon-btn" onClick={() => setOpen(false)} title="Hide the text" aria-label="Hide the text">
              ‹
            </button>
          </div>
        </div>

        <DbmlEditor
          ref={editorRef}
          value={text}
          readOnly={readOnly}
          diagnostics={model.diagnostics}
          onChange={(next) => schema.setText(next)}
          onCaret={(offset) => editor.ui.set({ schemaFocus: locate(model, offset) })}
        />

        <div className={`sd-schema-foot ${problems.length ? 'has-errors' : ''}`}>
          {problems.length ? (
            <button type="button" className="sd-schema-problem" onClick={() => editorRef.current?.reveal(problems[0].span)} title="Show in the text">
              {problems.length} error{problems.length === 1 ? '' : 's'}: {problems[0].message}
            </button>
          ) : (
            <span>{warnings ? `${warnings} warning${warnings === 1 ? '' : 's'}` : 'No errors'}</span>
          )}
          {!readOnly && (
            <span className="sd-schema-foot-actions">
              <button type="button" className="link-btn" onClick={() => schema.addTable()}>
                Add table
              </button>
              <button type="button" className="link-btn" onClick={() => schema.autoArrange()} disabled={!model.tables.length}>
                Auto-arrange
              </button>
            </span>
          )}
        </div>
      </aside>
      <PanelSplitter side="right" value={width} min={280} max={720} onChange={setWidth} onCollapse={() => setOpen(false)} label="Resize schema text" />

      {exportMenu && (
        <ActionMenu
          anchor={exportRef.current}
          returnFocus={exportRef.current}
          label="Export schema"
          onClose={() => setExportMenu(false)}
          items={[
            { label: 'Copy DBML', onSelect: () => navigator.clipboard?.writeText(text) },
            { label: 'Download .dbml', onSelect: () => download(`${slug}.dbml`, text) },
            'sep',
            { label: 'PostgreSQL DDL', onSelect: () => download(`${slug}.postgres.sql`, toDdl(model, 'postgres')), disabled: !model.tables.length },
            { label: 'MySQL DDL', onSelect: () => download(`${slug}.mysql.sql`, toDdl(model, 'mysql')), disabled: !model.tables.length },
            { label: 'SQLite DDL', onSelect: () => download(`${slug}.sqlite.sql`, toDdl(model, 'sqlite')), disabled: !model.tables.length },
          ]}
        />
      )}

      {importing && <ImportSqlDialog onClose={() => setImporting(false)} hasText={Boolean(text.trim())} onImport={(sql, replace) => schema.importSql(sql, { replace })} />}
      {lab && <SqlLabDrawer model={model} onClose={() => setLab(false)} left={width + 18} />}
    </>
  );
}

function ImportSqlDialog({ onClose, onImport, hasText }) {
  const [sql, setSql] = useState('');
  const [result, setResult] = useState(null);
  const areaRef = useRef(null);
  const run = (replace) => {
    const outcome = onImport(sql, replace);
    if (outcome.imported && !outcome.warnings.length) onClose();
    else setResult(outcome);
  };
  return (
    <Modal title="Import SQL" onClose={onClose} size="lg" initialFocus={areaRef}>
      <div className="modal-body sd-import">
        <p className="sd-import-hint">
          Paste <code>CREATE TABLE</code>, <code>ALTER TABLE … FOREIGN KEY</code>, <code>CREATE INDEX</code> and <code>CREATE TYPE … AS ENUM</code> statements from PostgreSQL or MySQL — a
          <code>pg_dump --schema-only</code> or <code>SHOW CREATE TABLE</code> works as it is. Everything else is skipped.
        </p>
        <textarea ref={areaRef} className="sd-import-text mono" value={sql} onChange={(e) => setSql(e.target.value)} spellCheck={false} placeholder="CREATE TABLE users (&#10;  id bigint PRIMARY KEY,&#10;  email varchar(255) NOT NULL UNIQUE&#10;);" />
        {result && (
          <div className={`sd-import-result ${result.imported ? 'ok' : 'bad'}`}>
            {result.imported ? 'Imported, with notes:' : 'Nothing imported:'}
            <ul>
              {result.warnings.slice(0, 12).map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
      <div className="modal-foot">
        <button type="button" className="btn ghost" onClick={onClose}>
          {result?.imported ? 'Done' : 'Cancel'}
        </button>
        {hasText && (
          <button type="button" className="btn ghost" disabled={!sql.trim()} onClick={() => run(false)}>
            Add to schema
          </button>
        )}
        <button type="button" className="btn primary" disabled={!sql.trim()} onClick={() => run(true)}>
          {hasText ? 'Replace schema' : 'Import'}
        </button>
      </div>
    </Modal>
  );
}
