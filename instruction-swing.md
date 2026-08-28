# System Specification & Instructions: Discretionary Swing Trading Stock Selection Tool

This document provides a highly structured, rule-based specification for an AI agent or software system to implement a swing trading stock picker tool. It is completely grounded in the discretionary trading methodologies and rules discussed in the video **"The Easiest Way to Find Swing Trading Stocks | The Long & The Short Ep. 43"**.

---

## 1. System Philosophy & Foundational Constraints

To design and execute swing trades successfully under this framework, the system must adhere to these foundational constraints:

### 1.1. Core Philosophy: Discretionary but Rule-Based
*   **Discretionary Definition:** The approach combines technical parameters with human judgment and pattern recognition. Discretionary trading does **not** mean trading without rules.
*   **The Rules Rule:** Successful traders must enforce strict, non-negotiable rules around entry triggers, risk management, and trailing exits. The user/system is fully responsible for trade outcomes, requiring strict psychological discipline.

### 1.2. The Equities Long-Only Mandate
The tool must restrict equity selection **exclusively to the Long Side**. Equities are structured on the long side due to two specific market mechanics:
1.  **Liquidity & Derivative Constraints:** The universe of highly liquid swing trading stocks is limited. Out of ~500 liquid equity candidates, only ~200 are in the Futures & Options (F&O) segment. When filtered for true, high-volume liquidity, the active pool shrinks to just 50–70 stocks. Taking short swing trades in equities is mechanically restricted by this tiny pool.
2.  **Upward Market Drift:** Equities possess a built-in upward bias in the broader market due to consistent capital inflows. Since equity markets spend significantly more time rising than falling, focus on the long side offers higher opportunity and probability.
*(Note: For commodities, the positive upward drift does not hold, meaning a dual-directional (long and short) approach can be considered. However, this specification focuses primarily on the equity long-side methodology.)*

---

## 2. Sectoral Analysis: The Wagner & Pedicelli Method

The engine of this tool relies on **The Wagner and Pedicelli Method**: **Find the strongest stock inside the strongest sector.** Once the flow of market money into a sector/industry is identified, pinpointing winning stocks becomes highly systematic.

### 2.1. The Market-Cap Weighting Problem
*   Standard sectoral indexes (e.g., NSE Sectoral Indexes) are **market-cap weighted**. Under this scheme, 1 or 2 heavyweight outliers (e.g., Reliance in Nifty Energy, HDFC Bank in Nifty Bank) can artificially skew the performance of the entire index.
*   For swing trading, the tool must look at a **true equal-weighted view** of the sectors to ensure that the majority of constituent stocks are actively participating in the rally rather than being carried by a single outlier.

### 2.2. Selecting and Aggregating Sectors
The system should accommodate two distinct sector universes:
1.  **Standard NSE Sectoral Indexes:**
    *   Utilize the 34 published NSE sectoral indexes, focusing on the 17 actively followed indices (e.g., Nifty Realty).
    *   Retrieve constituent files directly (e.g., from NiftyIndexes.com) to obtain the list of current member stocks.
2.  **Granular Niche Subsectors (Tijori Indexes - TJI):**
    *   Utilize niche subsector trackers (e.g., Tajori Finance Indexes) which track roughly 80 niche subsectors (e.g., Micro Finance).
    *   TJI indexes are highly effective for capturing small-cap and micro-cap momentum before it hits institutional radars.
    *   *Constraint:* Stocks selected from these niche indexes must be traded strictly as **unleveraged cash positions**, as they generally fall outside the F&O segment.

---

## 3. Equal-Weighted NAV Index Engine (TradingView Indicator Logic)

To evaluate sector strength, the tool must emulate or implement the custom TradingView "Equal-Weighted NAV Indicator" script.

### 3.1. Indicator Setup & Parameter Definitions
The indicator calculates an equal-weighted NAV baseline for a customized basket of sector stocks. The system must configure the following variables:
*   **NAV Label (`string`):** User-defined identification string (e.g., `"India Realty Basket"`, `"TJI Micro Finance Basket"`).
*   **Calculate NAV From (`date`):** The start date from which the equal-weighted baseline is calculated (e.g., `January 1, 2026`). All performance tracking begins relative to this date.
*   **Number of Active Stocks (`integer`):** The exact count of active stocks in the sectoral basket (e.g., `10` for Nifty Realty, `7` for TJI Micro Finance). This variable is critical for correct NAV calculations.
*   **Symbol Inputs (`array[string]`):** An array of symbols representing the sector constituents (up to 40 slots).
    *   *System Safety Rule:* To prevent compilation or runtime errors due to empty fields, the system must **pad all unused symbol slots** with a standard, highly liquid index symbol (e.g., `NIFTY50` or `"NSE:NIFTY"`).
