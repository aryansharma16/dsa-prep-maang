import { useEffect, useRef, useState } from 'react';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import {
  IconConnector,
  IconCylinder,
  IconDiamond,
  IconEllipse,
  IconEraser,
  IconFrame,
  IconHand,
  IconHighlighter,
  IconLibrary,
  IconParagraph,
  IconPen,
  IconRect,
  IconSelect,
  IconSticky,
  IconText,
  IconToolLock,
} from '../icons.jsx';
import { useEditor, useUi } from './hooks.js';

/**
 * The floating tool strip at the bottom of the canvas.
 *
 * Grouped the way FigJam groups them — move, frame, shapes, connect, draw,
 * write — with the shapes and the drawing tools behind a flyout each, so the
 * strip stays short and the last-used variant stays one click away. Every
 * button's tooltip names its shortcut.
 */

const SHAPES = [
  { tool: 'rect', label: 'Rectangle', Icon: IconRect },
  { tool: 'ellipse', label: 'Ellipse', Icon: IconEllipse },
  { tool: 'diamond', label: 'Diamond', Icon: IconDiamond },
  { tool: 'cylinder', label: 'Cylinder (database, queue)', Icon: IconCylinder },
];
const DRAW = [
  { tool: 'pen', label: 'Pen', Icon: IconPen },
  { tool: 'highlighter', label: 'Highlighter', Icon: IconHighlighter },
  { tool: 'eraser', label: 'Eraser', Icon: IconEraser },
];
const WRITE = [
  { tool: 'text', label: 'Text', Icon: IconText },
  { tool: 'paragraph', label: 'Paragraph (markdown)', Icon: IconParagraph },
];

const ACTION = {
  select: 'toolSelect',
  hand: 'toolHand',
  frame: 'toolFrame',
  rect: 'toolRect',
  ellipse: 'toolEllipse',
  diamond: 'toolDiamond',
  cylinder: 'toolCylinder',
  connector: 'toolConnector',
  pen: 'toolPen',
  highlighter: 'toolHighlighter',
  eraser: 'toolEraser',
  text: 'toolText',
  paragraph: 'toolParagraph',
  sticky: 'toolSticky',
};

const tip = (label, tool) => {
  const keys = shortcutFor(ACTION[tool]);
  return keys ? `${label} (${keys})` : label;
};

export function Toolbar() {
  const editor = useEditor();
  const tool = useUi((s) => s.tool);
  const locked = useUi((s) => s.toolLocked);
  const readOnly = useUi((s) => s.readOnly);
  const libraryOpen = useUi((s) => s.libraryOpen);
  const [lastShape, setLastShape] = useState('rect');
  const [lastDraw, setLastDraw] = useState('pen');
  const [lastWrite, setLastWrite] = useState('text');
  const [flyout, setFlyout] = useState(null);

  useEffect(() => {
    if (SHAPES.some((s) => s.tool === tool)) setLastShape(tool);
    if (DRAW.some((s) => s.tool === tool)) setLastDraw(tool);
    if (WRITE.some((s) => s.tool === tool)) setLastWrite(tool);
  }, [tool]);

  const pick = (name) => {
    setFlyout(null);
    editor.setTool(name);
    editor.dom?.viewport.focus({ preventScroll: true });
  };

  const button = (name, label, Icon, extra = {}) => (
    <button
      key={name}
      type="button"
      className={`sd-tool ${tool === name ? 'on' : ''}`}
      onClick={() => pick(name)}
      onDoubleClick={() => {
        editor.setTool(name, { lock: true });
      }}
      title={tip(label, name)}
      aria-label={label}
      aria-pressed={tool === name}
      {...extra}
    >
      <Icon size={18} />
    </button>
  );

  if (readOnly) {
    return (
      <div className="sd-toolbar" role="toolbar" aria-label="Tools" data-sd-control>
        {button('select', 'Select', IconSelect)}
        {button('hand', 'Hand', IconHand)}
      </div>
    );
  }

  return (
    <div className="sd-toolbar" role="toolbar" aria-label="Tools" data-sd-control>
      {button('select', 'Select', IconSelect)}
      {button('hand', 'Hand', IconHand)}
      <span className="sd-tool-sep" />
      {button('frame', 'Frame', IconFrame)}
      <Group items={SHAPES} last={lastShape} tool={tool} open={flyout === 'shapes'} onToggle={() => setFlyout(flyout === 'shapes' ? null : 'shapes')} onPick={pick} label="Shapes" />
      {button('connector', 'Connector', IconConnector)}
      <span className="sd-tool-sep" />
      <Group items={DRAW} last={lastDraw} tool={tool} open={flyout === 'draw'} onToggle={() => setFlyout(flyout === 'draw' ? null : 'draw')} onPick={pick} label="Draw" />
      <Group items={WRITE} last={lastWrite} tool={tool} open={flyout === 'write'} onToggle={() => setFlyout(flyout === 'write' ? null : 'write')} onPick={pick} label="Text" />
      {button('sticky', 'Sticky note', IconSticky)}
      <button
        type="button"
        className={`sd-tool ${libraryOpen ? 'on' : ''}`}
        onClick={() => editor.runAction('library')}
        title={`Components — tech, data structures, SQL tables (${shortcutFor('library')})`}
        aria-label="Component library"
        aria-pressed={libraryOpen}
      >
        <IconLibrary size={18} />
      </button>
      <span className="sd-tool-sep" />
      <button
        type="button"
        className={`sd-tool small ${locked ? 'on' : ''}`}
        onClick={() => editor.ui.set({ toolLocked: !locked })}
        title={`Keep the tool selected after drawing (${shortcutFor('toolLock')})`}
        aria-label="Keep tool selected"
        aria-pressed={locked}
      >
        <IconToolLock size={15} on={locked} />
      </button>
    </div>
  );
}

function Group({ items, last, tool, open, onToggle, onPick, label }) {
  const ref = useRef(null);
  const current = items.find((i) => i.tool === (items.some((x) => x.tool === tool) ? tool : last)) || items[0];
  const active = items.some((i) => i.tool === tool);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (event) => {
      if (!ref.current?.contains(event.target)) onToggle();
    };
    document.addEventListener('pointerdown', onDown, true);
    return () => document.removeEventListener('pointerdown', onDown, true);
  }, [open, onToggle]);

  return (
    <div className="sd-tool-group" ref={ref}>
      <button
        type="button"
        className={`sd-tool ${active ? 'on' : ''}`}
        onClick={() => onPick(current.tool)}
        title={tip(current.label, current.tool)}
        aria-label={current.label}
        aria-pressed={active}
      >
        <current.Icon size={18} />
      </button>
      <button type="button" className="sd-tool-more" onClick={onToggle} aria-label={`More ${label.toLowerCase()} tools`} aria-expanded={open}>
        <svg width="7" height="5" viewBox="0 0 7 5" aria-hidden="true">
          <path d="M.8 1l2.7 2.6L6.2 1" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
        </svg>
      </button>
      {open && (
        <div className="sd-flyout" role="menu" aria-label={label}>
          {items.map((item) => (
            <button key={item.tool} type="button" role="menuitem" className={`sd-flyout-item ${tool === item.tool ? 'on' : ''}`} onClick={() => onPick(item.tool)}>
              <item.Icon size={16} />
              <span>{item.label}</span>
              <kbd>{shortcutFor(ACTION[item.tool])}</kbd>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
