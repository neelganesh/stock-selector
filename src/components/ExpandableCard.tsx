import { motion, AnimatePresence } from 'framer-motion';
import { useState, type ReactNode } from 'react';

interface ExpandableCardProps {
  /** Title text shown in the always-visible header. */
  title: string;
  /** Optional badge or count chip rendered next to the title. */
  badge?: ReactNode;
  /** Optional decorative icon (svg) rendered before the title. */
  icon?: ReactNode;
  /** Initial open state. Defaults to collapsed so the UI stays lean. */
  defaultOpen?: boolean;
  /** Header className override for color treatment per surface. */
  headerClassName?: string;
  /** Body content revealed on expand. */
  children: ReactNode;
}

/**
 * Progressive-disclosure card used by Strategy Criteria & Rules and
 * any other "show on demand" surface.
 *
 * Card anatomy follows the unified card design system (see index.css
 * `--card-*` tokens):
 *
 *   [ icon ] Title ................... [ chevron ]   <- header (44–56px)
 *   ─────────────────────────────────────────────  <- 1px hairline
 *   <children>                                     <- body, fluid pad
 *
 * Header height, padding, icon size, and title font-size all scale
 * via cqi (container query inline) so the card looks balanced whether
 * it sits in a 320px sidebar or a 1280px main pane — no per-resolution
 * testing required.
 */
export function ExpandableCard({
  title,
  badge,
  icon,
  defaultOpen = false,
  headerClassName = '',
  children,
}: ExpandableCardProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="kite-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls={`expandable-${title.replace(/\s+/g, '-').toLowerCase()}`}
        className={`w-full text-left transition-colors hover:bg-[color:var(--card-bg-hover)] ${headerClassName}`}
        style={{ containerType: 'inline-size', containerName: 'accordion-header' }}
      >
        <div className="kite-card-header">
          {icon && (
            <span className="kite-card-icon" aria-hidden="true">
              {icon}
            </span>
          )}
          <h3 className="kite-card-title truncate flex-1 min-w-0">{title}</h3>
          {badge && <div className="shrink-0">{badge}</div>}
          <span className="accordion-chevron" data-open={open} aria-hidden="true">
            {/* High-resolution vector chevron — 24x24 viewBox + 2.25 stroke
                reads crisply at any size. */}
            <svg
              viewBox="0 0 24 24"
              fill="none"
              width="100%"
              height="100%"
              stroke="currentColor"
              strokeWidth={2.25}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </span>
        </div>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            id={`expandable-${title.replace(/\s+/g, '-').toLowerCase()}`}
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
            className="overflow-hidden"
          >
            <div className="kite-card-body">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
