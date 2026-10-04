import { useEffect, useState } from 'react';

const BREAKPOINT = 1300;

/** Возвращает true, если окно уже breakpoint (по умолчанию 1300px). */
export function useIsNarrow(breakpoint: number = BREAKPOINT): boolean {
  const query = `(max-width: ${breakpoint - 1}px)`;

  const [isNarrow, setIsNarrow] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia(query).matches;
  });

 useEffect(() => {
  const mql = window.matchMedia(query);
  const handler = (e: MediaQueryListEvent) => setIsNarrow(e.matches);

  mql.addEventListener('change', handler);
  setIsNarrow(mql.matches);

  return () => {
    mql.removeEventListener('change', handler);
  };
}, [query]);

  return isNarrow;
}