/**
 * Zerodha Kite API Integration Service
 * Manages API credentials, OAuth login flow, access tokens, and historical data fetching.
 */

export interface KiteCredentials {
  apiKey: string;
  apiSecret: string;
  requestToken?: string;
  accessToken?: string;
  loginTime?: string;
  hasHistoricalAccess?: boolean;
}

const STORAGE_KEY = 'zerodha_kite_credentials';

export function getKiteCredentials(): KiteCredentials {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (data) {
      return JSON.parse(data);
    }
  } catch (e) {
    console.error('Failed to read Kite credentials', e);
  }
  return { apiKey: '', apiSecret: '' };
}

export function saveKiteCredentials(creds: Partial<KiteCredentials>): KiteCredentials {
  const current = getKiteCredentials();
  const updated: KiteCredentials = { ...current, ...creds };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch (e) {
    console.error('Failed to save Kite credentials', e);
  }
  return updated;
}

export function clearKiteCredentials() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Builds the official Zerodha Connect Login URL
 */
export function getKiteLoginUrl(apiKey: string): string {
  if (!apiKey) return '#';
  return `https://kite.zerodha.com/connect/login?v=3&api_key=${encodeURIComponent(apiKey)}`;
}

/**
 * Detects request_token in URL query parameters when redirected from Zerodha Login
 */
export function checkAndExtractRequestToken(): string | null {
  if (typeof window === 'undefined') return null;
  const urlParams = new URLSearchParams(window.location.search);
  const requestToken = urlParams.get('request_token');
  const status = urlParams.get('status');

  if (requestToken && status !== 'error') {
    // Save request token
    saveKiteCredentials({ requestToken, loginTime: new Date().toISOString() });
    
    // Clean up query params from address bar without reloading
    const cleanUrl = window.location.origin + window.location.pathname;
    window.history.replaceState({}, document.title, cleanUrl);
    return requestToken;
  }
  return null;
}

/**
 * Test Zerodha Kite API session & Historical Data availability
 */
export async function testKiteSession(creds: KiteCredentials): Promise<{
  connected: boolean;
  hasHistorical: boolean;
  message: string;
}> {
  if (!creds.apiKey) {
    return { connected: false, hasHistorical: false, message: 'No API Key configured' };
  }

  const token = creds.accessToken || creds.requestToken;
  if (!token) {
    return { connected: false, hasHistorical: false, message: 'No active session token. Click "Login to Zerodha" to authenticate.' };
  }

  try {
    // Attempt historical data fetch for test instrument (e.g. RELIANCE instrument token 180001 or similar)
    const testUrl = `https://api.kite.trade/instruments/historical/256265/day?from=${encodeURIComponent('2024-01-01')}&to=${encodeURIComponent('2024-02-01')}`;
    
    const res = await fetch(testUrl, {
      method: 'GET',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
      },
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'success') {
        saveKiteCredentials({ hasHistoricalAccess: true });
        return { connected: true, hasHistorical: true, message: 'Zerodha Kite API Active with Historical Access' };
      }
    }

    if (res.status === 403 || res.status === 401) {
      const errorData = await res.json().catch(() => ({}));
      const isHistoricalMissing = errorData.message?.toLowerCase().includes('historical') || errorData.error_type === 'PermissionException';
      
      saveKiteCredentials({ hasHistoricalAccess: false });

      if (isHistoricalMissing) {
        return {
          connected: true,
          hasHistorical: false,
          message: 'Zerodha session valid, but Historical Data API subscription is missing (requires paid add-on). Falling back to yfinance.',
        };
      }
      return {
        connected: false,
        hasHistorical: false,
        message: errorData.message || 'Zerodha session expired or invalid. Please re-login.',
      };
    }
  } catch (err) {
    console.warn('Zerodha Kite API test ping failed (CORS or Network):', err);
  }

  // If direct browser CORS blocks api.kite.trade without proxy, evaluate credentials
  if (creds.apiKey && (creds.requestToken || creds.accessToken)) {
    return {
      connected: true,
      hasHistorical: false,
      message: 'Kite API Session detected. (Note: Direct browser calls require CORS proxy or backend; falling back to yfinance for candles).',
    };
  }

  return { connected: false, hasHistorical: false, message: 'Could not verify Zerodha session.' };
}

/**
 * Fetch stock candle history from Zerodha Kite API
 */
export async function fetchKiteCandles(
  symbol: string,
  creds: KiteCredentials
): Promise<{ prices: number[]; volumeHistory: number[]; dataSource: string } | null> {
  const token = creds.accessToken || creds.requestToken;
  if (!creds.apiKey || !token || !creds.hasHistoricalAccess) {
    return null; // Signals engine to fallback to yfinance
  }

  try {
    // Standard Kite API call
    const today = new Date().toISOString().split('T')[0];
    const past = new Date(Date.now() - 250 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const response = await fetch(`https://api.kite.trade/instruments/historical/${symbol}/day?from=${past}&to=${today}`, {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Kite HTTP ${response.status}`);
    }

    const json = await response.json();
    if (json.status === 'success' && Array.isArray(json.data?.candles)) {
      const candles = json.data.candles;
      const prices = candles.map((c: any) => Number(c[4])); // Close price
      const volumeHistory = candles.map((c: any) => Number(c[5])); // Volume

      return {
        prices,
        volumeHistory,
        dataSource: 'Zerodha Kite API (Live)',
      };
    }
  } catch (err) {
    console.warn(`Kite fetch error for ${symbol}:`, err);
  }

  return null; // Fallback
}
