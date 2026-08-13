import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { viewsApi } from '../api/index.js';
import { filterKey, normalizeFilters, toPayload } from '../filters/spec.js';
import { useAuth } from '../store/AuthContext.jsx';
import { useLocalState } from './useLocalState.js';

/**
 * A screen's filters, kept on the account and on the device.
 *
 * Two stores, for the reason AppearanceContext keeps two: the account is where
 * the choice lives — that is what makes it survive a reload on another machine —
 * but the account arrives a request after the first paint. Restoring from the
 * server alone would mean the roadmap rendering all 429 problems and then
 * collapsing to eleven a beat later, which reads as a bug in a way that showing
 * nothing for a moment does not. So localStorage answers synchronously and the
 * server reconciles behind it.
 *
 * The two disagree in exactly one interesting case — you filtered on your laptop
 * and then opened your phone — and the account wins there, because that is the
 * whole reason it is saved server-side.
 *
 * @param scope  one of the server's VIEW_SCOPES
 * @param spec   from defineFilters
 */

/* Long enough that clicking through four companies in a row is one request
   rather than four, short enough that closing the tab straight after does not
   lose the last one. */
const PUSH_DELAY = 700;

export function useSavedFilters(scope, spec) {
  const { user } = useAuth();
  const [stored, setStored] = useLocalState(`filters:${scope}`, null);

  const filters = useMemo(() => normalizeFilters(spec, stored), [spec, stored]);

  const set = useCallback(
    (next) =>
      setStored((prev) =>
        normalizeFilters(spec, typeof next === 'function' ? next(normalizeFilters(spec, prev)) : next),
      ),
    [setStored, spec],
  );

  /*
    `null` means "the account and this device may disagree, push". It is set to
    the current key whenever the two are known to match, which is what stops the
    adopt below and the push further down from undoing each other.
  */
  const synced = useRef(null);
  const adoptedFor = useRef(null);
  /* Set the moment the user touches a control. The fetch below is in flight
     across the first seconds of the page, and a reply landing on top of a filter
     just picked would be the server undoing a click. */
  const touched = useRef(false);

  /*
    Whether the account's copy has been heard from. State and not a ref, because
    the push effect has to re-run when it flips — a device holding filters that
    the account has none of pushes exactly then, and a ref would leave that set
    unsaved until the next click.

    Nothing may be pushed before it. A save that overtook the fetch would leave
    the reply landing afterwards as an "adopt" of a value the server had already
    replaced, so the screen and the account would disagree while both believed
    they were in step.
  */
  const [hydrated, setHydrated] = useState(false);

  const apply = useCallback(
    (next) => {
      setStored(next);
      synced.current = filterKey(spec, normalizeFilters(spec, next));
    },
    [setStored, spec],
  );

  useEffect(() => {
    const id = user?._id ?? null;
    if (!id) {
      adoptedFor.current = null;
      synced.current = null;
      touched.current = false;
      setHydrated(false);
      return undefined;
    }
    // Only on the way in. Re-running on every `user` identity change — a rating,
    // an avatar — would pull the saved set back over the one being edited.
    if (adoptedFor.current === id) return undefined;
    adoptedFor.current = id;

    let live = true;
    viewsApi
      .get(scope)
      .then((view) => {
        if (!live) return;
        // A filter picked while this was in flight is a newer answer than the
        // one that just arrived, and it is the one the person is looking at.
        if (view && !touched.current) apply(view.filters);
        // No saved view: the first visit since this shipped, or a cleared one.
        // Either way this device's set is the better answer, so leave it and let
        // the push below carry it up.
        else synced.current = null;
      })
      .catch(() => {
        // Offline, or a server that predates this endpoint. The local copy is
        // already on screen; the push below retries and costs nothing if it
        // fails again.
        if (live) synced.current = null;
      })
      .finally(() => {
        if (live) setHydrated(true);
      });

    return () => {
      live = false;
    };
  }, [user, scope, apply]);

  useEffect(() => {
    if (!user || !hydrated) return undefined;
    const key = filterKey(spec, filters);
    if (synced.current === key) return undefined;

    const timer = setTimeout(() => {
      synced.current = key;
      viewsApi.save(scope, toPayload(spec, filters)).catch(() => {
        // Retried on the next change. Not worth a toast: the filter the user
        // just set is applied and stored locally either way, and the only thing
        // lost is it following them to another machine.
        synced.current = null;
      });
    }, PUSH_DELAY);

    return () => clearTimeout(timer);
  }, [filters, user, hydrated, scope, spec]);

  const setFilters = useCallback(
    (next) => {
      touched.current = true;
      set(next);
    },
    [set],
  );

  return [filters, setFilters];
}
