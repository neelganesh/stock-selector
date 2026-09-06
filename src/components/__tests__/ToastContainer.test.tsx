import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { ToastContainer } from '../ToastContainer';
import type { ToastData } from '../Toast';

const makeToast = (overrides: Partial<ToastData> = {}): ToastData => ({
  id: 't1',
  message: 'Default',
  variant: 'info',
  duration: 0,
  ...overrides,
});

describe('ToastContainer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders nothing when toasts is empty', () => {
    const { container } = render(<ToastContainer toasts={[]} onDismiss={() => {}} />);
    expect(container.firstChild).toBeTruthy(); // wrapper div present
    // No toast children rendered
    expect(screen.queryByTestId('toast-t1')).toBeNull();
  });

  it('renders a toast for each item in toasts array', () => {
    const toasts: ToastData[] = [
      makeToast({ id: 'a', message: 'A' }),
      makeToast({ id: 'b', message: 'B' }),
      makeToast({ id: 'c', message: 'C' }),
    ];
    render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
    expect(screen.getByTestId('toast-a')).toBeTruthy();
    expect(screen.getByTestId('toast-b')).toBeTruthy();
    expect(screen.getByTestId('toast-c')).toBeTruthy();
  });

  it('renders newest toast on top (reverse-chronological order)', () => {
    const toasts: ToastData[] = [
      makeToast({ id: 'a', message: 'A' }),
      makeToast({ id: 'b', message: 'B' }),
      makeToast({ id: 'c', message: 'C' }),
    ];
    const { container } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
    // Use selector that excludes the data-testid="toast-stack" wrapper
    const renderedToasts = container.querySelectorAll('[data-testid^="toast-"]:not([data-testid="toast-stack"])');
    // Source array order is [a, b, c]; UI reorders so c is on top → c, b, a
    expect(renderedToasts[0].getAttribute('data-testid')).toBe('toast-c');
    expect(renderedToasts[1].getAttribute('data-testid')).toBe('toast-b');
    expect(renderedToasts[2].getAttribute('data-testid')).toBe('toast-a');
  });

  it('calls onDismiss with toast id when close button clicked', () => {
    const onDismiss = vi.fn();
    const toasts: ToastData[] = [
      makeToast({ id: 'a', message: 'A' }),
      makeToast({ id: 'b', message: 'B' }),
    ];
    render(<ToastContainer toasts={toasts} onDismiss={onDismiss} />);
    const closeA = screen.getByTestId('toast-a').querySelector('button[aria-label*="Dismiss"]')!;
    fireEvent.click(closeA);
    expect(onDismiss).toHaveBeenCalledWith('a');
  });

  it('exposes data-position="bottom-left" on desktop (default)', () => {
    render(<ToastContainer toasts={[makeToast()]} onDismiss={() => {}} />);
    const stack = screen.getByTestId('toast-stack');
    expect(stack.getAttribute('data-position')).toBe('bottom-left');
  });

  it('exposes data-position="bottom-center" when isMobile=true', () => {
    render(
      <ToastContainer toasts={[makeToast()]} onDismiss={() => {}} isMobile={true} />
    );
    const stack = screen.getByTestId('toast-stack');
    expect(stack.getAttribute('data-position')).toBe('bottom-center');
  });

  it('caps visible toasts at 5 (oldest get dropped)', () => {
    const toasts: ToastData[] = Array.from({ length: 8 }, (_, i) =>
      makeToast({ id: `t${i}`, message: `T${i}` })
    );
    const { container } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
    const rendered = container.querySelectorAll('[data-testid^="toast-t"]');
    expect(rendered).toHaveLength(5);
  });

  it('keeps the 5 most recent (newest) toasts', () => {
    const toasts: ToastData[] = Array.from({ length: 8 }, (_, i) =>
      makeToast({ id: `t${i}`, message: `T${i}` })
    );
    const { container } = render(<ToastContainer toasts={toasts} onDismiss={() => {}} />);
    const rendered = container.querySelectorAll('[data-testid^="toast-t"]');
    // toasts are 0..7; we expect 3..7 (the 5 newest) → t3, t4, t5, t6, t7
    // After reverse: t7, t6, t5, t4, t3
    const ids = Array.from(rendered).map((el) => el.getAttribute('data-testid'));
    expect(ids).toEqual(['toast-t7', 'toast-t6', 'toast-t5', 'toast-t4', 'toast-t3']);
  });

  it('positioned at bottom-left by default (outer wrapper CSS classes)', () => {
    const { container } = render(<ToastContainer toasts={[makeToast()]} onDismiss={() => {}} />);
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/bottom-4/);
    expect(outer.className).toMatch(/left-4/);
  });

  it('positioned at bottom-center when mobile (outer wrapper CSS classes)', () => {
    const { container } = render(
      <ToastContainer toasts={[makeToast()]} onDismiss={() => {}} isMobile={true} />
    );
    const outer = container.firstChild as HTMLElement;
    expect(outer.className).toMatch(/bottom-20/);
    expect(outer.className).toMatch(/inset-x-4/);
  });
});
