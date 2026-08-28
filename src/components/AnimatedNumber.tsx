import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect, useState } from 'react';

interface AnimatedNumberProps {
  value: number;
  format?: (value: number) => string;
  duration?: number;
  className?: string;
}

export function AnimatedNumber({
  value,
  format = (v) => v.toFixed(2),
  duration = 0.8,
  className = '',
}: AnimatedNumberProps) {
  const [displayValue, setDisplayValue] = useState<string>(() => format(value));

  const spring = useSpring(value, {
    stiffness: 100,
    damping: 20,
    duration: duration * 1000,
  });

  const display = useTransform(spring, (latest) => format(latest));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  useEffect(() => {
    return display.on('change', (v) => setDisplayValue(v));
  }, [display]);

  return (
    <motion.span
      className={`font-[var(--font-mono)] tabular-nums ${className}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
    >
      {displayValue}
    </motion.span>
  );
}
