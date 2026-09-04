/**
 * Provides toast state to the React tree.
 * The `useToast` hook lives in `useToast.ts` so it can be HMR-stable.
 */
import { type ReactNode } from 'react';
import { useToasts } from '../hooks/useToasts';
import { ToastContainer } from './ToastContainer';
import { useIsMobile } from '../hooks/useIsMobile';
import { ToastContext, type ToastAPI } from './useToast';

export type { ToastAPI };

export function ToastProvider({ children }: { children: ReactNode }) {
  const toastState = useToasts();
  const { isMobile } = useIsMobile();

  const api: ToastAPI = {
    ...toastState,
    success: (message, opts) => toastState.push({ ...opts, message, variant: 'success' }),
    error: (message, opts) => toastState.push({ ...opts, message, variant: 'error' }),
    info: (message, opts) => toastState.push({ ...opts, message, variant: 'info' }),
    warning: (message, opts) => toastState.push({ ...opts, message, variant: 'warning' }),
  };

  return (
    <ToastContext.Provider value={api}>
      {children}
      <ToastContainer
        toasts={toastState.toasts}
        onDismiss={toastState.dismiss}
        isMobile={isMobile}
      />
    </ToastContext.Provider>
  );
}
