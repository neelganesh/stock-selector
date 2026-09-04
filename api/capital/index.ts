import type { VercelRequest, VercelResponse } from '@vercel/node';
import { requireAuth, kiteRequest, getUserKiteCredentials, UnauthorizedError } from '../kite/_client';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let auth;
  try {
    auth = await requireAuth(req);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      return res.status(401).json({ error: 'Unauthorized' });
    }
    throw err;
  }
  const { user, supabase: userSupabase } = auth;

  // Fetch user profile with capital config
  const { data: profile, error: profileError } = await userSupabase
    .from('user_profiles')
    .select(
      'total_capital, risk_per_trade_pct, max_position_pct, max_sector_pct, max_daily_loss_pct, paper_trading_enabled, paper_trading_capital'
    )
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile) {
    return res.status(404).json({ error: 'User profile not found' });
  }

  // Fetch live margins from Zerodha
  let availableMargin = 0;
  try {
    const credentials = await getUserKiteCredentials(user.id);
    if (credentials) {
      const margins = await kiteRequest(credentials, 'GET', '/user/margins');
      availableMargin = margins?.equity?.net || 0;
    }
  } catch (marginError) {
    console.warn('Failed to fetch live margins:', marginError);
  }

  // Fetch open strategy executions (deployed capital)
  const { data: openExecutions } = await userSupabase
    .from('strategy_executions')
    .select('risk_amount, status, capital_allocated')
    .eq('user_id', user.id)
    .in('status', [
      'entry_filled',
      'gtt_placed',
      'target1_hit',
      'target2_hit',
      'stop_loss_hit',
      'partial_exit',
    ]);

  // Fetch open paper positions
  const { data: paperPositions } = await userSupabase
    .from('paper_positions')
    .select('risk_amount, risk_pct, status, entry_filled_price, quantity, charges_estimate')
    .eq('user_id', user.id)
    .in('status', ['pending', 'entry_filled', 'target1_hit', 'target2_hit']);

  const deployedCapital =
    openExecutions?.reduce((sum, ex) => sum + (ex.capital_allocated || 0), 0) || 0;
  const riskUsed = openExecutions?.reduce((sum, ex) => sum + (ex.risk_amount || 0), 0) || 0;
  const totalCapital = profile.paper_trading_enabled
    ? profile.paper_trading_capital
    : profile.total_capital;
  const riskUsedPct = totalCapital > 0 ? (riskUsed / totalCapital) * 100 : 0;

  // Fetch portfolio positions from Kite for additional deployed capital
  let portfolioDeployed = 0;
  try {
    const credentials = await getUserKiteCredentials(user.id);
    if (credentials) {
      const portfolio = await kiteRequest(credentials, 'GET', '/portfolio/positions');
      const dayPositions = portfolio?.day || [];
      portfolioDeployed = dayPositions
        .filter((p: any) => p.quantity !== 0)
        .reduce((sum: number, p: any) => sum + Math.abs(p.quantity * p.average_price), 0);
    }
  } catch (portfolioError) {
    console.warn('Failed to fetch portfolio positions:', portfolioError);
  }

  const totalDeployed = deployedCapital + portfolioDeployed;
  const availableCapital = totalCapital - totalDeployed;

  // Paper trading metrics
  const paperTradingCapital = profile.paper_trading_capital || 0;
  const paperRiskUsed = paperPositions?.reduce((sum, p) => sum + (p.risk_amount || 0), 0) || 0;
  const paperDeployedCapital =
    paperPositions?.reduce((sum, p) => {
      const filledPrice = p.entry_filled_price || 0;
      const qty = p.quantity || 0;
      return sum + filledPrice * qty;
    }, 0) || 0;
  const paperAvailableCapital = paperTradingCapital - paperDeployedCapital;
  const paperRiskUsedPct =
    paperTradingCapital > 0
      ? Math.round((paperRiskUsed / paperTradingCapital) * 10000) / 100
      : 0;
  const paperOpenPositionsCount = paperPositions?.length || 0;

  return res.status(200).json({
    totalCapital,
    availableMargin,
    deployedCapital: totalDeployed,
    availableCapital,
    riskUsed,
    riskUsedPct: Math.round(riskUsedPct * 100) / 100,
    openPositionsCount: (openExecutions?.length || 0) + (portfolioDeployed > 0 ? 1 : 0),
    paperTrading: profile.paper_trading_enabled,
    paperTradingCapital,
    paperDeployedCapital,
    paperAvailableCapital,
    paperRiskUsed,
    paperRiskUsedPct,
    paperOpenPositionsCount,
    riskLimits: {
      riskPerTradePct: profile.risk_per_trade_pct,
      maxPositionPct: profile.max_position_pct,
      maxSectorPct: profile.max_sector_pct,
      maxDailyLossPct: profile.max_daily_loss_pct,
    },
  });
}
