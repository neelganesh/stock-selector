import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { Toast } from '../Toast';

describe('Toast component', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('renders message', () => {
    render(<Toast id="t1" message="Trade executed" variant="success" duration={0} onDismiss={() => {}} />);
    expect(screen.getByText('Trade executed')).toBeTruthy();
  });

  it('uses role="status" and aria-live="polite" for success variant', () => {
    const { container } = render(<Toast id="t1" message="OK" variant="success" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast).toBeTruthy();
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.getAttribute('aria-live')).toBe('polite');
  });

  it('uses role="alert" and aria-live="assertive" for error variant', () => {
    const { container } = render(<Toast id="t1" message="Boom" variant="error" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast?.getAttribute('role')).toBe('alert');
    expect(toast?.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses role="alert" and aria-live="assertive" for warning variant', () => {
    const { container } = render(<Toast id="t1" message="Warn" variant="warning" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast?.getAttribute('role')).toBe('alert');
    expect(toast?.getAttribute('aria-live')).toBe('assertive');
  });

  it('uses role="status" and aria-live="polite" for info variant', () => {
    const { container } = render(<Toast id="t1" message="Info" variant="info" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.getAttribute('aria-live')).toBe('polite');
  });

  it('aria-atomic is always true', () => {
    const { container } = render(<Toast id="t1" message="x" variant="info" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast?.getAttribute('aria-atomic')).toBe('true');
  });

  it('data-variant reflects prop', () => {
    const { container } = render(<Toast id="t1" message="x" variant="error" duration={0} onDismiss={() => {}} />);
    const toast = container.querySelector('[data-testid="toast-t1"]');
    expect(toast?.getAttribute('data-variant')).toBe('error');
  });

  it('calls onDismiss when close button is clicked', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="x" variant="info" duration={0} onDismiss={onDismiss} />);
    const closeBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(closeBtn);
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('renders action button when action prop is provided', () => {
    const onAction = vi.fn();
    render(
      <Toast
        id="t1"
        message="Saved"
        variant="success"
        duration={0}
        onDismiss={() => {}}
        action={{ label: 'Undo', onAction }}
      />
    );
    const actionBtn = screen.getByRole('button', { name: /undo/i });
    expect(actionBtn).toBeTruthy();
    fireEvent.click(actionBtn);
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('does not render action button when action prop is omitted', () => {
    render(<Toast id="t1" message="x" variant="info" duration={0} onDismiss={() => {}} />);
    // only the close button
    const buttons = screen.getAllByRole('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].getAttribute('aria-label')).toMatch(/dismiss/i);
  });

  it('auto-dismisses after duration via timer', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="x" variant="info" duration={2000} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(onDismiss).toHaveBeenCalledWith('t1');
  });

  it('does not auto-dismiss when duration is 0', () => {
    const onDismiss = vi.fn();
    render(<Toast id="t1" message="x" variant="info" duration={0} onDismiss={onDismiss} />);
    act(() => {
      vi.advanceTimersByTime(999999);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
