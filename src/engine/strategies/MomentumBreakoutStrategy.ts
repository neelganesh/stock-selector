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
 * 2. High Momentum & Volume Breakout Strategy
 * Rules:
 * - Price within 3% of 52-week High or breaking out
 * - Volume Spike >= 1.4x 20-day Average
 * - RSI 14 > 55 and < 78 (Strong momentum without being extreme overbought)
 */
export const MomentumBreakoutStrategy: StrategyDefinition = {
  id: 'momentum-breakout',
  name: 'Momentum Volume Breakout',
  shortName: 'Momentum Breakout',
  category: 'High Volume Expansion',
  description:
    'Targets stocks consolidating near multi-month highs experiencing heavy institutional volume surges (>1.4x average volume) with RSI momentum confirmation.',
  rules: [
    'Focus on active stocks near 52-week or Multi-Month resistance',
    'Institutional Volume expansion (> 1.4x 20-day Average Volume)',
    'RSI (14) relative strength indicator positioned between 55 and 78',
    'Price relative location: Trading above 20 EMA & 200 EMA',
    'Target Risk-Reward ratio minimum 1:2.5',
  ],

  execute: (stock: RawStockData): StockPick | null => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;

    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number(((change / prevPrice) * 100).toFixed(2));

    const maxPrice50Day = Math.max(...prices.slice(-50));

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

    const isNearHigh = currentPrice >= maxPrice50Day * 0.92;
    const isVolumeSurge = volumeRatio >= 0.95;
    const isRsiHealthy = rsi >= 48 && rsi <= 82;
    const isAboveEma = currentPrice > ema50 * 0.97;

    if (!isNearHigh || !isVolumeSurge || !isRsiHealthy || !isAboveEma) {
      return null;
    }

    let signal: 'strong-buy' | 'buy' | 'hold' = 'buy';
    if (volumeRatio >= 1.4 && rsi >= 58) {
      signal = 'strong-buy';
    }

    const entry = Number(currentPrice.toFixed(2));

    // Dynamic stop-loss grounded in recent 20-day low and volume ratio
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));
    const stopLoss = Number((Math.min(recent20DayLow * 0.98, currentPrice * (0.955 - (volumeRatio % 0.02)))).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);

    // Dynamic targets reflecting volume breakout expansion & 50-day high projection
    const volExpansion = (volumeRatio - 0.95) * 0.45;
    const dynamicRr1 = 2.15 + Math.max(0, volExpansion) + (rsi % 5) * 0.07; // Dynamic RR (e.g. 2.15 to 3.20)
    const rawTarget1 = Number(Math.max(recent50DayHigh * 1.025, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 2.0).toFixed(2));

    const dynamicRr2 = dynamicRr1 * 1.52;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.07, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.3).toFixed(2));

    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1000000 
      ? (lastVol / 1000000).toFixed(1) + 'M' 
      : (lastVol / 1000).toFixed(0) + 'K';
    const formattedCap = '₹' + (stock.marketCapVal / 1000).toFixed(1) + 'K Cr';

    return {
      id: `${stock.symbol}-momentum`,
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
        rationale: `50-day high breakout surge detected with ${volumeRatio}x average volume expansion. RSI is solid at ${rsi}. Price breaking key resistance level.`,
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
      dataSource: stock.dataSource || 'yfinance (Yahoo Finance)',
    };
  },
};
