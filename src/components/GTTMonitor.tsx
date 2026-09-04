import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { GlassCard } from './GlassCard';

// ---------- Types ----------
export interface GTTOrder {
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  product: string;
  order_type: 'LIMIT' | 'MARKET' | 'SL' | 'SL-M';
  price?: number;
  trigger_price?: number;
}

export interface GTT {
  id: number;
  user_id?: string;
  tradingsymbol: string;
  exchange: string;
  trigger_values: number[];
  last_price: number;
  status: 'active' | 'triggered' | 'expired' | 'cancelled' | 'disabled' | string;
  expires_at: string;
  created_at: string;
  updated_at: string;
  orders: GTTOrder[];
}

interface GTTMonitorProps {
  /** ms between polls. 0 = disabled. Default 30000. */
  pollIntervalMs?: number;
  /** default filter on mount */
  defaultFilter?: 'active' | 'all';
}

const STATUS_STYLES: Record<string, { label: string; className: string; ring: string }> = {
  active: { label: 'Active', className: 'bg-emerald-100 text-emerald-700', ring: 'ring-emerald-400/40' },
  triggered: { label: 'Triggered', className: 'bg-indigo-100 text-indigo-700', ring: 'ring-indigo-400/40' },
  expired: { label: 'Expired', className: 'bg-slate-200 text-slate-600', ring: 'ring-slate-400/30' },
  cancelled: { label: 'Cancelled', className: 'bg-rose-100 text-rose-700', ring: 'ring-rose-400/30' },
  disabled: { label: 'Disabled', className: 'bg-slate-100 text-slate-500', ring: 'ring-slate-400/30' },
};

const formatDate = (iso: string) => {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch {
    return iso;
  }
};

const formatPrice = (n: number) =>
  n.toLocaleString('en-IN', { maximumFractionDigits: 2 });

const formatRelativeExpiry = (iso: string) => {
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const days = Math.floor(ms / (1000 * 60 * 60 * 24));
  if (days >= 1) return `${days}d left`;
  const hours = Math.floor(ms / (1000 * 60 * 60));
  return `${hours}h left`;
};

