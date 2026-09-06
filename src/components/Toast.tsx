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

const VARIANT_STYLES: Record<ToastVariant, { icon: string; border: string; bg: string }> = {
  success: { icon: 'var(--positive)', border: 'var(--positive)', bg: 'var(--positive-bg)' },
  error: { icon: 'var(--negative)', border: 'var(--negative)', bg: 'var(--negative-bg)' },
  info: { icon: 'var(--accent-brand)', border: 'var(--accent-brand)', bg: 'var(--accent-brand-bg)' },
  warning: { icon: 'var(--warning)', border: 'var(--warning)', bg: 'var(--warning-bg)' },
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
      initial={{ opacity: 0, x: -16, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: -8, scale: 0.95, transition: { duration: 0.15 } }}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      data-testid={`toast-${id}`}
      data-variant={variant}
      role={accent.role}
      aria-live={accent.live}
      aria-atomic="true"
      className="flex items-start gap-3 px-4 py-3 w-full max-w-sm pointer-events-auto rounded-xl shadow-lg"
      style={{
        backgroundColor: 'var(--elevated-1)',
        border: '1px solid var(--border-default)',
        borderLeft: `4px solid ${VARIANT_STYLES[variant].border}`,
      }}
    >
      {/* Icon */}
      <div className="shrink-0 mt-0.5 rounded-full p-1.5" aria-hidden="true" style={{ backgroundColor: VARIANT_STYLES[variant].bg }}>
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke={VARIANT_STYLES[variant].icon} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
          <path d={VARIANT_ICONS[variant]} />
        </svg>
      </div>

      {/* Message + action */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold leading-snug break-words" style={{ color: 'var(--text-primary)' }}>
          {message}
        </p>
        {action && (
          <button
            type="button"
            onClick={action.onAction}
            className="mt-1.5 text-xs font-bold active:scale-95 transition-transform cursor-pointer"
            style={{ color: 'var(--accent-brand)' }}
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
        className="shrink-0 -mr-1 -mt-1 p-1 rounded-lg transition-colors cursor-pointer"
        style={{ color: 'var(--text-tertiary)' }}
      >
        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </motion.div>
  );
}
