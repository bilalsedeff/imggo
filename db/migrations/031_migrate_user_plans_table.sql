-- Migration: 031_migrate_user_plans_table.sql
-- Description: Migrate user_plans table to use new plans table FK and add usage tracking
-- Date: 2025-01-28

BEGIN;

-- Add new columns to user_plans
ALTER TABLE user_plans
  ADD COLUMN plan_id UUID REFERENCES plans(id),
  ADD COLUMN billing_cycle TEXT CHECK (billing_cycle IN ('monthly', 'yearly')),
  ADD COLUMN current_period_start TIMESTAMPTZ DEFAULT DATE_TRUNC('month', NOW()),
  ADD COLUMN current_period_end TIMESTAMPTZ DEFAULT (DATE_TRUNC('month', NOW()) + INTERVAL '1 month'),
  ADD COLUMN requests_used_current_period INTEGER DEFAULT 0 NOT NULL,
  ADD COLUMN last_burst_request_at TIMESTAMPTZ,  -- For burst rate limiting (free plan: 1 req/min)
  ADD COLUMN is_trial BOOLEAN DEFAULT false,
  ADD COLUMN trial_ends_at TIMESTAMPTZ;

-- Migrate ALL existing users to free plan
UPDATE user_plans up
SET
  plan_id = (SELECT id FROM plans WHERE name = 'free'),
  billing_cycle = 'monthly',
  current_period_start = DATE_TRUNC('month', NOW()),
  current_period_end = DATE_TRUNC('month', NOW()) + INTERVAL '1 month',
  requests_used_current_period = 0;

-- Make plan_id required after migration
ALTER TABLE user_plans ALTER COLUMN plan_id SET NOT NULL;

-- Create indexes for performance
CREATE INDEX idx_user_plans_plan_id ON user_plans(plan_id);
CREATE INDEX idx_user_plans_period ON user_plans(current_period_end) WHERE stripe_subscription_id IS NOT NULL;
CREATE INDEX idx_user_plans_user_id_period ON user_plans(user_id, current_period_end);

-- Update RLS: Users can view their own plan with joined plan details
DROP POLICY IF EXISTS "Users can view own plan" ON user_plans;

CREATE POLICY "Users can view own plan with details"
  ON user_plans FOR SELECT
  USING (user_id = auth.uid());

-- Add comments for documentation
COMMENT ON COLUMN user_plans.plan_id IS 'FK to plans table (master plan definition). Required.';
COMMENT ON COLUMN user_plans.billing_cycle IS 'monthly or yearly. NULL for free plan.';
COMMENT ON COLUMN user_plans.requests_used_current_period IS 'USER-LEVEL request count (all API keys combined). Reset monthly.';
COMMENT ON COLUMN user_plans.last_burst_request_at IS 'Timestamp of last request (for burst rate limiting on free plan: 1 req/min)';
COMMENT ON COLUMN user_plans.current_period_start IS 'Start of current billing period (monthly)';
COMMENT ON COLUMN user_plans.current_period_end IS 'End of current billing period (monthly). Usage resets at this time.';

-- Note: Keep old columns for backwards compatibility during transition
-- After confirming everything works, run a cleanup migration:
-- ALTER TABLE user_plans DROP COLUMN plan_name;
-- ALTER TABLE user_plans DROP COLUMN rate_limit_requests;
-- ALTER TABLE user_plans DROP COLUMN rate_limit_window_seconds;

COMMIT;
