-- Migration: 034_create_usage_reset_cron.sql
-- Description: Create monthly usage reset cron job
-- Date: 2025-01-28

BEGIN;

-- Drop function if exists (for re-running migration)
DROP FUNCTION IF EXISTS reset_monthly_usage();

-- Function to reset monthly usage counters
CREATE OR REPLACE FUNCTION reset_monthly_usage()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  v_reset_count INTEGER;
BEGIN
  -- Count users whose period has ended
  SELECT COUNT(*) INTO v_reset_count
  FROM user_plans
  WHERE current_period_end <= NOW();

  -- Reset users whose period has ended
  UPDATE user_plans
  SET
    requests_used_current_period = 0,
    current_period_start = current_period_end,
    current_period_end = current_period_end + INTERVAL '1 month',
    updated_at = NOW()
  WHERE current_period_end <= NOW();

  -- Log result
  RAISE NOTICE 'Reset monthly usage for % users', v_reset_count;

  -- Also log to a tracking table if you want audit history
  -- INSERT INTO usage_reset_logs (reset_at, users_affected) VALUES (NOW(), v_reset_count);
END;
$$;

-- Schedule daily cron job (runs at 00:05 UTC every day)
-- This checks for any users whose billing period has ended and resets their usage
SELECT cron.schedule(
  'reset-monthly-usage',
  '5 0 * * *',  -- Every day at 00:05 UTC
  $$SELECT reset_monthly_usage();$$
);

-- Add comment for documentation
COMMENT ON FUNCTION reset_monthly_usage IS 'Reset monthly request counters for users whose billing period has ended. Runs daily via cron at 00:05 UTC.';

-- Note: To manually trigger reset for testing:
-- SELECT reset_monthly_usage();

-- To view scheduled cron jobs:
-- SELECT * FROM cron.job WHERE jobname = 'reset-monthly-usage';

-- To unschedule (if needed):
-- SELECT cron.unschedule('reset-monthly-usage');

COMMIT;
