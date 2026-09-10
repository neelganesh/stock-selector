import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';

interface ZerodhaStatusButtonProps {
  onNavigateToProfile?: () => void;
}

type KiteStatus = 'loading' | 'not-configured' | 'configured' | 'error';

interface KiteKeyStatus {
  configured: boolean;
  working?: boolean;
  updatedAt?: string;
}

/**
 * Polls GET /api/kite/key-status every 60 seconds to show the Kite API key
 * configuration state in the header.
 */
export function ZerodhaStatusButton({ onNavigateToProfile }: ZerodhaStatusButtonProps) {
  const [status, setStatus] = useState<KiteStatus>('loading');

  const checkStatus = useCallback(async () => {
    try {
      const { supabase } = await import('../lib/supabase.js');
      if (!supabase) {
        setStatus('not-configured');
        return;
      }
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (!token) {
        setStatus('not-configured');
        return;
      }

      const res = await fetch('/api/kite', {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        setStatus('not-configured');
        return;
      }

      const body: KiteKeyStatus = await res.json();
      if (body.configured) {
        setStatus(body.working !== false ? 'configured' : 'error');
      } else {
        setStatus('not-configured');
      }
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 60_000);
    return () => clearInterval(interval);
  }, [checkStatus]);

  const dotColor =
    status === 'configured'
      ? 'bg-emerald-500'
      : status === 'error'
      ? 'bg-red-500'
      : 'bg-slate-300';

  const tooltip =
    status === 'configured'
      ? 'Kite API key configured'
      : status === 'error'
      ? 'Kite API key error — check profile settings'
      : 'Configure Kite API key';

  return (
    <button
      onClick={onNavigateToProfile}
      className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
      title={tooltip}
      aria-label={tooltip}
    >
      <motion.span
        animate={
          status === 'configured'
            ? { scale: [1, 1.2, 1] }
            : status === 'error'
            ? { scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }
            : { scale: [1, 1, 1] }
        }
        transition={{ duration: status === 'loading' ? 0 : 2, repeat: Infinity }}
        className={`w-2 h-2 rounded-full shrink-0 ${dotColor}`}
      />
      <span
        className="text-[11px] font-medium whitespace-nowrap"
        style={{ color: 'var(--text-secondary)' }}
      >
        Kite
      </span>
    </button>
  );
}
