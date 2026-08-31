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
      // Get all GTTs
      const gtts = await kiteRequest(credentials, 'GET', '/gtt/triggers');
      return res.status(200).json(gtts);
    }

    if (req.method === 'POST') {
      // Place GTT order
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

      // Add orders
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
      // Delete GTT
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