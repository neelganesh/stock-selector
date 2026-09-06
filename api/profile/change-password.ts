import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, UnauthorizedError, getSupabaseAdmin } from '../_auth.js';

/**
 * POST /api/profile/change-password
 *
 * Changes the authenticated user's password. Supabase Auth does not allow
 * an admin to change a user's password without knowing the current one
 * (that would be a security risk — anyone with the admin key could reset
 * any account). So we verify the current password by attempting a fresh
 * sign-in before updating.
 *
 * Body: { currentPassword: string; newPassword: string }
 */

// Minimum password requirements (Supabase default + sensible safety floor)
const MIN_PASSWORD_LENGTH = 6;
const MAX_PASSWORD_LENGTH = 72;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { user } = await requireAuth(req);
    const { currentPassword, newPassword } = req.body || {};

    if (typeof currentPassword !== 'string' || !currentPassword) {
      return res.status(400).json({ error: 'Current password is required' });
    }
    if (typeof newPassword !== 'string' || newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({
        error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      });
    }
    if (newPassword.length > MAX_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be ${MAX_PASSWORD_LENGTH} characters or fewer` });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'New password must be different from current password' });
    }

    const supabase = getSupabaseAdmin();

    // Verify the current password by re-signing in
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: user.email,
      password: currentPassword,
    });

    if (signInError) {
      // Vague message so a caller can't enumerate valid accounts
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    // Update to the new password
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      user.id,
      { password: newPassword },
    );

    if (updateError) {
      console.error('[change-password] update error:', updateError);
      return res.status(500).json({ error: 'Failed to update password. Please try again.' });
    }

    return res.status(200).json({ success: true, message: 'Password changed successfully.' });
  } catch (err) {
    console.error('[change-password] unexpected error:', err);
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: err.message });
    }
    return res.status(500).json({ error: 'Internal server error' });
  }
}
