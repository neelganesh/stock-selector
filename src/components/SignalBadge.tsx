import { motion } from 'framer-motion';

type SignalType = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

interface SignalBadgeProps {
  type: SignalType;
  size?: 'sm' | 'md';
}

const signalConfig: Record<
  SignalType,
  { label: string; bg: string; text: string; border: string; dot: string }
> = {
  'strong-buy': {
    label: 'Strong Buy',
    bg: 'rgba(40, 205, 65, 0.12)',
    text: '#1E8E2D',
    border: 'rgba(40, 205, 65, 0.3)',
    dot: '#28CD41',
  },
  buy: {
    label: 'Buy',
    bg: 'rgba(40, 205, 65, 0.08)',
    text: '#24A137',
    border: 'rgba(40, 205, 65, 0.22)',
    dot: '#34C759',
  },
  hold: {
    label: 'Hold',
    bg: 'rgba(255, 149, 0, 0.12)',
    text: '#C67300',
    border: 'rgba(255, 149, 0, 0.3)',
    dot: '#FF9500',
  },
  sell: {
    label: 'Sell',
    bg: 'rgba(255, 59, 48, 0.1)',
    text: '#D72C21',
    border: 'rgba(255, 59, 48, 0.25)',
    dot: '#FF3B30',
  },
  'strong-sell': {
    label: 'Strong Sell',
    bg: 'rgba(255, 59, 48, 0.16)',
    text: '#B81A10',
    border: 'rgba(255, 59, 48, 0.35)',
    dot: '#D32F2F',
  },
};

export function SignalBadge({ type, size = 'md' }: SignalBadgeProps) {
  const config = signalConfig[type];
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-xs tracking-wide'
      : 'px-3.5 py-1 text-xs font-semibold tracking-wide';

  return (
    <motion.span
      className={`
        inline-flex items-center gap-1.5
        rounded-full font-semibold backdrop-blur-md
        border shadow-xs ${sizeClasses}
      `}
      style={{
        backgroundColor: config.bg,
        color: config.text,
        borderColor: config.border,
      }}
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      <span
        className="w-1.5 h-1.5 rounded-full animate-pulse"
        style={{ backgroundColor: config.dot }}
      />
      {config.label}
    </motion.span>
  );
}
