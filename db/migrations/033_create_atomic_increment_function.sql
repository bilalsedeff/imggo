-- Migration: 033_create_atomic_increment_function.sql
-- Description: Create Postgres function for atomic request count increment (USER-LEVEL)
-- Date: 2025-01-28

BEGIN;

-- Drop function if exists (for re-running migration)
DROP FUNCTION IF EXISTS increment_user_request_count(UUID, TIMESTAMPTZ);

-- Atomic increment function (prevents race conditions with concurrent requests)
-- CRITICAL: This increments at USER level, not API key level
CREATE OR REPLACE FUNCTION increment_user_request_count(
  p_user_id UUID,
  p_timestamp TIMESTAMPTZ
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_period_end TIMESTAMPTZ;
BEGIN
  -- Get current period end
  SELECT current_period_end INTO v_period_end
  FROM user_plans
  WHERE user_id = p_user_id;

  -- If period has ended, reset usage (safety check - cron should handle this)
  IF v_period_end IS NOT NULL AND v_period_end <= p_timestamp THEN
    UPDATE user_plans
    SET
      requests_used_current_period = 1,  -- This request counts as first in new period
      current_period_start = current_period_end,
      current_period_end = current_period_end + INTERVAL '1 month',
      last_burst_request_at = p_timestamp,
      updated_at = p_timestamp
    WHERE user_id = p_user_id;

    RAISE NOTICE 'Period ended, reset usage for user %', p_user_id;
    RETURN;
  END IF;

  -- Normal increment (within current period)
  UPDATE user_plans
  SET
    requests_used_current_period = requests_used_current_period + 1,
    last_burst_request_at = p_timestamp,
    updated_at = p_timestamp
  WHERE user_id = p_user_id;

  -- If no row found, user might not have a plan entry (shouldn't happen)
  IF NOT FOUND THEN
    RAISE WARNING 'User % has no plan entry', p_user_id;
  END IF;
END;
$$;

-- Add comment for documentation
COMMENT ON FUNCTION increment_user_request_count IS 'Atomically increment USER-LEVEL request count (shared across all API keys). Prevents race conditions with concurrent requests. Also updates burst rate limiting timestamp.';

COMMIT;
