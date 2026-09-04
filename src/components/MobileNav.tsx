import { motion } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';

export interface MobileNavTab {
  id: string;
  label: string;
  icon: string; // single emoji glyph or short symbol
}

export interface MobileNavProps {
  tabs: MobileNavTab[];
  activeTab: string;
  onChange: (id: string) => void;
  /** Test override: forces visibility regardless of viewport. */
  forceVisible?: boolean;
}

/**
 * Sticky bottom tab bar shown only on mobile. Hides itself on desktop.
 * Each tab is a large touch target (>= 48px) with an icon and short label.
 */
export function MobileNav({ tabs, activeTab, onChange, forceVisible = false }: MobileNavProps) {
  const { isMobile } = useIsMobile();
  if (!isMobile && !forceVisible) return null;

  return (
    <nav
      data-testid="mobile-nav"
      data-active-tab={activeTab}
      aria-label="Primary"
      className="fixed bottom-0 inset-x-0 z-50 vision-glass border-t border-glass-border-subtle shadow-[0_-10px_30px_-5px_rgba(0,0,0,0.08)] backdrop-blur-xl"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <ul className="grid grid-cols-5 max-w-2xl mx-auto">
        {tabs.map((t) => {
          const isActive = t.id === activeTab;
          return (
            <li key={t.id} className="flex">
              <button
                type="button"
                onClick={() => onChange(t.id)}
                aria-current={isActive ? 'page' : undefined}
                data-testid={`mobile-nav-tab-${t.id}`}
                data-active={isActive ? 'true' : 'false'}
                className={`relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 transition-colors duration-200 cursor-pointer ${
                  isActive
                    ? 'text-accent-blue'
                    : 'text-text-secondary hover:text-text-primary active:text-text-primary'
                }`}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full bg-accent-blue"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <span
                  className="text-lg leading-none"
                  aria-hidden="true"
                  style={{ filter: isActive ? 'none' : 'grayscale(0.3)' }}
                >
                  {t.icon}
                </span>
                <span className="text-[10px] font-extrabold tracking-tight leading-none">
                  {t.label}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
