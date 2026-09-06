# Stock Selector — Design

> **Status:** Post-Phase 3 (Tasks 3.1–3.5 done). All five primary tabs (Signals, Sectors, Trades, P&L, Settings) are wired against live APIs.

## What it is

A swing-trading selector for Indian equities. Scans a curated NSE universe
(Large/Mid/Small caps) using technical + relative-strength rules, then lets
the user execute paper trades or live Kite orders with auto-placed GTT OCOs.

## Architecture at a glance

```
┌────────────────────────────────────────────────────────────────────┐
│  Browser (Vite 8.2 + React 19 + TS 6 + Tailwind 4 + Framer Motion) │
│  ├─ pages          : App (single-page, tabbed: signals/sectors/    │
│  │                   trades/pnl/settings)                          │
│  ├─ contexts       : StrategyContext, AuthProvider, ToastProvider  │
│  ├─ auth-aware     : src/lib/authFetch.ts (Bearer injection)       │
│  └─ scanners       : src/engine/scannerEngine.ts (parallel)         │
└─────────────┬──────────────────────────────────────────────────────┘
              │ HTTPS (Bearer JWT from Supabase)
              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Vercel Serverless (8 functions, Hobby 12-cap)                     │
│                                                                     │
│  /api/kite/[action].ts       → auth | token | orders | gtt |        │
│                                 margins | portfolio                 │
│  /api/kite/token.ts          → OAuth callback (own auth model)     │
│  /api/kite/_client.js        → requireAuth + kiteRequest helpers   │
│  /api/executions/*           → strategy_executions CRUD + cashflows│
│  /api/paper-positions/*      → paper_positions CRUD                │
│  /api/capital                → live margin + deployed capital      │
│  /api/settings               → user_profiles PATCH / reset         │
│  /api/admin/refresh-universe → CRON_SECRET-gated NSE CSV upsert    │
│  /api/reconcile-orders       → order-book sync (stub)              │
└─────────────┬──────────────────────────────────────────────────────┘
              │ Service-role for admin / user JWT for the rest
              ▼
┌────────────────────────────────────────────────────────────────────┐
│  Supabase (PostgreSQL + Auth + RLS)                                 │
│  user_profiles        — capital, risk limits, Zerodha creds        │
│  strategy_executions  — status ∈ {pending, entry_placed,           │
│                       entry_filled, gtt_placed, target1_hit,        │
│                       target2_hit, stop_loss_hit, manually_exited, │
│                       cancelled, rejected}                         │
│  paper_positions      — status ∈ {pending, entry_filled,            │
│                       target1_hit, target2_hit, stop_loss_hit,      │
│                       manually_exited, cancelled, rejected}        │
│  trade_cash_flows     — entry/exit/charge/dividend for XIRR        │
│  capital_snapshots    — daily portfolio state                      │
│  stock_universe       — NSE large/mid/small, refreshed via CSV     │
└────────────────────────────────────────────────────────────────────┘
              │
              ▼
        Zerodha Kite Connect v3  (orders, GTT, margins, portfolio)
        yfinance (8 fallbacks)   (when Kite token absent)
```

## Key design decisions

### 1. `authFetch` is the only sanctioned way to call `/api/*` from the client

`src/lib/authFetch.ts` wraps `fetch` and auto-injects
`Authorization: Bearer <supabase_access_token>`. Throws on 401 so callers can react.

```ts
// Correct
const data = await authFetchJSON<Exec[]>('/api/executions');

// Wrong — 401 regression, will silently break
fetch('/api/executions', { headers: { Authorization: ... } });
```

Phase 3 audit fixed three raw `fetch` calls in `src/App.tsx`
(`/api/paper-positions` POST, capital useEffect GET, manual settings call —
last is already via `Bearer ${token}` in `SettingsPage` so left alone).

### 2. 6 Kite endpoints → 1 dynamic route

Vercel's Hobby plan caps serverless functions at 12. We used 11 before
consolidation, which meant every new endpoint forced a deletion. Folding
`auth | token | orders | gtt | margins | portfolio` into
`api/kite/[action].ts` brings the total to 8 and removes that constraint.

`token.ts` stays separate because its auth model is different (raw JWT
exchange, not the Supabase-Bearer `requireAuth` pattern).

### 3. `stock_universe` is DB-driven, not hardcoded

`src/engine/universe.ts` reads from Supabase at scan time. The frontend
`Settings → Stock Universe` section surfaces live counts and lets a user
paste a `CRON_SECRET` to trigger a refresh — no schema migration, no admin
role; the existing `api/admin/refresh-universe` endpoint validates the
token against the env var and upserts NSE CSVs.

