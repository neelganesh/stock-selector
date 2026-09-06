import { useEffect, useState, type ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';

export interface MobileSidebarDrawerProps {
  children: ReactNode;
}

export function MobileSidebarDrawer({ children }: MobileSidebarDrawerProps) {
  const { isMobile } = useIsMobile();
  const [open, setOpen] = useState(false);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  // Lock body scroll when open
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Desktop: just render children inline
  if (!isMobile) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Hamburger trigger */}
      <button
        type="button"
        aria-label="Open menu"
        aria-expanded={open}
        aria-controls="mobile-sidebar-drawer"
        onClick={() => setOpen(true)}
        className="fixed top-3 left-3 z-40 inline-flex items-center justify-center w-10 h-10 rounded-[var(--card-radius)] kite-card text-[color:var(--text-primary)] active:scale-95 transition"
        data-testid="mobile-drawer-trigger"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <line x1="4" y1="7" x2="20" y2="7" />
          <line x1="4" y1="12" x2="20" y2="12" />
          <line x1="4" y1="17" x2="20" y2="17" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.button
            type="button"
            aria-label="Close sidebar"
            data-testid="mobile-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-40 bg-slate-900/40 backdrop-blur-sm"
          />
        )}
      </AnimatePresence>

      {/* Always-rendered dialog for AT (closed = aria-hidden true) */}
      <div
        id="mobile-sidebar-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="Strategy selector"
        aria-hidden={!open}
        data-open={open}
        className={`fixed top-0 left-0 bottom-0 z-50 w-[88vw] max-w-sm vision-glass border-r border-white/60 shadow-2xl overflow-y-auto pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] transition-transform duration-200 ease-out ${
          open ? 'translate-x-0' : '-translate-x-full pointer-events-none'
        }`}
        data-testid="mobile-drawer-panel"
      >
        <div className="flex justify-end p-3">
          <button
            type="button"
            aria-label="Close menu"
            onClick={() => setOpen(false)}
            className="inline-flex items-center justify-center w-9 h-9 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 active:scale-95 transition"
            data-testid="mobile-drawer-close"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="6" y1="6" x2="18" y2="18" />
              <line x1="6" y1="18" x2="18" y2="6" />
            </svg>
          </button>
        </div>
        <div className="px-1 pb-4">
          {children}
        </div>
      </div>
    </>
  );
}
