import { useEffect, useRef, useState } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { ratingColour } from '../../theme/cfRating.js';
import { IconClock, IconClose, IconGrid, IconPlus, IconSend, IconStop } from '../ui/Icons.jsx';
import { ModelPicker } from './ModelPicker.jsx';
import { untilLabel } from './time.js';

/** Grows with the text, then scrolls. Matches the max-height in the stylesheet. */
const MAX_H = 132;

export function ChatComposer({ attached, onAttach, onDetach, onSend }) {
  const { streaming, stop, models, maxInputChars, enabled, retryAt } = useChat();
  const [text, setText] = useState('');
  // Re-render once a minute so a countdown does not sit there going stale while
  // someone is looking at it. Only while there is something to count down to.
  const [, tick] = useState(0);
  const ref = useRef(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, MAX_H)}px`;
  }, [text]);

  useEffect(() => {
    if (!retryAt) return undefined;
    const timer = setInterval(() => tick((n) => n + 1), 30000);
    return () => clearInterval(timer);
  }, [retryAt]);

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
    /*
      Three nested elements, each with one job: the rail spans the panel so its
      top border does, `-inner` holds the reading column so the field lines up
      with the prose above it, and `.chat-box` is the field itself — everything
      you can do to a message lives inside that border, which is what makes Send
      read as belonging to the text rather than floating on the panel.
    */
    <div className="chat-composer">
      <div className="chat-composer-inner">
        <div className="chat-box">
          {attached && (
            <span className="chat-attach">
              <IconGrid size={10} />
              {/*
                A ladder problem is identified by its contest code and rating, a
                roadmap problem by its difficulty word. Which one this is comes
                from the object rather than from the route, so a chip that
                outlives a navigation still describes what it actually holds.
              */}
              {attached.rating || attached.code ? (
                <span className="chat-attach-rating mono" style={{ color: ratingColour(attached.rating) }}>
                  {attached.code || attached.rating}
                </span>
              ) : (
                attached.difficulty && (
                  <span className={`diff ${attached.difficulty}`}>{attached.difficulty}</span>
                )
              )}
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
            placeholder={
              !enabled
                ? 'The assistant is unavailable'
                : usable.length === 0
                  ? 'No model available right now'
                  : 'Ask anything...'
            }
            disabled={!enabled || usable.length === 0}
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

            {usable.length > 0 && <ModelPicker />}

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
        </div>

        {/* Outside the box: it explains why the box does nothing, so it must not
            look like part of it. */}
        {enabled && usable.length === 0 && (
          <p className="chat-wait">
            <IconClock size={12} />
            {retryAt ? (
              <span>
                Every model has hit its limit. Back in <b>{untilLabel(retryAt)}</b>.
              </span>
            ) : (
              <span>No model is available on the server.</span>
            )}
          </p>
        )}

        {/* Enter sends, so say so once rather than in a tooltip nobody opens.
            Only where there is room — the dock hides it. */}
        <p className="chat-tip">
          <kbd>Enter</kbd> to send, <kbd>Shift</kbd> + <kbd>Enter</kbd> for a new line
        </p>
      </div>
    </div>
  );
}
