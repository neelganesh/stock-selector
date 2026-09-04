import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  getKiteCredentials,
  saveKiteCredentials,
  clearKiteCredentials,
  getKiteLoginUrl,
  testKiteSession,
  checkAndExtractRequestToken,
} from '../services/kiteService';
import { useAuth } from './AuthProvider';

interface ZerodhaLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCredentialsUpdated: () => void;
}

export function ZerodhaLoginModal({ isOpen, onClose, onCredentialsUpdated }: ZerodhaLoginModalProps) {
  const { user } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [requestToken, setRequestToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Check if URL contains request_token from redirect
      const extractedToken = checkAndExtractRequestToken();
      const creds = getKiteCredentials();
      setApiKey(creds.apiKey || '');
      setApiSecret(creds.apiSecret || '');
      setRequestToken(extractedToken || creds.requestToken || creds.accessToken || '');

      if (extractedToken) {
        // Exchange request_token for access_token via backend
        exchangeRequestToken(extractedToken);
      } else if (creds.requestToken || creds.apiKey) {
        verifySession(creds);
      }
    }
  }, [isOpen]);

  const exchangeRequestToken = async (token: string) => {
    if (!user) {
      setStatusType('error');
      setStatusMessage('Please sign in first to link Zerodha account.');
      return;
    }

    setStatusMessage('Exchanging request token for access token...');

    try {
      const response = await fetch('/api/kite/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await user.getIdToken())}`,
        },
        body: JSON.stringify({ requestToken: token }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to exchange token');
      }

      // Update local credentials with access token
      const updated = saveKiteCredentials({
        accessToken: data.access_token,
        requestToken: token,
        loginTime: new Date().toISOString(),
      });

      setStatusType('success');
      setStatusMessage('Zerodha Kite API connected successfully!');
      await verifySession(updated);
      onCredentialsUpdated();
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to exchange token. Please try again.');
    }
  };

  const verifySession = async (credsToTest = getKiteCredentials()) => {
    setIsTesting(true);
    setStatusMessage('Pinging Zerodha Kite API session...');
    const result = await testKiteSession(credsToTest);
    setIsTesting(false);

    if (result.connected && result.hasHistorical) {
      setStatusType('success');
      setStatusMessage('Zerodha Kite API Active (Live Historical Data Feed)');
    } else if (result.connected && !result.hasHistorical) {
      setStatusType('warning');
      setStatusMessage('Zerodha session active, but Historical Data API subscription is absent. Automatically falling back to yfinance.');
    } else {
      setStatusType('error');
      setStatusMessage(result.message);
    }
  };

  const handleSaveAndLogin = async () => {
    if (!user) {
      setStatusType('error');
      setStatusMessage('Please sign in first to save Zerodha credentials.');
      return;
    }
    if (!apiKey.trim() || !apiSecret.trim()) {
      setStatusType('error');
      setStatusMessage('Please enter both your Zerodha Kite API Key and API Secret.');
      return;
    }

    setStatusType('idle');
    setStatusMessage('Saving credentials…');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          zerodha_api_key: apiKey.trim(),
          zerodha_api_secret: apiSecret.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save credentials');
      }
      const loginUrl = getKiteLoginUrl(apiKey.trim());
      window.location.href = loginUrl;
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to save credentials');
    }
  };

  const handleManualSave = async () => {
    if (!user) return;
    setStatusType('idle');
    setStatusMessage('Saving credentials…');
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          zerodha_api_key: apiKey.trim(),
          zerodha_api_secret: apiSecret.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save credentials');
      }
      setStatusType('success');
      setStatusMessage('Credentials saved. You can now log in to Zerodha.');
    } catch (err: any) {
      setStatusType('error');
      setStatusMessage(err.message || 'Failed to save credentials');
    }
  };

  const handleDisconnect = () => {
    clearKiteCredentials();
    setApiKey('');
    setApiSecret('');
    setRequestToken('');
    setStatusType('idle');
    setStatusMessage('Zerodha credentials cleared. Active source: yfinance (Fallback)');
    onCredentialsUpdated();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop Blur overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 15 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 15 }}
            className="relative w-full max-w-lg bg-white/85 backdrop-blur-xl border border-white/80 rounded-3xl shadow-2xl overflow-hidden text-slate-800 p-6 sm:p-8 space-y-6"
            data-modal-panel
          >
            {/* Close Button */}
            <button
              onClick={onClose}
              className="absolute top-5 right-5 p-2 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            {/* Header */}
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-orange-600 text-white flex items-center justify-center font-bold text-xl shadow-lg shadow-orange-600/30">
                K
              </div>
              <div>
                <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
                  Zerodha Kite API Settings
                </h3>
                <p className="text-xs text-slate-500 font-medium">
                  Connect your Zerodha Connect API credentials or auto-login
                </p>
              </div>
            </div>

            {/* Status Alert Banner */}
            {statusMessage && (
              <div
                className={`p-3.5 rounded-2xl border text-xs font-medium leading-relaxed flex items-start gap-2.5 ${
                  statusType === 'success'
                    ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                    : statusType === 'warning'
                    ? 'bg-amber-50 text-amber-900 border-amber-200'
                    : statusType === 'error'
                    ? 'bg-rose-50 text-rose-900 border-rose-200'
                    : 'bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <div className="shrink-0 mt-0.5">
                  {isTesting ? (
                    <svg className="w-4 h-4 animate-spin text-slate-600" viewBox="0 0 24 24" fill="none">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                    </svg>
                  ) : (
                    <span>ℹ️</span>
                  )}
                </div>
                <span>{statusMessage}</span>
              </div>
            )}

            {/* Inputs */}
            <div className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kite API Key <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="e.g. 8x923jklm10429"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white/70 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Kite API Secret (Optional)
                </label>
                <input
                  type="password"
                  value={apiSecret}
                  onChange={(e) => setApiSecret(e.target.value)}
                  placeholder="••••••••••••••••"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white/70 focus:bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none transition-all font-mono text-xs"
                />
              </div>

              {requestToken && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Auto-Detected Request Token
                  </label>
                  <input
                    type="text"
                    readOnly
                    value={requestToken}
                    className="w-full px-3.5 py-2 py-2 rounded-xl border border-slate-200 bg-slate-100 font-mono text-xs text-slate-600"
                  />
                </div>
              )}
            </div>

            {/* Information Notice */}
            <div className="p-3.5 rounded-2xl bg-slate-100/80 border border-slate-200 text-[11px] text-slate-600 space-y-1">
              <p className="font-semibold text-slate-800 flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                <span>Automatic Fallback Protection:</span>
              </p>
              <p>
                Zerodha requires a separate paid subscription for Historical Data API access. If no key is set or if Historical Data fails, the application automatically uses <strong>yfinance</strong> as the fallback data source.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <button
                onClick={handleDisconnect}
                className="w-full sm:w-auto px-4 py-2.5 rounded-xl text-xs font-semibold text-rose-600 bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
              >
                Clear Credentials
              </button>

              <div className="flex items-center gap-2.5 w-full sm:w-auto">
                <button
                  onClick={handleManualSave}
                  className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-300 transition-colors"
                >
                  Test Connection
                </button>

                <button
                  onClick={handleSaveAndLogin}
                  className="w-full sm:w-auto flex-1 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-orange-600 hover:bg-orange-700 shadow-lg shadow-orange-600/25 transition-all flex items-center justify-center gap-2 active:scale-98"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                  <span>Login to Zerodha</span>
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
