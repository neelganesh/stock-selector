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
  const { user, getAccessToken } = useAuth();
  const [apiKey, setApiKey] = useState('');
  const [apiSecret, setApiSecret] = useState('');
  const [requestToken, setRequestToken] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'warning' | 'error'>('idle');
  const [isTesting, setIsTesting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // Always pre-fill the inputs from the DB (or localStorage cache)
      // so the user never has to re-enter credentials.
      const creds = getKiteCredentials();
      if (creds.apiKey || creds.apiSecret) {
        setApiKey(creds.apiKey || '');
        setApiSecret(creds.apiSecret || '');
      } else {
        // No local cache — fetch from the backend
        fetchCredentialsFromBackend();
      }

      // Pick up a fresh request_token from the URL (Zerodha redirect)
      // OR from localStorage (in case the top-level auto-exchange hasn't
      // run yet, e.g. the modal was opened manually right after redirect).
      const extractedToken = checkAndExtractRequestToken();
      const refreshed = getKiteCredentials();
      const tokenToExchange = extractedToken
        || (refreshed.requestToken && !refreshed.accessToken
            ? refreshed.requestToken
            : null);

      setRequestToken(extractedToken || refreshed.requestToken || refreshed.accessToken || '');

      if (tokenToExchange) {
        exchangeRequestToken(tokenToExchange);
      } else if (refreshed.requestToken || refreshed.accessToken) {
        verifySession(refreshed);
      } else if (creds.apiKey) {
        verifySession(creds);
      }
    }
  }, [isOpen]);

  const fetchCredentialsFromBackend = async () => {
    if (!user) return;
    try {
      const token = await getAccessToken();
      if (!token) return;
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.zerodha_api_key || data.zerodha_api_secret) {
        setApiKey(data.zerodha_api_key || '');
        setApiSecret(data.zerodha_api_secret || '');
        // Cache to localStorage so subsequent opens don't need a fetch
        saveKiteCredentials({
          apiKey: data.zerodha_api_key || '',
          apiSecret: data.zerodha_api_secret || '',
        });
      }
    } catch {
      // Silent — modal just shows empty inputs
    }
  };

  const exchangeRequestToken = async (token: string) => {
    if (!user) {
      setStatusType('error');
      setStatusMessage('Please sign in first to link Zerodha account.');
      return;
    }

    setStatusMessage('Exchanging request token for access token...');

    try {
      const token2 = await getAccessToken();
      if (!token2) throw new Error('Not signed in');
      const response = await fetch('/api/kite/token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token2}`,
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
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
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

  const handleSaveCredentials = async () => {
    if (!user) return;
    setStatusType('idle');
    setStatusMessage('Saving credentials…');
    try {
      const token = await getAccessToken();
      if (!token) throw new Error('Not signed in');
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

  const handleTestConnection = async () => {
    setStatusType('idle');
    setStatusMessage('Testing connection…');
    const result = await testKiteSession({
      apiKey: apiKey.trim(),
      apiSecret: apiSecret.trim(),
      accessToken: getKiteCredentials().accessToken,
    });
    if (result.connected && result.hasHistorical) {
      setStatusType('success');
      setStatusMessage('Zerodha Kite API Active (Live Historical Data Feed)');
    } else if (result.connected && !result.hasHistorical) {
      setStatusType('warning');
      setStatusMessage('Zerodha session active, but Historical Data API subscription is absent. Falling back to yfinance.');
    } else {
      setStatusType('error');
      setStatusMessage(result.message);
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

          {/* Modal Container — Apple system sheet */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 4 }}
            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            className="relative w-full max-w-[440px] bg-white/90 backdrop-blur-2xl border border-white/80 rounded-[20px] shadow-[0_24px_60px_-12px_rgba(0,0,0,0.18)] overflow-hidden text-slate-900 font-sans"
            data-modal-panel
          >
            {/* Drag handle for sheet affordance */}
            <div className="pt-2.5 flex justify-center sm:hidden">
              <div className="w-9 h-[5px] rounded-full bg-slate-300/80" />
            </div>

            {/* Header — centered, Apple style */}
            <div className="px-7 pt-7 pb-5 text-center relative">
              <button
                onClick={onClose}
                aria-label="Close"
                className="absolute top-4 right-4 w-8 h-8 rounded-full text-slate-400 hover:text-slate-700 hover:bg-slate-100/80 transition-colors flex items-center justify-center"
              >
                <svg className="w-[18px] h-[18px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.25}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>

              {/* Zerodha Kite mark — gradient tile */}
              <div className="mx-auto w-[52px] h-[52px] rounded-[14px] bg-gradient-to-br from-[#FF7A1A] to-[#E84A00] text-white flex items-center justify-center font-semibold text-[22px] tracking-tight shadow-[0_8px_18px_-4px_rgba(232,74,0,0.45)] mb-4">
                K
              </div>

              <h3 className="text-[20px] font-semibold tracking-[-0.01em] text-slate-900 leading-tight">
                Connect Zerodha Kite
              </h3>
              <p className="mt-1.5 text-[13px] text-slate-500 leading-snug max-w-[320px] mx-auto">
                Link your Kite Connect API for live historical data. Falls back to yfinance automatically.
              </p>
            </div>

            {/* Status Alert — iOS-style inline banner */}
            {statusMessage && (
              <div className="mx-6 mb-2">
                <div
                  className={`px-3.5 py-2.5 rounded-[12px] text-[12.5px] leading-snug flex items-start gap-2.5 ${
                    statusType === 'success'
                      ? 'bg-[#28CD41]/10 text-emerald-900'
                      : statusType === 'warning'
                      ? 'bg-[#FF9500]/12 text-amber-900'
                      : statusType === 'error'
                      ? 'bg-[#FF3B30]/10 text-rose-900'
                      : 'bg-slate-100/80 text-slate-700'
                  }`}
                >
                  <div className="shrink-0 mt-[1px]">
                    {isTesting ? (
                      <svg className="w-[14px] h-[14px] animate-spin text-slate-500" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                      </svg>
                    ) : statusType === 'success' ? (
                      <svg className="w-[14px] h-[14px] text-emerald-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.7-9.3a1 1 0 00-1.4-1.4L9 10.59 7.7 9.3a1 1 0 00-1.4 1.4l2 2a1 1 0 001.4 0l4-4z" clipRule="evenodd" /></svg>
                    ) : statusType === 'warning' ? (
                      <svg className="w-[14px] h-[14px] text-amber-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 6a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 6zm0 9a1 1 0 100-2 1 1 0 000 2z" clipRule="evenodd" /></svg>
                    ) : statusType === 'error' ? (
                      <svg className="w-[14px] h-[14px] text-rose-600" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                    ) : (
                      <svg className="w-[14px] h-[14px] text-slate-500" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10A8 8 0 11 2 10a8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>
                    )}
                  </div>
                  <span className="flex-1">{statusMessage}</span>
                </div>
              </div>
            )}

            {/* Input group — iOS grouped list style */}
            <div className="px-6 pt-4 pb-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="kite-api-key" className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.04em]">
                    API Key
                  </label>
                  <span className="text-[10px] text-rose-500 font-medium">Required</span>
                </div>
                <div className="rounded-[12px] border border-slate-200/80 bg-white/70 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
                  <input
                    id="kite-api-key"
                    type="text"
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder="8x923jklm10429"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 bg-transparent text-[13.5px] font-mono tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label htmlFor="kite-api-secret" className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.04em]">
                    API Secret
                  </label>
                  <span className="text-[10px] text-rose-500 font-medium">Required</span>
                </div>
                <div className="rounded-[12px] border border-slate-200/80 bg-white/70 focus-within:border-[#007AFF] focus-within:ring-2 focus-within:ring-[#007AFF]/20 transition-all">
                  <input
                    id="kite-api-secret"
                    type="password"
                    value={apiSecret}
                    onChange={(e) => setApiSecret(e.target.value)}
                    placeholder="••••••••••••••••"
                    spellCheck={false}
                    autoComplete="off"
                    className="w-full px-3.5 py-2.5 bg-transparent text-[13.5px] font-mono tracking-tight text-slate-900 placeholder:text-slate-300 focus:outline-none"
                  />
                </div>
              </div>

              {requestToken && (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between px-1">
                    <label className="text-[11px] font-medium text-slate-500 uppercase tracking-[0.04em]">
                      Request Token
                    </label>
                    <span className="text-[10px] text-emerald-600 font-medium">Auto-detected</span>
                  </div>
                  <div className="rounded-[12px] border border-slate-200/80 bg-slate-50/80">
                    <input
                      type="text"
                      readOnly
                      value={requestToken}
                      className="w-full px-3.5 py-2.5 bg-transparent text-[12px] font-mono tracking-tight text-slate-500 focus:outline-none"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Footer — single primary CTA, secondary row above */}
            <div className="px-6 pb-6 pt-1 space-y-3">
              <button
                onClick={handleSaveAndLogin}
                className="w-full h-11 rounded-[12px] text-[14px] font-semibold text-white bg-[#007AFF] hover:bg-[#0A6FE0] active:bg-[#0058B0] transition-colors flex items-center justify-center gap-1.5 shadow-[0_2px_6px_rgba(0,122,255,0.25)]"
              >
                <span>Log in with Zerodha</span>
                <svg className="w-[14px] h-[14px]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
              </button>

              <div className="flex items-center justify-center gap-4 text-[12.5px]">
                <button
                  onClick={handleTestConnection}
                  className="text-[#007AFF] hover:text-[#0A6FE0] font-medium transition-colors"
                >
                  Test
                </button>
                <span className="w-px h-3 bg-slate-300" />
                <button
                  onClick={handleSaveCredentials}
                  className="text-[#007AFF] hover:text-[#0A6FE0] font-medium transition-colors"
                >
                  Save
                </button>
                <span className="w-px h-3 bg-slate-300" />
                <button
                  onClick={handleDisconnect}
                  className="text-[#FF3B30] hover:text-[#E52E24] font-medium transition-colors"
                >
                  Disconnect
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
