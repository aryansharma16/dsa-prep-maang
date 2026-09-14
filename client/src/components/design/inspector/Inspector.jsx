import { memo, useMemo, useRef, useState } from 'react';
import { shapeFor } from '../../../design/shapes/registry.js';
import { COLORS, STICKY_COLORS } from '../../../design/shapes/shapes.js';
import { TECH, TECH_BY_ID, TECH_CATEGORIES } from '../../../design/library/tech.js';
import { EXAMPLE_SCHEMA } from '../../../design/schema/assist.js';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import { measureTextBox } from '../../../design/text/measure.js';
import { useLocalState } from '../../../hooks/useLocalState.js';
import {
  IconAlignBottom,
  IconAlignCenterH,
  IconAlignLeft,
  IconAlignMiddleV,
  IconAlignRight,
  IconAlignTop,
  IconBringFront,
  IconCanvasBoard,
  IconCurve,
  IconElbow,
  IconLock,
  IconPanelRight,
  IconSchemaBoard,
  IconSendBack,
  IconStraight,
} from '../icons.jsx';
import { shallowArray, useEditor, useStoreValue, useUi } from '../canvas/hooks.js';
import { PanelSplitter } from '../workspace/PanelSplitter.jsx';
import { RelationInspector, SchemaInspector } from '../schema/SchemaInspector.jsx';
import { useSchemaModel } from '../schema/useSchema.js';

/**
 * The panel on the right: what is selected, and everything about it you can change.
 *
 * Built from the element definitions (design/shapes), never hand-written per
 * type. With several things selected it shows only the fields they all have,
 * and a field whose values differ reads "Mixed" until you set it — the way
 * Figma's properties panel behaves.
 *
 * Every change is one commit applied to the whole selection. Dragging a number
 * scrubs it, merged into one undo step.
 */

const ICONS = {
  alignLeft: IconAlignLeft,
  alignCenter: IconAlignCenterH,
  alignRight: IconAlignRight,
  straight: IconStraight,
  elbow: IconElbow,
  curve: IconCurve,
};

const MIXED = Symbol('mixed');
// Arrowheads, then crow's-foot ends for entity-relationship lines.
const CAPS = ['none', 'arrow', 'triangle', 'circle', 'diamond', 'bar', 'one', 'onlyOne', 'zeroOrOne', 'many', 'oneOrMany', 'zeroOrMany'];
const CAP_TITLES = { onlyOne: 'exactly one', zeroOrOne: 'zero or one', oneOrMany: 'one or many', zeroOrMany: 'zero or many' };

export const Inspector = memo(function Inspector({ node }) {
  const editor = useEditor();
  const selection = useUi((s) => s.selection, shallowArray);
  const readOnly = useUi((s) => s.readOnly);
  // A schema table's column grid needs more room than shape styles, so schema boards remember their own width.
  const [width, setWidth] = useLocalState(node.boardKind === 'schema' ? 'sd-inspector-w-schema' : 'sd-inspector-w', node.boardKind === 'schema' ? 320 : 272);
  const [open, setOpen] = useLocalState('sd-inspector-open', true);

  const records = useStoreValue(
    (e) => e.ui.get().selection.map((id) => e.store.get(id)).filter(Boolean),
    shallowArray,
  );

  if (!open) {
    return (
      <button type="button" className="sd-inspector-reopen" onClick={() => setOpen(true)} title="Show properties" aria-label="Show properties" data-sd-control>
        <IconPanelRight size={16} />
      </button>
    );
  }

  return (
    <>
      <PanelSplitter side="left" value={width} min={232} max={400} onChange={setWidth} onCollapse={() => setOpen(false)} label="Resize properties" />
      <aside className="sd-inspector" style={{ width }} aria-label="Properties">
        <div className="sd-inspector-head">
          <span>{records.length === 0 ? 'Board' : records.length === 1 ? shapeFor(records[0].type).label : `${records.length} selected`}</span>
          <button type="button" className="sd-icon-btn" onClick={() => setOpen(false)} title="Hide properties" aria-label="Hide properties">
            <IconPanelRight size={15} />
          </button>
        </div>
        <div className="sd-inspector-body">
          {records.length === 0 ? (
            <>
              <SchemaRelationSection />
              <BoardInfo node={node} />
            </>
          ) : records.length === 1 && records[0].type === 'dbtable' ? (
            <>
              <SchemaInspector record={records[0]} />
              <PositionFields editor={editor} record={records[0]} disabled={readOnly} />
            </>
          ) : (
            <SelectionFields editor={editor} records={records} ids={selection} readOnly={readOnly} />
          )}
        </div>
      </aside>
    </>
  );
});

