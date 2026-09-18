export const TIERS = {
  FREE: 'free',
  PRO: 'pro',
  INSTITUTIONAL: 'institutional',
} as const;

export type Tier = (typeof TIERS)[keyof typeof TIERS];

export interface TierConfig {
  tier: Tier;
  label: string;
  priceMonthly: number | null; // null = free
  priceINR: number | null;
  maxStocksDisplay: number; // 0 = unlimited
  maxStrategies: number;
  backtesting: boolean;
  alerts: boolean;
  paperTrading: boolean;
  priorityData: boolean;
  apiAccess: boolean;
  features: string[];
}

export const TIER_CONFIGS: Record<Tier, TierConfig> = {
  [TIERS.FREE]: {
    tier: TIERS.FREE,
    label: 'Free',
    priceMonthly: null,
    priceINR: null,
    maxStocksDisplay: 0, // all stocks (gated server-side later)
    maxStrategies: 3,
    backtesting: false,
    alerts: false,
    paperTrading: true,
    priorityData: false,
    apiAccess: false,
    features: ['Basic signals', '192-stock universe', '3 strategies', 'Paper trading'],
  },
  [TIERS.PRO]: {
    tier: TIERS.PRO,
    label: 'Pro',
    priceMonthly: 999,
    priceINR: 999,
    maxStocksDisplay: 0,
    maxStrategies: 10,
    backtesting: true,
    alerts: true,
    paperTrading: true,
    priorityData: true,
    apiAccess: false,
    features: ['Everything in Free', '10 strategies', 'Backtesting', 'Smart alerts', 'Priority data', 'Unlimited stock display'],
  },
  [TIERS.INSTITUTIONAL]: {
    tier: TIERS.INSTITUTIONAL,
    label: 'Institutional',
    priceMonthly: null, // custom pricing
    priceINR: null,
    maxStocksDisplay: 0,
    maxStrategies: 50,
    backtesting: true,
    alerts: true,
    paperTrading: true,
    priorityData: true,
    apiAccess: true,
    features: ['Everything in Pro', 'Custom infrastructure', 'API access', 'White-label', 'Dedicated support'],
  },
};

export function getTierConfig(tier: Tier | null | undefined): TierConfig | null {
  if (!tier) return TIER_CONFIGS[TIERS.FREE];
  return TIER_CONFIGS[tier] ?? TIER_CONFIGS[TIERS.FREE];
}

export function isProOrAbove(tier: Tier | null | undefined): boolean {
  if (!tier) return false;
  return tier === TIERS.PRO || tier === TIERS.INSTITUTIONAL;
}
