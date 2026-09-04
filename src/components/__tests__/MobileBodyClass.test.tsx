import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MobileBodyClass } from '../MobileBodyClass';

function setMatchMedia(matches: boolean) {
  vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
    matches,
    media: q,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })));
}

describe('MobileBodyClass', () => {
  beforeEach(() => {
    document.body.classList.remove('is-mobile');
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
    document.body.classList.remove('is-mobile');
  });

  it('adds is-mobile class to body when viewport is mobile', () => {
    setMatchMedia(true);
    render(<MobileBodyClass />);
    expect(document.body.classList.contains('is-mobile')).toBe(true);
  });

  it('does not add is-mobile class when viewport is desktop', () => {
    setMatchMedia(false);
    render(<MobileBodyClass />);
    expect(document.body.classList.contains('is-mobile')).toBe(false);
  });

  it('removes is-mobile class on unmount', () => {
    setMatchMedia(true);
    const { unmount } = render(<MobileBodyClass />);
    expect(document.body.classList.contains('is-mobile')).toBe(true);
    unmount();
    expect(document.body.classList.contains('is-mobile')).toBe(false);
  });
});
