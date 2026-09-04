import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileSidebarDrawer } from '../MobileSidebarDrawer';

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

describe('MobileSidebarDrawer', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders children inline when viewport is desktop (no drawer UI)', () => {
    setMatchMedia(false);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    expect(screen.getByTestId('sidebar-child')).toBeTruthy();
    // No hamburger button on desktop
    expect(screen.queryByRole('button', { name: /open menu/i })).toBeNull();
  });

  it('shows a hamburger button on mobile', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    expect(screen.getByRole('button', { name: /open menu/i })).toBeTruthy();
  });

  it('has the panel in the DOM with correct closed state', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    const panel = screen.getByTestId('mobile-drawer-panel');
    expect(panel).toBeTruthy();
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.getAttribute('data-open')).toBe('false');
  });

  it('opens the drawer when hamburger is clicked', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    const panel = screen.getByTestId('mobile-drawer-panel');
    expect(panel.getAttribute('aria-hidden')).toBe('false');
    expect(panel.getAttribute('data-open')).toBe('true');
  });

  it('closes when the close button is clicked', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /close menu/i }));
    const panel = screen.getByTestId('mobile-drawer-panel');
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.getAttribute('data-open')).toBe('false');
  });

  it('closes when backdrop is clicked', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.click(screen.getByRole('button', { name: /close sidebar/i }));
    const panel = screen.getByTestId('mobile-drawer-panel');
    expect(panel.getAttribute('aria-hidden')).toBe('true');
  });

  it('closes when Escape key is pressed', () => {
    setMatchMedia(true);
    render(
      <MobileSidebarDrawer>
        <div data-testid="sidebar-child">SIDEBAR</div>
      </MobileSidebarDrawer>
    );
    fireEvent.click(screen.getByRole('button', { name: /open menu/i }));
    fireEvent.keyDown(document, { key: 'Escape' });
    const panel = screen.getByTestId('mobile-drawer-panel');
    expect(panel.getAttribute('aria-hidden')).toBe('true');
    expect(panel.getAttribute('data-open')).toBe('false');
  });
});
