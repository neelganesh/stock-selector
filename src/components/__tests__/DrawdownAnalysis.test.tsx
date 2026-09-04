import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DrawdownAnalysis } from '../DrawdownAnalysis';
import type { DrawdownTrade } from '../../utils/drawdown';

const trade = (overrides: Partial<DrawdownTrade>): DrawdownTrade => ({
  id: Math.random().toString(36).slice(2),
  exit_filled_at: '2025-01-15T10:00:00.000Z',
  realized_pnl: 1000,
  ...overrides,
});

describe('DrawdownAnalysis', () => {
  it('renders empty state when no closed trades', () => {
    render(<DrawdownAnalysis isLoggedIn={true} trades={[]} startingCapital={100000} />);
    expect(screen.getByText(/no closed trades yet/i)).toBeTruthy();
  });

  it('shows login prompt when not logged in', () => {
    render(<DrawdownAnalysis isLoggedIn={false} trades={[]} startingCapital={100000} />);
    const matches = screen.getAllByText((content, element) => {
      if (!element) return false;
      const tag = element.tagName.toLowerCase();
      if (tag !== 'p') return false;
      const text = (element.textContent ?? '').toLowerCase();
      return /login/.test(text) && /view/.test(text);
    });
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows summary stats: max drawdown, longest underwater, total trades', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 2000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
    ];
    render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    expect(screen.getByText(/max drawdown/i)).toBeTruthy();
    expect(screen.getByText(/underwater/i)).toBeTruthy();
    expect(screen.getByText(/closed trades/i)).toBeTruthy();
  });

  it('shows worst drawdown callout with peak and trough dates', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 2000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
      trade({ id: 'c', realized_pnl: 2000, exit_filled_at: '2025-02-10T10:00:00.000Z' }),
    ];
    render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    expect(screen.getAllByText(/peak/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/trough/i).length).toBeGreaterThan(0);
  });

  it('renders equity curve SVG (line element)', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 1500, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: -500, exit_filled_at: '2025-01-20T10:00:00.000Z' }),
      trade({ id: 'c', realized_pnl: 800, exit_filled_at: '2025-02-05T10:00:00.000Z' }),
    ];
    const { container } = render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    // SVG present
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // Line element
    const path = container.querySelector('svg path');
    expect(path).toBeTruthy();
  });

  it('renders underwater area chart', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 2000, exit_filled_at: '2025-01-01T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: -1500, exit_filled_at: '2025-01-15T10:00:00.000Z' }),
    ];
    const { container } = render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    // Multiple paths: equity line + underwater area
    const paths = container.querySelectorAll('svg path');
    expect(paths.length).toBeGreaterThanOrEqual(2);
  });

  it('skips trades without exit_filled_at', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 500, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: 200, exit_filled_at: null as any }),
    ];
    render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    // Only 1 closed trade — empty state should NOT render
    expect(screen.queryByText(/no closed trades yet/i)).toBeNull();
  });

  it('shows final return percentage', () => {
    const trades: DrawdownTrade[] = [
      trade({ id: 'a', realized_pnl: 5000, exit_filled_at: '2025-01-10T10:00:00.000Z' }),
      trade({ id: 'b', realized_pnl: 3000, exit_filled_at: '2025-02-10T10:00:00.000Z' }),
    ];
    render(<DrawdownAnalysis isLoggedIn={true} trades={trades} startingCapital={100000} />);
    expect(screen.getByText(/return/i)).toBeTruthy();
  });
});