function SchemaRelationSection() {
  const relationId = useUi((s) => s.schemaRelation);
  return relationId ? <RelationInspector relationId={relationId} /> : null;
}

function SchemaBoardHelp() {
  const editor = useEditor();
  const model = useSchemaModel();
  const readOnly = useUi((s) => s.readOnly);
  return (
    <section className="sd-section-block">
      <h5>Schema board</h5>
      <ul className="sd-tips">
        <li>Write DBML on the left — tables appear here as you type</li>
        <li>Select a table to edit it here: pick column types from a list, type a column name and its type is guessed</li>
        <li>
          <kbd>user_id</kbd> in a table next to <kbd>users</kbd> links the two by itself
        </li>
        <li>Hover a word in the text, a column or a relation line to see what it means</li>
        <li>Double-click a table to jump to its text; double-click empty space to add a table</li>
      </ul>
      {!readOnly && !model.tables.length && (
        <div className="sd-button-row sd-help-actions">
          <button type="button" className="btn primary sm" onClick={() => editor.schema?.addTable()}>
            Add a table
          </button>
          <button type="button" className="btn ghost sm" onClick={() => editor.schema?.appendText('Start from example', EXAMPLE_SCHEMA)} title="Example — Users, products, orders and order items, with keys, an enum and references">
            Start from an example
          </button>
        </div>
      )}
    </section>
  );
}

