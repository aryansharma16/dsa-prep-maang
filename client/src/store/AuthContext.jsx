import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_EXPIRED_EVENT } from '../api/http.js';
import { authApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  /**
   * Which side-menu modules this session may see, from the same response as the
   * user. Null until the session resolves, which every reader treats as "show
   * nothing yet" — see store/modules.js.
   */
  const [modules, setModules] = useState(null);

  // Applied together, always. A user from one response and a module list from
  // another is a menu that belongs to nobody.
  const applySession = useCallback((session) => {
    setUser(session.user);
    setModules(session.modules);
  }, []);

  const endSession = useCallback(() => {
    setUser(null);
    setModules(null);
  }, []);

  // On boot the access cookie may have expired; the http interceptor refreshes
  // transparently, so a failure here means genuinely signed out.
  useEffect(() => {
    authApi
      .me()
      .then(applySession)
      .catch(endSession)
      .finally(() => setReady(true));
  }, [applySession, endSession]);

  // A refresh that cannot be revived means the session is over — drop straight
  // back to the login screen rather than leaving every action failing.
  useEffect(() => {
    window.addEventListener(AUTH_EXPIRED_EVENT, endSession);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, endSession);
  }, [endSession]);

  const login = useCallback(async (body) => applySession(await authApi.login(body)), [applySession]);
  const register = useCallback(
    async (body) => applySession(await authApi.register(body)),
    [applySession],
  );
  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    endSession();
  }, [endSession]);

  /**
   * Re-reads the session. For the admin panel: a super admin who has just
   * hidden a module should watch it leave their own side menu, rather than
   * being told it worked and having to reload to see it.
   */
  const refreshSession = useCallback(
    async () => applySession(await authApi.me()),
    [applySession],
  );

  /**
   * For the endpoints that return an updated user — the avatar ones today.
   * Everything reading `user` from context (the sidebar, the profile card)
   * re-renders together, so a new picture never appears in one place and not
   * the other.
   */
  const applyUser = useCallback((next) => setUser(next), []);

  const value = useMemo(
    () => ({ user, modules, ready, login, register, logout, applyUser, refreshSession }),
    [user, modules, ready, login, register, logout, applyUser, refreshSession],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
