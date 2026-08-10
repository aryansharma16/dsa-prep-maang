import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext.jsx';
import { useChat } from '../../store/ChatContext.jsx';
import { moduleVisible } from '../../store/modules.js';
import { IconChat, IconClose } from '../ui/Icons.jsx';
import { ChatPanel } from './ChatPanel.jsx';

/**
 * The bubble, and the panel it opens.
 *
 * Mounted once in AppShell, so it is on every signed-in page and on none of the
 * signed-out ones. Hidden on /chat itself — a shortcut to the page you are
 * already looking at is just clutter.
 */
export function ChatLauncher() {
  const { dockOpen, setDockOpen, streaming, unread } = useChat();
  const { modules } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!dockOpen) return undefined;
    const onKey = (e) => e.key === 'Escape' && setDockOpen(false);
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dockOpen, setDockOpen]);

  /*
    The bubble floats over every page, so it is the one part of chat that
    outlives its own nav item — hiding the module has to take this with it, or
    the side menu loses a link and the app keeps a button that opens the whole
    feature anyway.
  */
  if (!moduleVisible(modules, 'chat')) return null;

  if (pathname === '/chat') return null;

  return (
    <>
      <button
        type="button"
        className={`chat-launcher ${dockOpen ? 'on' : ''}`}
        onClick={() => setDockOpen(!dockOpen)}
        aria-expanded={dockOpen}
        aria-label={streaming ? 'Study assistant — replying' : 'Study assistant'}
        title="Study assistant"
      >
        {dockOpen ? <IconClose size={17} /> : <IconChat size={18} />}
        {!dockOpen && (streaming || unread) && (
          <span className={`chat-launcher-dot ${streaming ? 'busy' : ''}`} />
        )}
      </button>

      {/*
        No click-outside close. AttemptPopover's dismiss-on-outside-click is
        right for a 210px popover; a chat panel you are reading while scrolling
        the roadmap behind it must not vanish when you click the page. Escape,
        the ✕, and the bubble itself are the three ways out.
      */}
      {dockOpen && (
        <div className="chat-dock" role="complementary" aria-label="Study assistant">
          <ChatPanel
            variant="dock"
            onExpand={() => {
              setDockOpen(false);
              navigate('/chat');
            }}
            onClose={() => setDockOpen(false)}
          />
        </div>
      )}
    </>
  );
}
