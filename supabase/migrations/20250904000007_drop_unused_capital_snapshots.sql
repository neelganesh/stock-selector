-- Drop unused capital_snapshots table
-- This table is never written to and has no consumer
-- Capital tracking is handled via trade_cash_flows + PnLAnalytics instead

DROP TABLE IF EXISTS capital_snapshots;
