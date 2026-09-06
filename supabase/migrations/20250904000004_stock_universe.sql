-- Stock Universe: NSE-sourced ticker master table
-- Source: NSE published Nifty 100/200, Midcap 100/150, Smallcap 50/100/250 lists
-- (https://archives.nseindia.com/content/indices/)

CREATE TABLE IF NOT EXISTS stock_universe (
  -- NSE trading symbol (primary key, e.g. "RELIANCE", "TATASTEEL").
  -- Matches Zerodha Kite's tradingsymbol directly.
  symbol TEXT PRIMARY KEY,

  -- Company display name (e.g. "Reliance Industries Limited").
  company_name TEXT NOT NULL,

  -- ISIN (12-char international identifier) for cross-exchange lookup.
  isin TEXT,

  -- Cap category: 'large' | 'mid' | 'small'.
  -- 'large' = Nifty 100, 'mid' = Nifty Midcap 100/150, 'small' = Nifty Smallcap 50/100/250.
  cap_category TEXT NOT NULL CHECK (cap_category IN ('large', 'mid', 'small')),

  -- Source list tag, used for refresh diffs. Free-form text so we can add new indices.
  -- E.g. 'nifty100', 'nifty_midcap100', 'nifty_midcap150', 'nifty_smallcap250'.
  source_list TEXT NOT NULL,

  -- Series (NSE equity series; usually 'EQ').
  series TEXT NOT NULL DEFAULT 'EQ',

  -- Trading segment label. NSE publishes text like "Cash Only" or "Cash and Derivatives".
  trading_segment TEXT NOT NULL DEFAULT 'Cash Only',

  -- Sector & industry (NSE provides industry classification per symbol).
  sector TEXT,
  industry TEXT,

  -- Track when this symbol was last seen in a refresh.
  -- Symbols that disappear from NSE source keep their row with old last_seen_at
  -- so downstream (Kite) listing-change detection still has history.
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Standard timestamps.
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for cap_category lookups (scanner filters by cap).
CREATE INDEX IF NOT EXISTS idx_stock_universe_cap_category
  ON stock_universe (cap_category);

-- Index for source_list lookups (refresh scripts diff by source).
CREATE INDEX IF NOT EXISTS idx_stock_universe_source_list
  ON stock_universe (source_list);

-- Index for last_seen_at, used to find symbols not in latest refresh.
CREATE INDEX IF NOT EXISTS idx_stock_universe_last_seen_at
  ON stock_universe (last_seen_at);

-- Updated_at trigger so we can monitor refresh activity.
CREATE OR REPLACE FUNCTION stock_universe_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_stock_universe_updated_at ON stock_universe;
CREATE TRIGGER trg_stock_universe_updated_at
  BEFORE UPDATE ON stock_universe
  FOR EACH ROW
  EXECUTE FUNCTION stock_universe_set_updated_at();

-- RLS: read-only for everyone (anon), writes only via service role.
ALTER TABLE stock_universe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "stock_universe_read" ON stock_universe;
CREATE POLICY "stock_universe_read" ON stock_universe
  FOR SELECT USING (true);

-- Inserts/updates/deletes: no public policy. Service role bypasses RLS.
-- This means the frontend can read all tickers but only the
-- load-nse-universe.mjs script (with service role key) can write.

COMMENT ON TABLE stock_universe IS
  'NSE-sourced ticker universe. Populated by scripts/load-nse-universe.mjs from NSE public CSV lists. Used by scanner to know which tickers to evaluate.';

COMMENT ON COLUMN stock_universe.cap_category IS
  'large = Nifty 100/200, mid = Nifty Midcap 100/150, small = Nifty Smallcap 50/100/250. Determines scanner universe size.';

COMMENT ON COLUMN stock_universe.last_seen_at IS
  'Updated on every refresh. Symbols that fall out of NSE list keep old last_seen_at; UI can show "X tickers stale" indicator.';
