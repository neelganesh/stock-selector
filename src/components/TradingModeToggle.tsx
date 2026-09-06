interface TradingModeToggleProps {
  isPaperMode: boolean;
  onToggle: (isPaper: boolean) => void;
}

export function TradingModeToggle({ isPaperMode, onToggle }: TradingModeToggleProps) {
  return (
    <button
      role="switch"
      aria-checked={!isPaperMode}
      aria-label="Toggle between live and paper trading"
      onClick={() => onToggle(!isPaperMode)}
      className={`
        relative shrink-0 h-4 w-8 rounded-full
        transition-colors duration-200
        focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
        ${isPaperMode ? 'bg-amber-500' : 'bg-blue-500'}
      `}
      style={{ padding: 0 }}
    >
      <span
        className={`
          absolute top-0.5 left-0.5 h-3 w-3 rounded-full bg-white shadow
          transition-transform duration-200
          ${isPaperMode ? 'translate-x-0' : 'translate-x-4'}
        `}
      />
      <span className="sr-only">{isPaperMode ? 'Paper' : 'Live'} mode</span>
    </button>
  );
}
