import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { MobileViewTabs, type MobileViewTab } from '../MobileViewTabs';

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

const TABS: MobileViewTab[] = [
  { id: 'signals', label: 'Swing Signals Screener', icon: <span data-testid="ico-1">⚡</span>, badge: 4 },
  { id: 'analytics', label: 'P&L Analytics', icon: <span data-testid="ico-2">📈</span> },
  { id: 'settings', label: 'Settings', icon: <span data-testid="ico-3">⚙️</span> },
];

describe('MobileViewTabs', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('renders a tablist landmark', () => {
    setMatchMedia(false);
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={() => {}} />);
    expect(screen.getByRole('tablist')).toBeTruthy();
  });

  it('renders a tab for each entry with the icon', () => {
    setMatchMedia(false);
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={() => {}} />);
    expect(screen.getByTestId('ico-1')).toBeTruthy();
    expect(screen.getByTestId('ico-2')).toBeTruthy();
    expect(screen.getByTestId('ico-3')).toBeTruthy();
  });

  it('shows the full label on desktop', () => {
    setMatchMedia(false);
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={() => {}} />);
    const signalsTab = screen.getByRole('tab', { name: /swing signals screener/i });
    expect(signalsTab).toBeTruthy();
  });

  it('hides the full label on mobile (icon-only)', () => {
    setMatchMedia(true);
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={() => {}} />);
    const tab = screen.getByTestId('tab-signals');
    expect(tab.getAttribute('aria-label')).toBe('Swing Signals Screener');
    // The visible label span is hidden via `hidden` class
    const visibleLabel = tab.querySelector('span:not(.sr-only):not([aria-hidden])') as HTMLElement;
    expect(visibleLabel?.textContent || '').not.toContain('Swing Signals Screener');
  });

  it('marks the active tab with aria-selected=true', () => {
    setMatchMedia(false);
    render(<MobileViewTabs tabs={TABS} activeTab="analytics" onChange={() => {}} />);
    const analytics = screen.getByTestId('tab-analytics');
    expect(analytics.getAttribute('aria-selected')).toBe('true');
    const signals = screen.getByTestId('tab-signals');
    expect(signals.getAttribute('aria-selected')).toBe('false');
  });

  it('calls onChange with the new tab id when clicked', () => {
    setMatchMedia(false);
    const onChange = vi.fn();
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('tab-settings'));
    expect(onChange).toHaveBeenCalledWith('settings');
  });

  it('renders the badge when provided (on desktop)', () => {
    setMatchMedia(false);
    render(<MobileViewTabs tabs={TABS} activeTab="signals" onChange={() => {}} />);
    // Badge "4" should appear for the signals tab
    expect(screen.getByTestId('tab-signals').textContent).toContain('4');
  });
});
