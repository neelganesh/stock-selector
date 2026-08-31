import React, { useState, useEffect, useCallback } from 'react';
import { fetchGTTOrders, cancelGTTOrder, type GTTOrder } from '../services/gttService';
import { getKiteCredentials } from '../services/kiteService';

interface OrderBookProps {
  isOpen: boolean;
  onClose: () => void;
}

export const OrderBook: React.FC<OrderBookProps> = ({ isOpen, onClose }) => {
  const [gttOrders, setGttOrders] = useState<GTTOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [filterStatus, setFilterStatus] = useState<'all' | GTTOrder['status']>('all');

  const fetchOrders = useCallback(async () => {
    const creds = getKiteCredentials();
    if (!creds.apiKey || !(creds.accessToken || creds.requestToken)) {
      setError('Zerodha not connected. Please login first.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const orders = await fetchGTTOrders();
      setGttOrders(orders);
    } catch (err) {
      setError('Failed to fetch GTT orders');
      console.error('Error fetching GTT orders:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      fetchOrders();
      if (autoRefresh) {
        const interval = setInterval(fetchOrders, 30000);
        return () => clearInterval(interval);
      }
    }
  }, [isOpen, fetchOrders, autoRefresh]);

  const filteredOrders = gttOrders.filter(o => {
    if (filterStatus === 'all') return true;
    return o.status === filterStatus;
  });

  const handleCancel = async (triggerId: string) => {
    if (!confirm('Cancel this GTT order?')) return;
    
    const result = await cancelGTTOrder(triggerId);
    if (result.success) {
      fetchOrders();
    } else {
      alert(`Failed to cancel: ${result.error}`);
    }
  };

  const formatCurrency = (value: number): string => {
    if (value >= 1e7) return `₹${(value / 1e7).toFixed(2)} Cr`;
    if (value >= 1e5) return `₹${(value / 1e5).toFixed(2)} L`;
    return `₹${value.toLocaleString('en-IN')}`;
  };

  const getStatusColor = (status: GTTOrder['status']): string => {
    switch (status) {
      case 'ACTIVE': return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
      case 'TRIGGERED': return 'text-blue-400 bg-blue-500/10 border-blue-500/30';
      case 'CANCELLED': return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
      case 'EXPIRED': return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
      case 'REJECTED': return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
      default: return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md">
      <div className="w-full max-w-5xl max-h-[90vh] bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-800 bg-slate-900/50">
          <div>
            <h2 className="text-xl font-bold text-white">Order Book & GTT Monitor</h2>
            <p className="text-xs text-slate-400 mt-0.5">Track all GTT (Good Till Triggered) orders on Zerodha</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-300 cursor-pointer">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4 accent-emerald-500 rounded border-slate-700"
              />
              Auto-refresh (30s)
            </label>
            <button
              onClick={fetchOrders}
              disabled={loading}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium transition-colors disabled:opacity-50"
            >
              Refresh
            </button>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="px-4 py-3 border-b border-slate-800 flex flex-wrap items-center gap-3">
          <span className="text-slate-400 text-xs font-medium">Filter:</span>
          <div className="flex gap-1">
            {(['all', 'ACTIVE', 'TRIGGERED', 'CANCELLED', 'EXPIRED', 'REJECTED'] as const).map((status) => (
              <button
                key={status}
                onClick={() => setFilterStatus(status)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  filterStatus === status
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-300'
                }`}
              >
                {status}
              </button>
            ))}
          </div>
          {error && (
            <span className="ml-auto text-rose-400 text-xs flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              {error}
            </span>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          {loading && gttOrders.length === 0 ? (
            <div className="flex items-center justify-center h-64">
              <div className="flex flex-col items-center gap-4 text-slate-400">
                <svg className="animate-spin w-8 h-8" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Loading GTT orders...
              </div>
            </div>
          ) : filteredOrders.length === 0 ? (
            <div className="flex items-center justify-center h-64 text-slate-500">
              <div className="text-center">
                <svg className="w-16 h-16 mx-auto mb-4 opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
                </svg>
                <p className="text-lg font-medium">No GTT orders found</p>
                <p className="text-sm mt-1">Place GTT orders from the Position Sizing Calculator to see them here</p>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredOrders.map((order) => (
                <GTTOrderCard
                  key={order.id}
                  order={order}
                  onCancel={handleCancel}
                  formatCurrency={formatCurrency}
                  getStatusColor={getStatusColor}
                />
              ))}
            </div>
          )}
        </div>

        {/* Summary Footer */}
        <div className="px-4 py-3 border-t border-slate-800 bg-slate-950/50 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-4">
            <span className="text-slate-400">Total: <span className="text-white font-mono">{gttOrders.length}</span></span>
            <span className="text-emerald-400">Active: <span className="font-mono">{gttOrders.filter(o => o.status === 'ACTIVE').length}</span></span>
            <span className="text-blue-400">Triggered: <span className="font-mono">{gttOrders.filter(o => o.status === 'TRIGGERED').length}</span></span>
            <span className="text-rose-400">Rejected: <span className="font-mono">{gttOrders.filter(o => o.status === 'REJECTED').length}</span></span>
          </div>
          <span className="text-slate-500">
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        </div>
      </div>
    </div>
  );
};

interface GTTOrderCardProps {
  order: GTTOrder;
  onCancel: (triggerId: string) => void;
  formatCurrency: (value: number) => string;
  getStatusColor: (status: GTTOrder['status']) => string;
}

const GTTOrderCard: React.FC<GTTOrderCardProps> = ({ order, onCancel, formatCurrency, getStatusColor }) => {
  const isActive = order.status === 'ACTIVE';
  const isTwoLeg = order.trigger_type === 'two-leg';
  const orderValue = order.quantity * order.limit_price;

  return (
    <div className="bg-slate-950/60 rounded-xl border border-slate-800 overflow-hidden">
      {/* Header Row */}
      <div className="p-4 grid grid-cols-12 gap-4 items-center border-b border-slate-800/50">
        <div className="col-span-12 md:col-span-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center">
              <span className="font-bold text-white text-sm">{order.tradingsymbol.slice(0, 2)}</span>
            </div>
            <div>
              <div className="font-bold text-white text-sm">{order.tradingsymbol}</div>
              <div className="text-[11px] text-slate-400">{order.exchange} • {order.product}</div>
            </div>
          </div>
        </div>

        <div className="col-span-6 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">Type</div>
          <div className="font-mono text-blue-400 text-sm capitalize">{order.transaction_type.toLowerCase()}</div>
        </div>

        <div className="col-span-6 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">Qty / Value</div>
          <div className="font-mono text-white text-sm">{order.quantity.toLocaleString('en-IN')}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">{formatCurrency(orderValue)}</div>
        </div>

        <div className="col-span-12 md:col-span-2 text-center md:text-left">
          <div className="text-[10px] text-slate-500 uppercase font-medium">Trigger / Limit</div>
          <div className="font-mono text-amber-400 text-sm">₹{order.trigger_price.toFixed(2)}</div>
          <div className="text-[10px] text-slate-400 font-mono mt-0.5">Limit: ₹{order.limit_price.toFixed(2)}</div>
        </div>

        <div className="col-span-12 md:col-span-2 text-right md:text-left">
          <span className={`px-2 py-1 rounded-full text-[10px] font-bold border ${getStatusColor(order.status)}`}>
            {order.status}
          </span>
          {isTwoLeg && (
            <span className="ml-2 px-2 py-1 rounded-full text-[10px] font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400">
              OCO
            </span>
          )}
        </div>
      </div>

      {/* Details Row */}
      <div className="px-4 py-3 grid grid-cols-12 gap-4 text-[11px]">
        <div className="col-span-6 md:col-span-3">
          <span className="text-slate-500">Created:</span>
          <span className="text-slate-300 ml-2 font-mono">{new Date(order.created_at).toLocaleString()}</span>
        </div>
        {order.triggered_at && (
          <div className="col-span-6 md:col-span-3">
            <span className="text-slate-500">Triggered:</span>
            <span className="text-blue-300 ml-2 font-mono">{new Date(order.triggered_at).toLocaleString()}</span>
          </div>
        )}
        {order.expires_at && (
          <div className="col-span-6 md:col-span-3">
            <span className="text-slate-500">Expires:</span>
            <span className="text-slate-300 ml-2 font-mono">{new Date(order.expires_at).toLocaleString()}</span>
          </div>
        )}
        <div className="col-span-6 md:col-span-3 text-right md:text-left">
          {isActive && (
            <button
              onClick={() => onCancel(order.id)}
              className="px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-medium transition-colors"
            >
              Cancel Order
            </button>
          )}
        </div>
      </div>

      {/* Two-leg details */}
      {isTwoLeg && (
        <div className="px-4 pb-4 border-t border-slate-800/50 bg-slate-900/30 grid grid-cols-12 gap-4 text-[11px]">
          <div className="col-span-6 md:col-span-4">
            <span className="text-slate-500">Upper Trigger:</span>
            <span className="text-emerald-300 ml-2 font-mono">₹{order.upper_trigger_price?.toFixed(2) || 'N/A'}</span>
            <span className="text-slate-500 ml-4">Limit:</span>
            <span className="text-emerald-300 ml-2 font-mono">₹{order.upper_limit_price?.toFixed(2) || 'N/A'}</span>
            <span className="text-slate-500 ml-4">Qty:</span>
            <span className="text-emerald-300 ml-2 font-mono">{order.upper_quantity?.toLocaleString('en-IN') || 'N/A'}</span>
          </div>
          <div className="col-span-6 md:col-span-4">
            <span className="text-slate-500">Lower Trigger:</span>
            <span className="text-rose-300 ml-2 font-mono">₹{order.lower_trigger_price?.toFixed(2) || 'N/A'}</span>
            <span className="text-slate-500 ml-4">Limit:</span>
            <span className="text-rose-300 ml-2 font-mono">₹{order.lower_limit_price?.toFixed(2) || 'N/A'}</span>
            <span className="text-slate-500 ml-4">Qty:</span>
            <span className="text-rose-300 ml-2 font-mono">{order.lower_quantity?.toLocaleString('en-IN') || 'N/A'}</span>
          </div>
        </div>
      )}
    </div>
  );
};