import type { StrategyDefinition } from '../types';
import { ZerodhaSwingStrategy } from './ZerodhaSwingStrategy';
import { MomentumBreakoutStrategy } from './MomentumBreakoutStrategy';
import { SuperTrendRiderStrategy } from './SuperTrendRiderStrategy';

/**
 * Strategy Registry
 * Zerodha Swing Strategy is listed 1st as requested by the user.
 * Additional strategies can be added here easily as pluggable modules.
 */
export const ALL_STRATEGIES: StrategyDefinition[] = [
  ZerodhaSwingStrategy,
  MomentumBreakoutStrategy,
  SuperTrendRiderStrategy,
];

export function getStrategyById(id: string): StrategyDefinition {
  const found = ALL_STRATEGIES.find((s) => s.id === id);
  return found || ZerodhaSwingStrategy;
}

export { ZerodhaSwingStrategy, MomentumBreakoutStrategy, SuperTrendRiderStrategy };