### 4. Status enums are the single source of truth

`strategy_executions.status` and `paper_positions.status` use canonical
enums. Filters in `ExecutionTracker` must match them. (`pending_entry` and
`partial_exit` were stale names from an earlier schema — Phase 3.4 fixed
the open-status filter to use the canonical set.)

### 5. Mobile = responsive desktop, not a separate UI

Phase 2 deleted the redundant `Mobile*` wrappers and replaced them with
responsive Tailwind classes + a 1023px breakpoint via `useIsMobile`. The
mobile bottom-nav (`MobileNav`) is the only mobile-specific UI element.

### 6. Toast system: state + context + provider

- `useToasts()` — raw state hook
- `useToast()` — context-wrapped shorthand returning `{ success, error, info, warning }`
- `<ToastProvider>` — wraps the app
- `<ToastContainer>` — renders top-right on desktop, bottom-center on mobile

`useToast` is the only toast hook components should import. Phase 3 added
toast feedback to the manual "Rescan Strategy" and "Run Parallel Scan"
buttons via a `runScanWithToast()` wrapper; auto-scans stay silent.

### 7. Settings save is optimistic with rollback

`SettingsPage.handleSave` snapshots `previousSettings`, applies the new
draft immediately, then on error reverts to `previousSettings` so the form
returns to a known-good state. Success path commits the server response.

### 8. Live trading is a 3-step chain

`App.handleExecute` for non-paper trades:

1. `POST /api/executions` — creates `strategy_executions` row with `status='pending'`
2. `POST /api/kite/orders` — places a LIMIT entry order (tagged with strategy id)
3. `POST /api/kite/gtt` — places a 2-leg OCO GTT: target1 LIMIT SELL + stopLoss SL-M SELL

Each step uses `authFetch` so the Supabase Bearer is auto-injected; each step
toasts on completion; any step's failure throws and aborts the chain.

### 9. Test discipline: vitest + RTL + MSW

- `vitest.config.mjs` uses `esbuild: { jsx: 'automatic' }` so `React` doesn't
  need an explicit import in test files
- 188 tests across 19 files (as of Phase 3 close)
- One new test file per task that adds a new component/contract:
  - `StockUniverseSettings.test.tsx` — 6 tests for Task 1.5
  - All fetch-mock tests use a `mockImplementation(async (url: string) => ...)`
    pattern so different paths can return different responses

## What we deliberately do NOT do

- **No Tailwind plugin chain.** Just classes. The `vision-glass` look is
  hand-rolled backdrop-blur with the design tokens in `src/index.css`.
- **No global state library.** React context is enough; Redux/Zustand would
  add a dep without solving a current problem.
- **No websocket / SSE.** 30s polling in `ExecutionTracker` is the right
  tradeoff for a single-user trading app. Kite webhooks are a future hook.
- **No service-role access from the client.** The only service-role call is
  `api/admin/refresh-universe`; everything else uses the user's RLS-scoped
  Supabase client.
- **No `any` in app code.** Audit found a couple of `as any` / `any` types
  in `ExecutionTracker` for the paper-position merge; the canonical types
  are in `src/lib/supabase.ts` and should be the source of truth.

## File layout (post-Phase 3)

```
api/
  kite/                       # [action].ts + _client.js + token.ts
  executions/                 # index.ts, [id].ts, cashflows.ts
  paper-positions/            # index.ts, [id].ts
  capital/index.ts
  settings/index.ts
  admin/refresh-universe.ts
  reconcile-orders/index.ts

src/
  components/                 # 30+ components; primitives: GlassCard, AnimatedNumber,
                              # Pagination, Toast*. Mobile layout: MobileNav, MobileSidebarDrawer.
  context/StrategyContext.tsx # picks, isScanning, progress, runScan
  engine/                     # scannerEngine, indicators, universe (DB-driven), types
  hooks/useTheme.ts           # system/light/dark + localStorage
  lib/
    authFetch.ts              # the only sanctioned way to call /api/*
    supabase.ts               # client + canonical types
  services/
    universeService.ts        # getUniverse / refreshUniverse / getUniverseCounts
    kiteService.ts            # localStorage cache helpers

supabase/
  migrations/                 # schema-as-code
  config.toml
supabase-schema.sql           # canonical schema dump
vercel.json                   # rewrite rules for /api/yahoo* → query1.finance.yahoo.com
vitest.config.mjs             # esbuild jsx: 'automatic'
```