*   **Technical Overlays (EMAs):** Overlay three Exponential Moving Averages on the calculated Equal-Weighted NAV line chart:
    *   **20-period EMA**
    *   **50-period EMA**
    *   **200-period EMA**

### 3.2. Step 1: Identifying Leading Sectors (Period Return Check)
To select a target sector, analyze the performance of the custom Equal-Weighted NAV across multiple historical periods.
*   **Required Metric Array:** Track performance over **1-Day, 1-Week, 1-Month, 3-Month, and 6-Month** intervals.
*   **Selection Condition:** Select sectors showing consistent positive returns and upward momentum across multiple timeframes.
*   **Trend Confirmation:** The sector's Equal-Weighted NAV must be in a confirmed uptrend, indicated by the **20 EMA being above the 50 EMA**, which is in turn above the 200 EMA (EMA Crossovers).

---

## 4. Relative Strength Stock Selection ("Versus NAV" Analysis)

Once an uptrending, high-momentum sector is identified, the tool drills down to find the strongest individual stocks within that basket.

### 4.1. "Versus NAV" Calculation
*   The baseline Equal-Weighted NAV is set at the specified start date (e.g., representing `100.0` or `0%` change at the beginning).
*   The system calculates the return of each individual stock in the basket since that start date.
*   **Versus NAV Metric:** For each stock, calculate:
    $$\text{Versus NAV (percentage points)} = \text{Individual Stock Return (\%)} - \text{Equal-Weighted Sector NAV Return (\%)} $$
*   This metric reveals how much better (or worse) a stock is performing compared to its average peer in that sector since the baseline date.

### 4.2. Selection Rule
*   Filter the sector's constituents using the **Stock versus NAV Table** (rendered on the bottom right of the visual workspace).
*   **Identify Outperformers:** Prioritize stocks with the highest **positive Versus NAV** values. These are the leaders driving the sector's performance, indicating concentrated buying momentum.

---

## 5. Tactical Entry & Technical Confirmation Filters

After identifying the leading stocks in the leading sectors, apply technical filters to determine exact entry timing.

### 5.1. Daily Timeframe Trend Scan (SuperTrend)
*   **Timeframe:** Always run technical entry screens on the **Daily Timeframe**.
*   **Primary Filter:** Apply the **SuperTrend** indicator.
*   **Parameters:** Use the default settings:
    *   **Period:** `10`
    *   **Multiplier:** `3`
*   **Execution Trigger:** The stock must be in a confirmed uptrend (SuperTrend indicator is green/buy mode on the daily chart) before initiating a long position.

### 5.2. Renko (Price-Only) Breakout Confirmation
For maximum entry clarity, complement standard candlestick charts with **Renko charts**.
*   **Why Renko?** Renko is a non-time-based, price-only visualization. It completely excludes time and only prints a box ("brick") when the price moves by a predefined brick size. If the price does not move, the chart does not update. This crunches time and filters out market noise.
*   **Breakout Identification:** Renko excels at exposing clear technical levels and breakouts because it simplifies the visual timeline.
*   **The All-Time High (ATH) Setup:** 
    *   Identify historical peak resistance levels (e.g., major highs established in previous years like 2023 or 2024).
    *   **Prioritize ATH Breakouts:** Look for stocks where the daily Renko chart shows a clear breakout above these historical all-time highs. This confirms the absence of overhead resistance and indicates highly active buying interest.

---

## 6. Exit Strategy & Risk Management

Swing trading longevity is determined by risk control rather than stock selection.

### 6.1. Dynamic Exits (The Trailing Stop-Loss Rule)
*   **No Fixed Targets:** Do **not** exit trades based on rigid, predetermined profit targets. Because momentum trends can persist far longer than predicted (sometimes continuing upwards for 6 months or more), fixed targets prematurely cap winning trades.
*   **The Trailing Mandate:** Define a strict trailing stop-loss method to capture as much of the macro-trend as possible, and continue to hold the position as long as the trend remains intact.
*   **Allowed Trailing Indicators:**
    1.  **SuperTrend (10, 3) Trailing:** Hold the position until the daily SuperTrend flip triggers a sell signal (turns red).
    2.  **Moving Averages Trailing:** Use exponential moving averages (e.g., the 20 EMA or 50 EMA on the daily chart) to trail. Exit when the price closes below the selected average.

### 6.2. Position Sizing & Diversification
*   **Diversification Necessity:** Avoid concentration. While high concentration looks favorable when a trade is successful, **diversification is what keeps a trader alive in the long run.**
*   **Sizing Focus:** Position sizing and risk management are far more vital for overall capital longevity than the stock selection itself. The system must establish a rule-based position sizing algorithm (covered dynamically in systematic frameworks) to ensure no single trade failure can severely damage the capital pool.
