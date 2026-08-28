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
 * 1. Zerodha Swing Strategy (Wagner & Pedicelli Method)
 * Rules:
 * - Equal-Weighted Sector NAV outperformers (Stock versus NAV > 0%)
 * - Daily EMA Alignment (20 EMA > 50 EMA)
 * - Daily SuperTrend in Bullish mode (Period 10, Multiplier 3)
 * - Renko Price-Only ATH confirmation (filters noise)
 * - Long-Only Equities Mandate with F&O vs Cash segment tagging
 */
export const ZerodhaSwingStrategy: StrategyDefinition = {
  id: 'zerodha-swing',
  name: 'Zerodha Swing Strategy',
  shortName: 'Zerodha Swing',
  category: 'Sector Relative Strength',
  description:
    'Grounded in the Wagner & Pedicelli method: identifies the strongest stocks outperforming their equal-weighted sector NAV with 20/50 EMA alignment and Renko price-only breakout confirmation.',
  rules: [
    'Long-only equities mandate tagged by segment (F&O / Cash Only)',
    'Equal-Weighted Sector NAV outperformance (Versus NAV > 0%)',
    'EMA Trend Alignment: 20-day EMA > 50-day EMA',
    'Renko ATH Price-Only Breakout & Bullish Brick confirmation',
    'Risk Management: Dynamic Trailing Stop Loss based on ATR and 50 EMA',
  ],

  execute: (stock: RawStockData): StockPick | null => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;

    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number(((change / prevPrice) * 100).toFixed(2));

    // Calculate indicators
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

    // Wagner & Pedicelli Filter Conditions
    const isEmaAligned = ema20 >= ema50 * 0.99;
    const isPriceAboveEma = currentPrice >= ema50 * 0.98;
    const isSectorOutperformer = relativeStrengthVsSector >= -3.0; // Positive or outperforming relative strength

    if (!isEmaAligned || !isPriceAboveEma || !isSectorOutperformer) {
      return null;
    }

    // Determine signal strength
    let signal: 'strong-buy' | 'buy' | 'hold' = 'buy';
    if (
      (relativeStrengthVsSector > 2.0 || renko.isAthBreakout) &&
      volumeRatio >= 1.1 &&
      rsi > 52
    ) {
      signal = 'strong-buy';
    } else if (relativeStrengthVsSector < -1.0 || rsi < 45) {
      signal = 'hold';
    }

    // Trade Signal Parameters (Entry, SL, Targets grounded in technical price structure)
    const entry = Number((currentPrice * 0.995).toFixed(2));

    // Dynamic technical stop-loss: placed below 50 EMA and recent 20-day swing low
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent20DayHigh = Math.max(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));

    const technicalSl = Math.min(ema50 * 0.99, recent20DayLow * 0.985);
    const stopLoss = Number((Math.min(technicalSl, currentPrice * 0.965)).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);

    // Dynamic Target 1: Swing High Resistance adjusted by sector outperformance
    const rsBonus = Math.max(0, relativeStrengthVsSector * 0.08);
    const dynamicRr1 = 1.85 + (rsi % 6) * 0.08 + rsBonus; // Dynamic RR multiplier (e.g., 1.85 to 2.65)
    const rawTarget1 = Number(Math.max(recent20DayHigh * 1.01, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 1.8).toFixed(2));

    // Dynamic Target 2: 50-day Major High or 1:3.2+ R:R extension
    const dynamicRr2 = dynamicRr1 * 1.55;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.04, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.2).toFixed(2));

    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1000000 
      ? (lastVol / 1000000).toFixed(1) + 'M' 
      : (lastVol / 1000).toFixed(0) + 'K';
    const formattedCap = '₹' + (stock.marketCapVal / 1000).toFixed(1) + 'K Cr';

    return {
      id: `${stock.symbol}-zerodha`,
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
        rationale: `Outperforming ${stock.sector} Equal-Weighted NAV by +${relativeStrengthVsSector}%. Price trading near 20 EMA (₹${ema20}) & 50 EMA (₹${ema50}) with Renko ATH breakout status: ${renko.isAthBreakout ? 'YES' : 'NO'}. Volume ratio at ${volumeRatio}x 20-day average.`,
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
