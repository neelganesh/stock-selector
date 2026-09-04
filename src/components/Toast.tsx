import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { ToastData, ToastAction, ToastVariant } from '../hooks/useToasts';

export type { ToastData, ToastAction, ToastVariant };

const VARIANT_ICONS: Record<ToastVariant, string> = {
  success: 'M5 13l4 4L19 7',
  error: 'M6 18L18 6M6 6l12 12',
  info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  warning: 'M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z',
};

const VARIANT_COLORS: Record<ToastVariant, string> = {
  success: 'text-emerald-500',
  error: 'text-rose-500',
  info: 'text-sky-500',
  warning: 'text-amber-500',
};

const VARIANT_BORDERS: Record<ToastVariant, string> = {
  success: 'border-l-emerald-500',
  error: 'border-l-rose-500',
  info: 'border-l-sky-500',
  warning: 'border-l-amber-500',
};

const VARIANT_ACCENT_ROLE: Record<ToastVariant, { role: 'status' | 'alert'; live: 'polite' | 'assertive' }> = {
  success: { role: 'status', live: 'polite' },
  info: { role: 'status', live: 'polite' },
  warning: { role: 'alert', live: 'assertive' },
  error: { role: 'alert', live: 'assertive' },
};

export interface ToastProps {
  id: string;
  message: string;
  variant: ToastVariant;
  duration: number;
  onDismiss: (id: string) => void;
  action?: ToastAction;
}

export function Toast({ id, message, variant, duration, onDismiss, action }: ToastProps) {
  useEffect(() => {
    // duration is handled by useToasts hook; this is a no-op safety in case
    // Toast is used standalone (e.g. in tests) without the hook.
    if (duration <= 0) return;
    const timer = setTimeout(() => onDismiss(id), duration);
    return () => clearTimeout(timer);
  }, [id, duration, onDismiss]);

  const accent = VARIANT_ACCENT_ROLE[variant];

  return (
    <motion.div
      initial={{ opacity: 0, y: -8, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 32 }}
      data-testid={`toast-${id}`}
      data-variant={variant}
      role={accent.role}
      aria-live={accent.live}
      aria-atomic="true"
      className={`vision-glass border border-slate-200/70 border-l-4 ${VARIANT_BORDERS[variant]} rounded-xl shadow-lg shadow-slate-900/5 px-3.5 py-3 w-full max-w-sm flex items-start gap-3 pointer-events-auto`}
    >
      {/* Icon */}
      <div className={`shrink-0 mt-0.5 ${VARIANT_COLORS[variant]}`} aria-hidden="true">
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={VARIANT_ICONS[variant]} />
        </svg>
      </div>

      {/* Message + action */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 leading-snug break-words">
          {message}
        </p>
        {action && (
          <button
            type="button"
            onClick={action.onAction}
            className="mt-1.5 text-xs font-bold text-sky-600 hover:text-sky-700 active:scale-95 transition-transform cursor-pointer"
          >
            {action.label}
          </button>
        )}
      </div>

      {/* Close */}
      <button
        type="button"
        onClick={() => onDismiss(id)}
        aria-label="Dismiss notification"
        className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100/60 transition-colors cursor-pointer"
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}
