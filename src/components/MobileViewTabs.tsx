import type { ReactNode } from 'react';
import { useIsMobile } from '../hooks/useIsMobile';

export interface MobileViewTab {
  id: string;
  label: string;
  icon: ReactNode;
  badge?: number;
}

export interface MobileViewTabsProps {
  tabs: MobileViewTab[];
  activeTab: string;
  onChange: (id: string) => void;
}

export function MobileViewTabs({ tabs, activeTab, onChange }: MobileViewTabsProps) {
  const { isMobile } = useIsMobile();
  const showLabels = !isMobile; // On mobile, icon-only; on desktop, full labels

  return (
    <div
      role="tablist"
      aria-label="View mode"
      className="flex items-center gap-2 border-b border-slate-200/80 pb-3 overflow-x-auto"
    >
      {tabs.map((t) => {
        const isActive = t.id === activeTab;
        const baseBtn = 'flex-shrink-0 rounded-[var(--card-radius)] text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer';
        const stateClasses = isActive
          ? 'bg-slate-900 text-white shadow-md'
          : 'bg-white/60 hover:bg-white text-slate-600 border border-slate-200';
        const sizing = showLabels ? 'px-4 py-2' : 'w-10 h-10 justify-center p-0';

        return (
          <button
            key={t.id}
            type="button"
            role="tab"
            id={`tab-${t.id}`}
            data-testid={`tab-${t.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${t.id}`}
            aria-label={t.label}
            title={t.label}
            onClick={() => onChange(t.id)}
            className={`relative ${baseBtn} ${stateClasses} ${sizing}`}
          >
            <span className="w-4 h-4 flex items-center justify-center">{t.icon}</span>
            {showLabels && <span>{t.label}</span>}
            {showLabels && typeof t.badge === 'number' && (
              <span className="px-2 py-0.5 rounded-full text-[10px] bg-emerald-500/20 text-emerald-300 font-extrabold">
                {t.badge}
              </span>
            )}
            {/* SR-only short label for compact mode (mobile) */}
            {!showLabels && <span className="hidden">{t.label}</span>}
            {/* Badge dot when compact */}
            {!showLabels && typeof t.badge === 'number' && (
              <span
                aria-hidden
                className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-emerald-500 text-white text-[9px] font-extrabold flex items-center justify-center"
              />
            )}
          </button>
        );
      })}
    </div>
  );
}
