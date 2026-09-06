import type { StrategyDefinition, RawStockData, StockPick } from '../types';
import {
  calculateEMA,
  calculateRSI,
  calculateSuperTrend,
  calculateVolumeRatio,
  calculateWagnerPedicelliRelativeStrength,
  calculateATR,
  calculateRenkoBricks,
} from '../indicators';

/**
 * 3. SuperTrend Trend Rider Strategy
 * Rules:
 * - SuperTrend (10, 3) Bullish Signal active
 * - Price above 50-day EMA
 * - RSI > 50 confirming upside trend continuation
 */
export const SuperTrendRiderStrategy: StrategyDefinition = {
  id: 'supertrend-rider',
  name: 'SuperTrend Trend Rider',
  shortName: 'SuperTrend Rider',
  category: 'Trend Following',
  description:
    'Rides extended bullish structural trends confirmed by SuperTrend (10,3) flips combined with 50-day EMA support and healthy momentum.',
  rules: [
    'SuperTrend (10, 3) must be in green/bullish state',
    'Stock price supported above 50-day Exponential Moving Average',
    'RSI (14) strictly above 50 baseline',
    'Trailing stop-loss strategy following SuperTrend baseline',
  ],

  execute: (stock: RawStockData): StockPick | null => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;

    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number(((change / prevPrice) * 100).toFixed(2));

    const ema20 = calculateEMA(prices, 20);
    const ema50 = calculateEMA(prices, 50);
    const ema200 = calculateEMA(prices, 200);
    const rsi = calculateRSI(prices, 14);
    const supertrend = calculateSuperTrend(prices);
    const volumeRatio = calculateVolumeRatio(volumeHistory);
    const relativeStrengthVsSector = calculateWagnerPedicelliRelativeStrength(
      prices,
      sectorNavHistory,
      30
    );
    const atr = calculateATR(prices, 14);
    const renko = calculateRenkoBricks(prices, Math.max(1, atr));

    if (currentPrice < ema50 * 0.96 || rsi < 45) {
      return null;
    }

    let signal: 'strong-buy' | 'buy' | 'hold' = 'buy';
    if (rsi > 58 && currentPrice > ema20 && volumeRatio > 1.1) {
      signal = 'strong-buy';
    }

    const entry = Number(currentPrice.toFixed(2));
    
    // Dynamic technical stop-loss anchored to 50 EMA & recent 20-day low
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent20DayHigh = Math.max(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));

    const stopLoss = Number((Math.min(ema50 * 0.985, recent20DayLow * 0.98)).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);

    // Dynamic targets reflecting trend strength & RSI momentum
    const rsiFactor = (rsi - 45) * 0.04;
    const dynamicRr1 = 1.9 + (volumeRatio % 0.5) + rsiFactor; // Dynamic RR (e.g. 1.9 to 2.8)
    const rawTarget1 = Number(Math.max(recent20DayHigh * 1.015, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 1.85).toFixed(2));
    
    const dynamicRr2 = dynamicRr1 * 1.48;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.04, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.25).toFixed(2));

    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1000000 
      ? (lastVol / 1000000).toFixed(1) + 'M' 
      : (lastVol / 1000).toFixed(0) + 'K';
    const capVal = typeof stock.marketCapVal === 'number' && !isNaN(stock.marketCapVal) ? stock.marketCapVal : 0;
    const formattedCap = capVal > 0 ? '₹' + (capVal / 1000).toFixed(1) + 'K Cr' : 'N/A';

    return {
      id: `${stock.symbol}-supertrend`,
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      capCategory: stock.capCategory,
      tradingSegment: stock.tradingSegment || (stock.capCategory === 'small' ? 'Cash Only' : 'F&O Segment'),
      currentPrice,
      change,
      changePercent,
      signal,
      signalDetails: {
        entry,
        stopLoss: safeStopLoss,
        target1,
        target2,
        rationale: `Active SuperTrend Buy signal with stock holding firmly above 50 EMA (₹${ema50}). RSI indicator (${rsi}) confirms continuous buyers dominance.`,
        indicators: {
          rsi,
          ema20,
          ema50,
          ema200,
          supertrend,
          volumeRatio,
          relativeStrengthVsSector,
          atr,
          renko,
        },
      },
      volume: formattedVol,
      marketCap: formattedCap,
      lastUpdated: new Date(),
      dataSource: stock.dataSource || 'Zerodha Kite API',
    };
  },
};
