# TDD Evidence Report — stock-selector

**Session**: TDD bug-fix cycle, 3 bugs reported by user.
**Date**: 2026-03-09
**Baseline**: 188 passing tests → 198 passing tests (+10 new)

---

## Bug Fixes

### Bug 1 — CapitalBar shows "sign in to view" even after login

**User Journey**: User signs in via Supabase Auth → CapitalBar still shows
"Capital unavailable — sign in to view" → capital data not visible.

**Root Cause**: `App.tsx` passed `isLoggedIn={activeDataSource.includes('Kite')}`
(CapitalBar received broker-connection state instead of auth state).

**Fix**: Changed to `isLoggedIn={isLoggedIn}` where `isLoggedIn = !!user`
(auth state from `useAuth`).

| Commit | Type | Message |
|--------|------|---------|
| `d77f779` | test | add reproducer for App.tsx CapitalBar wiring bug |
| `0c4306d` | fix  | wire CapitalBar isLoggedIn to auth state, not Kite status |

**Test Files Added**
- `src/components/__tests__/CapitalBar.test.tsx` (2 tests, unit contract)
- `src/components/__tests__/AppCapitalBarWiring.test.tsx` (1 test, App-level regression)

**Test Coverage**: CapitalBar renders placeholder when `isLoggedIn=false`; CapitalBar
renders data when `isLoggedIn=true`; App shows no "sign in" text when user is
logged in without Kite.

---

### Bug 2 — Scanner processes only 32 tickers, not full DB universe

**User Journey**: User clicks "Rescan" → scanner evaluates only 32 stocks
(seed data) → full NSE universe (~450) not scanned.

**Root Cause** (multi-layer):
1. Production `/api/tickers` endpoint returns 404 (serverless cold-start or
   stale deploy).
2. Supabase fallback in `loadUniverseFromApi` throws: the SELECT requested
   `is_fno_default` — a column absent from the live `stock_universe` schema.
3. Exception caught → silent fallback to `SEED_UNIVERSE` (32 stocks).

**Fix**: Removed `is_fno_default` from the SELECT in both:
- `src/services/universeService.ts` (client-side fallback)
- `api/tickers/index.ts` (server-side endpoint)

The `/api/tickers` 404 remains an operational issue requiring a fresh Vercel deploy.
The `stock_universe` table exists in the separate migration file
`supabase/migrations/20250904000004_stock_universe.sql` but is not included in
the main `supabase-schema.sql`.

| Commit | Type | Message |
|--------|------|---------|
| `5733dc6` | test | add reproducer for universe service DB-driven universe (4 tests) |
| `03d836f` | test | add regression — universe service must not request missing schema columns |
| `c11d687` | fix  | remove is_fno_default from SELECT — column missing from live schema caused 32-ticker fallback |

**Test Files Added**
- `src/services/__tests__/universeService.test.ts` (5 tests)
  - `getUniverse` returns DB data when API returns >32 rows
  - `getUniverse` returns DB data when API is 404 but Supabase returns >32 rows
  - `getUniverseCounts` preserves cap-category breakdown
  - `getUniverse` filters by capCategory
  - **Regression**: SELECT must not request columns absent from schema

---

### Bug 3 — Top bar cluttered with redundant "Connect Zerodha" button

**User Journey**: User connects Kite → top bar shows both the data-source pill
("Kite API (Live)") and a standalone "Connect Zerodha" pill → two buttons open
the same modal.

**Root Cause**: Standalone "Connect Zerodha" button rendered unconditionally,
redundant with the data-source pill when Kite is already connected.

**Fix**: Wrapped standalone button in `{!isKiteLive && (...)}` where
`isKiteLive = activeDataSource.includes('Kite')`.

| Commit | Type | Message |
|--------|------|---------|
| `0e13cd3` | test | add reproducer for App.tsx top bar clutter (redundant Connect Zerodha) |
| `093260d` | fix  | hide redundant Connect Zerodha pill when Kite is live |

**Test Files Added**
- `src/components/__tests__/AppTopBarClutter.test.tsx` (2 tests)
  - "Connect Zerodha" hidden when Kite is live (data-source pill sufficient)
  - "Connect Zerodha" shown when not connected (yfinance fallback)

---

## Test Specification

| Test File | Tests | Description |
|-----------|-------|-------------|
| `CapitalBar.test.tsx` | 2 | Unit: CapitalBar placeholder vs data contract |
| `AppCapitalBarWiring.test.tsx` | 1 | App-level: auth state wires to CapitalBar |
| `AppTopBarClutter.test.tsx` | 2 | App-level: redundant button hidden when Kite live |
| `universeService.test.ts` | 5 | Service-level: DB universe surfaced vs 32-seed fallback |

**Total new tests**: 10 across 4 files.

---

## Coverage and Known Gaps

**Covered**
- CapitalBar wiring contract (auth vs broker state)
- Top bar button visibility contract (Kite live vs fallback)
- Universe service DB-surfacing contract (API + Supabase fallback)
- Schema contract (SELECT columns must match live schema)

**Not Covered (requires operational action)**
- `/api/tickers` endpoint returns 200 in production (needs Vercel redeploy)
- `stock_universe` table populated with NSE data (needs `load-nse-universe.mjs` run)
- `stock_universe` included in `supabase-schema.sql` (currently only in migration)

**Known Gaps**
- No E2E test for the scanner hitting the full universe (requires DB seed + running scan)
- No test for the Kite OAuth auto-exchange flow
- No test for `is_fno_default` being added if it becomes a real column (design decision)

---

## Merge Evidence

All 3 bugs have:
1. RED commit (failing test) with observable failure message
2. GREEN commit (fix) with all tests passing
3. No regression in baseline suite (188 → 198, no regressions)

```
Baseline:  188 passed
Bug 1:     +3 tests (capital bar wiring)
Bug 2:     +5 tests (universe service)
Bug 3:     +2 tests (top bar clutter)
Final:     198 passed (0 failed)
```
