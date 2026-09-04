import { useTheme } from '../hooks/useTheme';

const LABELS: Record<'system' | 'light' | 'dark', string> = {
  system: 'System theme (click for light)',
  light: 'Light theme (click for dark)',
  dark: 'Dark theme (click for system)',
};

const TITLES: Record<'system' | 'light' | 'dark', string> = {
  system: 'System',
  light: 'Light',
  dark: 'Dark',
};

function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4" width="18" height="12" rx="2" />
      <path d="M8 20h8M12 16v4" />
    </svg>
  );
}

export interface ThemeToggleProps {
  className?: string;
}

export function ThemeToggle({ className }: ThemeToggleProps) {
  const { theme, cycleTheme } = useTheme();

  const icon = theme === 'light' ? <SunIcon /> : theme === 'dark' ? <MoonIcon /> : <SystemIcon />;

  return (
    <button
      type="button"
      onClick={cycleTheme}
      aria-label={LABELS[theme]}
      title={`Theme: ${TITLES[theme]}`}
      data-testid="theme-toggle"
      data-theme-mode={theme}
      className={className ?? 'inline-flex items-center justify-center w-8 h-8 rounded-full text-text-secondary hover:text-text-primary hover:bg-glass-bg-subtle transition-colors duration-200'}
    >
      {icon}
    </button>
  );
}
