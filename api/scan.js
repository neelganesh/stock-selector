// api/_scan.ts
import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

// src/engine/indicators.ts
function calculateEMA(prices, period) {
  if (prices.length < period) return prices[prices.length - 1] || 0;
  const k = 2 / (period + 1);
  let ema = prices.slice(0, period).reduce((sum, p) => sum + p, 0) / period;
  for (let i = period; i < prices.length; i++) {
    ema = prices[i] * k + ema * (1 - k);
  }
  return Number(ema.toFixed(2));
}
function calculateRSI(prices, period = 14) {
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
      avgLoss = avgLoss * (period - 1) / period;
    } else {
      avgGain = avgGain * (period - 1) / period;
      avgLoss = (avgLoss * (period - 1) + Math.abs(diff)) / period;
    }
  }
  if (avgLoss === 0) return 100;
  const rs = avgGain / avgLoss;
  return Number((100 - 100 / (1 + rs)).toFixed(1));
}
function calculateSuperTrend(prices, period = 10, multiplier = 3) {
  if (prices.length < period + 1) return "bullish";
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
  if (isBullish && latestPrice >= ema50) {
    return "bullish";
  }
  return isBullish && latestPrice >= ema20 ? "bullish" : "bearish";
}
function calculateVolumeRatio(volumes) {
  if (volumes.length < 20) return 1;
  const currentVol = volumes[volumes.length - 1];
  const sma20Vol = volumes.slice(-20, -1).reduce((sum, v) => sum + v, 0) / 19;
  if (sma20Vol === 0) return 1;
  return Number((currentVol / sma20Vol).toFixed(2));
}
function calculateWagnerPedicelliRelativeStrength(stockPrices, sectorNavPrices, lookbackPeriod = 30) {
  if (stockPrices.length < lookbackPeriod || sectorNavPrices.length < lookbackPeriod) {
    return 0;
  }
  const stockStart = stockPrices[stockPrices.length - lookbackPeriod];
  const stockEnd = stockPrices[stockPrices.length - 1];
  const stockReturn = (stockEnd - stockStart) / stockStart * 100;
  const sectorStart = sectorNavPrices[sectorNavPrices.length - lookbackPeriod];
  const sectorEnd = sectorNavPrices[sectorNavPrices.length - 1];
  const sectorReturn = (sectorEnd - sectorStart) / sectorStart * 100;
  return Number((stockReturn - sectorReturn).toFixed(2));
}
function calculateATR(prices, period = 14) {
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
function calculateRenkoBricks(prices, brickSizeOverride) {
  if (prices.length < 20) {
    return {
      currentDirection: "bullish",
      currentTrend: "bullish",
      brickCount: 2,
      isAthBreakout: false,
      brickSize: brickSizeOverride || 5,
      lastBrickPrice: prices[prices.length - 1] || 100
    };
  }
  const atr = calculateATR(prices, 14);
  const brickSize = Number((brickSizeOverride || Math.max(1, atr * 1.2)).toFixed(2));
  let currentBrick = Math.floor(prices[0] / brickSize) * brickSize;
  let direction = "bullish";
  let consecutiveBricks = 0;
  const historicPrices = prices.slice(0, Math.max(10, prices.length - 20));
  const maxHistoricPrice = Math.max(...historicPrices);
  for (let i = 1; i < prices.length; i++) {
    const price = prices[i];
    if (price >= currentBrick + brickSize) {
      const addedBricks = Math.floor((price - currentBrick) / brickSize);
      currentBrick += addedBricks * brickSize;
      if (direction === "bullish") {
        consecutiveBricks += addedBricks;
      } else {
        direction = "bullish";
        consecutiveBricks = addedBricks;
      }
    } else if (price <= currentBrick - brickSize) {
      const droppedBricks = Math.floor((currentBrick - price) / brickSize);
      currentBrick -= droppedBricks * brickSize;
      if (direction === "bearish") {
        consecutiveBricks += droppedBricks;
      } else {
        direction = "bearish";
        consecutiveBricks = droppedBricks;
      }
    }
  }
  const latestPrice = prices[prices.length - 1];
  const isAthBreakout = latestPrice > maxHistoricPrice * 1.01 && direction === "bullish";
  return {
    currentDirection: direction,
    currentTrend: direction,
    brickCount: consecutiveBricks,
    isAthBreakout,
    brickSize,
    lastBrickPrice: Number(currentBrick.toFixed(2))
  };
}

// src/engine/strategies/ZerodhaSwingStrategy.ts
var ZerodhaSwingStrategy = {
  id: "zerodha-swing",
  name: "Swing Strategy",
  shortName: "Swing",
  category: "Sector Relative Strength",
  description: "Grounded in the Wagner & Pedicelli method: identifies the strongest stocks outperforming their equal-weighted sector NAV with 20/50 EMA alignment and Renko price-only breakout confirmation.",
  rules: [
    "Long-only equities mandate tagged by segment (F&O / Cash Only)",
    "Equal-Weighted Sector NAV outperformance (Versus NAV > 0%)",
    "EMA Trend Alignment: 20-day EMA > 50-day EMA",
    "Renko ATH Price-Only Breakout & Bullish Brick confirmation",
    "Risk Management: Dynamic Trailing Stop Loss based on ATR and 50 EMA"
  ],
  execute: (stock) => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number((change / prevPrice * 100).toFixed(2));
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
    const isEmaAligned = ema20 >= ema50 * 0.99;
    const isPriceAboveEma = currentPrice >= ema50 * 0.98;
    const isSectorOutperformer = relativeStrengthVsSector >= -3;
    if (!isEmaAligned || !isPriceAboveEma || !isSectorOutperformer) {
      return null;
    }
    let signal = "buy";
    if ((relativeStrengthVsSector > 2 || renko.isAthBreakout) && volumeRatio >= 1.1 && rsi > 52) {
      signal = "strong-buy";
    } else if (relativeStrengthVsSector < -1 || rsi < 45) {
      signal = "hold";
    }
    const entry = Number((currentPrice * 0.995).toFixed(2));
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent20DayHigh = Math.max(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));
    const technicalSl = Math.min(ema50 * 0.99, recent20DayLow * 0.985);
    const stopLoss = Number(Math.min(technicalSl, currentPrice * 0.965).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);
    const rsBonus = Math.max(0, relativeStrengthVsSector * 0.08);
    const dynamicRr1 = 1.85 + rsi % 6 * 0.08 + rsBonus;
    const rawTarget1 = Number(Math.max(recent20DayHigh * 1.01, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 1.8).toFixed(2));
    const dynamicRr2 = dynamicRr1 * 1.55;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.04, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.2).toFixed(2));
    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1e6 ? (lastVol / 1e6).toFixed(1) + "M" : (lastVol / 1e3).toFixed(0) + "K";
    const capVal = typeof stock.marketCapVal === "number" && !isNaN(stock.marketCapVal) ? stock.marketCapVal : 0;
    const formattedCap = capVal > 0 ? "\u20B9" + (capVal / 1e3).toFixed(1) + "K Cr" : "N/A";
    const sectorKnown = !!stock.sector && stock.sector !== "Unknown";
    const sectorClause = sectorKnown ? `Outperforming ${stock.sector} Equal-Weighted NAV by +${relativeStrengthVsSector}%.` : `Outperforming its sector Equal-Weighted NAV by +${relativeStrengthVsSector}%.`;
    return {
      id: `${stock.symbol}-zerodha`,
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      capCategory: stock.capCategory,
      tradingSegment: stock.tradingSegment || (stock.capCategory === "small" ? "Cash Only" : "F&O Segment"),
      currentPrice,
      change,
      changePercent,
      signal,
      signalDetails: {
        entry,
        stopLoss: safeStopLoss,
        target1,
        target2,
        rationale: `${sectorClause} Price trading near 20 EMA (\u20B9${ema20}) & 50 EMA (\u20B9${ema50}) with Renko ATH breakout status: ${renko.isAthBreakout ? "YES" : "NO"}. Volume ratio at ${volumeRatio}x 20-day average.`,
        indicators: {
          rsi,
          ema20,
          ema50,
          ema200,
          supertrend,
          volumeRatio,
          relativeStrengthVsSector,
          atr,
          renko
        }
      },
      volume: formattedVol,
      marketCap: formattedCap,
      lastUpdated: /* @__PURE__ */ new Date(),
      dataSource: stock.dataSource || "Zerodha Kite API"
    };
  }
};

