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
  const { dockOpen, setDockOpen, streaming, unread, mode } = useChat();
  const { modules } = useAuth();
  const { pathname } = useLocation();
  const navigate = useNavigate();

  /*
    Which assistant the bubble opens, said out loud. The dock follows the route
    — see ChatContext — and a coach that answers differently without ever saying
    it is a different coach is a surprise rather than a feature.
  */
  const isCp = mode === 'cp';
  const label = isCp ? 'CP coach' : 'Study assistant';

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
        className={`chat-launcher ${dockOpen ? 'on' : ''} ${isCp ? 'cp' : ''}`}
        onClick={() => setDockOpen(!dockOpen)}
        aria-expanded={dockOpen}
        aria-label={streaming ? `${label} — replying` : label}
        title={label}
      >
        {dockOpen ? <IconClose size={17} /> : <IconChat size={18} />}
        {!dockOpen && (streaming || unread) && (
          <span className={`chat-launcher-dot ${streaming ? 'busy' : ''}`} />
        )}
      </button>

      {/*
        No click-outside close. A chat panel you are reading while scrolling
        the roadmap behind it must not vanish when you click the page. Escape,
        the ✕, and the bubble itself are the three ways out.
      */}
      {dockOpen && (
        <div className={`chat-dock ${isCp ? 'cp-dock' : ''}`} role="complementary" aria-label={label}>
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
