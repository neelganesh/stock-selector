/**
 * Consolidated Zerodha Kite endpoint.
 *
 * Replaces the previous 6 separate route files (`auth.ts`, `gtt.ts`, `margins.ts`,
 * `orders.ts`, `portfolio.ts`, `token.ts`) with a single dynamic route that
 * dispatches on `req.query.action`.
 *
 * Why consolidate? Vercel's Hobby plan caps deployments at 12 serverless
 * functions per project. Folding the 6 Kite endpoints into one route brings
 * the total function count under that limit.
 *
 * URL mapping (unchanged from the old per-file routes):
 *   GET    /api/kite/auth                → status / login URL
 *   POST   /api/kite/token               → exchange request_token for access_token
 *   GET    /api/kite/orders              → order history
 *   POST   /api/kite/orders              → place order
 *   GET    /api/kite/margins             → user margins
 *   GET    /api/kite/portfolio           → positions + holdings
 *   GET    /api/kite/gtt                 → list GTT triggers
 *   POST   /api/kite/gtt                 → place GTT
 *   DELETE /api/kite/gtt?id=<id>         → delete GTT
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import {
  requireAuth,
  kiteRequest,
  KITE_LOGIN_URL,
  generateChecksum,
  getUserKiteCredentials,
  UnauthorizedError,
} from './_client';

const supabaseAdmin = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type Action = 'auth' | 'token' | 'orders' | 'margins' | 'portfolio' | 'gtt';

function isAction(value: unknown): value is Action {
  return (
    value === 'auth' ||
    value === 'token' ||
    value === 'orders' ||
    value === 'margins' ||
    value === 'portfolio' ||
    value === 'gtt'
  );
}

/**
 * GET /api/kite/auth — returns auth status + Kite login URL if not connected.
 */