function BoardInfo({ node }) {
  const editor = useEditor();
  // A schema board's text is a record too; it is not an element anyone placed.
  const count = useStoreValue((e) => e.store.size - (e.store.has('__source') ? 1 : 0));
  const Icon = node.boardKind === 'schema' ? IconSchemaBoard : IconCanvasBoard;
  return (
    <>
      <section className="sd-section-block">
        <div className="sd-board-info">
          <Icon size={18} />
          <div>
            <b>{node.name}</b>
            <small>
              {node.boardKind === 'schema' ? 'Schema' : 'Canvas'} · {count} element{count === 1 ? '' : 's'}
            </small>
          </div>
        </div>
      </section>
      {node.boardKind === 'schema' ? (
        <SchemaBoardHelp />
      ) : (
      <section className="sd-section-block">
        <h5>Get started</h5>
        <ul className="sd-tips">
          <li>
            <kbd>{shortcutFor('toolRect')}</kbd> draw a box, <kbd>{shortcutFor('toolConnector')}</kbd> connect two
          </li>
          <li>
            <kbd>{shortcutFor('toolSticky')}</kbd> sticky note, <kbd>{shortcutFor('toolText')}</kbd> text, <kbd>{shortcutFor('toolPen')}</kbd> pen
          </li>
          <li>
            <kbd>{shortcutFor('toolFrame')}</kbd> frame a region — things inside move with it
          </li>
          <li>Double-click empty space to type</li>
          <li>
            <kbd>Space</kbd> + drag to pan, <kbd>{shortcutFor('shortcuts')}</kbd> for every shortcut
          </li>
        </ul>
        <button type="button" className="btn ghost sd-fit-btn" onClick={() => editor.zoomToFit()}>
          Zoom to fit
        </button>
      </section>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function commonValue(records, key) {
  let value;
  for (let i = 0; i < records.length; i += 1) {
    const v = records[i].data[key];
    if (i === 0) value = v;
    else if (JSON.stringify(v) !== JSON.stringify(value)) return MIXED;
  }
  return value;
}

function SelectionFields({ editor, records, ids, readOnly }) {
  const types = useMemo(() => [...new Set(records.map((r) => r.type))], [records]);

  // Fields every selected type offers, in the first type's order.
  const sections = useMemo(() => {
    const defs = types.map((t) => shapeFor(t));
    const first = defs[0].inspector;
    return first
      .map((section) => ({
        ...section,
        fields: section.fields.filter((field) => defs.every((d) => d.inspector.some((s) => s.fields.some((f) => f.key === field.key && f.kind === field.kind)))),
      }))
      .filter((section) => section.fields.length);
  }, [types]);

  const locked = records.every((r) => r.data.locked);
  const disabled = readOnly || locked;

  const apply = (key, value, { merge = false } = {}) => {
    editor.commit(
      'Change style',
      (tx) => {
        for (const id of ids) {
          const record = tx.get(id);
          const patch = { [key]: value };
          // Text and paragraphs size themselves to their content: a new size or weight changes the box.
          if ((key === 'fontSize' || key === 'weight') && (record?.type === 'text' || record?.type === 'paragraph')) {
            const next = { ...record, data: { ...record.data, [key]: value } };
            const auto = record.type === 'text' && record.data.autoWidth;
            const size = measureTextBox(next, auto ? undefined : record.data.w);
            if (auto) patch.w = size.w;
            patch.h = Math.max(record.type === 'paragraph' ? 24 : 16, size.h);
          }
          const fit = record && shapeFor(record.type).fit;
          if (fit) Object.assign(patch, fit({ ...record.data, [key]: value }));
          tx.update(id, { data: patch });
        }
      },
      { mergeKey: merge ? `style:${key}:${ids.join(',')}` : null },
    );
    // New elements of these types start with the style last chosen.
    const styleKeys = ['color', 'fillStyle', 'strokeStyle', 'strokeWidth', 'fontSize', 'route', 'endCap', 'startCap', 'size', 'align'];
    if (styleKeys.includes(key)) {
      const toolStyle = { ...editor.ui.get().toolStyle };
      for (const type of types) {
        toolStyle[type] = { ...(toolStyle[type] || {}), [key]: value };
        if (type === 'stroke') {
          for (const kind of ['pen', 'highlighter']) toolStyle[kind] = { ...(toolStyle[kind] || {}), [key]: value };
        }
      }
      editor.ui.set({ toolStyle });
    }
  };

  const single = records.length === 1 ? records[0] : null;
  const hasBox = single && single.type !== 'connector';

  return (
    <>
      {hasBox && <PositionFields editor={editor} record={single} disabled={disabled} />}

      {sections.map((section) => (
        <section key={section.title} className="sd-section-block">
          <h5>{section.title}</h5>
          {section.fields
            .filter((field) => !field.when || records.every((r) => field.when(r.data)))
            .map((field) => {
              const common = commonValue(records, field.key);
              // A field may show the value in effect when none is stored (a default that depends on other fields).
              const shown = field.current && common === undefined && single ? field.current(single.data) : common;
              return <Field key={field.key} field={field} value={shown} onChange={apply} disabled={disabled} record={single} />;
            })}
        </section>
      ))}

      <section className="sd-section-block">
        <h5>Layer</h5>
        <div className="sd-field">
          <span className="sd-field-label">Opacity</span>
          <OpacitySlider value={commonValue(records, 'opacity')} disabled={disabled} onChange={(v, merge) => apply('opacity', v >= 1 ? undefined : v, { merge })} />
        </div>
        <div className="sd-button-row">
          <button type="button" className="sd-icon-btn" disabled={disabled} onClick={() => editor.runAction('bringToFront')} title={`Bring to front (${shortcutFor('bringToFront')})`} aria-label="Bring to front">
            <IconBringFront size={15} />
          </button>
          <button type="button" className="sd-icon-btn" disabled={disabled} onClick={() => editor.runAction('sendToBack')} title={`Send to back (${shortcutFor('sendToBack')})`} aria-label="Send to back">
            <IconSendBack size={15} />
          </button>
          <span className="sd-grow" />
          <button type="button" className={`sd-icon-btn ${locked ? 'on' : ''}`} disabled={readOnly} onClick={() => editor.runAction('toggleLock')} title={`${locked ? 'Unlock' : 'Lock'} (${shortcutFor('toggleLock')})`} aria-label={locked ? 'Unlock' : 'Lock'} aria-pressed={locked}>
            <IconLock size={15} open={!locked} />
          </button>
        </div>
      </section>

      {records.length > 1 && !disabled && (
        <section className="sd-section-block">
          <h5>Align</h5>
          <div className="sd-button-row">
            {[
              ['alignLeft', IconAlignLeft, 'Align left'],
              ['alignCenterH', IconAlignCenterH, 'Align centres'],
              ['alignRight', IconAlignRight, 'Align right'],
              ['alignTop', IconAlignTop, 'Align top'],
              ['alignCenterV', IconAlignMiddleV, 'Align middles'],
              ['alignBottom', IconAlignBottom, 'Align bottom'],
            ].map(([action, Icon, label]) => (
              <button key={action} type="button" className="sd-icon-btn" onClick={() => editor.runAction(action)} title={`${label} (${shortcutFor(action)})`} aria-label={label}>
                <Icon size={15} />
              </button>
            ))}
          </div>
          {records.length > 2 && (
            <div className="sd-button-row">
              <button type="button" className="btn ghost sm" onClick={() => editor.runAction('distributeH')}>
                Distribute ↔
              </button>
              <button type="button" className="btn ghost sm" onClick={() => editor.runAction('distributeV')}>
                Distribute ↕
              </button>
            </div>
          )}
        </section>
      )}
    </>
  );
}

function PositionFields({ editor, record, disabled }) {
  const box = editor.worldBox(record);
  const def = shapeFor(record.type);
  const set = (patch, merge) => {
    editor.commit(
      'Change position',
      (tx) => {
        const origin = editor.worldOrigin(record.parent);
        const next = { ...patch };
        if ('x' in next) next.x -= origin.x;
        if ('y' in next) next.y -= origin.y;
        tx.update(record.id, { data: next });
      },
      { mergeKey: merge ? `pos:${record.id}:${Object.keys(patch).join()}` : null },
    );
  };
  const resizable = def.caps.resize !== 'none' && record.type !== 'stroke';
  return (
    <section className="sd-section-block">
      <h5>Position</h5>
      <div className="sd-grid-2">
        <NumberField label="X" value={Math.round(box.x)} disabled={disabled} onChange={(v, m) => set({ x: v }, m)} />
        <NumberField label="Y" value={Math.round(box.y)} disabled={disabled} onChange={(v, m) => set({ y: v }, m)} />
        <NumberField label="W" value={Math.round(box.w)} min={def.minW} disabled={disabled || !resizable} onChange={(v, m) => set({ w: Math.max(def.minW, v), ...(record.data.autoWidth ? { autoWidth: undefined } : {}) }, m)} />
        <NumberField label="H" value={Math.round(box.h)} min={def.minH} disabled={disabled || !resizable || def.caps.resize === 'width'} onChange={(v, m) => set({ h: Math.max(def.minH, v) }, m)} />
        {def.caps.rotate && (
          <NumberField
            label="°"
            value={Math.round(((record.data.rot || 0) * 180) / Math.PI)}
            disabled={disabled}
            onChange={(v, m) => set({ rot: ((((v % 360) + 360) % 360) * Math.PI) / 180 || undefined }, m)}
          />
        )}
      </div>
    </section>
  );
}

/* -------------------------------------------------------------------------- */
/* field kinds                                                                 */
/* -------------------------------------------------------------------------- */

function Field({ field, value, onChange, disabled, record }) {
  const mixed = value === MIXED;
  switch (field.kind) {
    case 'color':
      return (
        <div className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <div className="sd-swatches" role="radiogroup" aria-label={field.label}>
            {COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} title={c} data-hue={c} className={`sd-swatch ${value === c ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(field.key, c)} />
            ))}
          </div>
        </div>
      );
    case 'sticky':
      return (
        <div className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <div className="sd-swatches" role="radiogroup" aria-label={field.label}>
            {STICKY_COLORS.map((c) => (
              <button key={c} type="button" role="radio" aria-checked={value === c} aria-label={c} title={c} className={`sd-swatch sticky-${c} ${value === c ? 'on' : ''}`} disabled={disabled} onClick={() => onChange(field.key, c)} />
            ))}
          </div>
        </div>
      );
    case 'segmented':
      return (
        <div className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <div className={`sd-segmented ${mixed ? 'mixed' : ''}`} role="radiogroup" aria-label={field.label}>
            {field.options.map((option) => {
              const Icon = option.icon && ICONS[option.icon];
              return (
                <button key={option.value} type="button" role="radio" aria-checked={value === option.value} className={value === option.value ? 'on' : ''} disabled={disabled} onClick={() => onChange(field.key, option.value)} title={option.label}>
                  {Icon ? <Icon size={14} /> : option.label}
                </button>
              );
            })}
          </div>
        </div>
      );
    case 'number':
      return (
        <div className="sd-field">
          <NumberField label={field.label} wide value={mixed ? '' : value ?? 0} min={field.min} max={field.max} disabled={disabled} onChange={(v, merge) => onChange(field.key, v, { merge })} />
        </div>
      );
    case 'text':
      return (
        <label className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <input className="sd-input" value={mixed ? '' : value || ''} placeholder={mixed ? 'Mixed' : ''} disabled={disabled} maxLength={200} onChange={(e) => onChange(field.key, e.target.value, { merge: true })} />
        </label>
      );
    case 'select':
      return (
        <label className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <select className="sd-input" value={mixed ? '' : value ?? ''} disabled={disabled} onChange={(e) => onChange(field.key, e.target.value)}>
            {mixed && <option value="">Mixed</option>}
            {field.options.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      );
    case 'tech': {
      const entry = mixed ? null : TECH_BY_ID[value];
      return (
        <div className="sd-field">
          <label className="sd-field">
            <span className="sd-field-label">{field.label}</span>
            <select className="sd-input" value={mixed ? '' : value ?? ''} disabled={disabled} onChange={(e) => onChange(field.key, e.target.value)}>
              {mixed && <option value="">Mixed</option>}
              {!mixed && value && !TECH_BY_ID[value] && <option value={value}>Unknown ({value})</option>}
              {TECH_CATEGORIES.map((category) => (
                <optgroup key={category.id} label={category.label}>
                  {TECH.filter((t) => t.category === category.id).map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </label>
          {entry && <p className="sd-field-about">{entry.about}</p>}
        </div>
      );
    }
    case 'toggle':
      return (
        <label className="sd-field sd-toggle-row">
          <span className="sd-field-label">{field.label}</span>
          <input type="checkbox" checked={value === true} disabled={disabled} onChange={(e) => onChange(field.key, e.target.checked || undefined)} />
        </label>
      );
    case 'cap':
      return (
        <div className="sd-field">
          <span className="sd-field-label">{field.label}</span>
          <div className={`sd-segmented caps ${mixed ? 'mixed' : ''}`}>
            {CAPS.map((cap) => (
              <button key={cap} type="button" className={(value ?? (field.key === 'endCap' ? 'arrow' : 'none')) === cap ? 'on' : ''} disabled={disabled} onClick={() => onChange(field.key, cap)} title={CAP_TITLES[cap] || cap}>
                <CapGlyph cap={cap} flip={field.key === 'startCap'} />
              </button>
            ))}
          </div>
        </div>
      );
    case 'flow': {
      const flow = mixed ? null : value;
      return (
        <div className="sd-field">
          <label className="sd-toggle-row">
            <span className="sd-field-label">{field.label}</span>
            <input type="checkbox" checked={Boolean(flow?.on)} disabled={disabled} onChange={(e) => onChange('flow', e.target.checked ? { on: true, speed: flow?.speed || 2, reverse: flow?.reverse || false } : undefined)} />
          </label>
          {flow?.on && (
            <>
              <div className="sd-segmented" role="radiogroup" aria-label="Flow speed">
                {[1, 2, 3].map((speed) => (
                  <button key={speed} type="button" className={flow.speed === speed ? 'on' : ''} disabled={disabled} onClick={() => onChange('flow', { ...flow, speed })}>
                    {['Slow', 'Normal', 'Fast'][speed - 1]}
                  </button>
                ))}
              </div>
              <label className="sd-toggle-row">
                <span className="sd-field-label">Reverse direction</span>
                <input type="checkbox" checked={Boolean(flow.reverse)} disabled={disabled} onChange={(e) => onChange('flow', { ...flow, reverse: e.target.checked })} />
              </label>
            </>
          )}
          {record?.type === 'connector' && (
            <label className="sd-field">
              <span className="sd-field-label">Label</span>
              <input className="sd-input" value={record.data.label?.text || ''} placeholder="e.g. HTTPS, gRPC, 2k QPS" disabled={disabled} maxLength={120} onChange={(e) => onChange('label', e.target.value ? { text: e.target.value, t: record.data.label?.t ?? 0.5 } : undefined, { merge: true })} />
            </label>
          )}
        </div>
      );
    }
    default:
      return null;
  }
}

function CapGlyph({ cap, flip }) {
  const t = flip ? 'scale(-1,1) translate(-24,0)' : undefined;
  const paths = {
    none: <path d="M3 8h18" />,
    arrow: <path d="M3 8h17M15 4l5 4-5 4" />,
    triangle: (
      <>
        <path d="M3 8h13" />
        <path d="M21 8l-6-4v8z" fill="currentColor" />
      </>
    ),
    circle: (
      <>
        <path d="M3 8h13" />
        <circle cx="18" cy="8" r="3" fill="currentColor" />
      </>
    ),
    diamond: (
      <>
        <path d="M3 8h11" />
        <path d="M21 8l-3.5-3.5L14 8l3.5 3.5z" fill="currentColor" />
      </>
    ),
    bar: <path d="M3 8h18M21 3.5v9" />,
    one: <path d="M3 8h18M16 3.5v9" />,
    onlyOne: <path d="M3 8h18M13 3.5v9M17 3.5v9" />,
    zeroOrOne: (
      <>
        <path d="M3 8h6M15 8h6M18 3.5v9" />
        <circle cx="12" cy="8" r="2.6" />
      </>
    ),
    many: <path d="M3 8h18M15 8l6-4.5M15 8l6 4.5" />,
    oneOrMany: <path d="M3 8h18M15 8l6-4.5M15 8l6 4.5M12 3.5v9" />,
    zeroOrMany: (
      <>
        <path d="M3 8h4M13 8h8M15 8l6-4.5M15 8l6 4.5" />
        <circle cx="10" cy="8" r="2.6" />
      </>
    ),
  };
  return (
    <svg width="24" height="16" viewBox="0 0 24 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <g transform={t}>{paths[cap]}</g>
    </svg>
  );
}

function NumberField({ label, value, onChange, min = -1e6, max = 1e6, disabled, wide }) {
  const [draft, setDraft] = useState(null);
  const scrub = useRef(null);

  const commit = (text) => {
    setDraft(null);
    const number = Number(text);
    if (text === '' || !Number.isFinite(number)) return;
    onChange(Math.min(max, Math.max(min, Math.round(number))), false);
  };

  const onPointerDown = (event) => {
    if (disabled || event.button !== 0) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    scrub.current = { x: event.clientX, value: Number(value) || 0 };
  };
  const onPointerMove = (event) => {
    if (!scrub.current) return;
    const step = event.shiftKey ? 10 : 1;
    const next = scrub.current.value + Math.round((event.clientX - scrub.current.x) / 2) * step;
    onChange(Math.min(max, Math.max(min, next)), true);
  };
  const onPointerUp = () => {
    scrub.current = null;
  };

  return (
    <label className={`sd-number ${wide ? 'wide' : ''} ${disabled ? 'disabled' : ''}`}>
      {/* preventDefault on click: the span sits in a <label>, whose click would focus the input and keep keys from the board. */}
      <span className="sd-number-label" onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onClick={(event) => event.preventDefault()} title="Drag to adjust">
        {label}
      </span>
      <input
        className="mono"
        inputMode="numeric"
        disabled={disabled}
        value={draft ?? value}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={(e) => draft != null && commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setDraft(null);
            e.currentTarget.blur();
          }
          if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
            e.preventDefault();
            const step = (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1);
            onChange(Math.min(max, Math.max(min, (Number(value) || 0) + step)), true);
          }
        }}
      />
    </label>
  );
}

function OpacitySlider({ value, onChange, disabled }) {
  const current = value === MIXED ? 1 : value ?? 1;
  return (
    <div className="sd-slider">
      <input type="range" min={0.1} max={1} step={0.05} value={current} disabled={disabled} onChange={(e) => onChange(Number(e.target.value), true)} aria-label="Opacity" />
      <span className="mono">{Math.round(current * 100)}%</span>
    </div>
  );
}
