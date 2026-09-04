import { useEffect, useState } from 'react';

const MOBILE_BREAKPOINT = 1023;

export interface UseIsMobileResult {
  /** True when viewport is at or below the mobile breakpoint (1023px). */
  isMobile: boolean;
  /** Current viewport width in pixels. */
  width: number;
}

/**
 * Tracks whether the viewport is mobile-sized.
 *
 * SSR-safe: returns `{ isMobile: false, width: 0 }` when `window` is unavailable.
 * Reacts to `matchMedia` change events so it updates as the user resizes the
 * window or rotates a tablet.
 */
export function useIsMobile(): UseIsMobileResult {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false;
    return window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`).matches;
  });
  const [width, setWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return 0;
    return window.innerWidth;
  });

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;

    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT}px)`);
    const handle = (e: MediaQueryListEvent | MediaQueryList) => {
      setIsMobile(e.matches);
      setWidth(window.innerWidth);
    };

    // Initial sync (in case the state was stale on first render)
    handle(mql);

    if (mql.addEventListener) {
      mql.addEventListener('change', handle);
      return () => mql.removeEventListener('change', handle);
    }
    // Legacy Safari
    mql.addListener(handle);
    return () => mql.removeListener(handle);
  }, []);

  return { isMobile, width };
}

export const MOBILE_MAX_WIDTH = MOBILE_BREAKPOINT;