async function handleAuth(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    throw err;
  }

  try {
    const { credentials } = auth;

    if (!credentials?.accessToken) {
      const apiKey = credentials?.apiKey;
      if (!apiKey) {
        return res.status(200).json({
          authenticated: false,
          message: 'Zerodha not connected. Add API key in Settings.',
        });
      }
      const loginUrl = `${KITE_LOGIN_URL}?v=3&api_key=${apiKey}`;
      return res.status(200).json({
        authenticated: false,
        loginUrl,
        message: 'Zerodha login required',
      });
    }

    const profile = await kiteRequest(credentials, 'GET', '/user/profile');
    return res.status(200).json({ authenticated: true, profile: profile.data });
  } catch (error: any) {
    if (error.message?.includes('TokenException') || error.message?.includes('expired')) {
      const apiKey = auth.credentials?.apiKey;
      if (apiKey) {
        const loginUrl = `${KITE_LOGIN_URL}?v=3&api_key=${apiKey}`;
        return res.status(200).json({
          authenticated: false,
          loginUrl,
          message: 'Session expired, please login again',
        });
      }
    }
    return res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/kite/token — exchange request_token for an access_token.
 */
async function handleToken(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.slice(7);
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid auth token' });
  }

  const { requestToken } = req.body;
  if (!requestToken) {
    return res.status(400).json({ error: 'requestToken is required' });
  }

  try {
    const credentials = await getUserKiteCredentials(user.id);
    if (!credentials) {
      return res.status(400).json({ error: 'Zerodha API key not configured' });
    }
    const checksum = generateChecksum(credentials.apiKey, requestToken, credentials.apiSecret);
    const response = await kiteRequest(credentials, 'POST', '/session/token', {
      api_key: credentials.apiKey,
      request_token: requestToken,
      checksum,
    });
    const { access_token, user_id } = response.data;

    const expiresAt = new Date();
    expiresAt.setHours(6, 0, 0, 0);
    if (expiresAt <= new Date()) {
      expiresAt.setDate(expiresAt.getDate() + 1);
    }

    await supabaseAdmin
      .from('user_profiles')
      .update({
        zerodha_access_token: access_token,
        zerodha_access_token_expires_at: expiresAt.toISOString(),
        zerodha_user_id: user_id,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    return res.status(200).json({
      success: true,
      userId: user_id,
      access_token,
      expiresAt: expiresAt.toISOString(),
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * /api/kite/orders — GET history, POST place order.
 */
async function handleOrders(req: VercelRequest, res: VercelResponse, credentials: any) {
  try {
    if (req.method === 'GET') {
      const orders = await kiteRequest(credentials, 'GET', '/orders');
      return res.status(200).json(orders);
    }
    if (req.method === 'POST') {
      const {
        variety = 'regular',
        tradingsymbol,
        exchange = 'NSE',
        transaction_type,
        order_type = 'LIMIT',
        quantity,
        product = 'CNC',
        price,
        trigger_price,
        validity = 'DAY',
        disclosed_quantity = 0,
        market_protection = -1,
        tag,
      } = req.body;
      if (!tradingsymbol || !transaction_type || !quantity) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const body: Record<string, string> = {
        tradingsymbol,
        exchange,
        transaction_type,
        order_type,
        quantity: quantity.toString(),
        product,
        validity,
        disclosed_quantity: disclosed_quantity.toString(),
        market_protection: market_protection.toString(),
      };
      if (price !== undefined) body.price = price.toString();
      if (trigger_price !== undefined) body.trigger_price = trigger_price.toString();
      if (tag) body.tag = tag;
      const order = await kiteRequest(credentials, 'POST', `/orders/${variety}`, body);
      return res.status(200).json(order);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/kite/margins
 */
async function handleMargins(req: VercelRequest, res: VercelResponse, credentials: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const margins = await kiteRequest(credentials, 'GET', '/user/margins');
    return res.status(200).json(margins);
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * GET /api/kite/portfolio — positions + holdings in parallel.
 */
async function handlePortfolio(req: VercelRequest, res: VercelResponse, credentials: any) {
  try {
    if (req.method !== 'GET') {
      return res.status(405).json({ error: 'Method not allowed' });
    }
    const [positions, holdings] = await Promise.all([
      kiteRequest(credentials, 'GET', '/portfolio/positions'),
      kiteRequest(credentials, 'GET', '/portfolio/holdings'),
    ]);
    return res.status(200).json({ positions: positions.data, holdings: holdings.data });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

/**
 * /api/kite/gtt — GET list, POST place, DELETE delete.
 */
async function handleGtt(req: VercelRequest, res: VercelResponse, credentials: any) {
  try {
    if (req.method === 'GET') {
      const gtts = await kiteRequest(credentials, 'GET', '/gtt/triggers');
      return res.status(200).json(gtts);
    }
    if (req.method === 'POST') {
      const {
        type = 'two-leg',
        tradingsymbol,
        exchange = 'NSE',
        trigger_values,
        last_price,
        orders,
      } = req.body;
      if (!tradingsymbol || !trigger_values || !last_price || !orders) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      const body: Record<string, string> = {
        type,
        tradingsymbol,
        exchange,
        trigger_values: trigger_values.join(','),
        last_price: last_price.toString(),
      };
      orders.forEach((order: any, index: number) => {
        const prefix = index === 0 ? '' : `${index + 1}_`;
        body[`${prefix}transaction_type`] = order.transaction_type;
        body[`${prefix}quantity`] = order.quantity.toString();
        body[`${prefix}order_type`] = order.order_type || 'LIMIT';
        body[`${prefix}product`] = order.product || 'CNC';
        if (order.price !== undefined) body[`${prefix}price`] = order.price.toString();
      });
      const gtt = await kiteRequest(credentials, 'POST', '/gtt/triggers', body);
      return res.status(200).json(gtt);
    }
    if (req.method === 'DELETE') {
      const { id } = req.query;
      if (!id) {
        return res.status(400).json({ error: 'GTT ID required' });
      }
      const result = await kiteRequest(credentials, 'DELETE', `/gtt/triggers/${id}`);
      return res.status(200).json(result);
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const action = req.query.action;
  if (!isAction(action)) {
    return res.status(404).json({ error: 'Unknown kite action', action });
  }

  // auth + token manage their own auth (token uses raw JWT; auth uses requireAuth).
  if (action === 'auth') return handleAuth(req, res);
  if (action === 'token') return handleToken(req, res);

  // Everything else requires a Supabase-authed user with Kite credentials.
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    throw err;
  }

  if (!auth.credentials) {
    return res.status(400).json({ error: 'Zerodha API key not configured' });
  }

  if (action === 'orders') return handleOrders(req, res, auth.credentials);
  if (action === 'margins') return handleMargins(req, res, auth.credentials);
  if (action === 'portfolio') return handlePortfolio(req, res, auth.credentials);
  if (action === 'gtt') return handleGtt(req, res, auth.credentials);

  // Unreachable due to isAction guard.
  return res.status(500).json({ error: 'unhandled action' });
}