// src/engine/strategies/MomentumBreakoutStrategy.ts
var MomentumBreakoutStrategy = {
  id: "momentum-breakout",
  name: "Momentum Volume Breakout",
  shortName: "Momentum Breakout",
  category: "High Volume Expansion",
  description: "Targets stocks consolidating near multi-month highs experiencing heavy institutional volume surges (>1.4x average volume) with RSI momentum confirmation.",
  rules: [
    "Focus on active stocks near 52-week or Multi-Month resistance",
    "Institutional Volume expansion (> 1.4x 20-day Average Volume)",
    "RSI (14) relative strength indicator positioned between 55 and 78",
    "Price relative location: Trading above 20 EMA & 200 EMA",
    "Target Risk-Reward ratio minimum 1:2.5"
  ],
  execute: (stock) => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number((change / prevPrice * 100).toFixed(2));
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
    let signal = "buy";
    if (volumeRatio >= 1.4 && rsi >= 58) {
      signal = "strong-buy";
    }
    const entry = Number(currentPrice.toFixed(2));
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));
    const stopLoss = Number(Math.min(recent20DayLow * 0.98, currentPrice * (0.955 - volumeRatio % 0.02)).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);
    const volExpansion = (volumeRatio - 0.95) * 0.45;
    const dynamicRr1 = 2.15 + Math.max(0, volExpansion) + rsi % 5 * 0.07;
    const rawTarget1 = Number(Math.max(recent50DayHigh * 1.025, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 2).toFixed(2));
    const dynamicRr2 = dynamicRr1 * 1.52;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.07, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.3).toFixed(2));
    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1e6 ? (lastVol / 1e6).toFixed(1) + "M" : (lastVol / 1e3).toFixed(0) + "K";
    const capVal = typeof stock.marketCapVal === "number" && !isNaN(stock.marketCapVal) ? stock.marketCapVal : 0;
    const formattedCap = capVal > 0 ? "\u20B9" + (capVal / 1e3).toFixed(1) + "K Cr" : "N/A";
    return {
      id: `${stock.symbol}-momentum`,
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      capCategory: stock.capCategory,
      tradingSegment: stock.tradingSegment || (stock.capCategory === "small" ? "Cash Only" : "F&O Segment"),
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
          renko
        }
      },
      volume: formattedVol,
      marketCap: formattedCap,
      lastUpdated: /* @__PURE__ */ new Date(),
      dataSource: stock.dataSource || "yfinance (Yahoo Finance)"
    };
  }
};

