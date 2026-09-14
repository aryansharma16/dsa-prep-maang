import { useCallback } from 'react';
import { shortcutFor } from '../../../design/engine/shortcuts.js';
import { IconCopy, IconTrash } from '../../ui/Icons.jsx';
import { IconBringFront, IconDuplicate, IconFit, IconFrame, IconLock, IconSendBack } from '../icons.jsx';
import { ActionMenu } from '../ui/ActionMenu.jsx';
import { useEditor, useUi } from './hooks.js';

/** Right-click on the canvas: the verbs that apply to what is under the pointer. */
export function CanvasContextMenu() {
  const editor = useEditor();
  const menu = useUi((s) => s.contextMenu);
  const selection = useUi((s) => s.selection);
  const readOnly = useUi((s) => s.readOnly);
  const close = useCallback(() => editor.ui.set({ contextMenu: null }), [editor]);
  if (!menu) return null;

  const run = (action) => () => editor.runAction(action);
  const copy = () => document.execCommand('copy');
  const has = selection.length > 0;
  const locked = has && selection.every((id) => editor.store.get(id)?.data.locked);
  const frames = selection.some((id) => editor.store.get(id)?.type === 'frame');

  const items = has
    ? [
        { label: 'Copy', icon: <IconCopy size={14} />, shortcut: shortcutFor('copy'), onSelect: copy },
        !readOnly && { label: 'Duplicate', icon: <IconDuplicate size={14} />, shortcut: shortcutFor('duplicate'), onSelect: run('duplicate') },
        !readOnly && 'sep',
        !readOnly && { label: 'Bring to front', icon: <IconBringFront size={14} />, shortcut: shortcutFor('bringToFront'), onSelect: run('bringToFront') },
        !readOnly && { label: 'Send to back', icon: <IconSendBack size={14} />, shortcut: shortcutFor('sendToBack'), onSelect: run('sendToBack') },
        !readOnly && 'sep',
        !readOnly && { label: 'Frame selection', icon: <IconFrame size={14} />, shortcut: shortcutFor('frameSelection'), onSelect: run('frameSelection') },
        !readOnly && frames && { label: 'Remove frame', icon: null, shortcut: shortcutFor('unframe'), onSelect: run('unframe') },
        !readOnly && { label: locked ? 'Unlock' : 'Lock', icon: <IconLock size={14} open={locked} />, shortcut: shortcutFor('toggleLock'), onSelect: run('toggleLock') },
        { label: 'Zoom to selection', icon: <IconFit size={14} />, shortcut: shortcutFor('zoomSelection'), onSelect: run('zoomSelection') },
        !readOnly && 'sep',
        !readOnly && { label: 'Delete', icon: <IconTrash size={14} />, shortcut: 'Del', danger: true, onSelect: run('delete') },
      ]
    : [
        !readOnly && {
          label: 'Paste here',
          icon: null,
          shortcut: shortcutFor('paste'),
          onSelect: () => editor.notify('info', `Use ${shortcutFor('paste')} to paste`),
        },
        { label: 'Select all', icon: null, shortcut: shortcutFor('selectAll'), onSelect: run('selectAll') },
        { label: 'Zoom to fit', icon: <IconFit size={14} />, shortcut: shortcutFor('zoomFit'), onSelect: run('zoomFit') },
      ];

  return <ActionMenu anchor={{ x: menu.x, y: menu.y }} items={items.filter(Boolean)} onClose={close} label="Canvas actions" />;
}
