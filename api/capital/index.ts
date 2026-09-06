import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, kiteRequest, getUserKiteCredentials, UnauthorizedError, getSupabaseAdmin } from '../kite/_client.js';

/**
 * Capital API - Returns user capital data including deployed/available amounts.
 * 
 * Flow:
 * 1. Authenticate user via Bearer token
 * 2. Fetch user profile (create default if missing)
 * 3. Fetch open positions from DB and Kite
 * 4. Calculate and return capital metrics
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed', code: 'METHOD_NOT_ALLOWED' });
  }

  // Authenticate the request
  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      console.log('[capital API] Unauthorized request');
      return res.status(401).json({ error: 'Unauthorized', code: 'AUTH_FAILED' });
    }
    console.error('[capital API] Unexpected error during auth:', err);
    return res.status(500).json({ error: 'Internal server error', code: 'INTERNAL_ERROR' });
  }

  const { user } = auth;
  const supabase = getSupabaseAdmin();
  console.log('[capital API] Processing request for user:', user.id);

  // Fetch or create user profile
  let profile = await getOrCreateUserProfile(supabase, user);
  if (!profile) {
    console.error('[capital API] Failed to get or create profile for user:', user.id);
    return res.status(500).json({ 
      error: 'Failed to initialize user profile', 
      code: 'PROFILE_UNAVAILABLE',
      details: 'Please configure your account in Settings'
    });
  }

  // Fetch open positions from DB
  const openExecutions = await getOpenExecutions(supabase, user.id);
  const paperPositions = await getOpenPaperPositions(supabase, user.id);

  // Fetch live data from Zerodha (optional - don't fail if unavailable)
  const { availableMargin, portfolioDeployed } = await getLiveCapitalData(user.id);

  // Calculate and return capital metrics
  const capitalData = calculateCapitalMetrics(
    profile,
    openExecutions,
    paperPositions,
    availableMargin,
    portfolioDeployed
  );

  // Add kite connection status
  const credentials = await getUserKiteCredentials(user.id);
  const kiteStatus = credentials?.zerodha_access_token && credentials?.zerodha_access_token_expires_at
    ? (new Date(credentials.zerodha_access_token_expires_at) > new Date() ? 'connected' : 'expired')
    : credentials?.zerodha_api_key ? 'token_needed' : 'not_configured';

  capitalData.kiteStatus = kiteStatus;
  capitalData.kiteExpiresAt = credentials?.zerodha_access_token_expires_at || null;

  console.log('[capital API] Returning capital data for user:', user.id);
  return res.status(200).json(capitalData);
}

/**
 * Get user profile or create default if missing.
 * Uses admin client to bypass RLS for both read and write.
 */
async function getOrCreateUserProfile(supabase: any, user: { id: string; email?: string }): Promise<any | null> {
  // Try to get existing profile - use admin client to bypass RLS
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('user_id', user.id)
    .single();

  if (profile) {
    return profile;
  }

  // Profile not found - create default using admin client
  console.log('[capital API] Profile not found, creating default for user:', user.id);
  
  const defaultProfile = {
    user_id: user.id,
    email: user.email,
    total_capital: 100000,
    risk_per_trade_pct: 2,
    max_position_pct: 10,
    max_sector_pct: 25,
    daily_loss_limit_pct: 5,
    paper_trading_enabled: true,
    paper_trading_capital: 100000,
  };

  const { data: newProfile, error: createError } = await supabaseAdmin
    .from('user_profiles')
    .insert(defaultProfile)
    .select()
    .single();

  if (createError || !newProfile) {
    console.error('[capital API] Failed to create profile:', createError);
    return null;
  }

  console.log('[capital API] Successfully created profile for user:', user.id);
  return newProfile;
}

/**
 * Get open strategy executions for capital calculation.
 */
