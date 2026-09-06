import type { HTMLAttributes, ReactNode } from 'react';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
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
  elevated: 'vision-glass',
  subtle: 'vision-glass-subtle',
};

/**
 * Kite-style card primitive.
 *
 * design2.md: flat opaque surface, single 1px hairline border, no shadow,
 * no glass / blur / refraction. Used as the building block for stock
 * picks, signal panels, and the strategy-rules accordion body.
 *
 * The `variant` prop is kept for API compatibility with the rest of
 * the codebase but every variant now maps to the same flat material —
 * the differentiation is just hover affordance.
 */
export function GlassCard({
  children,
  variant = 'default',
  padding = 'md',
  className = '',
  ...props
}: GlassCardProps) {
  return (
    <div
      className={`${variantStyles[variant]} ${paddingStyles[padding]} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
