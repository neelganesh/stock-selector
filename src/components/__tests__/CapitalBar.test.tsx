/**
 * CapitalBar wiring tests
 *
 * Bug: App.tsx wired CapitalBar's `isLoggedIn` prop to the Kite data-
 * source status (`activeDataSource.includes('Kite')`) instead of the
 * user's auth state. As a result, a signed-in user with no Kite
 * credentials still saw "Capital unavailable — sign in to view".
 *
 * These tests pin the contract: a logged-in user (regardless of Kite
 * status) MUST be allowed past the "sign in" placeholder.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { CapitalBar } from '../CapitalBar';

describe('CapitalBar wiring (auth vs broker)', () => {
  afterEach(() => {
    cleanup();
  });

  it('shows the "sign in" placeholder when isLoggedIn is false', () => {
    render(<CapitalBar isLoggedIn={false} />);
    expect(screen.getByText(/sign in for capital/i)).toBeTruthy();
  });

  it('does NOT show the "sign in" placeholder when isLoggedIn is true (signed in, no Kite)', () => {
    // When signed in but capital fetch is still loading or unavailable,
    // the bar should render the skeleton/expanded view — NEVER the
    // "sign in to view" placeholder, which would be misleading.
    render(<CapitalBar isLoggedIn={true} />);
    expect(screen.queryByText(/sign in to view/i)).toBeNull();
  });
});

