import { useState, useRef, useEffect, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface InfoTooltipProps {
  /** Tooltip body. Plain text or short JSX. Keep it under ~160 chars for readability. */
  content: ReactNode;
  /** Accessible label, e.g. "What is R:R Ratio". */
  label: string;
  /** Optional side override. Auto-flips near viewport edges. */
  side?: 'top' | 'bottom' | 'auto';
  /** Size of the trigger icon. */
  size?: 'sm' | 'md';
}

const sizeMap = {
  sm: 'w-3.5 h-3.5',
  md: 'w-4 h-4',
} as const;

/**
 * Subtle, Apple-style info affordance.
 * - Hover on desktop → popover appears after a short delay.
 * - Tap on touch devices → toggles persistent popover; tap outside to dismiss.
 * - Keyboard accessible: focus / blur + Enter / Esc.
 * - Uses theme tokens so it renders correctly in light and dark modes.
 */
export function InfoTooltip({ content, label, side = 'auto', size = 'sm' }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const [resolvedSide, setResolvedSide] = useState<'top' | 'bottom'>('top');
  const wrapRef = useRef<HTMLSpanElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const hoverTimer = useRef<number | null>(null);

  // Outside-click dismissal for the touch / keyboard path.
  useEffect(() => {
    if (!open) return;
    const handleDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapRef.current) return;
      if (!wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleDown);
    document.addEventListener('touchstart', handleDown);
    return () => {
      document.removeEventListener('mousedown', handleDown);
      document.removeEventListener('touchstart', handleDown);
    };
  }, [open]);

  // Esc to close.
  useEffect(() => {
    if (!open) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [open]);

  const handleEnter = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    // Resolve side after the popover mounts so we can read its rect.
    hoverTimer.current = window.setTimeout(() => {
      if (side === 'auto' && popRef.current) {
        const rect = popRef.current.getBoundingClientRect();
        const wouldOverflowTop = rect.top < 8;
        setResolvedSide(wouldOverflowTop ? 'bottom' : 'top');
      } else {
        setResolvedSide(side === 'bottom' ? 'bottom' : 'top');
      }
      setOpen(true);
    }, 120);
  };

  const handleLeave = () => {
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    setOpen(false);
  };

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hoverTimer.current) window.clearTimeout(hoverTimer.current);
    if (side === 'auto' && popRef.current) {
      const rect = popRef.current.getBoundingClientRect();
      const wouldOverflowTop = rect.top < 8;
      setResolvedSide(wouldOverflowTop ? 'bottom' : 'top');
    } else {
      setResolvedSide(side === 'bottom' ? 'bottom' : 'top');
    }
    setOpen((v) => !v);
  };

  const popoverSide = resolvedSide;

  return (
    <span
      ref={wrapRef}
      className="relative inline-flex items-center"
      onMouseEnter={handleEnter}
      onMouseLeave={handleLeave}
    >
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        aria-describedby={open ? `tt-${label.replace(/\s+/g, '-').toLowerCase()}` : undefined}
        onClick={handleClick}
        onFocus={handleEnter}
        onBlur={handleLeave}
        className="inline-flex items-center justify-center rounded-full text-[color:var(--text-tertiary)] hover:text-[color:var(--text-secondary)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--accent-blue)] focus-visible:ring-offset-1 focus-visible:ring-offset-[color:var(--ground)] transition-colors"
      >
        <svg
          className={sizeMap[size]}
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="10" cy="10" r="8.5" stroke="currentColor" strokeWidth="1.2" />
          <path
            d="M10 8.5v5"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
          <circle cx="10" cy="6" r="0.95" fill="currentColor" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            ref={popRef}
            id={`tt-${label.replace(/\s+/g, '-').toLowerCase()}`}
            role="tooltip"
            initial={{ opacity: 0, y: popoverSide === 'top' ? 4 : -4, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: popoverSide === 'top' ? 4 : -4, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.16, 1, 0.3, 1] }}
            style={{ transformOrigin: popoverSide === 'top' ? 'bottom center' : 'top center' }}
            className={`pointer-events-none absolute z-50 left-1/2 -translate-x-1/2 max-w-[260px] sm:max-w-[300px] ${
              popoverSide === 'top' ? 'bottom-full mb-2' : 'top-full mt-2'
            }`}
          >
            <div className="kite-card rounded-[var(--card-radius)] px-3.5 py-2.5 text-xs leading-relaxed text-[color:var(--text-primary)]">
              <div className="font-semibold text-[color:var(--text-primary)] mb-0.5">{label}</div>
              <div className="text-[color:var(--text-secondary)] font-normal">{content}</div>
            </div>
            {/* Subtle arrow */}
            <span
              aria-hidden="true"
              className={`absolute left-1/2 -translate-x-1/2 w-2 h-2 rotate-45 bg-[color:var(--ground)] border-r border-b border-[color:var(--border-default)] ${
                popoverSide === 'top' ? '-bottom-1' : '-top-1'
              }`}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </span>
  );
}