async function getOpenExecutions(supabase: any, userId: string): Promise<any[]> {
  const { data: executions } = await supabase
    .from('strategy_executions')
    .select('risk_amount, status, entry_price, quantity')
    .eq('user_id', userId)
    .in('status', ['pending', 'entry_placed', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit']);
  return executions || [];
}

/**
 * Get open paper positions for capital calculation.
 */
async function getOpenPaperPositions(supabase: any, userId: string): Promise<any[]> {
  const { data: positions } = await supabase
    .from('paper_positions')
    .select('risk_amount, risk_pct, status, entry_filled_price, quantity, charges_estimate')
    .eq('user_id', userId)
    .in('status', ['pending', 'entry_filled', 'target1_hit', 'target2_hit']);
  return positions || [];
}

/**
 * Fetch live capital data from Zerodha (optional - won't fail if unavailable).
 */
async function getLiveCapitalData(userId: string): Promise<{ availableMargin: number; portfolioDeployed: number }> {
  let availableMargin = 0;
  let portfolioDeployed = 0;

  try {
    const credentials = await getUserKiteCredentials(userId);
    if (!credentials) {
      console.log('[capital API] No Kite credentials for user:', userId);
      return { availableMargin, portfolioDeployed };
    }

    // Fetch margins from Kite
    try {
      const margins = await kiteRequest(credentials, 'GET', '/user/margins');
      availableMargin = margins?.equity?.net || 0;
    } catch (marginError) {
      console.warn('[capital API] Failed to fetch margins:', marginError);
    }

    // Fetch portfolio positions from Kite
    try {
      const portfolio = await kiteRequest(credentials, 'GET', '/portfolio/positions');
      const dayPositions = portfolio?.day || [];
      portfolioDeployed = dayPositions
        .filter((p: any) => p.quantity !== 0)
        .reduce((sum: number, p: any) => sum + Math.abs(p.quantity * p.average_price), 0);
    } catch (portfolioError) {
      console.warn('[capital API] Failed to fetch portfolio:', portfolioError);
    }
  } catch (err) {
    console.warn('[capital API] Error fetching live data:', err);
  }

  return { availableMargin, portfolioDeployed };
}

/**
 * Calculate all capital metrics from fetched data.
 */
function calculateCapitalMetrics(
  profile: any,
  openExecutions: any[],
  paperPositions: any[],
  availableMargin: number,
  portfolioDeployed: number
): any {
  // Calculate deployed capital from executions
  const deployedCapital = openExecutions.reduce(
    (sum, ex) => sum + ((ex.entry_price || 0) * (ex.quantity || 0)),
    0
  );

  // Calculate risk used from executions
  const riskUsed = openExecutions.reduce(
    (sum, ex) => sum + (ex.risk_amount || 0),
    0
  );

  // Determine total capital based on trading mode
  const totalCapital = profile.paper_trading_enabled
    ? profile.paper_trading_capital
    : profile.total_capital;

  // Calculate risk percentage
  const riskUsedPct = totalCapital > 0 ? (riskUsed / totalCapital) * 100 : 0;

  // Total deployed = executions + Kite portfolio
  const totalDeployed = deployedCapital + portfolioDeployed;
  const availableCapital = totalCapital - totalDeployed;

  // Paper trading metrics
  const paperTradingCapital = profile.paper_trading_capital || 0;
  const paperRiskUsed = paperPositions.reduce((sum, p) => sum + (p.risk_amount || 0), 0);
  const paperDeployedCapital = paperPositions.reduce(
    (sum, p) => sum + ((p.entry_filled_price || 0) * (p.quantity || 0)),
    0
  );
  const paperAvailableCapital = paperTradingCapital - paperDeployedCapital;
  const paperRiskUsedPct = paperTradingCapital > 0
    ? Math.round((paperRiskUsed / paperTradingCapital) * 10000) / 100
    : 0;

  return {
    totalCapital,
    availableMargin,
    deployedCapital: totalDeployed,
    availableCapital,
    riskUsed,
    riskUsedPct: Math.round(riskUsedPct * 100) / 100,
    openPositionsCount: openExecutions.length + (portfolioDeployed > 0 ? 1 : 0),
    paperTrading: profile.paper_trading_enabled,
    paperTradingCapital,
    paperDeployedCapital,
    paperAvailableCapital,
    paperRiskUsed,
    paperRiskUsedPct,
    paperOpenPositionsCount: paperPositions.length,
    riskLimits: {
      riskPerTradePct: profile.risk_per_trade_pct,
      maxPositionPct: profile.max_position_pct,
      maxSectorPct: profile.max_sector_pct,
      maxDailyLossPct: profile.daily_loss_limit_pct,
    },
  };
}
