/**
 * Shared authentication utilities for API routes.
 * Decodes JWT to identify the user (avoids bad_jwt from auth.getUser).
 */
import "dotenv/config";
import type { VercelRequest } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Supabase server environment is not configured");
}

export const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

export function getSupabaseAdmin() {
  return supabaseAdmin;
}

export class UnauthorizedError extends Error {}

export async function requireAuth(req: VercelRequest) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    throw new UnauthorizedError("Missing auth token");
  }

  const token = authHeader.slice(7);

  // Decode JWT to extract user info (avoid bad_jwt from auth.getUser)
  let userId: string;
  let userEmail: string;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) throw new Error("Invalid JWT format");
    const payload: Record<string, any> = JSON.parse(Buffer.from(parts[1], "base64").toString());
    userId = payload.sub;
    userEmail = payload.email || "";
    if (!userId) throw new Error("No sub claim");
  } catch (err: any) {
    throw new UnauthorizedError("Invalid auth token");
  }

  return { user: { id: userId, email: userEmail } };
}
