import { useState, useCallback, useRef, useEffect } from 'react';

export type ToastVariant = 'success' | 'error' | 'info' | 'warning';

export interface ToastAction {
  label: string;
  onAction: () => void;
}

export interface ToastInput {
  message: string;
  variant: ToastVariant;
  duration?: number;
  action?: ToastAction;
}

export interface ToastData extends Required<Pick<ToastInput, 'message' | 'variant'>> {
  id: string;
  duration: number;
  action?: ToastAction;
}

const DEFAULT_DURATION = 5000;

export interface UseToastsResult {
  toasts: ToastData[];
  push: (toast: ToastInput) => string;
  dismiss: (id: string) => void;
  clear: () => void;
}

/**
 * Manages a stack of toast notifications with auto-dismiss timers.
 * Timers are tracked in a ref so unmounting cleans them up properly.
 */
export function useToasts(): UseToastsResult {
  const [toasts, setToasts] = useState<ToastData[]>([]);
  const idCounter = useRef(0);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const push = useCallback((toast: ToastInput): string => {
    idCounter.current += 1;
    const id = `t${idCounter.current}`;
    const duration = toast.duration ?? DEFAULT_DURATION;
    const data: ToastData = {
      id,
      message: toast.message,
      variant: toast.variant,
      duration,
      action: toast.action,
    };
    setToasts((prev) => [...prev, data]);

    if (duration > 0) {
      const timer = setTimeout(() => {
        dismiss(id);
      }, duration);
      timers.current.set(id, timer);
    }
    return id;
  }, [dismiss]);

  const clear = useCallback(() => {
    timers.current.forEach((t) => clearTimeout(t));
    timers.current.clear();
    setToasts([]);
  }, []);

  // Cleanup all timers on unmount
  useEffect(() => {
    const captured = timers.current;
    return () => {
      captured.forEach((t) => clearTimeout(t));
      captured.clear();
    };
  }, []);

  return { toasts, push, dismiss, clear };
}
