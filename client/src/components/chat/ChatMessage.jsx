import { useSyncExternalStore } from 'react';
import { chatStream } from '../../store/chatStream.js';
import { IconGrid, IconSparkle } from '../ui/Icons.jsx';
import { ChatMarkdown } from './ChatMarkdown.jsx';

/**
 * One turn.
 *
 * The live bubble is its own component so that it, and only it, subscribes to
 * the stream store. `ChatThread` maps over the message list and does not
 * re-render at all while a reply arrives — which is the difference between
 * re-parsing one markdown block per frame and re-parsing the entire
 * conversation forty times a second.
 */

function LiveBody() {
  const text = useSyncExternalStore(chatStream.subscribe, chatStream.snapshot);
  if (!text) {
    return (
      <span className="chat-typing" aria-label="Thinking">
        <i />
        <i />
        <i />
      </span>
    );
  }
  return <ChatMarkdown text={text} streaming />;
}

export function ChatMessage({ message }) {
  const { role, problem, live, content, error, truncated, model } = message;

  return (
    <div className={`chat-msg ${role}`}>
      {role === 'assistant' && (
        <span className="chat-msg-mark" aria-hidden="true">
          <IconSparkle size={12} />
        </span>
      )}

      <div className="chat-msg-body">
        {problem && (
          <span className="chat-attach static">
            <IconGrid size={10} />
            <span className="nm">{problem.title}</span>
          </span>
        )}

        {live ? <LiveBody /> : <ChatMarkdown text={content} />}

        {/* Which model wrote this. On Auto nobody chose it, and a router you
            cannot see is one you cannot judge — so it says so, quietly. */}
        {role === 'assistant' && model && !live && <div className="chat-msg-model mono">{model}</div>}

        {truncated && !error && <div className="chat-err">The reply was cut short. Ask again to continue.</div>}
        {error && <div className="chat-err">{error}</div>}
      </div>
    </div>
  );
}
