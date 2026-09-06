import { motion } from 'framer-motion';

interface StrategyTabProps {
  strategies: string[];
  activeStrategy: string;
  onSelect: (strategy: string) => void;
}

export function StrategyTab({ strategies, activeStrategy, onSelect }: StrategyTabProps) {
  return (
    <div className="relative flex items-center p-1 rounded-[var(--card-radius)] bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)]">
      {strategies.map((strategy) => (
        <button
          key={strategy}
          onClick={() => onSelect(strategy)}
          className={`
            relative px-4 py-2 rounded-[10px]
            text-sm font-semibold tracking-tight
            transition-colors duration-200 cursor-pointer select-none
            ${
              activeStrategy === strategy
                ? 'text-[color:var(--text-primary)]'
                : 'text-[color:var(--text-tertiary)] hover:text-[color:var(--text-primary)]'
            }
          `}
        >
          {activeStrategy === strategy && (
            <motion.div
              layoutId="active-strategy-pill"
              className="absolute inset-0 rounded-[10px] bg-[color:var(--ground)] border border-[color:var(--border-default)]"
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 35,
              }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activeStrategy === strategy ? 'bg-[color:var(--accent)]' : 'bg-transparent'}`} />
            {strategy}
          </span>
        </button>
      ))}
    </div>
  );
}
