import { useEffect, useLayoutEffect, useRef } from 'react';
import { FONT_SIZES } from '../../../design/shapes/shapes.js';
import { measureTextBox, stickyFontSize } from '../../../design/text/measure.js';
import { useEditor, useElement, useUi } from './hooks.js';

/**
 * Typing on the canvas.
 *
 * A `<textarea>` placed in world space exactly over the element being edited,
 * with the same font, size and padding as its view — so the text does not jump
 * when editing starts or ends, and IME composition, spellcheck and native
 * text selection all just work. `contentEditable` would give none of those
 * reliably.
 *
 * Every change is a commit with a merge key for this editing session: autosave
 * sees each keystroke (so a crash loses nothing), while undo sees one entry.
 */
export function TextEditor() {
  const editingId = useUi((s) => s.editingId);
  if (!editingId) return null;
  return <TextEditorFor key={editingId} id={editingId} />;
}

const FIELD = { text: 'text', paragraph: 'text', sticky: 'text', frame: 'name' };

function TextEditorFor({ id }) {
  const editor = useEditor();
  const record = useElement(id);
  const ref = useRef(null);
  const session = useRef(`text:${id}:${Date.now()}`);

  const type = record?.type;
  const field = FIELD[type] || 'label';
  const value = record?.data[field] ?? '';

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus({ preventScroll: true });
    const end = el.value.length;
    el.setSelectionRange(end, end);
    if (field === 'name' || (type === 'text' && !value)) el.select();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per session
  }, []);

  useEffect(() => {
    return () => {
      editor.history.seal();
      // Leaving an empty text element behind is leaving litter; remove it.
      const current = editor.store.get(id);
      if (current?.type === 'text' && !(current.data.text || '').trim()) {
        editor.store.transact((tx) => tx.remove(id), { label: 'Remove empty text', history: false });
      }
    };
  }, [editor, id]);

  if (!record) return null;
  const box = editor.worldBox(record);
  const origin = { x: box.x, y: box.y };
  const data = record.data;

  const update = (text) => {
    editor.commit(
      'Edit text',
      (tx) => {
        const patch = { [field]: text };
        if (type === 'text' || type === 'paragraph') {
          const draft = { ...record, data: { ...record.data, text } };
          const size = measureTextBox(draft, type === 'text' && data.autoWidth ? undefined : data.w);
          if (type === 'text' && data.autoWidth) patch.w = size.w;
          patch.h = Math.max(type === 'paragraph' ? 24 : 16, size.h);
        }
        tx.update(id, { data: patch });
      },
      { mergeKey: session.current },
    );
  };

  const stop = () => editor.ui.set({ editingId: null });

  const onKeyDown = (event) => {
    event.stopPropagation();
    if (event.key === 'Escape' || ((event.metaKey || event.ctrlKey) && event.key === 'Enter')) {
      event.preventDefault();
      stop();
      editor.dom?.viewport.focus({ preventScroll: true });
    }
    if (field === 'name' && event.key === 'Enter') {
      event.preventDefault();
      stop();
    }
  };

  let style;
  let className = 'sd-text-editor';
  if (type === 'text') {
    style = { left: origin.x, top: origin.y, width: data.autoWidth ? Math.max(data.w, 40) + 40 : data.w, height: data.h, fontSize: FONT_SIZES[data.fontSize] || FONT_SIZES.l, fontWeight: data.weight === 'bold' ? 650 : 400, textAlign: data.align };
    className += ' as-text';
    if (data.autoWidth) style.whiteSpace = 'pre';
  } else if (type === 'paragraph') {
    style = { left: origin.x, top: origin.y, width: data.w, minHeight: data.h, fontSize: FONT_SIZES[data.fontSize] || FONT_SIZES.m, textAlign: data.align };
    className += ' as-paragraph';
  } else if (type === 'sticky') {
    style = { left: origin.x + 14, top: origin.y + 14, width: data.w - 28, height: data.h - 28, fontSize: stickyFontSize(value, data.w, data.h), textAlign: data.align || 'center' };
    className += ' as-sticky';
  } else if (type === 'frame') {
    style = { left: origin.x, top: origin.y - 22, width: Math.max(160, Math.min(data.w, 320)), height: 20 };
    className += ' as-frame';
  } else {
    // A label inside a shape: centred in the shape, as it is drawn.
    style = { left: origin.x + 8, top: origin.y + 8, width: Math.max(20, data.w - 16), height: Math.max(20, data.h - 16), fontSize: FONT_SIZES[data.fontSize] || 14, textAlign: data.align || 'center' };
    className += ' as-label';
  }
  if (box.rot) {
    style.transform = `rotate(${box.rot}rad)`;
    style.transformOrigin = `${box.x + box.w / 2 - style.left}px ${box.y + box.h / 2 - style.top}px`;
  }

  return (
    <textarea
      ref={ref}
      className={className}
      style={style}
      value={value}
      spellCheck={type !== 'frame'}
      placeholder={type === 'paragraph' ? 'Notes, requirements, trade-offs…' : type === 'frame' ? 'Frame name' : ''}
      onChange={(event) => update(event.target.value)}
      onKeyDown={onKeyDown}
      onBlur={stop}
      onPointerDown={(event) => event.stopPropagation()}
      onWheel={(event) => event.stopPropagation()}
      aria-label="Edit text"
      data-hue={data.color}
    />
  );
}
