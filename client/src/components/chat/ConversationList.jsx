import { useEffect, useRef } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { IconClose, IconPlus, IconTrash } from '../ui/Icons.jsx';

/**
 * Saved threads. The rail on the full page, a sheet inside the dock.
 *
 * Every row shows how long it has left, because "deleted after 24 hours" is a
 * promise the interface should keep visible rather than mention once in a
 * settings screen.
 */

export const expiresIn = (value) => {
  if (!value) return '';
  const mins = Math.round((new Date(value) - Date.now()) / 60000);
  if (mins <= 0) return 'expiring';
  if (mins < 60) return `${mins}m left`;
  return `${Math.round(mins / 60)}h left`;
};

export function ConversationList({ variant = 'rail', onClose }) {
  const { conversations, conversationId, openConversation, removeConversation, newConversation, retentionHours } =
    useChat();
  const ref = useRef(null);

  useEffect(() => {
    if (variant !== 'sheet') return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose?.();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose?.();
      }
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [variant, onClose]);

  const open = (id) => {
    openConversation(id);
    onClose?.();
  };

  return (
    <div className={variant === 'sheet' ? 'chat-sheet' : 'chat-rail'} ref={ref}>
      <div className={variant === 'sheet' ? 'chat-sheet-head' : 'chat-rail-head'}>
        <button
          type="button"
          className="btn ghost"
          onClick={() => {
            newConversation();
            onClose?.();
          }}
        >
          <IconPlus size={12} />
          New chat
        </button>
        <span className="spacer" />
        {variant === 'sheet' && (
          <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
            <IconClose size={13} />
          </button>
        )}
      </div>

      <div className="chat-rail-scroll">
        {conversations.length === 0 && <div className="empty">No saved chats yet.</div>}

        {conversations.map((c) => (
          // A row, not a button — the delete control cannot be nested inside
          // the one that opens it.
          <div key={c._id} className={`chat-conv ${c._id === conversationId ? 'on' : ''}`}>
            <button type="button" className="chat-conv-open" onClick={() => open(c._id)} title={c.title}>
              <span className="nm">{c.title}</span>
              <span className="chat-conv-time mono">{expiresIn(c.expiresAt)}</span>
            </button>
            <button
              type="button"
              className="icon-btn chat-conv-del"
              onClick={() => removeConversation(c._id)}
              aria-label={`Delete ${c.title}`}
              title="Delete"
            >
              <IconTrash size={12} />
            </button>
          </div>
        ))}
      </div>

      {variant === 'rail' && (
        <div className="chat-rail-foot">
          <p className="hint">Chats are deleted {retentionHours}h after the last message.</p>
        </div>
      )}
    </div>
  );
}
