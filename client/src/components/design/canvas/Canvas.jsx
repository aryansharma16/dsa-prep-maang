import { useEffect, useLayoutEffect, useRef } from 'react';
import { fromClipboardData, instantiate, serializeSelection, toClipboardData } from '../../../design/engine/clipboard.js';
import { DraftStroke } from './DraftStroke.jsx';
import { ElementList } from './ElementHost.jsx';
import { useEditor, useUi } from './hooks.js';
import { OverlayLayer } from './OverlayLayer.jsx';
import { TextEditor } from './TextEditor.jsx';
import { COMPONENT_MIME } from '../library/LibraryPanel.jsx';
import { SchemaRelations } from '../schema/SchemaRelations.jsx';

/**
 * The canvas: a viewport, a dot grid, the world layer everything is drawn in,
 * and a screen-space overlay above it for handles and guides.
 *
 * The world layer is the only transformed node. The editor writes its
 * transform directly on every camera change; React never re-renders for a pan.
 */
export function Canvas() {
  const editor = useEditor();
  const rootRef = useRef(null);
  const viewportRef = useRef(null);
  const worldRef = useRef(null);
  const gridRef = useRef(null);
  const bucket = useUi((s) => s.zoomBucket);
  const flowPaused = useUi((s) => s.flowPaused);
  const tool = useUi((s) => s.tool);
  const readOnly = useUi((s) => s.readOnly);

  useLayoutEffect(() => {
    editor.attach({ root: rootRef.current, viewport: viewportRef.current, world: worldRef.current, grid: gridRef.current });
    return () => editor.detach();
  }, [editor]);

  useClipboard(editor);

  return (
    <div
      ref={rootRef}
      className={`sd-canvas lod-${bucket || 'near'} ${flowPaused ? 'flow-paused' : ''} tool-${tool} ${readOnly ? 'read-only' : ''}`}
    >
      <div
        ref={viewportRef}
        className="sd-viewport"
        tabIndex={0}
        role="application"
        aria-label="Board canvas. Press ? for keyboard shortcuts."
        onDragOver={(event) => {
          if (!event.dataTransfer.types.includes(COMPONENT_MIME)) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = 'copy';
        }}
        onDrop={(event) => {
          const raw = event.dataTransfer.getData(COMPONENT_MIME);
          if (!raw) return;
          event.preventDefault();
          try {
            const at = editor.clientToWorld(event.clientX, event.clientY);
            editor.runAction('insertComponent', { ...JSON.parse(raw), at });
            editor.dom?.viewport.focus({ preventScroll: true });
          } catch {
            /* not a component we know */
          }
        }}
      >
        <div ref={gridRef} className="sd-dots" aria-hidden="true" />
        <div ref={worldRef} className="sd-world">
          {editor.boardKind === 'schema' && <SchemaRelations />}
          <ElementList parent={null} />
          <TextEditor />
          <DraftStroke />
        </div>
        <OverlayLayer />
      </div>
    </div>
  );
}

/**
 * Copy, cut and paste through the browser's clipboard events rather than
 * keydown: they hand over `clipboardData` synchronously, need no permission
 * prompt, and work the same in Safari.
 */
function useClipboard(editor) {
  useEffect(() => {
    const active = (event) => {
      const target = event.target;
      if (target instanceof HTMLElement && (/^(INPUT|TEXTAREA)$/.test(target.tagName) || target.isContentEditable)) return false;
      return Boolean(editor.dom) && !document.querySelector('.overlay');
    };

    const onCopy = (event) => {
      if (!active(event) || !editor.ui.get().selection.length) return;
      const { html, text } = toClipboardData(serializeSelection(editor));
      event.clipboardData.setData('text/html', html);
      event.clipboardData.setData('text/plain', text);
      event.preventDefault();
    };

    const onCut = (event) => {
      if (!active(event) || editor.ui.get().readOnly) return;
      onCopy(event);
      editor.runAction('delete');
    };

    const onPaste = (event) => {
      if (!active(event) || editor.ui.get().readOnly) return;
      const data = event.clipboardData;
      const payload = fromClipboardData({ html: data.getData('text/html'), text: data.getData('text/plain') });
      if (payload) {
        event.preventDefault();
        pasteRecords(editor, payload, event);
        return;
      }
      const text = data.getData('text/plain');
      if (text && text.trim()) {
        event.preventDefault();
        pasteText(editor, text.trim());
      }
    };

    document.addEventListener('copy', onCopy);
    document.addEventListener('cut', onCut);
    document.addEventListener('paste', onPaste);
    return () => {
      document.removeEventListener('copy', onCopy);
      document.removeEventListener('cut', onCut);
      document.removeEventListener('paste', onPaste);
    };
  }, [editor]);
}

let lastPaste = { signature: '', count: 0 };

function pasteRecords(editor, payload) {
  const roots = payload.records.filter((r) => !r.parent);
  // Where the copied things are: boxes by their corners, connectors by their free end points.
  const corners = [];
  for (const r of roots) {
    if (r.type === 'connector') {
      for (const end of [r.data.start, r.data.end]) if (end?.point) corners.push(end.point);
    } else {
      corners.push([r.data.x || 0, r.data.y || 0], [(r.data.x || 0) + (r.data.w || 0), (r.data.y || 0) + (r.data.h || 0)]);
    }
  }
  const minX = corners.length ? Math.min(...corners.map((c) => c[0])) : 0;
  const minY = corners.length ? Math.min(...corners.map((c) => c[1])) : 0;

  // Pasting what is still on screen nudges each copy along; otherwise it lands in the middle of the view.
  const view = editor.visibleWorld();
  const visible = minX >= view.minX && minY >= view.minY && minX <= view.maxX && minY <= view.maxY;
  const signature = JSON.stringify(roots.map((r) => r.id));
  lastPaste = signature === lastPaste.signature ? { signature, count: lastPaste.count + 1 } : { signature, count: 1 };
  let offsetX;
  let offsetY;
  if (visible) {
    offsetX = 24 * lastPaste.count;
    offsetY = 24 * lastPaste.count;
  } else {
    const maxX = Math.max(...corners.map((c) => c[0]), minX);
    const maxY = Math.max(...corners.map((c) => c[1]), minY);
    offsetX = Math.round((view.minX + view.maxX) / 2 - (minX + maxX) / 2);
    offsetY = Math.round((view.minY + view.maxY) / 2 - (minY + maxY) / 2);
  }

  let created = [];
  editor.commit('Paste', (tx) => {
    const { records, topIds } = instantiate(payload, { offsetX, offsetY, parent: null, zAfter: tx.get(tx.childIds(null).at(-1))?.z ?? null });
    for (const record of records) tx.create(record);
    created = topIds;
  });
  editor.select(created);
}

function pasteText(editor, text) {
  const view = editor.visibleWorld();
  const long = text.length > 80 || text.includes('\n');
  let id = null;
  editor.commit('Paste text', (tx) => {
    const record = editor.newRecord(long ? 'paragraph' : 'text', {
      x: Math.round((view.minX + view.maxX) / 2 - (long ? 160 : 40)),
      y: Math.round((view.minY + view.maxY) / 2 - 20),
      text: text.slice(0, 20000),
    }, { tx });
    tx.create(record);
    id = record.id;
  });
  editor.select([id]);
  editor.ui.set({ editingId: id });
}
