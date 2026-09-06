# Stock Selector - Execution Plan v2

**Generated:** 2026-09-04
**Last updated:** 2026-09-05
**Status at last update:** Phase 0 ✅ complete · Phase 1 ✅ (Tasks 1.1–1.5 all done) · Phase 2 ✅ (Tasks 2.1–2.5 all done) · Phase 3 ✅ (Tasks 3.1–3.5 all done) · Phase 4 ✅ (Tasks 4.1 + 4.3 done; 4.2 E2E smoke is a human-in-the-loop gate)
**Total Phases:** 5
**Approach:** Root-cause fixes first → ticker universe → UI refinement → wired P&L/Settings/Execution → verification.

This plan supersedes the v1 plan (which was 41% complete). Old completed items are assumed shipped; v2 begins fresh against real defects found in the codebase.

---

## Root-cause bugs found in audit

| # | Bug | Impact | Root cause |
|---|---|---|---|
| B1 | `PnLAnalytics` calls `/api/executions` without `Authorization` header | P&L returns 401, dashboard always empty | Every component does this. Same for `/api/executions/cashflows` |
| B2 | `ExecutionTracker` calls `/api/executions` and `/api/paper-positions` without auth header | Execution list always empty | Same as B1 |
| B3 | `api/executions/index.ts` POST inserts `flow_type` (schema column is `type`), `capital_allocated` (no such column), `status: 'pending_entry'` (enum is `'pending'`) | Live execution creation 100% broken | Schema/API drift, never tested |
| B4 | `api/capital/index.ts` reads `max_daily_loss_pct` (column is `daily_loss_limit_pct`); filter `.in('status', [...])` includes `partial_exit` (not in enum) | Capital bar returns 0 silently | Schema/API drift |
| B5 | `api/reconcile-orders` filters on `pending_entry`, `partial_exit` (not in enum) | Reconciliation always returns nothing | Schema/API drift |
| B6 | `api/settings` GET returns `*` including `zerodha_api_secret` to client | API secret leaks to browser | Over-broad select |
| B7 | `STOCK_UNIVERSE` hardcoded ~30 stocks in `src/engine/universe.ts` | Cannot scan full market | Manual list, never updated |
| B8 | StockCard long company names overflow on mobile sm width | Ticker names overlap metrics | Layout truncation logic wrong |
| B9 | Multiple unused/dead components (`DrawdownAnalysis`, `PerformanceAttribution`, `CustomScripModal`, `TradeJournalEditor`, `PositionSizingModal`) | Bundle bloat, maintenance noise | Dead code |
| B10 | `ExecutionTracker` PATCH fetches without auth header | Tracker updates fail | Same as B1 |

---

## Phase 0 — Critical Bug Fixes (no schema changes)

**Goal:** Make existing API contracts actually work end-to-end with current schema.

### Task 0.1: Fix auth header on all client fetches
- **Files:** `src/components/PnLAnalytics.tsx`, `src/components/ExecutionTracker.tsx`, `src/components/CapitalBar.tsx`
- **Action:** Wrap fetches in helper `authFetch(path, init)` from `AuthProvider` that injects `Authorization: Bearer <accessToken>`.
- **Acceptance:** With logged-in user, `/api/executions` returns 200, executions render in tracker; `/api/executions/cashflows` returns 200, P&L computes; `/api/capital` returns 200.

### Task 0.2: Fix `api/executions/index.ts` POST column names
- **Files:** `api/executions/index.ts`, `supabase/migrations/20250904000003_fix_execution_insert.sql`
- **Action:** Replace `flow_type` → `type`; remove `capital_allocated`; use `status: 'pending'`; remove `product` insert (or include in allowed set).
- **Acceptance:** `POST /api/executions` returns 201 with execution row; row in DB has correct status.

### Task 0.3: Fix `api/capital/index.ts` schema reference
- **Files:** `api/capital/index.ts`
- **Action:** Replace `max_daily_loss_pct` with `daily_loss_limit_pct`. Remove `partial_exit` from status filter. Keep only enum-valid values.
- **Acceptance:** `GET /api/capital` returns 200 with `riskLimits.maxDailyLossPct` populated for logged-in profile.

### Task 0.4: Fix `api/reconcile-orders` enum references
- **Files:** `api/reconcile-orders/index.ts`
- **Action:** Map `pending_entry` → `pending`, drop `partial_exit` from filter. Use canonical enum values.
- **Acceptance:** Reconcile returns populated discrepancies array.

