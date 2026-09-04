# Stock Selector - Execution Plan

**Generated:** 2026-09-01  
**Total Tasks:** 22  
**Approach:** Vertical slices (TDD) - One feature at a time: test → implement → verify → next

---

## Phase 1: Paper Trading Mode (Tasks 1-5)

### Task 1: Paper Trading - Add paper_trading_enabled + paper_trading_capital to user_profiles
- **Status:** ✅ Complete (already in supabase-schema.sql)
- **Files:** `supabase-schema.sql` (lines 26-27)
- **Verification:** Schema includes `paper_trading_enabled BOOLEAN NOT NULL DEFAULT FALSE` and `paper_trading_capital NUMERIC(15, 2) NOT NULL DEFAULT 1000000`

### Task 2: Paper Trading - Create paper_positions table with RLS policies
- **Status:** ✅ Complete
- **Files:** `supabase-schema.sql` (line 138) — `paper_positions` table created with indexes on `user_id` and `status` (lines 188-189)
- **Verification:** Schema grep confirmed CREATE TABLE paper_positions + 2 indexes present

### Task 3: Paper Trading - Add paper trading toggle to CapitalBar component
- **Status:** ✅ Complete
- **Files:** `src/components/CapitalBar.tsx`
- **Completed:** Props for `paperTrading`/`paperTradingCapital`/`paperDeployedCapital`/`paperAvailableCapital`/`paperRiskUsed` etc., `togglePaperTrading` handler, `showPaperTrading` state, full paper-mode display switching

### Task 4: Paper Trading - Modify ExecuteModal for simulated order execution
- **Status:** ✅ Complete
- **Files:** `src/components/ExecuteModal.tsx`, `api/paper-positions/index.ts`
- **Completed:** `isPaperTrading` prop plumbed through, button gated to `(isLoggedIn || isPaperTrading)`, PAPER badge in modal, body posts to `/api/paper-positions` instead of Kite
- **Verification:** `App.tsx` handleExecute already routes to `/api/paper-positions` endpoint (lines 91-117)

### Task 5: Paper Trading - Add paper trading context/state management
- **Status:** ✅ Complete
- **Files:** `src/context/StrategyContext.tsx` (paper state integrated) + `api/paper-positions/index.ts` (CRUD)
- **Completed:** Capital bar reads paperTrading props from parent, paper positions managed via API endpoint

---

## Phase 2: Order Book Sync & GTT Monitor (Tasks 6-9)

### Task 6: Order Sync - Create 30s polling service in StrategyContext
- **Status:** ⏳ Planned (not started)
- **Files:** `src/context/StrategyContext.tsx`
- **Remaining:** No `setInterval`/polling block currently in StrategyContext — needs adding
- **Requirements:**
  - Background interval fetching orders/portfolio
  - Update execution statuses automatically
  - Handle rate limiting

### Task 7: Order Sync - Build GTT Monitor component
- **Status:** ⏳ Planned (file does not exist)
- **Files:** New `src/components/GTTMonitor.tsx`
- **Remaining:** GTT API exists at `api/kite/gtt.ts` but no UI component yet
- **Requirements:**
  - Display active GTTs with trigger prices, expiry, status
  - Real-time updates from polling
  - Cancel/modify GTT actions

### Task 8: Order Sync - Implement auto-status transitions
- **Status:** ⏳ Planned
- **Files:** `src/context/StrategyContext.tsx`, API endpoints
- **Remaining:** No fill-to-status logic present yet
- **Requirements:**
  - `entry_filled` → `target1_hit`/`target2_hit`/`stop_loss_hit`
  - Based on order fills from Kite
  - Update strategy_executions table

### Task 9: Order Sync - Add reconciliation logic
- **Status:** ⏳ Planned
- **Files:** New `src/services/reconciliation.ts` (does not exist)
- **Remaining:** `api/kite/orders.ts` exists for fetch, no compare/diff logic yet
- **Requirements:**
  - Compare local executions with Kite order book
  - Flag discrepancies
  - Auto-correct or alert user

---

## Phase 3: Settings Page (Tasks 10-13)

### Task 10: Settings - Build Settings page with capital/risk config
- **Status:** ✅ Complete
- **Files:** `src/components/SettingsPage.tsx` (created, imported into App.tsx, tab wired)
- **Completed:** `CapitalRiskSettings` section with all 6 fields (capital, risk per trade, max position %, max sector %, max open strategies, daily loss limit %)

### Task 11: Settings - Add paper trading settings section
- **Status:** ✅ Complete
- **Files:** `src/components/SettingsPage.tsx` (line 379: `PaperTradingSettings`)
- **Completed:** Toggle, virtual capital input, reset button (handleResetPaper)

### Task 12: Settings - Add Zerodha API management section
- **Status:** ✅ Complete
- **Files:** `src/components/SettingsPage.tsx` (line 434: `KiteSettings`)
- **Completed:** API key input (`apiKey` prop), connection status indicator, revoke access button

