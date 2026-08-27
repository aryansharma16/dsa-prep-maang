import { useEffect, useState } from 'react';

/** useState that survives reloads. Used for sidebar collapse, theme, open sections. */
export function useLocalState(key, initial) {
  const [value, setValue] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw === null ? initial : JSON.parse(raw);
    } catch {
      return initial;
    }
  });

  /*
    Writes only when the stored text would actually change.

    This effect runs on mount as well as on change, so every component using
    the hook used to serialise its whole value and write it back unchanged the
    moment it appeared — and `localStorage` is synchronous, on the main thread,
    with a disk behind it. The Learn pages made that visible: the read-topics
    map is read by the hub, the track page and every topic, so walking a track
    was one redundant write of the whole map per navigation. Reading the key
    back first is a cheap comparison against an expensive write.
  */
  useEffect(() => {
    try {
      const next = JSON.stringify(value);
      if (localStorage.getItem(key) !== next) localStorage.setItem(key, next);
    } catch {
      /* private mode / quota — not worth surfacing */
    }
  }, [key, value]);

  return [value, setValue];
}
