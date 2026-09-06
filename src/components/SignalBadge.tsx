import { motion } from 'framer-motion';

type SignalType = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

interface SignalBadgeProps {
  type: SignalType;
  size?: 'sm' | 'md';
}

/**
 * Signal badge — the only place signal colour lives on the card.
 * The dot is the hue (sky / violet / orchid / peach / rose) but the
 * pill itself stays neutral glass. This way the card reads as
 * "iOS 26 Liquid Glass" while the dot still communicates
 * conviction at a glance.
 */
const signalConfig: Record<
  SignalType,
  { label: string; dotVar: string }
> = {
  'strong-buy': {
    label: 'Strong Buy',
    dotVar: 'var(--signal-strong-buy)',
  },
  buy: {
    label: 'Buy',
    dotVar: 'var(--signal-buy)',
  },
  hold: {
    label: 'Hold',
    dotVar: 'var(--signal-hold)',
  },
  sell: {
    label: 'Sell',
    dotVar: 'var(--signal-sell)',
  },
  'strong-sell': {
    label: 'Strong Sell',
    dotVar: 'var(--signal-strong-sell)',
  },
};

export function SignalBadge({ type, size = 'md' }: SignalBadgeProps) {
  const config = signalConfig[type];
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[10px]'
      : 'px-3.5 py-1 text-xs font-semibold tracking-wide';

  return (
    <motion.span
      className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses}`}
      style={{
        backgroundColor: 'var(--glass-bg-subtle)',
        border: '1px solid var(--glass-border-subtle)',
        color: 'var(--text-secondary)',
      }}
      whileHover={{ scale: 1.02 }}
      transition={{ duration: 0.15 }}
    >
      <span
        className="rounded-full shrink-0"
        style={{
          width: size === 'sm' ? '5px' : '6px',
          height: size === 'sm' ? '5px' : '6px',
          backgroundColor: config.dotVar,
        }}
      />
      {config.label}
    </motion.span>
  );
}