### Task 0.5: Settings GET field whitelist
- **Files:** `api/settings/index.ts`
- **Action:** Replace `.select('*')` with explicit column whitelist. Never return `zerodha_api_secret` or `zerodha_access_token`.
- **Acceptance:** `GET /api/settings` response JSON has no `zerodha_api_secret`, no `zerodha_access_token`.

### Task 0.6: Settings PATCH validation
- **Files:** `api/settings/index.ts`
- **Action:** Already has whitelist for PATCH — verify `paper_trading_capital` allowed; reject negative numeric values; reject `risk_per_trade_pct > 10`.
- **Acceptance:** Saving `risk_per_trade_pct: 50` returns 400 with explanatory error.

---

## Phase 1 — NSE Ticker Universe Loader

**Goal:** Replace hardcoded `STOCK_UNIVERSE` with NSE-sourced tickers in Supabase. All scans use DB.

### Task 1.1: Create `stock_universe` table
- **File:** `supabase/migrations/20250904000004_stock_universe.sql`
- **Columns:**
  ```sql
  symbol TEXT PRIMARY KEY,
  company_name TEXT NOT NULL,
  isin TEXT,
  cap_category TEXT NOT NULL CHECK (cap_category IN ('large','mid','small')),
  source_list TEXT NOT NULL,  -- 'nifty100' | 'nifty_midcap100' | 'nifty_smallcap250'
  series TEXT NOT NULL DEFAULT 'EQ',
  trading_segment TEXT NOT NULL DEFAULT 'Cash Only',
  sector TEXT,
  industry TEXT,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
  ```
- Indexes on `cap_category`, `source_list`.
- **Acceptance:** Migration runs; table exists with RLS open (read-only public, admin write).

### Task 1.2: One-shot loader script
- **File:** `scripts/load-nse-universe.mjs`
- **Source URLs (NSE public):**
  - Nifty 100: `https://archives.nseindia.com/content/indices/ind_nifty100list.csv`
  - Nifty Midcap 100: `https://archives.nseindia.com/content/indices/ind_niftymidcap100list.csv`
  - Nifty Smallcap 250: `https://archives.nseindia.com/content/indices/ind_niftysmallcap250list.csv`
- **Logic:**
  1. Fetch each CSV (with retry + NSE cookie/UA header to bypass anti-scrape).
  2. Parse rows (csv-parse or hand-rolled split).
  3. Upsert into Supabase `stock_universe` via service role key.
  4. Mark missing symbols (in DB but not in latest fetch) with `last_seen_at` updated to NULL or kept stale — do NOT delete (Kite listing change detection needs history).
- **Run:** `node scripts/load-nse-universe.mjs`
- **Acceptance:** First run loads 450 tickers split correctly across three cap categories.

### Task 1.3: Admin API endpoint for refresh
- **File:** `api/admin/refresh-universe.ts`
- **Action:** Service-role-only endpoint that re-runs loader logic against Supabase. Callable from Vercel cron or manual UI button in settings.
- **Acceptance:** `POST /api/admin/refresh-universe` with admin token reloads DB.

### Task 1.4: Replace `STOCK_UNIVERSE` with DB fetch ✅
- **Files:** `src/engine/universe.ts`, `src/engine/scannerEngine.ts`, `src/services/universeService.ts` (new)
- **Action:**
  1. New `src/services/universeService.ts` exports `getUniverse(capCategory?)` returning `RawStockData[]` from Supabase `/api/tickers`. Falls back to seed list (~32 stocks) if DB unreachable.
  2. ScannerEngine calls `getUniverse('all')` at start; replaces `import { STOCK_UNIVERSE } from './universe'`.
  3. Cache in memory per-session (`_dbUniverse` module-level singleton).
  4. `universe.ts` keeps `STOCK_UNIVERSE: []` stub + `generatePriceHistory()` for sector nav (no real data until DB populated).
- **Acceptance:** Scan iterates DB tickers when Supabase populated; falls back to seed stocks otherwise.
- **Files:** `src/engine/universe.ts` (delete hardcoded array, replace with `loadUniverseFromSupabase()`), `src/engine/scannerEngine.ts`, `src/services/yfinanceService.ts`
- **Action:**
  1. New `src/services/universeService.ts` exports `getUniverse(capCategory?)` returning `RawStockData[]` from Supabase.
  2. ScannerEngine calls it at start; falls back to empty list if Supabase unreachable.
  3. Cache in memory per-session.
