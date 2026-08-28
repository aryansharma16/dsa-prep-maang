import { useEffect, useRef } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { chatStream } from '../../store/chatStream.js';
import { IconSparkle } from '../ui/Icons.jsx';
import { ChatMessage } from './ChatMessage.jsx';

/** Within this many pixels of the bottom counts as "following along". */
const STICK_PX = 48;

export function ChatThread({ onPick }) {
  const { messages, suggestions, loadingThread, streaming, mode } = useChat();
  const scrollRef = useRef(null);
  const stuckRef = useRef(true);

  /*
    Follow the reply down, but stop the moment they scroll up.

    Someone re-reading the top of an answer while the rest of it arrives must
    not be yanked back to the bottom every frame — that is the single most
    irritating thing a streaming chat can do. `stuck` is recomputed on every
    scroll and only pins while it is true.
  */
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return undefined;
    const onScroll = () => {
      stuckRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < STICK_PX;
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  const pin = () => {
    const el = scrollRef.current;
    if (el && stuckRef.current) el.scrollTop = el.scrollHeight;
  };

  // New turn, or the thread was swapped: go to the bottom regardless.
  useEffect(() => {
    stuckRef.current = true;
    pin();
  }, [messages.length, loadingThread]);

  // Growing text does not change `messages`, so the stream store is what says
  // "there is more of it now".
  useEffect(() => {
    if (!streaming) return undefined;
    return chatStream.subscribe(pin);
  }, [streaming]);

  return (
    <div className="chat-scroll" ref={scrollRef} aria-live="polite">
      <div className="chat-thread">
        {loadingThread && <div className="loading">Loading...</div>}

        {!loadingThread && messages.length === 0 && (
          <div className="chat-greet">
            <span className="chat-greet-mark">
              <IconSparkle size={17} />
            </span>
            {/* Who is actually answering. The suggestions below already switch
                with the route, and a greeting that did not would be the coach
                introducing itself as somebody else. */}
            {mode === 'cp' ? (
              <>
                <h4>Hi! I&apos;m your CP coach.</h4>
                <p>
                  Ask for a nudge on a ladder problem, or attach one with + so I know the rating and
                  contest you mean.
                </p>
              </>
            ) : (
              <>
                <h4>Hi! I&apos;m your study assistant.</h4>
                <p>Ask about syntax, a pattern, complexity, or a problem you&apos;re stuck on.</p>
              </>
            )}

            {suggestions.length > 0 && (
              <>
                <p className="chat-suggest-label">Suggested</p>
                <div className="chat-suggest">
                  {suggestions.map((s) => (
                    <button key={s} type="button" className="chat-chip" onClick={() => onPick(s)}>
                      {s}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {messages.map((message) => (
          <ChatMessage key={message.id} message={message} />
        ))}
      </div>
    </div>
  );
}