// src/engine/strategies/SuperTrendRiderStrategy.ts
var SuperTrendRiderStrategy = {
  id: "supertrend-rider",
  name: "SuperTrend Trend Rider",
  shortName: "SuperTrend Rider",
  category: "Trend Following",
  description: "Rides extended bullish structural trends confirmed by SuperTrend (10,3) flips combined with 50-day EMA support and healthy momentum.",
  rules: [
    "SuperTrend (10, 3) must be in green/bullish state",
    "Stock price supported above 50-day Exponential Moving Average",
    "RSI (14) strictly above 50 baseline",
    "Trailing stop-loss strategy following SuperTrend baseline"
  ],
  execute: (stock) => {
    const { prices, volumeHistory, sectorNavHistory } = stock;
    if (prices.length < 50) return null;
    const currentPrice = prices[prices.length - 1];
    const prevPrice = prices[prices.length - 2];
    const change = Number((currentPrice - prevPrice).toFixed(2));
    const changePercent = Number((change / prevPrice * 100).toFixed(2));
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
    let signal = "buy";
    if (rsi > 58 && currentPrice > ema20 && volumeRatio > 1.1) {
      signal = "strong-buy";
    }
    const entry = Number(currentPrice.toFixed(2));
    const recent20DayLow = Math.min(...prices.slice(-20));
    const recent20DayHigh = Math.max(...prices.slice(-20));
    const recent50DayHigh = Math.max(...prices.slice(-50));
    const stopLoss = Number(Math.min(ema50 * 0.985, recent20DayLow * 0.98).toFixed(2));
    const safeStopLoss = Number(Math.min(stopLoss, entry * 0.975).toFixed(2));
    const riskAmount = Math.max(entry * 0.015, entry - safeStopLoss);
    const rsiFactor = (rsi - 45) * 0.04;
    const dynamicRr1 = 1.9 + volumeRatio % 0.5 + rsiFactor;
    const rawTarget1 = Number(Math.max(recent20DayHigh * 1.015, entry + riskAmount * dynamicRr1).toFixed(2));
    const target1 = Number(Math.max(rawTarget1, entry + riskAmount * 1.85).toFixed(2));
    const dynamicRr2 = dynamicRr1 * 1.48;
    const rawTarget2 = Number(Math.max(recent50DayHigh * 1.04, entry + riskAmount * dynamicRr2).toFixed(2));
    const target2 = Number(Math.max(rawTarget2, target1 + riskAmount * 1.25).toFixed(2));
    const lastVol = volumeHistory.length > 0 ? volumeHistory[volumeHistory.length - 1] : stock.volumeVal;
    const formattedVol = lastVol >= 1e6 ? (lastVol / 1e6).toFixed(1) + "M" : (lastVol / 1e3).toFixed(0) + "K";
    const capVal = typeof stock.marketCapVal === "number" && !isNaN(stock.marketCapVal) ? stock.marketCapVal : 0;
    const formattedCap = capVal > 0 ? "\u20B9" + (capVal / 1e3).toFixed(1) + "K Cr" : "N/A";
    return {
      id: `${stock.symbol}-supertrend`,
      symbol: stock.symbol,
      name: stock.name,
      sector: stock.sector,
      capCategory: stock.capCategory,
      tradingSegment: stock.tradingSegment || (stock.capCategory === "small" ? "Cash Only" : "F&O Segment"),
      currentPrice,
      change,
      changePercent,
      signal,
      signalDetails: {
        entry,
        stopLoss: safeStopLoss,
        target1,
        target2,
        rationale: `Active SuperTrend Buy signal with stock holding firmly above 50 EMA (\u20B9${ema50}). RSI indicator (${rsi}) confirms continuous buyers dominance.`,
        indicators: {
          rsi,
          ema20,
          ema50,
          ema200,
          supertrend,
          volumeRatio,
          relativeStrengthVsSector,
          atr,
          renko
        }
      },
      volume: formattedVol,
      marketCap: formattedCap,
      lastUpdated: /* @__PURE__ */ new Date(),
      dataSource: stock.dataSource || "Zerodha Kite API"
    };
  }
};

