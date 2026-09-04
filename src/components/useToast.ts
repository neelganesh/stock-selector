/**
 * Exported separately from ToastProvider so that consuming components don't
 * re-render (or throw) when ToastProvider itself is hot-replaced during Vite
 * Fast Refresh.  Moving the hook into its own module makes its identity
 * stable across HMR updates of the provider.
 */
import { createContext, useContext } from 'react';
import type { UseToastsResult, ToastInput } from '../hooks/useToasts';

export interface ToastAPI extends UseToastsResult {
  success: (message: string, opts?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => string;
  error: (message: string, opts?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => string;
  info: (message: string, opts?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => string;
  warning: (message: string, opts?: Partial<Omit<ToastInput, 'message' | 'variant'>>) => string;
}

const ToastContext = createContext<ToastAPI | null>(null);

export { ToastContext };

export function useToast(): ToastAPI {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used inside <ToastProvider>');
  }
  return ctx;
}
