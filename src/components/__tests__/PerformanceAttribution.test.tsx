import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { PerformanceAttribution } from '../PerformanceAttribution';
import type { AttributionItem } from '../../utils/attribution';

const makeItem = (overrides: Partial<AttributionItem> = {}): AttributionItem => ({
  id: Math.random().toString(36).slice(2),
  realized_pnl: 1000,
  exit_filled_at: '2025-01-15T10:00:00.000Z',
  entry_filled_at: '2025-01-10T10:00:00.000Z',
  strategy_id: 's1',
  strategy_name: 'Swing',
  symbol: 'RELIANCE',
  ...overrides,
});

describe('PerformanceAttribution', () => {
  it('renders empty state when no items', () => {
    render(<PerformanceAttribution isLoggedIn={true} items={[]} />);
    expect(screen.getByText(/no closed trades yet/i)).toBeTruthy();
  });

  it('shows login prompt when not logged in', () => {
    render(<PerformanceAttribution isLoggedIn={false} items={[]} />);
    // The "Login to view..." text is in its own <p> tag.
    const matches = screen.getAllByText((content, element) => {
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      if (tag !== 'p') return false;
      const text = (element.textContent ?? '').toLowerCase();
      return /login/.test(text) && /view/.test(text);
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows month buckets by default', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -300, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 800, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    // Best/worst callouts can also show "Jan 2025"; use getAllByText to assert presence.
    expect(screen.getAllByText(/jan 2025/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/feb 2025/i).length).toBeGreaterThan(0);
  });

  it('switches to quarter view on tab change', async () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 200, exit_filled_at: '2025-04-15T10:00:00.000Z' }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /quarter/i }));
    expect(screen.getAllByText('2025 Q1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('2025 Q2').length).toBeGreaterThan(0);
  });

  it('switches to financial year view', async () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 700, exit_filled_at: '2025-04-15T10:00:00.000Z' }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    fireEvent.click(screen.getByRole('button', { name: /fy/i }));
    expect(screen.getAllByText('FY 2024-25').length).toBeGreaterThan(0);
    expect(screen.getAllByText('FY 2025-26').length).toBeGreaterThan(0);
  });

  it('shows summary stats: total net P&L, win rate, best period, worst period', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -300, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      makeItem({ id: 'c', realized_pnl: 800, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    // Net = 2000 — header label "Net P&L"
    expect(screen.getAllByText(/net p&l/i).length).toBeGreaterThan(0);
    // Win rate
    expect(screen.getByText(/win rate/i)).toBeTruthy();
    // Best / worst period callouts
    expect(screen.getByText(/best period/i)).toBeTruthy();
    expect(screen.getByText(/worst period/i)).toBeTruthy();
  });

  it('shows per-strategy breakdown when a bucket is expanded', async () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: 1500, strategy_id: 's1', strategy_name: 'Swing', exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: -300, strategy_id: 's2', strategy_name: 'Momentum', exit_filled_at: '2025-01-20T10:00:00.000Z' }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    // Click the expand button for the first bucket
    const expandButtons = screen.getAllByRole('button', { name: /show breakdown/i });
    fireEvent.click(expandButtons[0]);
    expect(screen.getByText('Swing')).toBeTruthy();
    expect(screen.getByText('Momentum')).toBeTruthy();
  });

  it('skips items that are not yet closed (no exit_filled_at)', () => {
    const items: AttributionItem[] = [
      makeItem({ id: 'a', realized_pnl: null as any, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      makeItem({ id: 'b', realized_pnl: 500, exit_filled_at: null as any }),
    ];
    render(<PerformanceAttribution isLoggedIn={true} items={items} />);
    expect(screen.getByText(/no closed trades yet/i)).toBeTruthy();
  });
});
