import { SHORTCUTS, displayKeys } from '../../../design/engine/shortcuts.js';
import { Modal } from '../../ui/Modal.jsx';

const EXTRA = [
  { group: 'View', label: 'Pan', display: 'Space + drag · middle mouse · scroll' },
  { group: 'View', label: 'Zoom', display: `${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} + scroll · pinch` },
  { group: 'Edit', label: 'Duplicate while dragging', display: 'Alt + drag' },
  { group: 'Edit', label: 'Ignore snapping', display: `${/Mac/.test(navigator.platform) ? '⌘' : 'Ctrl'} while dragging` },
  { group: 'Edit', label: 'Square / keep proportions', display: 'Shift while drawing or resizing' },
  { group: 'Tools', label: 'Opacity', display: '1 … 9, 0' },
];

/** Every shortcut, generated from the same table the key handler uses. */
export function ShortcutsDialog({ onClose }) {
  const groups = ['Tools', 'Edit', 'Arrange', 'View'];
  const rows = [...SHORTCUTS.filter((s) => !s.hidden && s.label), ...EXTRA];
  return (
    <Modal title="Keyboard shortcuts" onClose={onClose} size="lg">
      <div className="modal-body sd-shortcuts">
        {groups.map((group) => (
          <section key={group}>
            <h4>{group}</h4>
            {rows
              .filter((row) => row.group === group)
              .map((row) => (
                <div key={`${row.label}-${row.keys || row.display}`} className="sd-shortcut-row">
                  <span>{row.label}</span>
                  <kbd>{row.display || displayKeys(row.keys)}</kbd>
                </div>
              ))}
          </section>
        ))}
      </div>
    </Modal>
  );
}
