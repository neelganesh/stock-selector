import { motion } from 'framer-motion';

interface StrategyTabProps {
  strategies: string[];
  activeStrategy: string;
  onSelect: (strategy: string) => void;
}

export function StrategyTab({ strategies, activeStrategy, onSelect }: StrategyTabProps) {
  return (
    <div className="relative flex items-center p-1.5 rounded-2xl bg-white/70 backdrop-blur-2xl border border-white/80 shadow-md">
      {strategies.map((strategy) => (
        <button
          key={strategy}
          onClick={() => onSelect(strategy)}
          className={`
            relative px-4 py-2.5 rounded-xl
            text-sm font-semibold tracking-tight
            transition-colors duration-200 cursor-pointer select-none
            ${
              activeStrategy === strategy
                ? 'text-[#1D1D1F]'
                : 'text-[#6E6E73] hover:text-[#1D1D1F]'
            }
          `}
        >
          {activeStrategy === strategy && (
            <motion.div
              layoutId="active-strategy-pill"
              className="absolute inset-0 rounded-xl bg-white shadow-sm border border-black/5"
              transition={{
                type: 'spring',
                stiffness: 450,
                damping: 35,
              }}
            />
          )}
          <span className="relative z-10 flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${activeStrategy === strategy ? 'bg-blue-500' : 'bg-transparent'}`} />
            {strategy}
          </span>
        </button>
      ))}
    </div>
  );
}
