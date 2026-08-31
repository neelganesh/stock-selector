/**
 * XIRR (Extended Internal Rate of Return) Calculation
 * Uses Newton-Raphson method to find the rate that makes NPV = 0
 */

export interface CashFlow {
  date: string; // ISO date string
  amount: number; // positive = inflow, negative = outflow
}

export function xirr(cashFlows: CashFlow[], guess = 0.1): number | null {
  if (cashFlows.length < 2) return null;

  // Sort by date
  const sorted = [...cashFlows].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  
  // Check if we have both positive and negative flows
  const hasPositive = sorted.some(cf => cf.amount > 0);
  const hasNegative = sorted.some(cf => cf.amount < 0);
  if (!hasPositive || !hasNegative) return null;

  const dates = sorted.map(cf => new Date(cf.date).getTime());
  const amounts = sorted.map(cf => cf.amount);
  const firstDate = dates[0];

  // Convert dates to years from first date
  const years = dates.map(d => (d - firstDate) / (365.25 * 24 * 60 * 60 * 1000));

  // Newton-Raphson iteration
  let rate = guess;
  const maxIterations = 100;
  const tolerance = 1e-8;

  for (let i = 0; i < maxIterations; i++) {
    let npv = 0;
    let dnpv = 0;

    for (let j = 0; j < amounts.length; j++) {
      const factor = Math.pow(1 + rate, years[j]);
      npv += amounts[j] / factor;
      dnpv -= amounts[j] * years[j] / (factor * (1 + rate));
    }

    if (Math.abs(npv) < tolerance) {
      return rate;
    }

    if (dnpv === 0) break;

    const newRate = rate - npv / dnpv;
    
    // Prevent divergence
    if (newRate <= -1) {
      rate = -0.99;
    } else if (Math.abs(newRate - rate) < tolerance) {
      rate = newRate;
      break;
    } else {
      rate = newRate;
    }
  }

  // Final check
  let npv = 0;
  for (let j = 0; j < amounts.length; j++) {
    npv += amounts[j] / Math.pow(1 + rate, years[j]);
  }
  
  if (Math.abs(npv) < 1e-4) {
    return rate;
  }

  return null;
}

/**
 * CAGR (Compound Annual Growth Rate) Calculation
 */
export function cagr(beginningValue: number, endingValue: number, years: number): number | null {
  if (beginningValue <= 0 || endingValue <= 0 || years <= 0) return null;
  return Math.pow(endingValue / beginningValue, 1 / years) - 1;
}

/**
 * Calculate XIRR from trade cash flows for a strategy execution
 */
export function calculateExecutionXIRR(cashFlows: Array<{
  date: string;
  amount: number;
  type: string;
}>): number | null {
  // Convert to XIRR format: entry/exit are outflows/inflows, charges are outflows
  const xirrFlows: CashFlow[] = cashFlows.map(cf => ({
    date: cf.date,
    amount: cf.type === 'entry' || cf.type === 'charge' ? -Math.abs(cf.amount) : Math.abs(cf.amount),
  }));

  // Add current unrealized value as final inflow if there are open positions
  // This would need current price data - for now just use realized flows
  return xirr(xirrFlows);
}

/**
 * Calculate CAGR for a strategy execution
 */
export function calculateExecutionCAGR(
  entryPrice: number,
  currentPrice: number,
  entryDate: string,
  exitDate?: string
): number | null {
  const start = new Date(entryDate).getTime();
  const end = exitDate ? new Date(exitDate).getTime() : Date.now();
  const years = (end - start) / (365.25 * 24 * 60 * 60 * 1000);
  
  if (years < 1/365) return null; // Less than a day
  
  return cagr(entryPrice, currentPrice, years);
}

/**
 * Format percentage for display
 */
export function formatPct(value: number | null, decimals = 2): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  const pct = value * 100;
  const sign = pct >= 0 ? '+' : '';
  return `${sign}${pct.toFixed(decimals)}%`;
}

/**
 * Format currency for display
 */
export function formatCurrency(value: number | null, decimals = 0): string {
  if (value === null || value === undefined || isNaN(value)) return '—';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(value);
}