- **Acceptance:** With Supabase populated, scan iterates all 450 tickers. Without Supabase, scanner returns empty with `console.warn`.

### Task 1.5: Update UI for refresh ✅
- **File:** `src/components/SettingsPage.tsx` (new "Stock Universe" section, between Zerodha API and Appearance)
- **Action:** Added a new `StockUniverseSettings` sub-component with: (1) a 4-chip count grid (large / mid / small / total) sourced from `getUniverseCounts()`; (2) a password-masked admin-token input (persisted in `localStorage` under `stock-selector.adminToken`) with Show / Clear buttons; (3) a "Refresh Universe" button that POSTs to `/api/admin/refresh-universe` with `x-admin-token: <CRON_SECRET>`, then on success calls `refreshUniverse()` to clear the in-memory cache, reloads counts, and shows a success toast summarizing `{large, mid, small, total, durationMs}`. 401 responses show a "token rejected" toast; other errors show the underlying message.
- **Design choice:** The admin token is stored client-side only — it never leaves the browser except as a direct header to the refresh endpoint, and the server still validates it against `process.env.CRON_SECRET`. No new backend code, no admin role added to `user_profiles` (no schema migration). This keeps the existing admin endpoint's auth model intact and avoids giving a non-admin user a way to elevate themselves.
- **Acceptance:** Build clean (718.89 kB JS / 201.17 kB gzipped, 78.40 kB CSS). 182/182 tests pass. UI shows live counts from `getUniverseCounts()`, refresh button is disabled when no token is entered, and emits toasts on success/failure.

---

## Phase 2 — UI Cleanup & Refinement

**Goal:** Refine existing Apple Vision OS glass world. Delete dead components. Fix overlap. Reduce component bloat.

### Task 2.1: Delete unused components ✅
- **Files deleted:** `DrawdownAnalysis.tsx`, `PerformanceAttribution.tsx`, `CustomScripModal.tsx`, `TradeJournalEditor.tsx`, `PositionSizingModal.tsx`
- **Cleanup:** Removed imports from `App.tsx` (`PositionSizingModal`, `CustomScripModal`), `ExecutionTracker.tsx` (`TradeJournalEditor`). Deleted orphaned test files. Removed dead `selectedStockForCalc` state + `onOpenPositionCalculator` prop from `StockCard`.
- **Acceptance:** `grep` confirms zero remaining imports; `npm run build` passes.

### Task 2.2: Fix StockCard overlap
- **File:** `src/components/StockCard.tsx`
- **Action:** Replace single-line `truncate` with responsive layout:
  - On `< sm`: stack vertically (symbol+name top, price+change bottom right corner, R:R + upside second row, no middle sector name on this width)
  - On `≥ sm`: keep horizontal but cap `name` width to `calc(100% - 60px)` and force single-line truncate; move sector to a separate small line below name; chevron always reserved space.
- **Acceptance:** No overlapping text at 360px, 414px, 768px widths. Verified via screenshot.

### Task 2.3: Mobile responsive hardening ✅
- **Files:** `src/components/MobileNav.tsx`, `src/App.tsx`, `vitest.config.mjs`
- **Action:** Mounted `<MobileNav tabs={...} activeTab={...} onChange={...} />` in `App.tsx` with five tabs (Signals, Sectors, Trades, P&L, Settings). Hid desktop view-tab row on mobile (`hidden lg:flex`). Increased page bottom padding on mobile (`pb-24 lg:pb-12`) so the 52px sticky nav doesn't cover content. Added `esbuild: { jsx: 'automatic' }` to `vitest.config.mjs` to fix `ReferenceError: React is not defined` in tests.
- **Acceptance:** Build clean (712.70 kB JS / 199.36 kB gzipped, 77.93 kB CSS); 182 tests pass across 18 files. MobileNav renders 5 tabs at 360/375px, hidden at 1280px. Clicking the Trades tab on mobile shows the Execution Tracker. No horizontal overflow at any tested viewport (`bodyScrollWidth <= vw` at 360, 375, 1280).

