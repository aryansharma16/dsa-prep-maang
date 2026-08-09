import { useState } from 'react';
import { useChat } from '../../store/ChatContext.jsx';
import { IconClock, IconClose, IconExpand, IconPlus, IconSparkle } from '../ui/Icons.jsx';
import { ChatComposer } from './ChatComposer.jsx';
import { ChatThread } from './ChatThread.jsx';
import { ConversationList } from './ConversationList.jsx';
import { ProblemPicker } from './ProblemPicker.jsx';

/**
 * Head, thread, composer — the same body in the dock and on the full page.
 *
 * Only the chrome differs, which is why this takes a `variant` instead of
 * existing twice. Two implementations of a chat panel is two places to fix a
 * scrolling bug.
 */

/*
  Keep the page's single-key shortcuts out of the panel.

  The roadmap listens on window for s/f/r/n/j/k and the shell for "/", and both
  already skip INPUT and TEXTAREA — so typing in the composer is safe. What is
  not safe is a focused *button* in here: pressing "j" with Send focused would
  walk the cursor down the table behind the panel.

  useDialog is the usual answer and is wrong here. It traps Tab and increments
  the "a modal is open" counter, which would make this panel modal — and the
  whole point of the dock is that the page underneath stays usable. Swallowing
  bare printable keys at the panel boundary buys the suppression without the
  trap. React attaches its listener at the root container, below window, so
  stopping propagation here really does stop it there.
*/
const scopeKeys = (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key.length === 1) e.stopPropagation();
};

export function ChatPanel({ variant, onExpand, onClose }) {
  const chat = useChat();
  // Per message, not per conversation: you can ask about one problem and then
  // another in the same thread.
  const [attached, setAttached] = useState(null);
  const [sheet, setSheet] = useState(null);

  return (
    <div className={`chat-panel ${variant}`} onKeyDown={scopeKeys}>
      <header className="chat-head">
        <span className="chat-head-mark" aria-hidden="true">
          <IconSparkle size={12} />
        </span>
        <span className="chat-head-id">Study assistant</span>
        <span className="spacer" />

        {variant === 'dock' ? (
          <>
            <button
              type="button"
              className="icon-btn"
              onClick={() => chat.newConversation()}
              title="New chat"
              aria-label="New chat"
            >
              <IconPlus size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSheet('history')}
              title="Past chats"
              aria-label="Past chats"
            >
              <IconClock size={14} />
            </button>
            <button
              type="button"
              className="icon-btn"
              onClick={onExpand}
              title="Open full screen"
              aria-label="Open full screen"
            >
              <IconExpand size={13} />
            </button>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Close">
              <IconClose size={13} />
            </button>
          </>
        ) : (
          /*
            Only below 900px, where the CSS hides the rail — above that the rail
            owns both of these and a second copy in the header is just clutter.
            Rendered rather than conditionally mounted so the breakpoint lives in
            one place, next to the rule that hides the rail.
          */
          <span className="chat-head-narrow">
            <button
              type="button"
              className="icon-btn"
              onClick={() => setSheet('history')}
              title="Past chats"
              aria-label="Past chats"
            >
              <IconClock size={14} />
            </button>
            <button type="button" className="btn ghost" onClick={() => chat.newConversation()}>
              <IconPlus size={12} />
              New chat
            </button>
          </span>
        )}
      </header>

      {chat.configError && <div className="alert">{chat.configError}</div>}

      <ChatThread onPick={(q) => chat.send(q)} />

      <ChatComposer
        attached={attached}
        onAttach={() => setSheet('problems')}
        onDetach={() => setAttached(null)}
        onSend={(text) => {
          chat.send(text, { problem: attached });
          setAttached(null);
        }}
      />

      {sheet === 'problems' && (
        <ProblemPicker
          onPick={(problem) => {
            setAttached(problem);
            setSheet(null);
          }}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'history' && <ConversationList variant="sheet" onClose={() => setSheet(null)} />}
    </div>
  );
}
