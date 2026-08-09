import { useEffect, useRef, useState } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { IconClose, IconGrid, IconPlus, IconSend, IconStop } from '../ui/Icons.jsx';

/** Grows with the text, then scrolls. Matches the max-height in the stylesheet. */
const MAX_H = 132;

export function ChatComposer({ attached, onAttach, onDetach, onSend }) {
  const { streaming, stop, models, model, setModel, maxInputChars, enabled } = useChat();
  const [text, setText] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, [text]);

  const usable = models.filter((m) => m.available);
  const tooLong = text.length > maxInputChars;
  const canSend = enabled && !streaming && text.trim().length > 0 && !tooLong && usable.length > 0;

  const submit = () => {
    if (!canSend) return;
    onSend(text);
    setText('');
  };

  const onKeyDown = (e) => {
    // Enter sends, Shift+Enter breaks the line. The convention every chat uses,
    // and the reason the composer is a textarea rather than an input.
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="chat-composer">
      {attached && (
        <span className="chat-attach">
          <IconGrid size={10} />
          <span className={`diff ${attached.difficulty}`}>{attached.difficulty}</span>
          <span className="nm">{attached.title}</span>
          <button
            type="button"
            onClick={onDetach}
            aria-label={`Remove ${attached.title}`}
            // Tab goes from the textarea to Send, not through the chip.
            tabIndex={-1}
          >
            <IconClose size={9} />
          </button>
        </span>
      )}

      <textarea
        ref={ref}
        rows={1}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder={enabled ? 'Ask anything...' : 'The assistant is unavailable'}
        disabled={!enabled}
        aria-label="Message"
      />

      <div className="chat-composer-acts">
        <button
          type="button"
          className="icon-btn"
          onClick={onAttach}
          title="Attach a problem for context"
          aria-label="Attach a problem"
          disabled={!enabled}
        >
          <IconPlus size={14} />
        </button>

        {usable.length > 0 && (
          <select
            className="select chat-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            aria-label="Model"
          >
            {models.map((m) => (
              <option key={`${m.provider}:${m.id}`} value={m.id} disabled={!m.available}>
                {m.label}
                {m.available ? '' : ' — unavailable'}
              </option>
            ))}
          </select>
        )}

        <span className="spacer" />

        {tooLong && <span className="chat-count over">{text.length}/{maxInputChars}</span>}

        {streaming ? (
          <button type="button" className="chat-send stop" onClick={stop} title="Stop" aria-label="Stop">
            <IconStop size={12} />
          </button>
        ) : (
          <button
            type="button"
            className="chat-send"
            onClick={submit}
            disabled={!canSend}
            title="Send"
            aria-label="Send"
          >
            <IconSend size={14} />
          </button>
        )}
      </div>

      {enabled && usable.length === 0 && (
        <p className="hint">No model is configured on the server.</p>
      )}
    </div>
  );
}