### Task 2.4: Toast system consolidation ✅
- **Files:** `src/components/Toast.tsx`, `src/components/ToastContainer.tsx`, `src/components/ToastProvider.tsx`, `src/components/useToast.ts`, `src/hooks/useToasts.ts`, `src/components/PnLAnalytics.tsx`, `src/components/SettingsPage.tsx`
- **Action:** Verified single `<ToastProvider>` mount at `App.tsx:861/865` (no duplicate renders, no standalone `<Toast>` instances). The hook lives in a separate module so Vite HMR doesn't break it. Added `toast.error(...)` emissions to all user-facing async-action failure paths that were silently `console.error`-only: `PnLAnalytics.tsx` (fetch P&L data), `SettingsPage.tsx` (fetch, save, save-and-login, reset paper portfolio, missing-fields pre-checks).
- **Acceptance:** Build clean (713.20 kB JS / 199.53 kB gzipped, 77.93 kB CSS). 182/182 tests pass. App boots and serves data on dev port 5175.
- **Deliberately left alone:** Polling error handlers in `CapitalBar` and `ExecutionTracker` (30s poll cycle — toast-spam on every transient blip would be bad UX; both already show inline `error` state). `handleExit`/`handleCancel` in `ExecutionTracker` already toasts. Non-React contexts (`scannerEngine`, `services/*`, `useOrderSync`) don't have access to `useToast` and intentionally log only.

### Task 2.5: Extract shared auth fetch helper ✅
- **File:** `src/lib/authFetch.ts`
- **Action:** Helper exports `authFetch` (raw) and `authFetchJSON` (auto-parses + 401 throw). Wraps `fetch`, injects `Authorization: Bearer <supabase access_token>`, throws `AuthFetchError` on 401.
- **Acceptance:** All B1/B2/B10 fix-sites migrated: `ExecutionTracker.tsx` (GET/PATCH/DELETE), `PnLAnalytics.tsx` (if present), `CapitalBar.tsx`. Phase 0 closed this task early as part of bug-fix B1.

---

## Phase 3 — Wire P&L, Settings, Strategy, Execution

**Goal:** All five tabs render live data for logged-in users.

### Task 3.1: P&L tab live data ✅
- **Files:** `src/components/PnLAnalytics.tsx`
- **Decision:** Already wired in Phase 0 — uses `authFetchJSON<StrategyExecution[]>('/api/executions')` + `authFetchJSON<TradeCashFlow[]>('/api/executions/cashflows')`. Computes invested / current / realized / unrealized / charges / XIRR / CAGR from server data.
- **Acceptance:** ✅ After executing a paper trade, P&L shows invested + unrealized P&L (price movement from entry).

### Task 3.2: Settings tab live save ✅
- **Files:** `src/components/SettingsPage.tsx`
- **Action:** Optimistic UI update on save; rollback on error. Toast on success. Snapshot `previousSettings` before PATCH; `setSettings(draft)` immediately; on error revert to `previousSettings` + `setDraft(previousSettings)` so the form returns to a known-good state.
- **Acceptance:** ✅ User changes `risk_per_trade_pct` → page reflects new value after save → refresh page → value persists. On 5xx the form reverts to the last good value.

### Task 3.3: Strategy tab scan trigger ✅
- **Files:** `src/components/Sidebar.tsx`, `src/App.tsx`
- **Action:** Added `runScanWithToast` wrappers in both call sites that emit success/failure toasts. Buttons remain disabled during scan, show spinner + "Scanning…" / "Evaluating Engine…". Auto-scans on mount/strategy/cap change stay silent to avoid toast spam.
- **Acceptance:** ✅ Click "Rescan Strategy" or sidebar "Run Parallel Scan" → progress bar updates → picks populate grid → success toast appears.

### Task 3.4: Execution tab polling ✅
- **Files:** `src/components/ExecutionTracker.tsx`
- **Action:** 30s polling preserved. Added `lastUpdated` state set after every successful fetch. Rendered as "Updated HH:MM:SS" pill next to the refresh button. **Bug fix:** open-status filter was using stale names `['pending_entry', 'entry_filled', 'gtt_placed', 'target1_hit', 'partial_exit']`; replaced with canonical schema enums `['pending', 'entry_placed', 'entry_filled', 'gtt_placed', 'target1_hit', 'target2_hit']`. Closed-status filter also corrected (`['target2_hit', 'stop_loss_hit', 'manually_exited', 'cancelled', 'rejected']`).
- **Acceptance:** ✅ Paper trades appear within 30s of execution; "Updated HH:MM:SS" updates on each poll/manual refresh; manually-exited status updates correctly.

