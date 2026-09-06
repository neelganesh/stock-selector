-- Remove unused calculate_xirr function stub
-- This was a placeholder implementation that was never called

DROP FUNCTION IF EXISTS calculate_xirr(UUID, DATE);

-- Note: XIRR calculation can be done client-side or via a proper implementation
-- when needed. The current analytics use simple ROI calculations instead.
