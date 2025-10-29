-- Migration: 035_cleanup_user_plans_redundant_columns.sql
-- Description: Remove redundant columns from user_plans that duplicate data from plans table
-- Date: 2025-01-28
-- IMPORTANT: Only run this AFTER confirming plan_id FK is working correctly

BEGIN;

-- Drop redundant columns that duplicate data from plans table
-- All this info should be retrieved via JOIN with plans table
ALTER TABLE user_plans
  DROP COLUMN IF EXISTS plan_name,
  DROP COLUMN IF EXISTS rate_limit_requests,
  DROP COLUMN IF EXISTS rate_limit_window_seconds,
  DROP COLUMN IF EXISTS max_api_keys,
  DROP COLUMN IF EXISTS max_patterns,
  DROP COLUMN IF EXISTS max_webhooks;

-- Add comment explaining the architecture
COMMENT ON TABLE user_plans IS
  'User subscription/plan tracking. Only stores user-specific billing and usage data.
   Plan limits/features are retrieved via JOIN with plans table using plan_id FK.';

COMMENT ON COLUMN user_plans.plan_id IS
  'FK to plans table. All plan limits (requests_per_month, max_api_keys, etc.)
   are retrieved from plans table via JOIN.';

COMMIT;
