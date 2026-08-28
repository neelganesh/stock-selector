import { STOCK_UNIVERSE, getSectorsNavData } from '../universe';
import { calculateEMA, calculateRSI, calculateSuperTrend, calculateVolumeRatio, calculateWagnerPedicelliRelativeStrength, calculateATR, calculateRenkoBricks } from '../indicators';
import { ZerodhaSwingStrategy } from '../strategies/ZerodhaSwingStrategy';
import { MomentumBreakoutStrategy } from '../strategies/MomentumBreakoutStrategy';
import { SuperTrendRiderStrategy } from '../strategies/SuperTrendRiderStrategy';

console.log('=== RUNNING QUANT VISION COMPREHENSIVE SUITE AUDIT ===\n');

let totalPassed = 0;
let totalFailed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    totalPassed++;
  } else {
    totalFailed++;
    console.error(`[FAIL] ${message}`);
  }
}

// 1. Audit Stock Universe Symbols & Price History Integrity
console.log(`1. Auditing Universe Metadata (${STOCK_UNIVERSE.length} stocks)...`);
assert(STOCK_UNIVERSE.length >= 30, 'Universe count should be >= 30');

STOCK_UNIVERSE.forEach((stock) => {
  assert(Boolean(stock.symbol && stock.symbol.trim().length > 0), `Stock has valid symbol`);
  assert(!stock.symbol.includes('&') || stock.symbol === 'LT', `Stock symbol ${stock.symbol} is clean for NSE`);
  assert(stock.prices.length >= 50, `${stock.symbol} has sufficient historical prices (${stock.prices.length})`);
  assert(stock.prices.every((p) => typeof p === 'number' && !isNaN(p) && p > 0), `${stock.symbol} prices are all positive numbers`);
  assert(stock.volumeHistory.every((v) => typeof v === 'number' && !isNaN(v) && v >= 0), `${stock.symbol} volumes are non-negative`);
});

// 2. Audit Technical Indicators Engine
console.log('\n2. Auditing Technical Indicators Engine...');
const testPrices = Array.from({ length: 100 }, (_, i) => 100 + i * 0.5 + Math.sin(i) * 2);
const testSectorNav = Array.from({ length: 100 }, (_, i) => 100 + i * 0.3);

const ema20 = calculateEMA(testPrices, 20);
const ema50 = calculateEMA(testPrices, 50);
const rsi = calculateRSI(testPrices, 14);
const supertrend = calculateSuperTrend(testPrices);
const volRatio = calculateVolumeRatio(Array.from({ length: 100 }, () => 1000000));
const relStrength = calculateWagnerPedicelliRelativeStrength(testPrices, testSectorNav, 30);
const atr = calculateATR(testPrices, 14);
const renko = calculateRenkoBricks(testPrices, atr);

assert(typeof ema20 === 'number' && !isNaN(ema20) && ema20 > 0, 'EMA 20 calculation valid');
assert(typeof ema50 === 'number' && !isNaN(ema50) && ema50 > 0, 'EMA 50 calculation valid');
assert(rsi >= 0 && rsi <= 100, 'RSI strictly between 0 and 100');
assert(supertrend === 'bullish' || supertrend === 'bearish', 'SuperTrend output valid string');
assert(volRatio > 0, 'Volume ratio calculation valid');
assert(typeof relStrength === 'number' && !isNaN(relStrength), 'Relative strength calculation valid');
assert(atr > 0, 'ATR calculation valid');
assert(renko.brickSize > 0 && typeof renko.isAthBreakout === 'boolean', 'Renko calculation valid');

// 3. Audit Sector NAV Aggregation Engine
console.log('\n3. Auditing Sector NAV Engine...');
const sectors = getSectorsNavData();
assert(sectors.length > 0, 'Sector NAV aggregation returns non-empty results');
sectors.forEach((sec) => {
  assert(Boolean(sec.name && sec.universeType), `Sector ${sec.name} has name & universeType`);
  assert(typeof sec.returns.d1 === 'number' && !isNaN(sec.returns.d1), `Sector ${sec.name} 1D return valid`);
  assert(sec.topOutperformingConstituents.length > 0, `Sector ${sec.name} constituents populated`);
});

// 4. Audit Pluggable Strategies Engine & Target/SL Bounding
console.log('\n4. Auditing Pluggable Strategies Output & Price Sensitivity Bounds...');
const strategies = [ZerodhaSwingStrategy, MomentumBreakoutStrategy, SuperTrendRiderStrategy];

strategies.forEach((strat) => {
  console.log(`- Testing Strategy: ${strat.name}`);
  let pickCount = 0;

  STOCK_UNIVERSE.forEach((stock) => {
    const pick = strat.execute(stock);
    if (pick) {
      pickCount++;
      const { entry, stopLoss, target1, target2 } = pick.signalDetails;

      assert(stopLoss < entry, `[${strat.id}] ${stock.symbol}: Stop Loss (${stopLoss}) < Entry (${entry})`);
      assert(entry < target1, `[${strat.id}] ${stock.symbol}: Entry (${entry}) < Target 1 (${target1})`);
      assert(target1 < target2, `[${strat.id}] ${stock.symbol}: Target 1 (${target1}) < Target 2 (${target2})`);
      assert(!isNaN(pick.currentPrice) && pick.currentPrice > 0, `[${strat.id}] ${stock.symbol}: Current Price valid (${pick.currentPrice})`);
      assert(!isNaN(pick.changePercent), `[${strat.id}] ${stock.symbol}: Change % valid`);
    }
  });

  console.log(`  └─ Generated ${pickCount} valid picks out of ${STOCK_UNIVERSE.length} universe stocks`);
});

console.log(`\n=== SUITE AUDIT COMPLETE: ${totalPassed} PASSED, ${totalFailed} FAILED ===\n`);

if (totalFailed > 0) {
  process.exit(1);
}