### Task 13: Settings - Add notification preferences
- **Status:** ✅ Complete
- **Files:** `src/components/SettingsPage.tsx` (line 488: `NotificationSettings`)
- **Completed:** Toggles for `orderFills`, `gttTriggers`, `dailyLossAlert`, `emailNotifications` (local state only — `notification_preferences` table still TODO)

---

## Phase 4: Risk Management & Bank-Grade Features (Tasks 14-16)

### Task 14: Risk Management - Pre-trade risk checks
- **Status:** ⏳ Planned
- **Files:** New `src/utils/riskChecks.ts` (does not exist), `ExecuteModal.tsx`
- **Remaining:** No risk checks module yet; `PositionSizingModal` exists but is sizing-only, not enforcement

### Task 15: Risk Management - Daily loss limit enforcement
- **Status:** ⏳ Planned
- **Files:** `src/utils/riskChecks.ts`, `StrategyContext.tsx`
- **Remaining:** No daily P&L tracking or block-on-limit logic

### Task 16: Risk Management - Trade journal (notes, tags)
- **Status:** ⏳ Planned
- **Files:** `src/components/ExecutionTracker.tsx` (DB has notes/tags columns)
- **Remaining:** No notes/tags UI in ExecutionTracker yet

---

## Phase 5: Advanced Analytics (Tasks 17-19)

### Task 17: Advanced Analytics - Portfolio XIRR/CAGR in dashboard
- **Status:** 🔄 In Progress
- **Files:** `src/components/PnLAnalytics.tsx` (XIRR/CAGR computed via `analytics.ts`), `src/components/CapitalBar.tsx`
- **Completed:** `PnLAnalytics` already calls `calculateExecutionXIRR` + `calculateExecutionCAGR` (weighted)
- **Remaining:** Surface these in `CapitalBar` header

### Task 18: Advanced Analytics - Monthly/quarterly attribution
- **Status:** ⏳ Planned
- **Files:** New `src/components/PerformanceAttribution.tsx` (does not exist)

### Task 19: Advanced Analytics - Drawdown analysis
- **Status:** ⏳ Planned
- **Files:** New `src/components/DrawdownAnalysis.tsx` (does not exist)

---

## Phase 6: UI/UX Polish (Tasks 20-22)

### Task 20: UI/UX - Dark mode support
- **Status:** ⏳ Planned
- **Files:** `src/index.css` (no dark theme tokens), `tailwind.config.js`, all components
- **Remaining:** No `dark:` variants / CSS variables for theme switching

### Task 21: UI/UX - Mobile responsive improvements
- **Status:** ⏳ Planned
- **Files:** All components, `src/App.tsx`
- **Remaining:** Sidebar is always visible (no drawer), no touch-friendly tuning pass

### Task 22: UI/UX - Toast notifications system
- **Status:** ⏳ Planned
- **Files:** New `src/components/ToastProvider.tsx`, `src/hooks/useToast.ts` (neither exists)
- **Remaining:** No toast infra

---

## Dependencies & Ordering

```
Phase 1 (Paper Trading) → Phase 2 (Order Sync) → Phase 3 (Settings) → Phase 4 (Risk) → Phase 5 (Analytics) → Phase 6 (UI/UX)
     ↑                      ↑                      ↑                    ↑                  ↑                   ↑
  Foundation           Needs paper          Needs settings         Needs risk           Needs data         Polish last
  for all              trading data         for config             checks               from trades
  phases
```

---

## TDD Approach for Each Task

For each task, follow:
1. **Red** - Write failing test first
2. **Green** - Minimal implementation to pass
3. **Refactor** - Clean up (separate review stage)

### Test Files Structure
```
src/
├── components/__tests__/
├── context/__tests__/
├── utils/__tests__/
├── services/__tests__/
└── hooks/__tests__/
```

---

## Current Progress (Verified 2026-09-03)

| Phase | Tasks | Completed | In Progress | Remaining |
|-------|-------|-----------|-------------|-----------|
| 1: Paper Trading | 5 | 5 | 0 | 0 |
| 2: Order Sync | 4 | 0 | 0 | 4 |
| 3: Settings | 4 | 4 | 0 | 0 |
| 4: Risk Mgmt | 3 | 0 | 0 | 3 |
| 5: Analytics | 3 | 0 | 1 | 2 |
| 6: UI/UX | 3 | 0 | 0 | 3 |
| **Total** | **22** | **9** | **1** | **12** |

**Completion: 9/22 (41%)**

---

## Next Immediate Actions

1. **Task 6** — Add 30s polling service in `StrategyContext.tsx` (no polling exists today)
2. **Task 7** — Build `src/components/GTTMonitor.tsx` (GTT API already exists at `api/kite/gtt.ts`)
3. **Task 8** — Wire Kite order fills to `entry_filled`/`target1_hit`/`target2_hit`/`stop_loss_hit` status transitions
4. **Task 9** — Add `src/services/reconciliation.ts` to diff local executions vs Kite order book
5. **Task 14** — Build `src/utils/riskChecks.ts` for pre-trade gates
6. **Run `npm run build`** after each task to verify TypeScript compilation