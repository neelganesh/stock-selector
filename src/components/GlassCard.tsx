import { motion } from 'framer-motion';
import type { HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';

interface GlassCardProps extends HTMLMotionProps<'div'> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'subtle' | 'interactive';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  className?: string;
}

const paddingStyles = {
  none: '',
  sm: 'p-3.5 sm:p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

const variantStyles = {
  default: 'vision-glass',
  interactive: 'vision-glass vision-glass-hover',
  elevated: 'vision-glass shadow-2xl',
  subtle: 'vision-glass-subtle',
};

export function GlassCard({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: GlassCardProps) {
  return (
    <motion.div
      className={`
        rounded-2xl
        ${variantStyles[variant]}
        ${paddingStyles[padding]}
        ${className}
      `}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
      {...props}
    >
      {children}
    </motion.div>
  );
}
