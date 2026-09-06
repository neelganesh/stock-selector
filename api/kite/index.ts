/**
 * /api/kite — Zerodha Kite API key management
 *
 * GET    /api/kite             → check key status  (was key-status.ts)
 * POST   /api/kite             → save/encrypt key (was save-key.ts)
 * DELETE /api/kite             → delete key        (was delete-key.ts)
 * POST   /api/kite?publish=true → issue publish ticket (was publish.ts)
 */
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';
import { encrypt, decrypt } from '../_crypto.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getEncryptionKey(): string {
  const key = process.env.KITE_KEY_ENCRYPTION_KEY;
  if (!key) throw new Error('KITE_KEY_ENCRYPTION_KEY env var not set');
  return key;
}

/** Returns the encrypted api_key for the authenticated user, or null. */
async function getEncryptedKey(userId: string): Promise<string | null> {
  const supabase = getSupabaseAdmin();
  const { data } = await supabase
    .from('user_profiles')
    .select('kite_api_key')
    .eq('user_id', userId)
    .maybeSingle();
  return (data?.kite_api_key as string | null) ?? null;
}

/** Issue a short-lived publish ticket (plaintext API key, expires in 60 s). */
function buildPublishTicket(apiKey: string, userId: string): object {
  const issuedAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + 60_000).toISOString();
  // Encode a simple compact-JWK-like structure (not a real JWK — server use only)
  const ticket = Buffer.from(
    JSON.stringify({ apiKey, userId, issuedAt, expiresAt }),
  ).toString('base64');
  return { ticket, expiresAt };
}

// ---------------------------------------------------------------------------
// GET — key status
// ---------------------------------------------------------------------------

async function handleGet(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);

  const encrypted = await getEncryptedKey(user.id);
  if (!encrypted) {
    return void res.status(200).json({ configured: false, message: 'No Kite API key configured.' });
  }

  try {
    const apiKey = decrypt(encrypted);
    return void res.status(200).json({
      configured: true,
      message: 'Kite API key is configured.',
      // Return only the first 4 and last 4 characters of the API key
      maskedKey: apiKey.replace(/.(?=.{4})/g, '*'),
    });
  } catch {
    return void res.status(200).json({
      configured: false,
      message: 'Stored key could not be decrypted. Please re-enter your API key.',
    });
  }
}

// ---------------------------------------------------------------------------
// POST — save key / publish ticket
// ---------------------------------------------------------------------------

async function handlePost(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);

  // ?publish=true issues a short-lived publish ticket instead of storing
  if (req.query?.publish === 'true' || req.query?.publish === true) {
    const encrypted = await getEncryptedKey(user.id);
    if (!encrypted) {
      return void res.status(400).json({ error: 'No Kite API key configured. Save a key first.' });
    }
    let apiKey: string;
    try {
      apiKey = decrypt(encrypted);
    } catch {
      return void res.status(400).json({ error: 'Stored key could not be decrypted. Please re-enter your API key.' });
    }
    const ticket = buildPublishTicket(apiKey, user.id);
    return void res.status(200).json(ticket);
  }

  // Default: save/encrypt the key
  const { api_key } = req.body ?? {};
  if (!api_key || typeof api_key !== 'string' || api_key.trim().length === 0) {
    return void res.status(400).json({ error: 'api_key is required.' });
  }
  const trimmed = api_key.trim();
  // Basic format validation: Kite API keys are typically 12 chars alphanumeric
  if (trimmed.length < 8 || trimmed.length > 64) {
    return void res.status(400).json({ error: 'api_key appears invalid (length out of range).' });
  }

  const encrypted = encrypt(trimmed);
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_profiles')
    .update({ kite_api_key: encrypted, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    console.error('[kite POST] save error:', error);
    return void res.status(500).json({ error: 'Failed to save Kite API key.' });
  }

  return void res.status(200).json({
    success: true,
    maskedKey: trimmed.replace(/.(?=.{4})/g, '*'),
  });
}

// ---------------------------------------------------------------------------
// DELETE — delete key
// ---------------------------------------------------------------------------

async function handleDelete(req: VercelRequest, res: VercelResponse): Promise<void> {
  const { user } = await requireAuth(req);

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('user_profiles')
    .update({ kite_api_key: null, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (error) {
    console.error('[kite DELETE] error:', error);
    return void res.status(500).json({ error: 'Failed to delete Kite API key.' });
  }

  return void res.status(200).json({ success: true, message: 'Kite API key deleted.' });
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    switch (req.method) {
      case 'GET':    return handleGet(req, res);
      case 'POST':   return handlePost(req, res);
      case 'DELETE': return handleDelete(req, res);
      default:
        return void res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (err) {
    console.error('[kite] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return void res.status(401).json({ error: err.message });
    }
    return void res.status(500).json({ error: 'Internal server error' });
  }
}
