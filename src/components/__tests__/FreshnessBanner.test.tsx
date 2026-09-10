import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FreshnessBanner, FreshnessDot } from '../FreshnessBanner';

describe('FreshnessBanner', () => {
  it('renders updated time', () => {
    render(<FreshnessBanner lastUpdated={new Date('2026-01-01T10:00:00')} />);
    expect(screen.getByLabelText(/Data freshness/i)).toBeTruthy();
  });
  it('shows stale indicator', () => {
    render(<FreshnessBanner lastUpdated={new Date()} isStale />);
    expect(screen.getByLabelText(/Data freshness/i)).toBeTruthy();
  });
});
describe('FreshnessDot', () => {
  it('shows fresh dot', () => {
    render(<FreshnessDot isFresh={true} />);
    expect(screen.getByLabelText('Fresh data')).toBeTruthy();
  });
  it('shows stale dot', () => {
    render(<FreshnessDot isFresh={false} />);
    expect(screen.getByLabelText('Stale data')).toBeTruthy();
  });
});