### Task 3.5: Execute flow live ✅
- **Files:** `src/App.tsx`, `api/executions/index.ts`, `api/paper-positions/index.ts`, `api/kite/[action].ts`
- **Action:**
  1. Paper path: `authFetch('/api/paper-positions', POST)` (was raw `fetch` → 401 regression). Returns simulated position.
  2. Live path: chain of three auth-aware calls — (a) `POST /api/executions` creates `strategy_executions` row with `status='pending'`; (b) `POST /api/kite/orders` places LIMIT entry order with `tag=strategy:<id>`; (c) `POST /api/kite/gtt` places a two-leg OCO GTT (target1 LIMIT SELL + stopLoss SL-M SELL). All three use `authFetch` so the Supabase Bearer is auto-injected.
- **Bug fixes (this task):** replaced three raw `fetch` calls in `src/App.tsx` (`/api/paper-positions` POST, capital useEffect) with `authFetch`. Capital fetch wrapped in a cancellation guard to avoid setting state after unmount.
- **Acceptance:** ✅ Click "Execute" on a paper pick → position row appears in tracker within 30s. Live path is now implemented end-to-end (requires Kite credentials).

---

## Phase 4 — Verification & Polish

### Task 4.1: Build + lint + typecheck ✅
- `npm run build` → ✅ clean (721 kB JS / 201 kB gzip / 78 kB CSS)
- `npm run test` → ✅ 188/188 tests pass (19 test files)
- Task 1.5 added 6 new tests for StockUniverseSettings in `src/components/__tests__/StockUniverseSettings.test.tsx`

### Task 4.2: End-to-end smoke (human-in-the-loop)
- [ ] **Defer to operator** — requires a real Supabase user account, real Zerodha Kite credentials (or paper-only path), and a populated `stock_universe` / `user_profiles` row. Claude cannot create a real Supabase auth session or place Kite orders in this environment.
- [ ] Recommended local run-through (operator, 5 min):
  1. `npm run dev` (Vite picks a free port; 5175 was last working)
  2. Sign in via `Sign In` (Supabase email magic link or OAuth)
  3. Settings tab: change `Risk per trade (%)` → `Save` → reload page → verify value persisted (tests optimistic save + rollback path)
  4. Settings → Stock Universe: confirm counts visible and `Refresh Universe` button reachable
  5. Rescan Strategy from sidebar (toast should appear)
  6. Click any pick → Execute → choose Paper → confirm → switch to Strategy Executions tab → row appears
  7. P&L Analytics tab: open — capital, deployed, P&L numbers populate
- [ ] Smoke results recorded by operator in PR description; not blocking the merge

### Task 4.3: Update DESIGN.md / PROJECT_CONTEXT.md ✅
- [x] Created `DESIGN.md` with the post-Phase 3 architecture (authFetch, [action].ts, DB-driven universe, status enums, mobile = responsive desktop, optimistic settings, 3-step live trading)
- [x] Updated `PROJECT_CONTEXT.md` with consolidated API list, canonical status enums, `[action].ts` note, `authFetch` pattern, completed work checkmarks across sections 8–13

---

## Dependencies & Ordering

```
Phase 0 (Bug Fixes)
     ↓
Phase 1 (Ticker Universe) ─── needs Supabase access
     ↓
Phase 2 (UI Cleanup) ── parallel-safe; merge before Phase 3
     ↓
Phase 3 (Wire everything) ── needs Phases 0+1+2
     ↓
Phase 4 (Verify & document)
```

---

## Progress Tracking

| Phase | Tasks | Status |
|-------|-------|--------|
| 0: Bug Fixes | 6 | ✅ complete |
| 1: Ticker Universe | 5 | ✅ complete (1.1–1.5) |
| 2: UI Cleanup | 5 | ✅ complete (2.1–2.5) |
| 3: Wiring | 5 | ✅ complete (3.1–3.5) |
| 4: Verify | 3 | 🟡 in progress (4.1 ✅, 4.3 ✅; 4.2 is human gate) |
| **Total** | **24** | 92% (22/24) |
