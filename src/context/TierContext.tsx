import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { TIERS, TIER_CONFIGS, isProOrAbove, type Tier, type TierConfig } from '../lib/tiers';

interface TierContextType {
  tier: Tier;
  tierConfig: TierConfig;
  loading: boolean;
  isPro: boolean;
  upgradeToPro: () => Promise<void>;
  refreshTier: () => Promise<void>;
}

const TierContext = createContext<TierContextType | null>(null);

export function TierProvider({ children }: { children: ReactNode }) {
  const [tier, setTier] = useState<Tier>(TIERS.FREE);
  const [loading, setLoading] = useState(true);

  const refreshTier = useCallback(async () => {
    if (!supabase) {
      setTier(TIERS.FREE);
      setLoading(false);
      return;
    }
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        setTier(TIERS.FREE);
        setLoading(false);
        return;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('plan')
        .eq('user_id', session.user.id)
        .single();
      if (!error && data?.plan) {
        const plan = data.plan as Tier;
        if (Object.values(TIERS).includes(plan)) {
          setTier(plan);
        }
      }
    } catch (err) {
      console.error('[Tier] Failed to refresh:', err);
      setTier(TIERS.FREE);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshTier();
    // Listen for auth changes
    const { data: { subscription } } = supabase?.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await refreshTier();
      } else {
        setTier(TIERS.FREE);
        setLoading(false);
      }
    });
    return () => { subscription?.unsubscribe(); };
  }, [refreshTier]);

  const upgradeToPro = useCallback(async () => {
    // Store intent for when billing is fully integrated
    sessionStorage.setItem('upgrade_intent', Date.now().toString());
    window.dispatchEvent(new CustomEvent('tier-upgrade'));
  }, []);

  const tierConfig = TIER_CONFIGS[tier] ?? TIER_CONFIGS[TIERS.FREE];

  return (
    <TierContext.Provider value={{
      tier,
      tierConfig,
      loading,
      isPro: isProOrAbove(tier),
      upgradeToPro,
      refreshTier,
    }}>
      {children}
    </TierContext.Provider>
  );
}

export function useTier(): TierContextType {
  const ctx = useContext(TierContext);
  if (!ctx) throw new Error('useTier must be used within TierProvider');
  return ctx;
}
