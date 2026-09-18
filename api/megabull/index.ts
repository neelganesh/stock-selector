import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { encrypt, decrypt } from '../_crypto.js';

async function getStoredKey(userId: string): Promise<string | null> {
  const { data, error } = await getSupabaseAdmin()
    .from('user_profiles').select('megabull_api_key').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return (data?.megabull_api_key as string | null) ?? null;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const { user } = await requireAuth(req);
    const supabase = getSupabaseAdmin();

    if (req.method === 'GET') {
      const stored = await getStoredKey(user.id);
      if (!stored) return void res.status(200).json({ configured: false });
      try {
        const key = decrypt(stored);
        return void res.status(200).json({
          configured: true,
          maskedKey: key.length > 4 ? `${'*'.repeat(Math.max(4, key.length - 4))}${key.slice(-4)}` : '****',
        });
      } catch {
        return void res.status(200).json({ configured: false, error: 'Stored key is invalid. Please replace it.' });
      }
    }

    if (req.method === 'POST') {
      const apiKey = req.body?.megabull_api_key || req.body?.api_key;
      if (typeof apiKey !== 'string' || apiKey.trim().length < 8 || apiKey.trim().length > 512) {
        return void res.status(400).json({ error: 'A valid MegaBull API key is required.' });
      }
      const { error } = await supabase.from('user_profiles').update({
        megabull_api_key: encrypt(apiKey.trim()),
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      if (error) throw error;
      return void res.status(200).json({ success: true, configured: true });
    }

    if (req.method === 'DELETE') {
      const { error } = await supabase.from('user_profiles').update({
        megabull_api_key: null,
        updated_at: new Date().toISOString(),
      }).eq('user_id', user.id);
      if (error) throw error;
      return void res.status(200).json({ success: true, configured: false });
    }

    return void res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('[megabull] unexpected error:', error);
    if (error instanceof UnauthorizedError) return void res.status(401).json({ error: error.message });
    return void res.status(500).json({ error: 'Internal server error' });
  }
}
