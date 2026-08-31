import { getKiteCredentials } from './kiteService';

export interface GTTOrderParams {
  tradingsymbol: string;
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO' | 'MCX';
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  product: 'CNC' | 'NRML' | 'MIS' | 'MTF';
  trigger_type: 'single' | 'two-leg';
  trigger_price: number;
  limit_price: number;
  // For two-leg (OCO)
  upper_trigger_price?: number;
  upper_limit_price?: number;
  upper_quantity?: number;
  lower_trigger_price?: number;
  lower_limit_price?: number;
  lower_quantity?: number;
}

export interface GTTOrderResponse {
  success: boolean;
  order_id?: string;
  message?: string;
  error?: string;
}

export interface GTTOrder {
  id: string;
  user_id: string;
  tradingsymbol: string;
  exchange: string;
  transaction_type: 'BUY' | 'SELL';
  quantity: number;
  product: string;
  trigger_type: 'single' | 'two-leg';
  trigger_price: number;
  limit_price: number;
  upper_trigger_price?: number;
  upper_limit_price?: number;
  upper_quantity?: number;
  lower_trigger_price?: number;
  lower_limit_price?: number;
  lower_quantity?: number;
  status: 'ACTIVE' | 'TRIGGERED' | 'CANCELLED' | 'EXPIRED' | 'REJECTED';
  created_at: string;
  updated_at: string;
  triggered_at?: string;
  expires_at?: string;
}

export interface OCOOrderSet {
  entry: GTTOrderParams;
  stop_loss: GTTOrderParams;
  target1: GTTOrderParams;
  target2?: GTTOrderParams;
}

/**
 * Place a GTT (Good Till Triggered) order via Zerodha Kite API
 */
export async function placeGTTOrder(params: GTTOrderParams): Promise<GTTOrderResponse> {
  const creds = getKiteCredentials();
  const token = creds.accessToken || creds.requestToken;
  
  if (!creds.apiKey || !token) {
    return { success: false, error: 'Zerodha credentials not configured. Please login first.' };
  }

  // Build the GTT order payload
  const payload: Record<string, any> = {
    type: params.trigger_type === 'single' ? 'single' : 'two-leg',
    tradingsymbol: params.tradingsymbol,
    exchange: params.exchange,
    transaction_type: params.transaction_type,
    quantity: params.quantity,
    product: params.product,
    trigger_price: params.trigger_price,
    limit_price: params.limit_price,
  };

  if (params.trigger_type === 'two-leg') {
    if (params.upper_trigger_price && params.upper_limit_price && params.upper_quantity) {
      payload.upper_trigger_price = params.upper_trigger_price;
      payload.upper_limit_price = params.upper_limit_price;
      payload.upper_quantity = params.upper_quantity;
    }
    if (params.lower_trigger_price && params.lower_limit_price && params.lower_quantity) {
      payload.lower_trigger_price = params.lower_trigger_price;
      payload.lower_limit_price = params.lower_limit_price;
      payload.lower_quantity = params.lower_quantity;
    }
  }

  try {
    // Try direct API call
    const response = await fetch('https://api.kite.trade/gtt/triggers', {
      method: 'POST',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, order_id: data.data?.trigger_id, message: 'GTT order placed successfully' };
      }
      return { success: false, error: data.message || 'Failed to place GTT order' };
    }

    // Handle specific error codes
    const errorData = await response.json().catch(() => ({}));
    
    if (response.status === 403 || response.status === 401) {
      return { success: false, error: 'Zerodha session expired. Please re-login.' };
    }
    
    return { success: false, error: errorData.message || `HTTP ${response.status}: Failed to place GTT order` };
  } catch (err) {
    console.warn('Direct GTT API call failed (CORS):', err);
    
    // Try via Vercel proxy
    try {
      const proxyResponse = await fetch('/api/kite/gtt/triggers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });

      if (proxyResponse.ok) {
        const data = await proxyResponse.json();
        if (data.status === 'success') {
          return { success: true, order_id: data.data?.trigger_id, message: 'GTT order placed via proxy' };
        }
        return { success: false, error: data.message || 'Failed to place GTT order via proxy' };
      }
    } catch (proxyErr) {
      console.warn('Proxy GTT API call failed:', proxyErr);
    }

    return { success: false, error: 'Network error: Could not reach Zerodha API. Check CORS proxy configuration.' };
  }
}

/**
 * Place a complete OCO (One-Cancels-Other) order set for a trade
 * This creates: Entry GTT + Stop Loss GTT + Target1 GTT + Target2 GTT (optional)
 */
export async function placeOCOOrderSet(ocoSet: OCOOrderSet): Promise<{
  success: boolean;
  orders: { type: string; order_id?: string; error?: string }[];
  message?: string;
}> {
  const results: { type: string; order_id?: string; error?: string }[] = [];
  let allSuccess = true;

  // 1. Place Entry GTT (single leg)
  const entryResult = await placeGTTOrder(ocoSet.entry);
  results.push({ type: 'ENTRY', order_id: entryResult.order_id, error: entryResult.error });
  if (!entryResult.success) allSuccess = false;

  // 2. Place Stop Loss GTT (single leg, opposite transaction)
  const slResult = await placeGTTOrder(ocoSet.stop_loss);
  results.push({ type: 'STOP_LOSS', order_id: slResult.order_id, error: slResult.error });
  if (!slResult.success) allSuccess = false;

  // 3. Place Target 1 GTT (single leg, opposite transaction)
  const t1Result = await placeGTTOrder(ocoSet.target1);
  results.push({ type: 'TARGET_1', order_id: t1Result.order_id, error: t1Result.error });
  if (!t1Result.success) allSuccess = false;

  // 4. Place Target 2 GTT (optional)
  if (ocoSet.target2) {
    const t2Result = await placeGTTOrder(ocoSet.target2);
    results.push({ type: 'TARGET_2', order_id: t2Result.order_id, error: t2Result.error });
    if (!t2Result.success) allSuccess = false;
  }

  return {
    success: allSuccess,
    orders: results,
    message: allSuccess ? 'All OCO orders placed successfully' : 'Some orders failed',
  };
}

