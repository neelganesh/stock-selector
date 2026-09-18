import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { GlassCard } from './GlassCard';
import { Icon, type IconName } from './Icon';
import { useTier } from '../context/TierContext';
import { TIERS, TIER_CONFIGS } from '../lib/tiers';

export function UpgradeModal() {
  const { tier, tierConfig } = useTier();
  const [intent, setIntent] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (typeof detail === 'string') {
        setIntent(detail);
      } else if (detail?.feature) {
        setIntent(`${detail.feature} → ${detail.required}`);
      }
    };
    window.addEventListener('tier-upgrade', handler);
    return () => window.removeEventListener('tier-upgrade', handler);
  }, []);

  const show = !!intent;
  const nextTier = tier === TIERS.FREE ? TIER_CONFIGS[TIERS.PRO] : null;

  const handleUpgrade = () => {
    sessionStorage.setItem('upgrade_intent', intent ?? '');
    window.dispatchEvent(new CustomEvent('tier-upgrade-stripe'));
  };

  if (!show) return null;

  return (
    <div>
      <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)' }}>
        <div onClick={(e) => e.stopPropagation()}>
        <GlassCard className="w-[400px] max-w-[90vw] p-6">
          <div className="flex items-center gap-3 mb-4">
            <Icon name="sparkles" className="w-5 h-5 text-[var(--accent)]" />
            <h3 className="text-lg font-bold text-[color:var(--text-primary)]">Upgrade to Pro</h3>
          </div>
          <p className="text-sm text-[color:var(--text-secondary)] mb-4">
            {intent === 'backtesting' && 'Backtesting is a Pro feature. Upgrade to test your strategies historically.'}
            {intent === 'alerts' && 'Smart alerts are a Pro feature. Upgrade to get notified about signal changes.'}
            {intent === 'unlimitedStrategies' && 'Unlock more strategies with Pro.'}
            {intent === 'apiAccess' && 'API access is available on Institutional plans.'}
            {![ 'backtesting', 'alerts', 'unlimitedStrategies', 'apiAccess' ].includes(intent ?? '') && 'Unlock premium features to get more from your trading analysis.'}
          </p>
          {nextTier && (
            <div className="mb-4">
              <div className="flex items-center justify-between text-sm">
                <span className="text-[color:var(--text-secondary)]">Current plan</span>
                <span className="font-medium text-[color:var(--text-primary)]">{tierConfig.label}</span>
              </div>
              <div className="flex items-center justify-between text-sm mt-2">
                <span className="text-[color:var(--text-secondary)]">Pro plan</span>
                <span className="font-medium text-[color:var(--accent)]">{nextTier.priceMonthly ? `₹${nextTier.priceINR}/mo` : 'Contact us'}</span>
              </div>
            </div>
          )}
          <div className="flex gap-2">
            <button
              onClick={handleUpgrade}
              className="flex-1 px-4 py-2 rounded-lg bg-[color:var(--accent)] text-white text-sm font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              Upgrade Now
            </button>
            <button
              onClick={() => setIntent(null)}
              className="flex-1 px-4 py-2 rounded-lg bg-[color:var(--ground-secondary)] text-[color:var(--text-primary)] text-sm font-medium hover:bg-[color:var(--ground)] transition-colors cursor-pointer"
            >
              Maybe Later
            </button>
          </div>
        </GlassCard>
        </div>
      </div>
    </div>
  );
}
