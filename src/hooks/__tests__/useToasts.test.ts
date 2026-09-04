import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useToasts } from '../useToasts';

describe('useToasts', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('returns empty toasts initially', () => {
    const { result } = renderHook(() => useToasts());
    expect(result.current.toasts).toEqual([]);
  });

  it('push adds a toast with auto-generated id', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'Test message', variant: 'success' });
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].id).toBeTruthy();
    expect(result.current.toasts[0].message).toBe('Test message');
    expect(result.current.toasts[0].variant).toBe('success');
  });

  it('push supports all four variants', () => {
    const { result } = renderHook(() => useToasts());
    const variants = ['success', 'error', 'info', 'warning'] as const;
    variants.forEach((v) => {
      act(() => {
        result.current.push({ message: v, variant: v });
      });
    });
    expect(result.current.toasts).toHaveLength(4);
    result.current.toasts.forEach((t, i) => {
      expect(t.variant).toBe(variants[i]);
    });
  });

  it('push supports action button', () => {
    const { result } = renderHook(() => useToasts());
    const actionFn = vi.fn();
    act(() => {
      result.current.push({
        message: 'File saved',
        variant: 'success',
        action: { label: 'Undo', onAction: actionFn },
      });
    });
    expect(result.current.toasts[0].action).toBeTruthy();
    expect(result.current.toasts[0].action!.label).toBe('Undo');
    act(() => {
      result.current.toasts[0].action!.onAction();
    });
    expect(actionFn).toHaveBeenCalledTimes(1);
  });

  it('push uses default duration 5000ms when not specified', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'Test', variant: 'info' });
    });
    expect(result.current.toasts[0].duration).toBe(5000);
  });

  it('push uses provided duration', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'Sticky', variant: 'info', duration: 0 });
    });
    expect(result.current.toasts[0].duration).toBe(0);
  });

  it('dismiss removes toast by id', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'A', variant: 'info' });
      result.current.push({ message: 'B', variant: 'info' });
    });
    const idToRemove = result.current.toasts[0].id;
    act(() => {
      result.current.dismiss(idToRemove);
    });
    expect(result.current.toasts).toHaveLength(1);
    expect(result.current.toasts[0].message).toBe('B');
  });

  it('clear removes all toasts', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'A', variant: 'info' });
      result.current.push({ message: 'B', variant: 'info' });
      result.current.push({ message: 'C', variant: 'info' });
    });
    expect(result.current.toasts).toHaveLength(3);
    act(() => {
      result.current.clear();
    });
    expect(result.current.toasts).toEqual([]);
  });

  it('auto-dismiss fires after duration when duration > 0', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'Auto', variant: 'success', duration: 3000 });
    });
    const id = result.current.toasts[0].id;
    expect(result.current.toasts).toHaveLength(1);
    act(() => {
      vi.advanceTimersByTime(2999);
    });
    expect(result.current.toasts).toHaveLength(1); // not yet
    act(() => {
      vi.advanceTimersByTime(1); // exactly at 3000
    });
    expect(result.current.toasts).toHaveLength(0);
  });

  it('auto-dismiss does not fire when duration is 0 (sticky)', () => {
    const { result } = renderHook(() => useToasts());
    act(() => {
      result.current.push({ message: 'Sticky', variant: 'info', duration: 0 });
    });
    act(() => {
      vi.advanceTimersByTime(999999);
    });
    expect(result.current.toasts).toHaveLength(1);
  });

  it('push returns the new toast id', () => {
    const { result } = renderHook(() => useToasts());
    let id: string | undefined;
    act(() => {
      id = result.current.push({ message: 'Test', variant: 'info' });
    });
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });
});
