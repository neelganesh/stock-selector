export type SignalType = 'strong-buy' | 'buy' | 'hold' | 'sell' | 'strong-sell';

export interface StockSignal {
  entry: number;
  stopLoss: number;
  target1: number;
  target2?: number;
  rationale: string;
}

export interface StockPick {
  id: string;
  symbol: string;
  name: string;
  currentPrice: number;
  change: number;
  changePercent: number;
  signal: SignalType;
  signalDetails: StockSignal;
  volume?: string;
  marketCap?: string;
  lastUpdated: Date;
}

export interface Strategy {
  id: string;
  name: string;
  description: string;
  picks: StockPick[];
  lastRun: Date;
  status: 'active' | 'paused' | 'error';
}

// Mock data for Zerodha Swing Strategy placeholder
export const mockStrategies: Strategy[] = [
  {
    id: 'zerodha-swing',
    name: 'Zerodha Swing Strategy',
    description: 'Swing trading signals based on technical analysis and momentum indicators. Identifies potential breakouts and trend continuations.',
    status: 'active',
    lastRun: new Date(),
    picks: [
      {
        id: 'reliance-1',
        symbol: 'RELIANCE',
        name: 'Reliance Industries Ltd.',
        currentPrice: 2456.85,
        change: 32.40,
        changePercent: 1.34,
        signal: 'strong-buy',
        signalDetails: {
          entry: 2440,
          stopLoss: 2380,
          target1: 2520,
          target2: 2580,
          rationale: 'Bullish breakout above resistance on high volume. RSI showing strength at 62. MACD crossover confirmed. Strong support at 2420.',
        },
        volume: '8.2M',
        marketCap: '₹16.5L Cr',
        lastUpdated: new Date(),
      },
      {
        id: 'tatasteel-1',
        symbol: 'TATASTEEL',
        name: 'Tata Steel Ltd.',
        currentPrice: 142.35,
        change: -1.20,
        changePercent: -0.84,
        signal: 'buy',
        signalDetails: {
          entry: 140,
          stopLoss: 134,
          target1: 155,
          rationale: 'Pullback to 50-day EMA support. Commodity cycle showing signs of recovery. Risk-reward favorable at current levels.',
        },
        volume: '15.4M',
        marketCap: '₹1.75L Cr',
        lastUpdated: new Date(),
      },
      {
        id: 'hdfc-1',
        symbol: 'HDFC',
        name: 'HDFC Bank Ltd.',
        currentPrice: 1678.90,
        change: 18.55,
        changePercent: 1.12,
        signal: 'buy',
        signalDetails: {
          entry: 1660,
          stopLoss: 1610,
          target1: 1740,
          target2: 1780,
          rationale: 'Consolidation breakout pattern. Strong fundamental support. Banking sector showing relative strength.',
        },
        volume: '6.8M',
        marketCap: '₹12.8L Cr',
        lastUpdated: new Date(),
      },
      {
        id: 'infy-1',
        symbol: 'INFY',
        name: 'Infosys Ltd.',
        currentPrice: 1456.20,
        change: -8.30,
        changePercent: -0.57,
        signal: 'hold',
        signalDetails: {
          entry: 1450,
          stopLoss: 1400,
          target1: 1520,
          rationale: 'Consolidating in a narrow range. Wait for directional confirmation. IT sector facing headwinds from weak guidance.',
        },
        volume: '4.2M',
        marketCap: '₹6.1L Cr',
        lastUpdated: new Date(),
      },
    ],
  },
];
