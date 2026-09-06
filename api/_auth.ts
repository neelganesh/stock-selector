/**
 * Shared authentication utilities for API routes
 */
import type { VercelRequest } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export function getSupabaseAdmin() {
  return supabaseAdmin;
}

export class UnauthorizedError extends Error {}

export async function requireAuth(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    throw new UnauthorizedError('Missing auth token');
  }
  const token = authHeader.slice(7);
  const secret = process.env.SUPABASE_JWT_SECRET || process.env.JWT_SECRET || '';
  const decoded = jwt.verify(token, secret) as { sub: string; email?: string };
  return { user: { id: decoded.sub, email: decoded.email || '' } };
}
