import { ChatPanel } from '../components/chat/ChatPanel.jsx';
import { ConversationList } from '../components/chat/ConversationList.jsx';

/**
 * The full-size assistant.
 *
 * Renders the same ChatPanel the dock does, next to the thread rail. Because
 * every piece of chat state lives in ChatProvider, arriving here from the dock
 * mid-reply picks the stream up exactly where it was — nothing is refetched and
 * nothing is interrupted.
 */
export function Chat() {
  return (
    <div className="chat-page">
      <ConversationList variant="rail" />
      <ChatPanel variant="full" />
    </div>
  );
}
