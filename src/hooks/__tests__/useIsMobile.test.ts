import { describe, it, expect, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useIsMobile } from '../useIsMobile';

type ChangeHandler = (e: MediaQueryListEvent) => void;

interface FakeMQL {
  matches: boolean;
  media: string;
  onchange: null;
  addEventListener: ReturnType<typeof vi.fn>;
  removeEventListener: ReturnType<typeof vi.fn>;
  addListener: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
  dispatchEvent: ReturnType<typeof vi.fn>;
}

function makeMQL(initial: boolean): { mql: FakeMQL; setMatches: (m: boolean) => void } {
  const handlers: ChangeHandler[] = [];
  const mql: FakeMQL = {
    matches: initial,
    media: '',
    onchange: null,
    addEventListener: vi.fn((_evt: string, h: ChangeHandler) => handlers.push(h)),
    removeEventListener: vi.fn((_evt: string, h: ChangeHandler) => {
      const idx = handlers.indexOf(h);
      if (idx >= 0) handlers.splice(idx, 1);
    }),
    addListener: vi.fn((h: ChangeHandler) => handlers.push(h)),
    removeListener: vi.fn((h: ChangeHandler) => {
      const idx = handlers.indexOf(h);
      if (idx >= 0) handlers.splice(idx, 1);
    }),
    dispatchEvent: vi.fn(),
  };
  return {
    mql,
    setMatches: (m: boolean) => {
      mql.matches = m;
      handlers.forEach((h) => h({ matches: m } as MediaQueryListEvent));
    },
  };
}

describe('useIsMobile', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('returns false when viewport > 1023px', () => {
    const { mql } = makeMQL(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current.isMobile).toBe(false);
  });

  it('returns true when viewport <= 1023px', () => {
    const { mql } = makeMQL(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current.isMobile).toBe(true);
  });

  it('reacts to media query changes', () => {
    const { mql, setMatches } = makeMQL(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(result.current.isMobile).toBe(false);

    act(() => setMatches(true));
    expect(result.current.isMobile).toBe(true);

    act(() => setMatches(false));
    expect(result.current.isMobile).toBe(false);
  });

  it('exposes a numeric viewport width', () => {
    const { mql } = makeMQL(true);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { result } = renderHook(() => useIsMobile());
    expect(typeof result.current.width).toBe('number');
    expect(result.current.width).toBeGreaterThan(0);
  });

  it('cleans up the listener on unmount', () => {
    const { mql } = makeMQL(false);
    vi.stubGlobal('matchMedia', vi.fn(() => mql));
    const { unmount } = renderHook(() => useIsMobile());
    expect(mql.addEventListener).toHaveBeenCalled();
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});
