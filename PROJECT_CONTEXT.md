# Stock Selector - Project Context & Implementation Plan

## Project Overview
**Zerodha Swing Strategy Selector** - A full-stack trading platform with strategy scanning, automated execution, position tracking, and P&L analytics.

**Tech Stack:**
- Frontend: Vite 8.2.2 + React 19 + TypeScript 6 + Tailwind CSS 4 + Framer Motion
- Deployment: Vercel (static + serverless functions)
- Database: Supabase (PostgreSQL) with Row Level Security
- Auth: Supabase Auth (user accounts) + Zerodha Connect OAuth (trading credentials)
- Market Data: yfinanceService with Vercel rewrites + 6 fallback proxies
- Trading API: Zerodha Kite Connect v3

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        VERCEL DEPLOYMENT                        │
├─────────────────────────────────────────────────────────────────┤
│  Frontend (Static)          │  Serverless Functions (/api/*)    │
│  ─────────────────          │  ─────────────────────────────    │
│  • React App                │  • /api/kite/* - Kite API proxy   │
│  • Components               │  • /api/executions/* - Execution  │
│  • Context/State            │    CRUD + cash flows              │
│  • Hooks                    │  • /api/capital - Capital status  │
│  • Services                 │  • /api/yahoo* - Yahoo Finance    │
└─────────────────────────────┴───────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      EXTERNAL SERVICES                          │
├─────────────────────────────────────────────────────────────────┤
│  Supabase (PostgreSQL + Auth)    │  Zerodha Kite Connect API   │
│  ─────────────────────────────   │  ─────────────────────────   │
│  • user_profiles                 │  • Orders / GTT / Margins    │
│  • strategy_executions           │  • Portfolio / Profile       │
│  • trade_cash_flows              │  • OAuth Token Exchange      │
│  • capital_snapshots             │  • Historical Data           │
└──────────────────────────────────┴──────────────────────────────┘
```

---

## Implemented Features (✅ Complete)

### 1. Strategy Scanner & Signal Generation
- **Multi-cap parallel scanning** (Large/Mid/Small cap)
- **Wagner & Pedicelli Relative Strength Engine**
- **Strategies**: Pullback, Breakout, Momentum, Mean Reversion, Trend Following
- **Real-time Yahoo Finance data** with 8 fallback endpoints
- **Sector Strength Explorer** - Equal-weighted NAV heatmap

### 2. Deployment & Infrastructure
- ✅ Vercel deployment with live pricing (vercel.json rewrites)
- ✅ Git repos: `neelganesh/stock-selector` + `neelganesh/stock-selector-deploy`
- ✅ TypeScript build passing (488 modules, ~1.8s)
- ✅ Environment variables configured

### 3. Supabase Database Schema
```sql
-- 4 Tables with RLS Policies
user_profiles          -- Capital config, risk limits, Zerodha creds, paper trading
strategy_executions    -- Trade tracking with status enum
trade_cash_flows       -- XIRR calculation (entry/exit/charge/dividend)
capital_snapshots      -- Daily portfolio snapshots
```
- Helper functions: `get_user_capital_status()`, `updated_at` triggers
- Indexes on user_id, status, symbol, date

### 4. Vercel Serverless Functions (Kite API Proxy)
```
/api/kite/auth.ts      - User profile
/api/kite/token.ts     - OAuth token exchange
/api/kite/orders.ts    - Place/modify/cancel orders
/api/kite/gtt.ts       - GTT OCO (entry + SL + target)
/api/kite/margins.ts   - Live margins
/api/kite/portfolio.ts - Holdings & positions
/api/executions/index.ts     - CRUD strategy executions
/api/executions/[id].ts      - Single execution + status updates
/api/executions/cashflows.ts - Cash flows for XIRR
/api/capital/index.ts  - Capital status with live margins
```

### 5. Frontend Components

| Component | Purpose |
|-----------|---------|
| `Sidebar` | Strategy selection, cap category, scan trigger |
| `StockCard` | Signal display with execute button |
| `SectorStrengthExplorer` | Equal-weighted sector NAV heatmap |
| `CapitalBar` | Top-right budget: total/available/deployed, risk%, margins |
| `ExecuteModal` | Risk slider (0.5-5%), position sizing, charges breakdown, GTT OCO |
| `ExecutionTracker` | Execution list with filter tabs, action buttons (T1/T2/SL/Exit) |
| `PnLAnalytics` | **NEW** - CAGR, XIRR, summary cards, executions table |
| `AuthProvider` / `AuthPage` | Supabase Auth (email/password) |
| `ZerodhaLoginModal` | Kite Connect OAuth flow |
| `PositionSizingModal` | Risk calculator (fixed) |
| `CustomScripModal` | Import scrip.txt watchlist |

### 6. Authentication & User Management
- Supabase Auth (signup/login/logout)
- User profiles with capital & risk configuration
- Zerodha Connect OAuth with backend token exchange
- Auto-detect `request_token` from redirect URL
- Paper trading flag in profile

### 7. P&L Analytics (Latest)
- **XIRR**: Newton-Raphson implementation (handles irregular cash flows)
- **CAGR**: Compound Annual Growth Rate (weighted by capital)
- **Summary Cards**: Invested, Current Value, P&L, Charges
- **Advanced Metrics**: XIRR & CAGR with color coding
- **Breakdown**: Realized/Unrealized/Charges/Net
- **Executions Table**: Per-trade XIRR, P&L%, status

---

## Remaining Work (🔄 In Progress / ⏳ Planned)

### 8. Paper Trading Mode
- [ ] Add `paper_trading_enabled` toggle to user_profiles
- [ ] Virtual capital tracking (separate from live)
- [ ] Modify ExecuteModal for simulated orders
- [ ] Paper trading indicator in CapitalBar
- [ ] Separate P&L tracking for paper vs live

### 9. Order Book Sync & GTT Monitor
- [ ] 30s polling service: `/api/kite/orders` + `/api/kite/portfolio`
- [ ] Auto-update execution statuses (entry_filled, target1_hit, etc.)
- [ ] GTT Monitor component: active GTTs with trigger prices, expiry
- [ ] Webhook support for real-time updates (future)

### 10. Settings Page
- [ ] Total capital configuration
- [ ] Risk per trade % (default 1%)
- [ ] Max position % (default 10%)
- [ ] Max sector % (default 25%)
- [ ] Max open strategies (default 10)
- [ ] Daily loss limit % (default 3%)
- [ ] Paper trading toggle + virtual capital amount
- [ ] Zerodha API key management

### 11. Risk Management & Bank-Grade Features
- [ ] Pre-trade risk checks (capital, sector, position limits)
- [ ] Daily loss limit enforcement
- [ ] Trade journal (notes, tags, screenshots)
- [ ] Order book sync with reconciliation
- [ ] GTT expiry monitoring & alerts
- [ ] Audit trail for all mutations

### 12. Advanced Analytics
- [ ] Portfolio-level XIRR/CAGR in dashboard header
- [ ] Monthly/quarterly performance attribution
- [ ] Sector/strategy performance breakdown
- [ ] Drawdown analysis
- [ ] Win rate, profit factor, expectancy
- [ ] Export to CSV/Excel

### 13. UI/UX Polish
- [ ] Dark mode support
- [ ] Mobile responsive improvements
- [ ] Keyboard shortcuts
- [ ] Toast notifications for async actions
- [ ] Loading skeletons for all async components
- [ ] Error boundaries

---

## Key Implementation Details

### State Management
- **StrategyContext** (`src/context/StrategyContext.tsx`): Scanner state, picks, filters, Zerodha connection
- **AuthContext** (`src/components/AuthProvider.tsx`): User, profile, auth methods
- **Local state**: Modals, selected stocks, active tabs

### Data Flow for Live Pricing
```
StockCard → yfinanceService.ts → candidateUrls[] (priority order)
  1. /api/yahoo1/* (Vercel rewrite → query1.finance.yahoo.com)
  2. /api/yahoo2/* (Vercel rewrite → query2.finance.yahoo.com)
  3. corsproxy.io
  4. r.jina.ai
  5. allorigins.win
  6. textise.net
  7. Direct Yahoo query1
  8. Direct Yahoo query2
→ 6s timeout per endpoint → first success wins
```

### GTT OCO Pattern (Bracket Order Replacement)
Since BO is deprecated, use **two-leg GTT**:
```typescript
// Upper leg: Target (limit order)
{ trigger_value: target1, limit_price: target1, quantity: qty }

// Lower leg: Stop Loss (SL-M order)
{ trigger_value: stop_loss, limit_price: stop_loss, quantity: qty }
```

### Charges Calculation (ExecuteModal)
```typescript
brokerage: Math.min(20, turnover * 0.0003)
stt: turnover * 0.001 (sell side only)
exchange: turnover * 0.0000345
sebi: turnover * 0.000001
gst: (brokerage + exchange + sebi) * 0.18
stamp: buy_turnover * 0.00015
```

### XIRR Algorithm (Newton-Raphson)
```typescript
// Iteratively solve: Σ(amount_i / (1+r)^years_i) = 0
// Max 100 iterations, tolerance 1e-8
// Handles: entry (outflow), exits (inflow), charges (outflow)
```

---

## File Structure (Key Files)

```
stock-selector/
├── api/
│   ├── kite/           # Kite API proxy endpoints
│   ├── executions/     # Execution CRUD + cashflows
│   └── capital/        # Capital status
├── src/
│   ├── components/     # All React components
│   ├── context/        # StrategyContext, AuthProvider
│   ├── data/           # strategies.ts (strategy definitions)
│   ├── engine/         # universe.ts, types.ts, scanner
│   ├── hooks/          # useRateLimitedFetch
│   ├── lib/            # supabase.ts (client + types)
│   ├── services/       # yfinanceService.ts
│   ├── utils/          # analytics.ts (XIRR/CAGR)
│   ├── App.tsx         # Main dashboard
│   └── main.tsx        # Entry point
├── supabase-schema.sql # Complete DB schema
├── vercel.json         # Rewrite rules for Yahoo Finance
└── PROJECT_CONTEXT.md  # This file
```

---

## Environment Variables Required

```env
# Vercel / Production
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ZERODHA_API_KEY=
ZERODHA_API_SECRET=
ZERODHA_REDIRECT_URI=

# Local Development (.env.local)
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

---

## Testing Checklist for New Features

- [ ] `npm run build` passes (TypeScript + Vite)
- [ ] `npm run lint` passes (if configured)
- [ ] Manual test: Scanner → Signal → Execute → Track → Analytics
- [ ] Verify Supabase RLS policies work (user isolation)
- [ ] Test Zerodha OAuth flow end-to-end
- [ ] Verify GTT OCO placement (two-leg)
- [ ] Check CapitalBar updates with live margins
- [ ] Validate XIRR/CAGR calculations with known test cases

---

## Agent Handoff Notes

**For future agents working on this codebase:**

1. **Start here**: Read `PROJECT_CONTEXT.md` (this file) + `supabase-schema.sql`
2. **Key entry points**: `src/App.tsx` (dashboard), `src/context/StrategyContext.tsx` (scanner state)
3. **API pattern**: All Kite calls go through `/api/kite/*` serverless functions with `requireAuth()`
4. **Database**: Use `userSupabase` from `requireAuth()` for RLS-enforced queries
5. **TypeScript**: Strict mode enabled. Use types from `src/lib/supabase.ts`
6. **Styling**: Tailwind CSS 4 + custom `vision-glass` utility class
7. **Animations**: Framer Motion for modals, transitions, AnimatedNumber
8. **Date handling**: ISO strings throughout, convert to Date for calculations
9. **Error handling**: Try/catch with user-friendly toasts, console.error for debugging

**Common pitfalls to avoid:**
- Don't call Kite API directly from frontend (CORS, credential exposure)
- Don't forget `user_id` in all Supabase inserts (RLS requires it)
- Don't use `capital_allocated` column (doesn't exist - compute from `entry_price * quantity`)
- Don't forget `format` prop on `AnimatedNumber` (not `formatter`)
- Vercel static hosting needs explicit rewrites for external API proxying

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 0.1.0 | 2025-01 | Initial scanner UI, Vercel deployment |
| 0.2.0 | 2025-02 | Live pricing fix (vercel.json rewrites) |
| 0.3.0 | 2025-03 | Supabase schema, Kite API proxy, Auth |
| 0.4.0 | 2025-04 | CapitalBar, ExecuteModal, ExecutionTracker |
| 0.5.0 | 2025-08 | **P&L Analytics: CAGR + XIRR** |
| 0.6.0 | TBD | Paper Trading, Order Sync, Settings |

---

*Last Updated: 2026-08-31*
*Generated for agent context persistence*