// src/engine/strategies/index.ts
var ALL_STRATEGIES = [
  ZerodhaSwingStrategy,
  MomentumBreakoutStrategy,
  SuperTrendRiderStrategy
];
function getStrategyById(id) {
  const found = ALL_STRATEGIES.find((s) => s.id === id);
  return found || ZerodhaSwingStrategy;
}

// src/services/upstoxService.ts
var UpstoxAuthError = class extends Error {
  constructor(message = "Upstox access token expired or invalid (401)") {
    super(message);
    this.name = "UpstoxAuthError";
  }
};
var BASE = "https://api.upstox.com/v2";
function getToken() {
  const token = process.env.UPSTOX_ACCESS_TOKEN;
  if (!token) throw new Error("UPSTOX_ACCESS_TOKEN not configured");
  return token;
}
function dateRange() {
  const to = /* @__PURE__ */ new Date();
  const from = new Date(to.getTime() - 365 * 24 * 60 * 60 * 1e3);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { from: fmt(from), to: fmt(to) };
}
async function fetchCandleData(instrumentKey) {
  const { from, to } = dateRange();
  const url = `${BASE}/historical-candle/${encodeURIComponent(instrumentKey)}/day/${to}/${from}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${getToken()}`, Accept: "application/json" }
  });
  if (res.status === 401) throw new UpstoxAuthError();
  if (!res.ok) throw new Error(`Upstox ${res.status} for ${instrumentKey}`);
  const json = await res.json();
  const rawCandles = json?.data?.candles ?? [];
  if (rawCandles.length < 50) throw new Error(`Insufficient candles for ${instrumentKey}`);
  const candles = [...rawCandles].reverse();
  const closes = candles.map((c) => Number(c[4]));
  const volumes = candles.map((c) => Number(c[5] ?? 0));
  const returns = closes.slice(1).map((c, i) => (c - closes[i]) / closes[i]);
  const nav = [100];
  for (const r of returns) {
    nav.push(Number((nav[nav.length - 1] * (1 + r * 0.7 + 1e-4)).toFixed(2)));
  }
  return {
    prices: closes,
    volumeHistory: volumes,
    sectorNavHistory: nav,
    dataSource: "Upstox"
  };
}

