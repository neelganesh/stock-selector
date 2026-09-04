import { useState, useEffect, useCallback, useRef } from 'react';

export interface UseOrderSyncOptions {
  isLoggedIn: boolean;
  paperTradingEnabled: boolean;
  pollIntervalMs?: number;
}

export interface ExecutionLike {
  id: string | number;
  symbol?: string;
  status?: string;
  [key: string]: unknown;
}

export interface OrderLike {
  order_id?: string;
  status?: string;
  [key: string]: unknown;
}

export interface GTTLike {
  id?: number | string;
  tradingsymbol?: string;
  [key: string]: unknown;
}

export interface OrderSyncState {
  executions: ExecutionLike[];
  orders: OrderLike[];
  gtts: GTTLike[];
  isPolling: boolean;
  lastSyncedAt: Date | null;
  error: Error | null;
  refresh: () => Promise<void>;
}

const DEFAULT_POLL_MS = 30_000;

async function fetchJson<T>(url: string): Promise<{ ok: boolean; status: number; data: T | null }> {
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, status: res.status, data: null };
    }
    const data = (await res.json()) as T;
    return { ok: true, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: null };
  }
}

export function useOrderSync(options: UseOrderSyncOptions): OrderSyncState {
  const { isLoggedIn, paperTradingEnabled, pollIntervalMs = DEFAULT_POLL_MS } = options;
  const enabled = isLoggedIn || paperTradingEnabled;

  const [executions, setExecutions] = useState<ExecutionLike[]>([]);
  const [orders, setOrders] = useState<OrderLike[]>([]);
  const [gtts, setGtts] = useState<GTTLike[]>([]);
  const [isPolling, setIsPolling] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<Date | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const authLostRef = useRef(false);

  const sync = useCallback(async () => {
    if (!enabled || authLostRef.current) return;

    setIsPolling(true);
    try {
      // Always fetch executions + paper positions
      const execPromises: Promise<ExecutionLike[]>[] = [
        fetchJson<ExecutionLike[]>('/api/executions').then((r) => (r.ok && r.data) || []),
      ];
      if (paperTradingEnabled) {
        execPromises.push(
          fetchJson<ExecutionLike[]>('/api/paper-positions').then((r) => (r.ok && r.data) || [])
        );
      }
      const execResults = await Promise.all(execPromises);
      const allExecs = execResults.flat();
      setExecutions(allExecs);

      // Kite-only endpoints
      if (isLoggedIn) {
        const ordersRes = await fetchJson<OrderLike[]>('/api/kite/orders');
        if (ordersRes.status === 401) {
          authLostRef.current = true;
          setIsPolling(false);
          return;
        }
        if (ordersRes.ok) {
          setOrders(ordersRes.data || []);
        } else if (ordersRes.status === 429) {
          // Rate limited — keep current data, record error
          setError(new Error('Rate limited (429)'));
        }

        const gttsRes = await fetchJson<GTTLike[]>('/api/kite/gtt');
        if (gttsRes.status === 401) {
          authLostRef.current = true;
          setIsPolling(false);
          return;
        }
        if (gttsRes.ok) {
          setGtts(gttsRes.data || []);
        }
      }

      setLastSyncedAt(new Date());
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      setIsPolling(false);
    }
  }, [enabled, isLoggedIn, paperTradingEnabled]);

  // Initial fetch + interval setup
  useEffect(() => {
    if (!enabled) {
      setExecutions([]);
      setOrders([]);
      setGtts([]);
      setLastSyncedAt(null);
      authLostRef.current = false;
      return;
    }

    authLostRef.current = false;
    // Fire immediately
    sync();

    intervalRef.current = setInterval(sync, pollIntervalMs);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [enabled, pollIntervalMs, sync]);

  return {
    executions,
    orders,
    gtts,
    isPolling,
    lastSyncedAt,
    error,
    refresh: sync,
  };
}