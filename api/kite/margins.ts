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
      // Get margins
      const margins = await kiteRequest(credentials, 'GET', '/user/margins');
      return res.status(200).json(margins);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}