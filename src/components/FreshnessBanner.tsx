import { motion } from 'framer-motion';

interface FreshnessBannerProps {
  lastUpdated: Date | null;
  isStale?: boolean;
}

export function FreshnessBanner({ lastUpdated, isStale }: FreshnessBannerProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold bg-[color:var(--ground-secondary)] border border-[color:var(--border-subtle)]" aria-label="Data freshness">
      <span className={`w-2 h-2 rounded-full ${isStale ? 'bg-[color:var(--warning-amber)]' : 'bg-[color:var(--positive)]'}`} />
      <span className="text-[color:var(--text-secondary)]">
        {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'No data'}
      </span>
    </div>
  );
}

export function FreshnessDot({ isFresh }: { isFresh: boolean }) {
  return (
    <span className={`w-2 h-2 rounded-full shrink-0 ${isFresh ? 'bg-[color:var(--positive)]' : 'bg-[color:var(--warning-amber)]'}`} aria-label={isFresh ? 'Fresh data' : 'Stale data'} />
  );
}
