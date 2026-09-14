import { useEffect, useState } from 'react';

/**
 * Brand logo paths, loaded the first time anything needs one.
 *
 * ~170KB of SVG path data is its own chunk: a board without a logo on it — and
 * the rest of the app — never downloads it. Every caller shares one promise.
 */

let loaded = null;
let promise = null;

export function loadBrandPaths() {
  if (!promise) {
    promise = import('../../../design/library/brandPaths.generated.js').then((m) => {
      loaded = m.BRAND_PATHS;
      return loaded;
    });
  }
  return promise;
}

export function useBrandPaths() {
  const [paths, setPaths] = useState(loaded);
  useEffect(() => {
    if (loaded) return undefined;
    let alive = true;
    loadBrandPaths()
      .then((result) => alive && setPaths(result))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  return paths;
}
