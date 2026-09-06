-- Add exchange column to strategy_executions for multi-exchange support
-- Currently only NSE is supported, but BSE/future exchanges may be added
ALTER TABLE strategy_executions
  ADD COLUMN IF NOT EXISTS exchange TEXT NOT NULL DEFAULT 'NSE';

-- Add index for exchange filtering
CREATE INDEX IF NOT EXISTS idx_strategy_executions_exchange ON strategy_executions(exchange);
