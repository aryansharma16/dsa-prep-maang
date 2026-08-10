import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { errorMessage } from '../api/http.js';
import { chatApi } from '../api/index.js';
import { streamChat } from '../api/stream.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { useAuth } from './AuthContext.jsx';
import { chatStream } from './chatStream.js';
import { moduleVisible } from './modules.js';

/**
 * One conversation state for the whole app.
 *
 * The dock and the /chat page are the same conversation seen through two
 * frames, so they cannot each own a copy — expanding the dock mid-reply would
 * abort the stream and lose the text. Everything lives here instead, and both
 * surfaces render from it.
 *
 * Mounted inside the signed-in branch of App.jsx, deliberately. When `user`
 * goes null that whole tree unmounts and takes the messages with it, so one
 * account's questions cannot survive into the next session on a shared
 * machine. Do not hoist this next to ToastProvider in main.jsx.
 */

const ChatContext = createContext(null);
export const useChat = () => useContext(ChatContext);

let seq = 0;
const nextId = () => `local-${(seq += 1)}`;

const FALLBACK_SUGGESTIONS = [
  'What is a monotonic stack?',
  'Explain two pointers with an example',
  'When do I use BFS over DFS?',
];

export function ChatProvider({ children }) {
  /*
    The provider stays mounted when chat is hidden — its consumers would have to
    cope with a null context otherwise, and none of them are rendered anyway —
    but it stops reaching for the API. Without this, hiding chat leaves every
    session making two requests on boot for a feature it cannot see, and both
    now answer 404.
  */
  const { modules } = useAuth();
  const enabledHere = moduleVisible(modules, 'chat');

  const [config, setConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  /**
   * When the models come back, if they are all currently spent.
   *
   * Held separately from `config` because it is learned two ways — the config
   * fetch reports it up front, and a send that exhausts the last model reports
   * it in the failure — and the second must not wait for a refetch to be shown.
   */
  const [retryAt, setRetryAt] = useState(null);

  const [conversations, setConversations] = useState([]);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThread, setLoadingThread] = useState(false);

  const [streaming, setStreaming] = useState(false);
  const [dockOpen, setDockOpen] = useState(false);
  const [unread, setUnread] = useState(false);

  // Persisted so the picker remembers you, validated against the server's list
  // below — a key removed server-side must not leave you stuck on a dead model.
  const [model, setModel] = useLocalState('chat-model', '');

  /*
    Refs shadow the state that `send` reads. The callback closes over its
    values, and two messages sent in quick succession would otherwise post the
    second one against a stale conversation id — creating a second thread
    instead of continuing the first.
  */
  const conversationRef = useRef(null);
  const streamingRef = useRef(false);
  const abortRef = useRef(null);
  const dockOpenRef = useRef(false);

  useEffect(() => {
    conversationRef.current = conversationId;
  }, [conversationId]);
  useEffect(() => {
    dockOpenRef.current = dockOpen;
  }, [dockOpen]);

  useEffect(() => {
    if (!enabledHere) return undefined;
    let live = true;
    chatApi
      .config()
      .then((data) => {
        if (!live) return;
        setConfig(data);
        setRetryAt(data.retryAt || null);
        /*
          An empty string is Auto, and it is the default — a new reader gets
          task-based routing without having to know what any of these models
          are.

          A named model that is gone or out of requests falls back *to Auto*,
          not to some other named model. Auto already knows how to find a
          working one, and silently pinning someone to a specific replacement
          just means they hit the same wall again tomorrow.
        */
        setModel((current) => {
          if (!current) return '';
          return data.models.some((m) => m.id === current && m.available) ? current : '';
        });
      })
      .catch((err) => live && setConfigError(errorMessage(err, 'The assistant is unavailable')));
    return () => {
      live = false;
    };
  }, [enabledHere, setModel]);

  const refreshList = useCallback(() => {
    if (!enabledHere) return;
    chatApi.conversations().then(setConversations).catch(() => {});
  }, [enabledHere]);

  useEffect(() => {
    refreshList();
  }, [refreshList]);

  const providerFor = useCallback(
    (id) => config?.models.find((m) => m.id === id)?.provider,
    [config],
  );

  const send = useCallback(
    async (raw, { problem } = {}) => {
      const content = String(raw || '').trim();
      if (!content || streamingRef.current) return;

      const userMessage = { id: nextId(), role: 'user', content, problem: problem || null };
      const draft = { id: nextId(), role: 'assistant', content: '', live: true };
      setMessages((prev) => [...prev, userMessage, draft]);

      chatStream.reset();
      streamingRef.current = true;
      setStreaming(true);

      const controller = new AbortController();
      abortRef.current = controller;

      let failure = null;

      try {
        await streamChat(
          {
            content,
            conversationId: conversationRef.current,
            model: model || undefined,
            provider: providerFor(model),
            problemId: problem?._id,
          },
          {
            signal: controller.signal,
            onEvent: ({ event, data }) => {
              const payload = JSON.parse(data);
              if (event === 'delta') {
                chatStream.push(payload.t);
              } else if (event === 'start') {
                // Which model actually answered. Worth showing: on Auto the
                // reader did not choose it, and a router you cannot see is one
                // you cannot trust. One setState per reply, not per token.
                setMessages((prev) =>
                  prev.map((m) =>
                    m.id === draft.id ? { ...m, model: payload.model, provider: payload.provider } : m,
                  ),
                );
                // The thread exists from this moment. Adopt its id before any
                // further send can race against a null one.
                conversationRef.current = payload.conversationId;
                setConversationId(payload.conversationId);
                setConversations((prev) =>
                  prev.some((c) => c._id === payload.conversationId)
                    ? prev
                    : [
                        {
                          _id: payload.conversationId,
                          title: payload.title,
                          messageCount: 0,
                          lastMessageAt: new Date().toISOString(),
                        },
                        ...prev,
                      ],
                );
              } else if (event === 'title') {
                setConversations((prev) =>
                  prev.map((c) =>
                    c._id === conversationRef.current ? { ...c, title: payload.title } : c,
                  ),
                );
              } else if (event === 'error') {
                failure = payload.message || 'The assistant stopped responding';
              }
            },
          },
        );
      } catch (err) {
        // Stop is a deliberate act, not a failure — whatever arrived is kept.
        if (err.name !== 'AbortError') {
          failure = errorMessage(err, 'The assistant stopped responding');
          /*
            Running the last model dry is the one failure with a knowable end.
            Recording it here rather than waiting for the next config fetch is
            what lets the composer say "back in 4 hours" on the same click that
            caused it.
          */
          if (err.meta?.retryAt) setRetryAt(err.meta.retryAt);
          if (err.code === 'ALL_PROVIDERS_FAILED' || err.code === 'CHAT_QUOTA') {
            chatApi.config().then((data) => {
              setConfig(data);
              setRetryAt(data.retryAt || err.meta?.retryAt || null);
            }).catch(() => {});
          }
        }
      } finally {
        const text = chatStream.get();
        setMessages((prev) =>
          prev.map((m) => (m.id === draft.id ? { ...m, content: text, live: false, error: failure } : m)),
        );
        chatStream.reset();
        streamingRef.current = false;
        setStreaming(false);
        abortRef.current = null;
        refreshList();
        if (!dockOpenRef.current) setUnread(true);
      }
    },
    [model, providerFor, refreshList],
  );

  const stop = useCallback(() => {
    abortRef.current?.abort();
    // Best-effort: tells the server to release the upstream in the (common)
    // case where it is the same worker. The abort above is what actually ends
    // the reply on screen.
    if (conversationRef.current) chatApi.stop(conversationRef.current).catch(() => {});
  }, []);

  const newConversation = useCallback(() => {
    abortRef.current?.abort();
    chatStream.reset();
    conversationRef.current = null;
    setConversationId(null);
    setMessages([]);
  }, []);

  const openConversation = useCallback(async (id) => {
    abortRef.current?.abort();
    chatStream.reset();
    setLoadingThread(true);
    conversationRef.current = id;
    setConversationId(id);
    try {
      const { messages: rows } = await chatApi.conversation(id);
      setMessages(
        rows.map((m) => ({
          id: m._id,
          role: m.role,
          content: m.content,
          model: m.model,
          provider: m.provider,
          truncated: m.truncated,
          problem: m.problemSlug ? { slug: m.problemSlug, title: m.problemSlug } : null,
        })),
      );
    } catch (err) {
      setMessages([]);
      setConfigError(errorMessage(err, 'Could not open that conversation'));
    } finally {
      setLoadingThread(false);
    }
  }, []);

  const removeConversation = useCallback(
    async (id) => {
      await chatApi.remove(id);
      setConversations((prev) => prev.filter((c) => c._id !== id));
      if (conversationRef.current === id) {
        conversationRef.current = null;
        setConversationId(null);
        setMessages([]);
      }
    },
    [],
  );

  const openDock = useCallback((open) => {
    setDockOpen(open);
    if (open) setUnread(false);
  }, []);

  const value = useMemo(
    () => ({
      ready: Boolean(config),
      configError,
      enabled: config?.enabled ?? false,
      models: config?.models ?? [],
      suggestions: config?.suggestions?.length ? config.suggestions : FALLBACK_SUGGESTIONS,
      retentionHours: config?.retentionHours ?? 24,
      maxInputChars: config?.maxInputChars ?? 4000,
      retryAt,
      model,
      setModel,
      conversations,
      conversationId,
      messages,
      loadingThread,
      streaming,
      dockOpen,
      setDockOpen: openDock,
      unread,
      send,
      stop,
      newConversation,
      openConversation,
      removeConversation,
    }),
    [
      config,
      configError,
      retryAt,
      model,
      setModel,
      conversations,
      conversationId,
      messages,
      loadingThread,
      streaming,
      dockOpen,
      openDock,
      unread,
      send,
      stop,
      newConversation,
      openConversation,
      removeConversation,
    ],
  );

  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}
