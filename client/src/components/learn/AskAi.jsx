import { useAuth } from '../../store/AuthContext.jsx';
import { useChat } from '../../store/ChatContext.jsx';
import { moduleVisible } from '../../store/modules.js';
import { IconSparkle } from '../ui/Icons.jsx';

/**
 * The hand-off from a topic to the study assistant.
 *
 * A reference answers the question it was written for. The one you actually
 * have is the one next to it — "but what happens if the dependency is an
 * object", "show me that with my case" — and that is a conversation, not a
 * document. This is the shortest path from reading to asking: the questions are
 * pre-written per topic, so the click that opens the dock is also the click that
 * sends.
 *
 * No new chat plumbing. `ChatLauncher` already mounts the dock on every
 * signed-in page from `AppShell`, and `ChatContext` already holds one
 * conversation shared by the dock and the /chat page — so an answer started here
 * is still there after navigating away, and expanding it keeps the thread.
 *
 * Renders nothing when the super admin has hidden the chat module: opening a
 * dock that is not mounted would do nothing at all, and a dead button is worse
 * than no button.
 */
export function AskAi({ questions, compact = false }) {
  const { modules } = useAuth();
  const { setDockOpen, send, streaming } = useChat();

  if (!moduleVisible(modules, 'chat')) return null;
  if (!questions?.length) return null;

  const ask = (question) => {
    setDockOpen(true);
    // A send while a reply is already streaming is dropped by the context, so
    // the buttons disable rather than silently doing nothing.
    send(question);
  };

  return (
    <div className={`learn-ask ${compact ? 'compact' : ''}`}>
      <p className="learn-ask-label">
        <IconSparkle size={12} />
        Ask the assistant
      </p>
      <div className="learn-ask-list">
        {questions.map((question) => (
          <button
            key={question}
            type="button"
            className="learn-ask-btn"
            onClick={() => ask(question)}
            disabled={streaming}
            title={streaming ? 'The assistant is still replying' : 'Ask this in the chat dock'}
          >
            {question}
          </button>
        ))}
      </div>
    </div>
  );
}
