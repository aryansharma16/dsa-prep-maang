import { createContext, useCallback, useContext, useEffect, useMemo, useRef } from 'react';
import { authApi } from '../api/index.js';
import { useLocalState } from '../hooks/useLocalState.js';
import { DEFAULT_APPEARANCE, applyAppearance, normalize } from '../theme/accents.js';
import { useAuth } from './AuthContext.jsx';

/**
 * Theme and accent colour.
 *
 * Two stores, on purpose. The account is where the choice lives — that is what
 * makes it follow you to another machine — but the account arrives one request
 * after the first paint, and a UI that flashed amber before turning violet on
 * every load would be worse than not syncing at all. So localStorage holds a
 * copy, the pre-paint script in index.html reads it before React exists, and the
 * server reconciles a moment later.
 *
 * Mounted outside <App/> so the signed-out login and register pages are themed
 * too — they read the local copy, which is all there is when nobody is signed in.
 */
const AppearanceContext = createContext(null);

/* Long enough that dragging the native colour picker sends one request at the
   end rather than one per frame. */
const PUSH_DELAY = 400;

const toPrefs = ({ theme, accent, custom }) => ({ theme, accent, accentCustom: custom });
const fromPrefs = (p) => ({ theme: p.theme, accent: p.accent, custom: p.accentCustom });
const keyOf = ({ theme, accent, custom }) => `${theme}|${accent}|${custom}`;

/**
 * Seed from the standalone `theme` key this replaced, if that is all a browser
 * has.
 *
 * The bootstrap in index.html reads that key too, so first paint is already
 * right — but without the same fallback here React would mount on the defaults
 * and flip a light-theme user to dark a moment after the page appeared. Worse
 * than not migrating at all, because it looks like a bug rather than a reset.
 */
function initialAppearance() {
  try {
    if (localStorage.getItem('appearance')) return DEFAULT_APPEARANCE;
    const legacy = JSON.parse(localStorage.getItem('theme'));
    if (legacy === 'light' || legacy === 'dark') return { ...DEFAULT_APPEARANCE, theme: legacy };
  } catch {
    /* private mode, or nothing worth migrating */
  }
  return DEFAULT_APPEARANCE;
}

export function AppearanceProvider({ children }) {
  const { user } = useAuth();
  const [stored, setStored] = useLocalState('appearance', initialAppearance());

  const appearance = useMemo(() => normalize(stored), [stored]);

  /*
    Normalising on the way in as well as the way out, so what lands in
    localStorage always carries the derived custom values. The bootstrap script
    cannot compute them — it has no module system — so it can only read them.
  */
  const update = useCallback(
    (patch) => setStored((prev) => normalize({ ...normalize(prev), ...patch })),
    [setStored],
  );

  // Corrects whatever the pre-paint script guessed, and repaints on every change.
  useEffect(() => {
    applyAppearance(appearance);
  }, [appearance]);

  /*
    `null` means "the account and this device may disagree, push". It is set
    whenever the two are known to match, which is the only thing stopping the
    adopt below and the push further down from talking past each other.
  */
  const synced = useRef(null);
  const adoptedFor = useRef(null);

  useEffect(() => {
    const id = user?._id ?? null;
    if (!id) {
      adoptedFor.current = null;
      synced.current = null;
      return;
    }
    // Only on the way in. Re-running on every `user` identity change would
    // undo a colour picked seconds ago.
    if (adoptedFor.current === id) return;
    adoptedFor.current = id;

    if (user.prefs) {
      update(fromPrefs(user.prefs));
      synced.current = keyOf(normalize(fromPrefs(user.prefs)));
    } else {
      // No prefs on the account yet — the first sign-in since this shipped.
      // Carry this device's choice up rather than resetting them to defaults.
      synced.current = null;
    }
  }, [user, update]);

  useEffect(() => {
    if (!user) return undefined;
    const key = keyOf(appearance);
    if (synced.current === key) return undefined;

    const timer = setTimeout(() => {
      synced.current = key;
      authApi.updateMe({ prefs: toPrefs(appearance) }).catch(() => {
        // Cosmetic and retried on the next change. Not worth a toast — the
        // colour the user just picked is already on screen either way.
        synced.current = null;
      });
    }, PUSH_DELAY);

    return () => clearTimeout(timer);
  }, [appearance, user]);

  const value = useMemo(
    () => ({
      ...appearance,
      setTheme: (theme) => update({ theme }),
      setAccent: (accent) => update({ accent }),
      setCustom: (custom) => update({ accent: 'custom', custom }),
      toggleTheme: () => update({ theme: appearance.theme === 'dark' ? 'light' : 'dark' }),
    }),
    [appearance, update],
  );

  return <AppearanceContext.Provider value={value}>{children}</AppearanceContext.Provider>;
}

export const useAppearance = () => useContext(AppearanceContext);
