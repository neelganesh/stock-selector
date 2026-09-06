import { motion } from 'framer-motion';
import { useIsMobile } from '../hooks/useIsMobile';
import { Icon, type IconName } from './Icon';

export interface MobileNavTab {
  id: string;
  label: string;
  /** Name from the shared icon set — never an emoji. */
  icon: IconName;
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
      className="fixed bottom-0 inset-x-0 z-50"
      style={{
        backgroundColor: 'var(--ground)',
        borderTop: '1px solid var(--border-default)',
        paddingBottom: 'env(safe-area-inset-bottom)',
      }}
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
                className="relative flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2 px-1 transition-colors duration-200 cursor-pointer"
                style={{
                  color: isActive ? 'var(--accent-brand)' : 'var(--text-secondary)',
                }}
              >
                {isActive && (
                  <motion.span
                    layoutId="mobile-nav-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 w-10 h-[3px] rounded-b-full"
                    style={{ backgroundColor: 'var(--accent-brand)' }}
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <motion.span
                  className="flex items-center justify-center"
                  animate={{ scale: isActive ? 1.06 : 1 }}
                  transition={{ type: 'spring', stiffness: 480, damping: 30 }}
                >
                  <Icon name={t.icon} size={21} strokeWidth={isActive ? 2.2 : 1.9} />
                </motion.span>
                <span className="text-[10px] font-semibold tracking-tight leading-none">
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
