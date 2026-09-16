import { useRef, useState, useSyncExternalStore } from 'react';
import { Link } from 'react-router-dom';
import { AppearancePicker } from '../../layout/AppearancePicker.jsx';
import { IconEdit } from '../../ui/Icons.jsx';
import {
  IconBack,
  IconChevronDown,
  IconFit,
  IconFlow,
  IconKeyboard,
  IconPanelLeft,
  IconRedo,
  IconShare,
  IconUndo,
} from '../icons.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';

const NO_CHROME = Object.freeze({ zoom: 1, canUndo: false, canRedo: false, save: { state: 'idle' }, flowPaused: false });
const noop = () => () => {};

/** The editor's chrome state — zoom, undo availability, save status — or a resting default before a board mounts. */
export function useEditorChrome(editor) {
  return useSyncExternalStore(
    editor ? editor.subscribeChrome : noop,
    editor ? editor.getChrome : () => NO_CHROME,
  );
}

/**
 * The strip across the top of the workspace.
 *
 * Left: the way out, and where you are. Right: what the board is doing — its
 * save state, undo, zoom — and the doors that are not open yet. Deliberately
 * light: every control here exists elsewhere as a shortcut, and the canvas is
 * the thing on screen.
 */
export function TopBar({ project, path, node, editor, explorerOpen, onToggleExplorer, onRenameBoard, readOnly }) {
  const chrome = useEditorChrome(editor);
  const [renaming, setRenaming] = useState(false);
  const [zoomMenu, setZoomMenu] = useState(false);
  const zoomRef = useRef(null);
  const folders = path.slice(0, -1);

  return (
    <header className="sd-topbar">
      <div className="sd-topbar-left">
        <Link to="/design" className="sd-icon-btn" title="All projects" aria-label="All projects">
          <IconBack size={16} />
        </Link>
        <button
          type="button"
          className={`sd-icon-btn ${explorerOpen ? 'on' : ''}`}
          onClick={onToggleExplorer}
          aria-pressed={explorerOpen}
          title={`${explorerOpen ? 'Hide' : 'Show'} explorer (${modKey()}\\)`}
          aria-label="Toggle explorer"
        >
          <IconPanelLeft size={16} />
        </button>

        <nav className="sd-crumbs" aria-label="Breadcrumb">
          <span className="sd-crumb project" data-hue={project?.hue}>
            <span className="sd-crumb-dot" aria-hidden="true" />
            {project?.name}
          </span>
          {folders.map((folder) => (
            <span key={folder.id} className="sd-crumb">
              {folder.name}
            </span>
          ))}
          {node && (
            <span className="sd-crumb current">
              {renaming ? (
                <input
                  className="sd-crumb-input"
                  // eslint-disable-next-line jsx-a11y/no-autofocus -- entered by an explicit rename action
                  autoFocus
                  defaultValue={node.name}
                  maxLength={120}
                  aria-label="Board name"
                  onFocus={(event) => event.currentTarget.select()}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') event.currentTarget.blur();
                    if (event.key === 'Escape') {
                      event.currentTarget.value = node.name;
                      event.currentTarget.blur();
                    }
                  }}
                  onBlur={(event) => {
                    setRenaming(false);
                    onRenameBoard(event.currentTarget.value);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="sd-crumb-name"
                  onDoubleClick={() => !readOnly && setRenaming(true)}
                  onClick={(event) => event.detail === 0 && !readOnly && setRenaming(true)}
                  title={readOnly ? node.name : 'Double-click to rename'}
                >
                  {node.name}
                  {!readOnly && <IconEdit size={11} />}
                </button>
              )}
            </span>
          )}
          {readOnly && project && <span className="sd-readonly-pill">View only</span>}
        </nav>
      </div>

      <div className="sd-topbar-right">
        <SaveStatus save={chrome.save} onRetry={() => editor?.flushSave()} />

        <div className="sd-topbar-group">
          <button
            type="button"
            className="sd-icon-btn"
            onClick={() => editor?.undo()}
            disabled={!chrome.canUndo || readOnly}
            title={`Undo (${modKey()}Z)`}
            aria-label="Undo"
          >
            <IconUndo size={16} />
          </button>
          <button
            type="button"
            className="sd-icon-btn"
            onClick={() => editor?.redo()}
            disabled={!chrome.canRedo || readOnly}
            title={`Redo (${modKey()}⇧Z)`}
            aria-label="Redo"
          >
            <IconRedo size={16} />
          </button>
        </div>

        <button
          type="button"
          className={`sd-icon-btn ${chrome.flowPaused ? '' : 'on'}`}
          onClick={() => editor?.toggleFlow()}
          disabled={!editor}
          title={chrome.flowPaused ? 'Play connector flow' : 'Pause connector flow'}
          aria-label="Toggle connector flow animation"
          aria-pressed={!chrome.flowPaused}
        >
          <IconFlow size={15} playing={!chrome.flowPaused} />
        </button>

        <button
          ref={zoomRef}
          type="button"
          className="sd-zoom-btn"
          onClick={() => setZoomMenu((open) => !open)}
          disabled={!editor}
          aria-haspopup="menu"
          aria-expanded={zoomMenu}
          title="Zoom"
        >
          <span className="mono">{Math.round(chrome.zoom * 100)}%</span>
          <IconChevronDown size={12} />
        </button>
        {zoomMenu && editor && (
          <ActionMenu
            anchor={zoomRef.current}
            returnFocus={zoomRef.current}
            label="Zoom"
            onClose={() => setZoomMenu(false)}
            items={[
              { label: 'Zoom in', shortcut: '+', icon: null, onSelect: () => editor.zoomBy(1) },
              { label: 'Zoom out', shortcut: '−', icon: null, onSelect: () => editor.zoomBy(-1) },
              'sep',
              { label: 'Zoom to fit', shortcut: '⇧1', icon: <IconFit size={14} />, onSelect: () => editor.zoomToFit() },
              { label: 'Zoom to selection', shortcut: '⇧2', icon: null, onSelect: () => editor.zoomToSelection() },
              'sep',
              { label: '50%', icon: null, onSelect: () => editor.zoomTo(0.5) },
              { label: '100%', shortcut: '⇧0', icon: null, onSelect: () => editor.zoomTo(1) },
              { label: '200%', icon: null, onSelect: () => editor.zoomTo(2) },
            ]}
          />
        )}

        {/*
          The whole appearance menu, not a light/dark button.

          The workspace takes the entire window, so the app shell's copy of this
          — and with it every way to change the theme or the accent — is off
          screen for as long as a board is open. That matters more here than on
          a list page: a board is drawn in the theme's colours and the accent is
          what the selection, the active tool and the guides are painted in, so
          "does this read on a projector?" is one menu away instead of a trip
          back to /design and in again. It is the same component the top bar
          uses, wearing this bar's button.
        */}
        <AppearancePicker triggerClassName="sd-icon-btn" />

        <button
          type="button"
          className="sd-icon-btn"
          onClick={() => editor?.openShortcuts()}
          disabled={!editor}
          title="Keyboard shortcuts (?)"
          aria-label="Keyboard shortcuts"
        >
          <IconKeyboard size={16} />
        </button>

        <button type="button" className="sd-share-btn" disabled title="Sharing is coming soon">
          <IconShare size={14} />
          Share
        </button>
      </div>
    </header>
  );
}

function SaveStatus({ save, onRetry }) {
  switch (save.state) {
    case 'saving':
      return (
        <span className="sd-save saving" role="status" title="Saving — Changes go to the server a moment after you stop">
          <span className="sd-save-dot" /> Saving…
        </span>
      );
    case 'saved':
      return (
        <span className="sd-save saved" role="status" title="Saved — Every change is saved automatically; there is no save button">
          Saved
        </span>
      );
    case 'offline':
      return (
        <span className="sd-save warn" role="status" title="Your changes are kept on this device and will be saved when you are back online">
          <span className="sd-save-dot" /> Offline · {save.pending || 0} pending
        </span>
      );
    case 'error':
      return (
        <span className="sd-save error" role="alert">
          {save.message || 'Could not save'}
          {save.retryable !== false && (
            <button type="button" className="link-btn" onClick={onRetry}>
              Retry
            </button>
          )}
        </span>
      );
    default:
      return <span className="sd-save idle" aria-hidden="true" />;
  }
}

const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);
export const modKey = () => (isMac ? '⌘' : 'Ctrl+');
