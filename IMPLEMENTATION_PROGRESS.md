# Implementation Progress — Settings Page Overhaul

**Started:** 2026-09-06
**Last updated:** 2026-09-06 (context-compacted, agents running)

---

## ✅ Completed

### Phase 7 — API Routes
- [x] `api/_crypto.ts` — AES-256-GCM encrypt/decrypt + `isValidKiteKeyFormat`
- [x] `api/kite/save-key.ts` — validate format, encrypt, store ciphertext
- [x] `api/kite/delete-key.ts` — clear kite_api_key
- [x] `api/kite/key-status.ts` — check if key is configured + decrypt test
- [x] `api/kite/publish.ts` — decrypt key, return 60s publish ticket (never send to browser)
- [x] `api/profile/index.ts` — GET / PATCH / DELETE profile
- [x] `api/profile/change-password.ts` — verify current pw, update via admin API
- [x] `supabase/migrations/20250906000000_encrypt_kite_api_key.sql` — wipe plaintext, add length constraint

### Phase 5 — kitePublisher.ts
- [x] `src/services/kitePublisher.ts` — removed localStorage, added `fetchPublishTicket()`, `initKitePublisher()`, updated `placeOrder()` to auto-fetch ticket

### Phase 6 — Cleanup (types)
- [x] `src/lib/supabase.ts` — updated `UserProfile` type: replaced `zerodha_*` columns with `kite_api_key: string | null`

### Phase 4 — ZerodhaStatusButton
- [x] Design finalized (see `api/kite/key-status.ts` + `ZerodhaStatusButton.tsx` spec)

---

## 🚧 In Progress

### Phase 2 — Profile Tab + Phase 3 — SettingsPage Tabs + Phase 8 — Tests
**Agent: `abf516f409006884f`**
- Refactoring `src/components/SettingsPage.tsx` to 3 tabs: Profile, Paper Trading, Appearance
- Creating `src/components/DeleteAccountModal.tsx` (confirmation modal with email confirmation)
- Profile tab: full name, email display, password change form, delete account, Zerodha API key input with save/delete/status
- Adding `'user'` icon to `Icon.tsx`
- Writing tests: `DeleteAccountModal.test.tsx`

### Phase 4 — ZerodhaStatusButton + Phase 6 — App.tsx
**Agent: `ae74dc57efadab116`**
- Creating `src/components/ZerodhaStatusButton.tsx` (polls `/api/kite/key-status`, shows gray/green/red)
- Updating `src/App.tsx`: add button to header, live Execute → `kitePublisher.placeOrder()`, "Coming soon" for Executions/P&L tabs
- Fixing `AppTopBarClutter.test.tsx` with `ZerodhaStatusButton` mock

### Phase 8 — Tests
**Agent: `a89fdc62e552268a6`**
- `api/__tests__/crypto.test.ts` — encrypt/decrypt roundtrip, CryptoError
- `api/__tests__/kite-routes.test.ts` — save-key, delete-key, key-status, publish
- `api/__tests__/profile.test.ts` — GET/PATCH/DELETE profile
- `src/components/__tests__/ZerodhaStatusButton.test.tsx`
- `src/components/__tests__/DeleteAccountModal.test.tsx`

---

## 📋 Remaining (blocked on agents completing)

### Phase 6 — Cleanup (code + API routes)
- [ ] Delete `api/executions/cashflows.ts` — only referenced by ExecutionsTracker/PnLAnalytics (tabs going to "Coming soon")
- [ ] Delete `api/reconcile-orders/index.ts` — only referenced by docs + reconciliation service
- [ ] Update `PROJECT_CONTEXT.md` — remove reconcile-orders reference
- [ ] Update `DESIGN.md` — remove reconcile-orders reference
- [ ] Update `src/components/__tests__/StockUniverseSettings.test.tsx` — StockUniverseSettings is being removed
- [ ] Update `authFetch.ts` docstring — remove `/api/executions` comment (optional, still used by paper positions)

### Phase 6 — App.tsx cleanup (after agents)
- [ ] Verify ExecutionsTracker and PnLAnalytics tabs replaced with "Coming soon"
- [ ] Verify mobile nav doesn't reference ExecutionTracker/PnLAnalytics
- [ ] Verify `handleExecute` no longer calls `POST /api/executions` for live orders
- [ ] Verify `api/executions/index.ts` and `[id].ts` are safe to delete once tabs are gone

### Phase 5 — StockCard Execute button (live)
- [ ] Verify `StockCard.tsx` Execute button calls `kitePublisher.placeOrder()` when `!isPaperOnly`
- [ ] Show toast "Configure Kite API key first" + navigate to settings if `KITE_KEY_NOT_CONFIGURED`
- [ ] Handle error states from `placeOrder()`

### Phase 1 — DB Audit
- [ ] Check `capital_snapshots` table — does migration to drop it exist?
- [ ] Verify no other unused tables remain

### Phase 5 — ExecuteModal capital
- [ ] Verify ExecuteModal still fetches capital from `/api/capital` for paper mode display
- [ ] Remove capital fetching from App.tsx if ExecuteModal handles it

---

## Key Design Decisions (locked)

1. **AES-256-GCM** with versioned format `v1:<iv>:<tag>:<ct>` — allows key rotation
2. **Publish ticket**: 60s TTL, nonce logged server-side for replay detection
3. **No key in browser**: key only in memory during order placement, never localStorage
4. **Delete account**: requires email confirmation in modal before `DELETE /api/profile`
5. **Password change**: verifies current password via `signInWithPassword` before admin update
6. **3 settings tabs only**: Profile, Paper Trading, Appearance
7. **Executions/P&L**: "Coming soon" placeholders (not tracked in Kite Publisher mode)
8. **ZerodhaStatusButton**: polls every 60s, gray/green/red states, click → settings Profile tab

---

## Files Created/Modified

| File | Change |
|------|--------|
| `supabase/migrations/20250906000000_encrypt_kite_api_key.sql` | created |
| `api/_crypto.ts` | created |
| `api/kite/save-key.ts` | created |
| `api/kite/delete-key.ts` | created |
| `api/kite/key-status.ts` | created |
| `api/kite/publish.ts` | created |
| `api/profile/index.ts` | created |
| `api/profile/change-password.ts` | created |
| `src/services/kitePublisher.ts` | refactored |
| `src/lib/supabase.ts` `UserProfile` type | updated |

## Files Pending Creation

| File | Agent |
|------|-------|
| `src/components/SettingsPage.tsx` | abf516f4 |
| `src/components/DeleteAccountModal.tsx` | abf516f4 |
| `src/components/ZerodhaStatusButton.tsx` | ae74dc57 |
| `api/__tests__/crypto.test.ts` | a89fdc62 |
| `api/__tests__/kite-routes.test.ts` | a89fdc62 |
| `api/__tests__/profile.test.ts` | a89fdc62 |
| `src/components/__tests__/ZerodhaStatusButton.test.tsx` | a89fdc62 |
| `src/components/__tests__/DeleteAccountModal.test.tsx` | a89fdc62 |
