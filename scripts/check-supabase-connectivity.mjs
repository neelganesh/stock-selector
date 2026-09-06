// End-to-end connectivity check for the new Supabase Publishable + Secret keys.
//   1. Secret key  -> reads stock_universe (server-side, bypasses RLS).
//   2. Publishable -> tries to read stock_universe (browser-safe, RLS-enabled;
//      the public SELECT policy we created should let it through).
//
// Exit code 0 = both keys connect, 1 = any failure.

import { createClient } from '@supabase/supabase-js';

const URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SECRET = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLISHABLE =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

if (!URL || !SECRET) {
  console.error('Missing SUPABASE_URL or SUPABASE_SECRET_KEY in env.');
  process.exit(1);
}
if (!PUBLISHABLE) {
  console.error('Missing publishable key (VITE_SUPABASE_PUBLISHABLE_KEY).');
  process.exit(1);
}

const mask = (k) => (k ? `${k.slice(0, 12)}...(${k.length} chars)` : '(none)');
console.log(`URL          : ${URL}`);
console.log(`Secret       : ${mask(SECRET)}`);
console.log(`Publishable  : ${mask(PUBLISHABLE)}`);
console.log('');

let exitCode = 0;

// 1) Secret key -> full access, should return all 451 rows.
try {
  const admin = createClient(URL, SECRET, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const t0 = Date.now();
  const { data, error, count } = await admin
    .from('stock_universe')
    .select('symbol, cap_category', { count: 'exact' })
    .limit(1);
  const ms = Date.now() - t0;
  if (error) throw error;
  console.log(`[secret]   OK  count=${count}  sample=${data?.[0]?.symbol}  ${ms}ms`);
} catch (e) {
  console.error(`[secret]   FAIL  ${e.message}`);
  if (e.cause) console.error('  cause:', e.cause);
  exitCode = 1;
}

// 2) Publishable key -> RLS-bounded; the public SELECT policy on stock_universe
//    should let it through, so we expect a non-zero count.
try {
  const pub = createClient(URL, PUBLISHABLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const t0 = Date.now();
  const { data, error, count } = await pub
    .from('stock_universe')
    .select('symbol, cap_category', { count: 'exact' })
    .limit(1);
  const ms = Date.now() - t0;
  if (error) throw error;
  console.log(`[publish]  OK  count=${count}  sample=${data?.[0]?.symbol}  ${ms}ms`);
} catch (e) {
  console.error(`[publish]  FAIL  ${e.message}`);
  if (e.cause) console.error('  cause:', e.cause);
  exitCode = 1;
}

process.exit(exitCode);
