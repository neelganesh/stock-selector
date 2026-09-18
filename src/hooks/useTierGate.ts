import { useTier } from '../context/TierContext';
import { TIERS, TIER_CONFIGS, type Tier } from '../lib/tiers';

/** Gate a feature by tier. Returns { allowed, upgrade } */
export function useTierGate(feature: string) {
  const { tier, tierConfig } = useTier();

  // Feature to tier mapping
  const featureTiers: Record<string, Tier> = {
    backtesting: TIERS.PRO,
    alerts: TIERS.PRO,
    priorityData: TIERS.PRO,
    apiAccess: TIERS.INSTITUTIONAL,
    unlimitedStrategies: TIERS.PRO,
    institutional: TIERS.INSTITUTIONAL,
  };

  const required = featureTiers[feature];
  if (!required) return { allowed: true, upgrade: () => {} };

  const tierOrder = [TIERS.FREE, TIERS.PRO, TIERS.INSTITUTIONAL];
  const allowed = tierOrder.indexOf(tier) >= tierOrder.indexOf(required);

  return {
    allowed,
    upgrade: () => {
      const intent = { feature, required, current: tier };
      sessionStorage.setItem('upgrade_intent', JSON.stringify(intent));
      window.dispatchEvent(new CustomEvent('tier-upgrade', { detail: intent }));
    },
  };
}

/** Get tier display info for billing UI */
export function useBillingInfo() {
  const { tier, tierConfig } = useTier();
  return {
    currentTier: tierConfig.label,
    isPro: tier !== TIERS.FREE,
    isFree: tier === TIERS.FREE,
    nextTier: tier === TIERS.FREE ? TIER_CONFIGS[TIERS.PRO] : null,
    priceMonthly: tierConfig.priceMonthly,
    priceINR: tierConfig.priceINR,
  };
}
