import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { AUTH_EXPIRED_EVENT } from '../api/http.js';
import { authApi } from '../api/index.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  // On boot the access cookie may have expired; the http interceptor refreshes
  // transparently, so a failure here means genuinely signed out.
  useEffect(() => {
    authApi
      .me()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setReady(true));
  }, []);

  // A refresh that cannot be revived means the session is over — drop straight
  // back to the login screen rather than leaving every action failing.
  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener(AUTH_EXPIRED_EVENT, onExpired);
    return () => window.removeEventListener(AUTH_EXPIRED_EVENT, onExpired);
  }, []);

  const login = useCallback(async (body) => setUser(await authApi.login(body)), []);
  const register = useCallback(async (body) => setUser(await authApi.register(body)), []);
  const logout = useCallback(async () => {
    await authApi.logout().catch(() => {});
    setUser(null);
  }, []);

  /**
   * For the endpoints that return an updated user — the avatar ones today.
   * Everything reading `user` from context (the sidebar, the profile card)
   * re-renders together, so a new picture never appears in one place and not
   * the other.
   */
  const applyUser = useCallback((next) => setUser(next), []);

  const value = useMemo(
    () => ({ user, ready, login, register, logout, applyUser }),
    [user, ready, login, register, logout, applyUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
