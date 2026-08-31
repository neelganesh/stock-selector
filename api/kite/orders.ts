import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, kiteRequest } from './client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  const auth = await requireAuth(req);
  if (!auth) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { credentials } = auth;

  try {
    if (req.method === 'GET') {
      // Get order history
      const orders = await kiteRequest(credentials, 'GET', '/orders');
      return res.status(200).json(orders);
    }

    if (req.method === 'POST') {
      // Place order
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