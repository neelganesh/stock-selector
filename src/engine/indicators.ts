/**
 * Technical Indicators Engine for Swing Trading Stock Selection
 */

// Calculate Exponential Moving Average (EMA)
export function calculateEMA(prices: number[], period: number): number {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  
  const k = 2 / (period + 1);
  // Start with SMA for initial EMA seed
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  
  return Number(ema.toFixed(2));
}

// Calculate Relative Strength Index (RSI - 14 period)
export function calculateRSI(prices: number[], period: number = 14): number {
  if (prices.length <= period) return 50;

  let gains = 0;
  let losses = 0;

  for (let i = 1; i <= period; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) gains += diff;
    else losses += Math.abs(diff);
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;

  for (let i = period + 1; i < prices.length; i++) {
    const diff = prices[i] - prices[i - 1];
    if (diff >= 0) {
      avgGain = (avgGain * (period - 1) + diff) / period;
      avgLoss = (avgLoss * (period - 1)) / period;
    } else {
      avgGain = (avgGain * (period - 1)) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }

  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}

// Calculate SuperTrend (Period 10, Multiplier 3)
export function calculateSuperTrend(prices: number[], period: number = 10, multiplier: number = 3): 'bullish' | 'bearish' {
  if (prices.length < period + 1) return 'bullish';

  const atr = calculateATR(prices, period);
  const latestPrice = prices[prices.length - 1];
  const ema20 = calculateEMA(prices, 20);
  const ema50 = calculateEMA(prices, 50);

  let upperBand = prices[0] + multiplier * atr;
  let lowerBand = prices[0] - multiplier * atr;
  let isBullish = true;

  for (let i = 1; i < prices.length; i++) {
    const close = prices[i];
    const prevClose = prices[i - 1];
    const basicUpper = close + multiplier * atr;
    const basicLower = close - multiplier * atr;

    if (basicLower > lowerBand || prevClose < lowerBand) {
      lowerBand = basicLower;
    }
    if (basicUpper < upperBand || prevClose > upperBand) {
      upperBand = basicUpper;
    }

    if (isBullish && close < lowerBand) {
      isBullish = false;
    } else if (!isBullish && close > upperBand) {
      isBullish = true;
    }
  }

  // Double-verify with EMA structure for robust momentum confirmation
  if (isBullish && latestPrice >= ema50) {
    return 'bullish';
  }
  return isBullish && latestPrice >= ema20 ? 'bullish' : 'bearish';
}

// Calculate Volume Ratio (Current Volume / 20-day SMA Volume)
export function calculateVolumeRatio(volumes: number[]): number {
  if (volumes.length < 20) return 1.0;
  
  const currentVol = volumes[volumes.length - 1];
  const sma20Vol = volumes.slice(-20, -1).reduce((sum, v) => sum + v, 0) / 19;
  
  if (sma20Vol === 0) return 1.0;
  return Number((currentVol / sma20Vol).toFixed(2));
}

/**
 * Wagner & Pedicelli Method:
 * Relative Strength vs Equal-Weighted Sector NAV (%)
 * Formula: Stock Return (%) - Sector NAV Return (%) over baseline period
 */
export function calculateWagnerPedicelliRelativeStrength(
  stockPrices: number[],
  sectorNavPrices: number[],
  lookbackPeriod: number = 30
): number {
  if (stockPrices.length < lookbackPeriod || sectorNavPrices.length < lookbackPeriod) {
    return 0;
  }

  const stockStart = stockPrices[stockPrices.length - lookbackPeriod];
  const stockEnd = stockPrices[stockPrices.length - 1];
  const stockReturn = ((stockEnd - stockStart) / stockStart) * 100;

  const sectorStart = sectorNavPrices[sectorNavPrices.length - lookbackPeriod];
  const sectorEnd = sectorNavPrices[sectorNavPrices.length - 1];
  const sectorReturn = ((sectorEnd - sectorStart) / sectorStart) * 100;

  // Versus NAV (percentage points difference)
  return Number((stockReturn - sectorReturn).toFixed(2));
}

/**
 * Calculate Average True Range (ATR - 14 period)
 */
export function calculateATR(prices: number[], period: number = 14): number {
  if (prices.length <= period) return Number((prices[prices.length - 1] * 0.02).toFixed(2));

  let totalTr = 0;
  for (let i = 1; i <= period; i++) {
    const high = prices[i] * 1.01;
    const low = prices[i] * 0.99;
    const prevClose = prices[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    totalTr += tr;
  }

  let atr = totalTr / period;
  for (let i = period + 1; i < prices.length; i++) {
    const high = prices[i] * 1.01;
    const low = prices[i] * 0.99;
    const prevClose = prices[i - 1];
    const tr = Math.max(high - low, Math.abs(high - prevClose), Math.abs(low - prevClose));
    atr = (atr * (period - 1) + tr) / period;
  }

  return Number(Math.max(0.5, atr).toFixed(2));
}

export interface RenkoResult {
  currentDirection: 'bullish' | 'bearish';
  currentTrend: 'bullish' | 'bearish';
  brickCount: number;
  isAthBreakout: boolean;
  brickSize: number;
  lastBrickPrice: number;
}

/**
 * Renko (Price-Only) Breakout & All-Time High Confirmation Engine (Section 5.2)
 * Eliminates noise by updating bricks only when price exceeds ATR brick size threshold.
 */
export function calculateRenkoBricks(prices: number[], brickSizeOverride?: number): RenkoResult {
  if (prices.length < 20) {
    return {
      currentDirection: 'bullish',
      currentTrend: 'bullish',
      brickCount: 2,
      isAthBreakout: false,
      brickSize: brickSizeOverride || 5,
      lastBrickPrice: prices[prices.length - 1] || 100,
    };
  }

  const atr = calculateATR(prices, 14);
  const brickSize = Number((brickSizeOverride || Math.max(1, atr * 1.2)).toFixed(2));

  let currentBrick = Math.floor(prices[0] / brickSize) * brickSize;
  let direction: 'bullish' | 'bearish' = 'bullish';
  let consecutiveBricks = 0;

  // Track max historic brick level before recent 20 days
  const historicPrices = prices.slice(0, Math.max(10, prices.length - 20));
  const maxHistoricPrice = Math.max(...historicPrices);

  for (let i = 1; i < prices.length; i++) {
    const price = prices[i];
    if (price >= currentBrick + brickSize) {
      const addedBricks = Math.floor((price - currentBrick) / brickSize);
      currentBrick += addedBricks * brickSize;
      if (direction === 'bullish') {
        consecutiveBricks += addedBricks;
      } else {
        direction = 'bullish';
        consecutiveBricks = addedBricks;
      }
    } else if (price <= currentBrick - brickSize) {
      const droppedBricks = Math.floor((currentBrick - price) / brickSize);
      currentBrick -= droppedBricks * brickSize;
      if (direction === 'bearish') {
        consecutiveBricks += droppedBricks;
      } else {
        direction = 'bearish';
        consecutiveBricks = droppedBricks;
      }
    }
  }

  const latestPrice = prices[prices.length - 1];
  const isAthBreakout = latestPrice > maxHistoricPrice * 1.01 && direction === 'bullish';

  return {
    currentDirection: direction,
    currentTrend: direction,
    brickCount: consecutiveBricks,
    isAthBreakout,
    brickSize,
    lastBrickPrice: Number(currentBrick.toFixed(2)),
  };
}

/**
 * Multi-Timeframe Return Tracker for Equal-Weighted Sector NAV (Section 3.2)
 * Calculates 1D, 1W, 1M, 3M, 6M returns
 */
export function calculateMultiTimeframeReturns(prices: number[]) {
  const current = prices[prices.length - 1] || 100;
  const p1d = prices[prices.length - 2] || current;
  const p1w = prices[Math.max(0, prices.length - 6)] || current;
  const p1m = prices[Math.max(0, prices.length - 22)] || current;
  const p3m = prices[Math.max(0, prices.length - 64)] || current;
  const p6m = prices[Math.max(0, prices.length - 127)] || current;

  return {
    d1: Number((((current - p1d) / p1d) * 100).toFixed(2)),
    w1: Number((((current - p1w) / p1w) * 100).toFixed(2)),
    m1: Number((((current - p1m) / p1m) * 100).toFixed(2)),
    m3: Number((((current - p3m) / p3m) * 100).toFixed(2)),
    m6: Number((((current - p6m) / p6m) * 100).toFixed(2)),
  };
}
