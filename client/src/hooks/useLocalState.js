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

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* private mode / quota — not worth surfacing */
    }
  }, [key, value]);

  return [value, setValue];
}
