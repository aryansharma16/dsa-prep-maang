import { IconFit, IconMinus, IconPlusSmall } from '../icons.jsx';
import { useEditorChrome } from '../workspace/TopBar.jsx';
import { useEditor } from './hooks.js';

/** Bottom-right: zoom out, the current zoom (click for 100%), zoom in, and fit. */
export function ZoomControls() {
  const editor = useEditor();
  const { zoom } = useEditorChrome(editor);
  return (
    <div className="sd-zoom" data-sd-control>
      <button type="button" className="sd-icon-btn" onClick={() => editor.zoomBy(-1)} title="Zoom out (−)" aria-label="Zoom out">
        <IconMinus size={14} />
      </button>
      <button type="button" className="sd-zoom-value mono" onClick={() => editor.zoomTo(1)} title="Reset to 100% (⇧0)">
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className="sd-icon-btn" onClick={() => editor.zoomBy(1)} title="Zoom in (+)" aria-label="Zoom in">
        <IconPlusSmall size={14} />
      </button>
      <span className="sd-tool-sep" />
      <button type="button" className="sd-icon-btn" onClick={() => editor.zoomToFit()} title="Zoom to fit (⇧1)" aria-label="Zoom to fit">
        <IconFit size={14} />
      </button>
    </div>
  );
}
