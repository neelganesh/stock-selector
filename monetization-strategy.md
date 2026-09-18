# Monetization Strategy — stock-selector

## Current State
- Free tier: 192 stock universe, basic signals, paper trading
- Users: Auth via Supabase (virtual email), username/password
- Integrations: Zerodha Kite (paper trade), MegaBull API keys (per-user)
- Deployed on Vercel Hobby (9/12 serverless functions used)

## Monetization Model Options

### Option 1: Freemium Tiers (RECOMMENDED)
**Free Tier** (current):
- 192 stock universe, basic signals, strategy selector
- 1 portfolio, basic filters
- Paper trading demo

**Pro Tier** ($9-15/month or ₹500-1000/month):
- Full stock universe (NSE + BSE, ~6000 stocks)
- Real-time signals with webpush/email alerts
- Unlimited portfolios, advanced screening
- Strategy backtesting
- MegaBull API integration (per-user config)

**Institutional** ($500+/month):
- White-label
- API access
- Dedicated infrastructure
- Multi-broker support

### Option 2: Usage-Based
- Credits for API calls
- Pay per signal generated
- Good for scaling infrastructure costs

### Option 3: Data/Insights
- Premium research reports
- Strategy performance benchmarks
- Market sentiment overlays

## Implementation Plan (Freemium - Phased)

### Phase 1: Feature Gating (2-3 weeks)
- Add `plan` column to users table (free/pro/institutional)
- Gate advanced features behind plan checks
- Add billing via Stripe (Vercel has Stripe integration)
- Pro features: unlimited universe, real-time signals, alerts

### Phase 2: Payment (1 week)
- Stripe checkout for India + international
- Webhooks for subscription management
- Usage tracking for metering

### Phase 3: Advanced Features (3-4 weeks)
- Backtesting engine (compute-intensive, justifies pricing)
- Portfolio analytics and reporting
- Paper trading integration (MegaBull API keys)
- Webpush notifications for signals

### Phase 4: Enterprise (ongoing)
- White-label/embedded widget
- API access
- Dedicated broker integrations

## Revenue Projections
- 100 free users → 10 Pro ($10/mo) = $100/mo
- 1000 free → 100 Pro = $1000/mo
- 100 institutional pilots = $50K+/mo

## Risks
- Stock market data licensing (Zerodha/Kite terms)
- Regulatory compliance (investment advice disclaimers)
- Need for financial compliance disclaimers on all signals