export function GTTMonitor({ pollIntervalMs = 30000, defaultFilter = 'active' }: GTTMonitorProps) {
  const [gtts, setGtts] = useState<GTT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsLogin, setNeedsLogin] = useState(false);
  const [filter, setFilter] = useState<'active' | 'all'>(defaultFilter);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchGtts = useCallback(async () => {
    try {
      const res = await fetch('/api/kite/gtt', { method: 'GET' });
      if (res.status === 401) {
        setNeedsLogin(true);
        setError(null);
        setLoading(false);
        return;
      }
      if (!res.ok) {
        throw new Error(`Request failed with status ${res.status}`);
      }
      const data = (await res.json()) as GTT[];
      setGtts(Array.isArray(data) ? data : []);
      setError(null);
      setNeedsLogin(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load GTTs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGtts();
  }, [fetchGtts]);

  useEffect(() => {
    if (!pollIntervalMs) return;
    intervalRef.current = setInterval(() => {
      fetchGtts();
    }, pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollIntervalMs, fetchGtts]);

  const handleCancel = async (id: number) => {
    if (!window.confirm(`Cancel GTT #${id}? This cannot be undone.`)) return;
    setBusyId(id);
    try {
      const res = await fetch(`/api/kite/gtt?id=${id}`, { method: 'DELETE' });
      if (res.ok) {
        setGtts((prev) => prev.filter((g) => g.id !== id));
      } else {
        setError(`Failed to cancel GTT #${id}`);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Cancel failed');
    } finally {
      setBusyId(null);
    }
  };

  const handleSaveModify = async (id: number, trigger: number) => {
    setBusyId(id);
    try {
      const res = await fetch('/api/kite/gtt', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, trigger_values: [trigger] }),
      });
      if (res.ok) {
        const updated = (await res.json()) as Partial<GTT>;
        setGtts((prev) => prev.map((g) => (g.id === id ? { ...g, ...updated } : g)));
        setEditingId(null);
      } else {
        setError(`Failed to modify GTT #${id}`);
      }
    } catch (err: any) {
      setError(err?.message ?? 'Modify failed');
    } finally {
      setBusyId(null);
    }
  };

  const visible = filter === 'active' ? gtts.filter((g) => g.status === 'active' || g.status === 'triggered') : gtts;

  return (
    <GlassCard variant="elevated" padding="md" className="space-y-4">
      <header className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-slate-800">GTT Monitor</h2>
          <p className="text-xs text-slate-500">
            {gtts.length} total {gtts.length === 1 ? 'GTT' : 'GTTs'} · {visible.length} shown
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setFilter('active')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                filter === 'active' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Active
            </button>
            <button
              type="button"
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md font-medium transition ${
                filter === 'all' ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All
            </button>
          </div>
          <button
            type="button"
            onClick={() => fetchGtts()}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition"
            aria-label="Refresh"
          >
            ↻ Refresh
          </button>
        </div>
      </header>

      {loading && (
        <div className="py-8 text-center text-sm text-slate-500" role="status">
          Loading GTTs…
        </div>
      )}

      {!loading && needsLogin && (
        <div className="py-6 px-4 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-sm text-center">
          Please log in to your Zerodha account to view GTTs.
        </div>
      )}

      {!loading && !needsLogin && error && (
        <div role="alert" className="py-6 px-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm text-center">
          {error}
        </div>
      )}

      {!loading && !needsLogin && !error && visible.length === 0 && (
        <div className="py-10 text-center text-sm text-slate-400">
          <div className="text-3xl mb-2">🎯</div>
          No GTTs to show. Active triggers will appear here.
        </div>
      )}

      {!loading && !needsLogin && !error && visible.length > 0 && (
        <ul className="space-y-2.5">
          <AnimatePresence initial={false}>
            {visible.map((gtt) => {
              const status = STATUS_STYLES[gtt.status] ?? STATUS_STYLES.disabled;
              const isEditing = editingId === gtt.id;
              const isBusy = busyId === gtt.id;
              return (
                <motion.li
                  key={gtt.id}
                  layout
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  data-gtt-row
                  className={`flex items-center justify-between gap-4 p-3.5 rounded-xl bg-white/60 backdrop-blur ring-1 ring-slate-200/70 hover:ring-2 ${status.ring} transition`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-slate-800 truncate">{gtt.tradingsymbol}</span>
                      <span className="text-xs text-slate-500">{gtt.exchange}</span>
                      <span className={`text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full ${status.className}`}>
                        {status.label}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-4 text-xs text-slate-600 flex-wrap">
                      <span>
                        Triggers:{' '}
                        <span className="font-medium text-slate-800">
                          {gtt.trigger_values.map(formatPrice).join(' / ')}
                        </span>
                      </span>
                      <span>
                        LTP: <span className="font-medium text-slate-800">₹{formatPrice(gtt.last_price)}</span>
                      </span>
                      <span>
                        Qty: <span className="font-medium text-slate-800">{gtt.orders[0]?.quantity ?? 0}</span>
                      </span>
                      <span>
                        Expires:{' '}
                        <span className="font-medium text-slate-800">{formatDate(gtt.expires_at)}</span>{' '}
                        <span className="text-slate-400">({formatRelativeExpiry(gtt.expires_at)})</span>
                      </span>
                    </div>
                    {isEditing && (
                      <div className="mt-2 flex items-center gap-2">
                        <label htmlFor={`trigger-${gtt.id}`} className="text-xs text-slate-500">
                          New trigger
                        </label>
                        <input
                          id={`trigger-${gtt.id}`}
                          type="number"
                          aria-label="trigger"
                          defaultValue={gtt.trigger_values[0]}
                          className="px-2 py-1 text-sm rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-400 w-28"
                        />
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {isEditing ? (
                      <>
                        <button
                          type="button"
                          disabled={isBusy}
                          onClick={() => {
                            const input = document.getElementById(`trigger-${gtt.id}`) as HTMLInputElement | null;
                            const value = input ? Number(input.value) : NaN;
                            if (!Number.isFinite(value) || value <= 0) {
                              setError('Trigger must be a positive number');
                              return;
                            }
                            handleSaveModify(gtt.id, value);
                          }}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                        >
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 transition"
                        >
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          type="button"
                          disabled={isBusy || gtt.status !== 'active'}
                          onClick={() => setEditingId(gtt.id)}
                          className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-40 transition"
                        >
                          Modify
                        </button>
                        <button
                          type="button"
                          disabled={isBusy || gtt.status === 'cancelled' || gtt.status === 'expired'}
                          onClick={() => handleCancel(gtt.id)}
                          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 transition"
                        >
                          Cancel
                        </button>
                      </>
                    )}
                  </div>
                </motion.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
    </GlassCard>
  );
}

export default GTTMonitor;
