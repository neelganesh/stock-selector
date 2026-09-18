# Stock Selector — Feature Inventory

> Generated 2026-09-18 | Vercel: stock-selector-deploy.vercel.app

## Feature Inventory

### 1. Authentication & Profile
- **Sign Up / Sign In** — Username + password (virtual email auto-generated: `{username}@stock-selector.local`)
- **Session Management** — JWT stored in localStorage, auto-refresh via `authFetch`
- **Profile Page** (`/settings` → Profile tab) — Username display, email (read-only), Change Password, Delete Account
- **Top-Right Profile UX** — Avatar ring, online indicator, username label, dropdown with My Profile + Signout
- **Auth Modal** — Inline sign-in prompt when action requires auth

### 2. Market Signals (Core Feature)
- **Signal Cards** — Real-time stock recommendations with:
  - Symbol, name, R:R ratio, upside %, entry, stoploss, target1, target2, current price
  - Expandable detail: Price Range ladder, Rationale text, Action bar
  - **Execute in Kite** button — 1-click Kite order popup with GTT bracket details (entry, stoploss, target)
  - Execute Modal — Review order before confirming in Kite popup
- **Signal Loading** — Parallel endpoint loading (`Promise.any`), sessionStorage cache (2-min TTL), prefetch-on-idle
- **Pagination** — 12 signals per page with page navigation
- **Sector Heatmap** — Visual sector strength exploration (next signals)

### 3. Settings
- **Settings Page** — Tabbed interface with section navigation
  - **Profile** — Personal info, username display, Change Password, Delete Account (danger zone)
  - **Connections** — Zerodha Kite Publisher API key (save + delete + status), MegaBull API key (save + delete + status)
  - **Paper** — Trading mode settings, capital configuration (UNAPPLICABLE — will remove)
  - **Appearance** — Theme toggle (light/dark/system)
- **Save System** — Unsaved changes detection bar, per-section Save buttons, success/error toasts
- **Capital Overview** — Available capital, risk limit, capital bar (floating on signals tab)

### 4. Trading (Future)
- **Kite GTT Bracket Orders** — When stopLoss > 0 and target1 > 0: SL order with MIS product; otherwise MARKET/CNC
- **Kite Publisher Mode** — Encrypted API key, publish ticket, popup-based order placement
- **Paper Trading** — REMOVED from cards and mobile nav (not applicable)
- **Trades / P&L** — REMOVED from mobile nav (not applicable)

### 5. Navigation
- **Desktop Sidebar** — Full navigation with section tabs
- **Mobile Bottom Nav** — Signals + Settings only (Trades/P&L removed)
- **Tab Navigation** — AnimatePresence transitions between sections

### 6. System
- **API Layer** — 9 serverless functions (under Vercel Hobby 12-limit)
- **Database** — Supabase (PostgreSQL) with row-level security
- **Key Management** — Per-user encrypted API keys (Kite, MegaBull)
- **Error Handling** — `response.text()` + JSON.parse with proper error messages
- **Accessibility** — ARIA labels, semantic HTML, keyboard navigation
- **Responsive** — Mobile-first with adaptive layouts
- **Animations** — Framer Motion (card expand, tab transitions, modal animations, reduced motion support)

---

## Removed Features (Not Applicable Now)
- ~~Paper Trading tab in mobile nav~~
- ~~Paper Trade button on stock cards~~
- ~~PaperTradingDashboard component (web trades/P&L)~~
- ~~CapitalBar floating row~~
- ~~TradingModeToggle component~~
- ~~TradingMode toggle in StrategyContext~~
- ~~Paper Trading settings section~~
- `Capital Overview` — Kept (shows available capital for execution context)

## API Endpoints
| Method | Endpoint | Purpose |
|--------|----------|---------|
| POST | `/api/kite` | Publish ticket, save/delete Kite key |
| POST | `/api/kite?publish=true` | Fetch publish ticket for order placement |
| POST | `/api/megabull` | Configure MegaBull API key |
| GET | `/api/megabull` | Check MegaBull configuration |
| POST | `/api/paper-trade` | Place paper order |
| GET | `/api/paper-trade` | List paper positions |
| PATCH | `/api/paper-trade?id={uuid}` | Update position (exit) |
| DELETE | `/api/paper-trade?id={uuid}` | Delete position |
| GET | `/api/capital` | Fetch capital data |
| GET | `/api/profile` | Get profile |
| PATCH | `/api/profile` | Update profile |
| POST | `/api/settings` | Update settings |
| GET | `/api/settings` | Get settings |
| GET | `/api/tickers` | Market tickers |
| POST | `/api/auth/...` | Auth (signup/signin) |

## Tech Stack
- React 19 + TypeScript + Vite
- Tailwind CSS + CSS custom properties (theming)
- Framer Motion (animations)
- Lucide React (icons)
- Supabase (auth + database)
- Zerodha Kite Publisher API (order placement)
- MegaBull API (paper trading engine)
- Yahoo Finance API (market data via CORS proxies)
