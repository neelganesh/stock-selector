import { AnimatePresence } from 'framer-motion';
import { Toast } from './Toast';
import type { ToastData } from '../hooks/useToasts';

export interface ToastContainerProps {
  toasts: ToastData[];
  onDismiss: (id: string) => void;
  isMobile?: boolean;
}

const MAX_VISIBLE = 5;

export function ToastContainer({ toasts, onDismiss, isMobile = false }: ToastContainerProps) {
  // Cap to MAX_VISIBLE newest (last items in the array are the most recent).
  const visible = toasts.length > MAX_VISIBLE ? toasts.slice(-MAX_VISIBLE) : toasts;
  // Reverse so newest appears at the top of the stack.
  const ordered = [...visible].reverse();

  const position = isMobile ? 'bottom-center' : 'top-right';
  const positionClass = isMobile
    ? 'bottom-4 inset-x-4 items-stretch sm:items-center'
    : 'top-4 right-4 items-end';

  return (
    <div
      aria-live="polite"
      aria-label="Notifications"
      className={`fixed ${positionClass} flex flex-col gap-2 z-[100] pointer-events-none`}
    >
      <div
        data-testid="toast-stack"
        data-position={position}
        className="flex flex-col gap-2 w-full items-stretch sm:items-end"
      >
        <AnimatePresence initial={false}>
          {ordered.map((toast) => (
            <Toast
              key={toast.id}
              id={toast.id}
              message={toast.message}
              variant={toast.variant}
              duration={toast.duration}
              onDismiss={onDismiss}
              action={toast.action}
            />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
