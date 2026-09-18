# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

React + Vite with TypeScript. Animation library: Framer Motion for smooth, production-grade transitions. Styling: Tailwind CSS for responsive, utility-first design.

## Users

Retail traders managing their own portfolios. They want systematic stock picks without spending hours on research. They may have a day job and trade part-time, so efficiency and clarity are critical.

## Product Purpose

A strategy-based stock selection dashboard that surfaces actionable picks from proven methodologies. Users can view, compare, and act on strategy outputs with minimal friction. Success means the user spends less time finding opportunities and more time executing confident decisions.

## Positioning

Multi-strategy screening in one clean interface. Each strategy is a pluggable module with its own logic, parameters, and output format. The Zerodha Swing Strategy is first; more can be added without changing the core architecture.

## Operating Context

- Traders may check the dashboard once per day (morning scan) or multiple times (intraday monitoring)
- Decisions often happen alongside other tools: brokerage apps, charts, news feeds
- Screen sizes range from mobile phones during commute to desktop monitors at home
- Market hours and data freshness matter; stale data should be clearly indicated

## Capabilities and Constraints

**Core capabilities:**
- Display active strategies and their current stock picks
- Show key metrics per pick (entry, stop loss, targets, rationale)
- Responsive across mobile, tablet, and desktop
- Smooth, fluid animations that feel native and premium
- Rate-limited data fetching with fallback to yfinance, primary target Zerodha Kite API

**Constraints:**
- No live trading execution in v1 — screening only
- Strategy logic is user-provided; the UI is the presentation layer
- Data freshness depends on external APIs and rate limits
- Must gracefully handle API failures and missing data

**Terminology:**
- Strategy: a screening methodology with defined entry/exit rules
- Pick: a stock that passed a strategy's criteria
- Signal: entry, stop loss, target levels for a pick

## Brand Commitments

Visual direction: Apple Vision OS-inspired light theme. Translucent glass elements, soft shadows, clean typography, generous whitespace. The feel should be calm, focused, and premium — not a busy trading terminal.

Animations should feel inevitable and smooth, never jarring. Every motion serves comprehension or delight.

Scalability: the layout and component architecture must support any screen size without separate codebases.

## Evidence on Hand

- Placeholder strategy name: "Zerodha Swing Strategy" — implementation will be provided by user in next step
- Data sources: Zerodha Kite API (primary target), yfinance (fallback)
- No real stock picks, logos, testimonials, or performance data yet

## Product Principles

1. **Clarity over density.** One clear action is better than ten competing signals.
2. **Motion with purpose.** Animations guide attention and confirm state, never distract.
3. **Progressive disclosure.** Show what matters now; details on demand.
4. **Resilient by default.** API failures and missing data are normal states with clear UI treatment.
5. **Strategy-agnostic core.** Adding a new strategy should not require architectural changes.
