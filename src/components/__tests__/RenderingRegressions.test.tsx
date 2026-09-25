// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../GlassCard', () => ({
  GlassCard: ({ children, ...props }: { children?: React.ReactNode; [key: string]: unknown }) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock('../Icon', () => ({
  Icon: ({ name }: { name: string }) => <span data-testid={`icon-${name}`} />,
}));

vi.mock('../AnimatedNumber', () => ({
  AnimatedNumber: ({ value, format }: { value: number; format?: (value: number) => string }) => (
    <span>{format ? format(value) : value}</span>
  ),
}));

vi.mock('../SignalBadge', () => ({
  SignalBadge: ({ type }: { type: string }) => <span>{type}</span>,
}));

vi.mock('../InfoTooltip', () => ({
  InfoTooltip: () => null,
}));

import StockCard from '../StockCard';

const stockWithoutDetails = {
  id: 'stock-1',
  symbol: 'TEST',
  name: 'Test Limited',
  sector: 'Technology',
  signal: 'buy',
  currentPrice: 100,
  change: 1,
  changePercent: 1,
  marketCap: '₹1 Cr',
} as any;

const stockWithDetails = {
  ...stockWithoutDetails,
  signalDetails: {
    entry: 100,
    stopLoss: 95,
    target1: 110,
    target2: 115,
    rationale: 'Test rationale',
    indicators: { relativeStrengthVsSector: 1 },
  },
};

describe('rendering regressions', () => {
  it('StockCard keeps a stable hook order when signal details load', () => {
    const { rerender, container } = render(<StockCard stock={stockWithoutDetails} />);

    expect(container.querySelector('.animate-pulse')).not.toBeNull();

    expect(() => {
      rerender(<StockCard stock={stockWithDetails} />);
    }).not.toThrow();

    expect(screen.getByText('TEST')).toBeInTheDocument();
  });
});