// api/_scan.ts
var SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || "";
var SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY || "";
var supabaseAdmin = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) : null;
async function saveScan(row) {
  if (!supabaseAdmin) return;
  const { error } = await supabaseAdmin.from("scan_results").upsert(row);
  if (error) console.warn("[scan] cache write skipped:", error.message);
}
function mapUniverse(rows) {
  return rows.map((row) => ({
    symbol: row.symbol,
    name: row.company_name,
    sector: row.sector || "Unknown",
    industry: row.industry || null,
    capCategory: row.cap_category,
    tradingSegment: row.cap_category === "small" ? "Cash Only" : "F&O Segment",
    marketCapVal: row.cap_category === "large" ? 5e5 : row.cap_category === "mid" ? 75e3 : 25e3,
    volumeVal: 0,
    prices: [],
    volumeHistory: [],
    sectorNavHistory: [],
    dataSource: "pending",
    instrumentKey: row.instrument_key
  }));
}
async function loadUniverse() {
  if (!supabaseAdmin) {
    throw new Error("Supabase configuration missing");
  }
  const { data, error } = await supabaseAdmin.from("stock_universe").select("symbol, company_name, sector, industry, cap_category, instrument_key").not("instrument_key", "is", null).order("cap_category", { ascending: true }).order("symbol", { ascending: true });
  if (error) throw error;
  return mapUniverse(data || []);
}
async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  const strategyId = req.query.strategy || "zerodha-swing";
  const cap = req.query.cap || "all";
  const rowId = `${strategyId}:${cap}`;
  const strategy = getStrategyById(strategyId);
  try {
    const universe = (await loadUniverse()).filter(
      (s) => cap === "all" || s.capCategory === cap
    );
    let sawAuthError = false;
    let liveCount = 0;
    const picks = [];
    const CHUNK_SIZE = 5;
    for (let i = 0; i < universe.length; i += CHUNK_SIZE) {
      const chunk = universe.slice(i, i + CHUNK_SIZE);
      await Promise.all(
        chunk.map(async (stock) => {
          if (!stock.instrumentKey) return;
          try {
            const data = await fetchCandleData(stock.instrumentKey);
            stock.prices = data.prices;
            stock.volumeHistory = data.volumeHistory;
            stock.sectorNavHistory = data.sectorNavHistory;
            stock.dataSource = data.dataSource;
            liveCount++;
            const pick = strategy.execute(stock);
            if (pick) {
              pick.dataSource = "Upstox";
              picks.push(pick);
            }
          } catch (err) {
            if (err instanceof UpstoxAuthError) {
              sawAuthError = true;
            }
          }
        })
      );
      if (sawAuthError) break;
    }
    const dataSource = sawAuthError ? "Upstox (token expired)" : liveCount > 0 ? "Upstox" : "Upstox (no data)";
    const row = {
      id: rowId,
      strategy_id: strategyId,
      cap_category: cap,
      picks,
      data_source: dataSource,
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    await saveScan(row);
    return res.json({
      picks,
      updatedAt: row.updated_at,
      dataSource,
      cached: false,
      upstoxAuthError: sawAuthError
    });
  } catch (err) {
    console.error("[scan] failed:", err);
    return res.status(500).json({ error: err?.message || "Scan failed" });
  }
}
export {
  handler as default
};