/**
 * Fetch all active GTT orders for the user
 */
export async function fetchGTTOrders(): Promise<GTTOrder[]> {
  const creds = getKiteCredentials();
  const token = creds.accessToken || creds.requestToken;
  
  if (!creds.apiKey || !token) {
    return [];
  }

  try {
    const response = await fetch('https://api.kite.trade/gtt/triggers', {
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success' && Array.isArray(data.data)) {
        return data.data.map((gtt: any) => ({
          id: gtt.id,
          user_id: gtt.user_id,
          tradingsymbol: gtt.tradingsymbol,
          exchange: gtt.exchange,
          transaction_type: gtt.transaction_type,
          quantity: gtt.quantity,
          product: gtt.product,
          trigger_type: gtt.type,
          trigger_price: gtt.trigger_price,
          limit_price: gtt.limit_price,
          upper_trigger_price: gtt.upper_trigger_price,
          upper_limit_price: gtt.upper_limit_price,
          upper_quantity: gtt.upper_quantity,
          lower_trigger_price: gtt.lower_trigger_price,
          lower_limit_price: gtt.lower_limit_price,
          lower_quantity: gtt.lower_quantity,
          status: gtt.status,
          created_at: gtt.created_at,
          updated_at: gtt.updated_at,
          triggered_at: gtt.triggered_at,
          expires_at: gtt.expires_at,
        }));
      }
    }
  } catch (err) {
    console.warn('Failed to fetch GTT orders:', err);
  }

  return [];
}

/**
 * Cancel a GTT order by ID
 */
export async function cancelGTTOrder(triggerId: string): Promise<GTTOrderResponse> {
  const creds = getKiteCredentials();
  const token = creds.accessToken || creds.requestToken;
  
  if (!creds.apiKey || !token) {
    return { success: false, error: 'Zerodha credentials not configured' };
  }

  try {
    const response = await fetch(`https://api.kite.trade/gtt/triggers/${triggerId}`, {
      method: 'DELETE',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
      },
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, message: 'GTT order cancelled successfully' };
      }
      return { success: false, error: data.message || 'Failed to cancel GTT order' };
    }

    const errorData = await response.json().catch(() => ({}));
    return { success: false, error: errorData.message || `HTTP ${response.status}` };
  } catch (err) {
    console.warn('Failed to cancel GTT order:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Modify a GTT order
 */
export async function modifyGTTOrder(triggerId: string, params: Partial<GTTOrderParams>): Promise<GTTOrderResponse> {
  const creds = getKiteCredentials();
  const token = creds.accessToken || creds.requestToken;
  
  if (!creds.apiKey || !token) {
    return { success: false, error: 'Zerodha credentials not configured' };
  }

  try {
    const response = await fetch(`https://api.kite.trade/gtt/triggers/${triggerId}`, {
      method: 'PUT',
      headers: {
        'X-Kite-Version': '3',
        'Authorization': `token ${creds.apiKey}:${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(params),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.status === 'success') {
        return { success: true, message: 'GTT order modified successfully' };
      }
      return { success: false, error: data.message || 'Failed to modify GTT order' };
    }

    const errorData = await response.json().catch(() => ({}));
    return { success: false, error: errorData.message || `HTTP ${response.status}` };
  } catch (err) {
    console.warn('Failed to modify GTT order:', err);
    return { success: false, error: 'Network error' };
  }
}

/**
 * Build OCO order set from position sizing calculator data
 */
export function buildOCOOrderSet(
  symbol: string,
  exchange: 'NSE' | 'BSE' | 'NFO' | 'BFO',
  entryPrice: number,
  stopLoss: number,
  target1: number,
  target2: number | undefined,
  quantity: number,
  product: 'CNC' | 'NRML' | 'MIS' | 'MTF'
): OCOOrderSet {
  const isBuy = true; // Strategy is long-only
  const oppositeType = isBuy ? 'SELL' : 'BUY';

  return {
    entry: {
      tradingsymbol: symbol,
      exchange,
      transaction_type: 'BUY',
      quantity,
      product,
      trigger_type: 'single',
      trigger_price: entryPrice,
      limit_price: entryPrice * 1.001, // Slightly above trigger for limit order
    },
    stop_loss: {
      tradingsymbol: symbol,
      exchange,
      transaction_type: oppositeType,
      quantity,
      product,
      trigger_type: 'single',
      trigger_price: stopLoss,
      limit_price: stopLoss * 0.999, // Slightly below trigger
    },
    target1: {
      tradingsymbol: symbol,
      exchange,
      transaction_type: oppositeType,
      quantity,
      product,
      trigger_type: 'single',
      trigger_price: target1,
      limit_price: target1 * 0.999,
    },
    target2: target2 ? {
      tradingsymbol: symbol,
      exchange,
      transaction_type: oppositeType,
      quantity,
      product,
      trigger_type: 'single',
      trigger_price: target2,
      limit_price: target2 * 0.999,
    } : undefined,
  };
}