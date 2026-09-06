import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileNav } from '../MobileNav';
import type { IconName } from '../Icon';

interface TabInfo {
  id: string;
  label: string;
  icon: IconName;
}

const TABS: TabInfo[] = [
  { id: 'signals', label: 'Signals', icon: 'bolt' },
  { id: 'heatmap', label: 'Sectors', icon: 'bars' },
  { id: 'executions', label: 'Trades', icon: 'clipboard' },
  { id: 'analytics', label: 'P&L', icon: 'trend' },
  { id: 'settings', label: 'Settings', icon: 'gear' },
];

describe('MobileNav', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders a nav landmark when visible', () => {
    render(<MobileNav tabs={TABS} activeTab="signals" onChange={() => {}} forceVisible />);
    expect(screen.getByRole('navigation')).toBeTruthy();
  });

  it('renders a button for each tab', () => {
    render(<MobileNav tabs={TABS} activeTab="signals" onChange={() => {}} forceVisible />);
    for (const t of TABS) {
      expect(screen.getByRole('button', { name: new RegExp(t.label, 'i') })).toBeTruthy();
    }
  });

  it('marks the active tab with aria-current', () => {
    render(<MobileNav tabs={TABS} activeTab="heatmap" onChange={() => {}} forceVisible />);
    const active = screen.getByRole('button', { name: /sectors/i });
    expect(active.getAttribute('aria-current')).toBe('page');
    const other = screen.getByRole('button', { name: /signals/i });
    expect(other.getAttribute('aria-current')).toBeNull();
  });

  it('calls onChange with the new tab id when a button is clicked', () => {
    const onChange = vi.fn();
    render(<MobileNav tabs={TABS} activeTab="signals" onChange={onChange} forceVisible />);
    fireEvent.click(screen.getByRole('button', { name: /settings/i }));
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  it('hides itself when not mobile (no tab bar shown on desktop)', () => {
    // Default matchMedia matches:false (desktop)
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
      matches: false,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    const { container } = render(
      <MobileNav tabs={TABS} activeTab="signals" onChange={() => {}} />
    );
    expect(container.querySelector('nav')).toBeNull();
  });

  it('shows itself when viewport is mobile', () => {
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((q: string) => ({
      matches: true,
      media: q,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })));
    render(<MobileNav tabs={TABS} activeTab="signals" onChange={() => {}} />);
    expect(screen.getByRole('navigation')).toBeTruthy();
  });
});
