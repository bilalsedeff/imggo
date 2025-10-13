-- Migration: API Keys Enhancement for Production
-- Created: 2025-01-13
-- Purpose: Add comprehensive API key system with scopes, rate limiting, and audit

-- ============================================================================
-- 1. API KEYS TABLE ENHANCEMENT
-- ============================================================================

-- Drop existing if any (for clean migration)
DROP TABLE IF EXISTS api_keys CASCADE;

CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Key identification
  name TEXT NOT NULL,
  key_prefix TEXT NOT NULL,  -- First 12 chars: "imggo_live_2" for display
  key_hash TEXT NOT NULL UNIQUE,  -- SHA-256 hash of full key

  -- Environment
  environment TEXT NOT NULL DEFAULT 'live' CHECK (environment IN ('test', 'live')),

  -- Permissions (fine-grained access control)
  scopes TEXT[] NOT NULL DEFAULT ARRAY['patterns:read', 'patterns:ingest', 'jobs:read'],

  -- Security & access control
  last_used_at TIMESTAMPTZ,
  last_used_ip TEXT,
  expires_at TIMESTAMPTZ,  -- Optional expiration
  ip_whitelist TEXT[],  -- Optional IP restrictions

  -- Rate limiting (usage tracking)
  request_count INTEGER DEFAULT 0,
  last_request_reset_at TIMESTAMPTZ DEFAULT NOW(),

  -- Audit trail
  created_at TIMESTAMPTZ DEFAULT NOW(),
  revoked_at TIMESTAMPTZ,
  revoked_reason TEXT,

  -- Constraints
  CONSTRAINT valid_name CHECK (length(name) > 0 AND length(name) <= 100),
  CONSTRAINT valid_prefix CHECK (length(key_prefix) >= 12),
  CONSTRAINT valid_hash CHECK (length(key_hash) = 64)  -- SHA-256 = 64 hex chars
);

-- ============================================================================
-- 2. INDEXES FOR PERFORMANCE
-- ============================================================================

-- Fast lookup by hash (authentication)
CREATE INDEX idx_api_keys_hash
  ON api_keys(key_hash)
  WHERE revoked_at IS NULL;

-- User's active keys
CREATE INDEX idx_api_keys_user_active
  ON api_keys(user_id)
  WHERE revoked_at IS NULL;

-- Expired keys cleanup
CREATE INDEX idx_api_keys_expired
  ON api_keys(expires_at)
  WHERE expires_at IS NOT NULL AND revoked_at IS NULL;

-- Recent usage tracking
CREATE INDEX idx_api_keys_last_used
  ON api_keys(last_used_at DESC NULLS LAST);

-- ============================================================================
-- 3. USER PLANS TABLE (Rate Limiting)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_plans (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  plan_name TEXT NOT NULL DEFAULT 'free' CHECK (plan_name IN ('free', 'pro', 'enterprise')),

  -- Rate limits (requests per window)
  rate_limit_requests INTEGER NOT NULL DEFAULT 10,  -- Free: 100 req
  rate_limit_window_seconds INTEGER NOT NULL DEFAULT 600,  -- Per 10 minutes

  -- Feature flags
  max_api_keys INTEGER NOT NULL DEFAULT 2,  -- Free: 2 keys, Pro: 10, Enterprise: unlimited
  max_patterns INTEGER NOT NULL DEFAULT 5,  -- Free: 5 patterns
  max_webhooks INTEGER NOT NULL DEFAULT 3,

  -- Billing
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT,

  -- Metadata
  plan_started_at TIMESTAMPTZ DEFAULT NOW(),
  plan_expires_at TIMESTAMPTZ,

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for plan lookups
CREATE INDEX idx_user_plans_plan_name ON user_plans(plan_name);

-- ============================================================================
-- 4. PLAN DEFAULTS INSERT
-- ============================================================================

-- Insert default free plan for existing users
INSERT INTO user_plans (user_id, plan_name, rate_limit_requests, rate_limit_window_seconds, max_api_keys, max_patterns, max_webhooks)
SELECT
  id,
  'free',
  10,   -- 10 requests per 10 minutes
  600,   -- 10 minutes
  2,     -- 2 API keys max
  5,     -- 5 patterns max
  3      -- 3 webhooks max
FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- ============================================================================
-- 5. TRIGGER: Auto-create plan for new users
-- ============================================================================

CREATE OR REPLACE FUNCTION create_default_user_plan()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_plans (
    user_id,
    plan_name,
    rate_limit_requests,
    rate_limit_window_seconds,
    max_api_keys,
    max_patterns,
    max_webhooks
  )
  VALUES (
    NEW.id,
    'free',
    10,   -- Free tier: 10 req/10min
    600,
    2,     -- 2 API keys
    5,     -- 5 patterns
    3      -- 3 webhooks
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created_create_plan
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION create_default_user_plan();

-- ============================================================================
-- 6. RLS POLICIES
-- ============================================================================

-- Enable RLS
ALTER TABLE api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_plans ENABLE ROW LEVEL SECURITY;

-- API Keys: Users can only see/manage their own keys
CREATE POLICY "Users can view own API keys"
  ON api_keys FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own API keys"
  ON api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own API keys"
  ON api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users cannot delete API keys (soft delete only)"
  ON api_keys FOR DELETE
  USING (false);

-- User Plans: Users can view own plan
CREATE POLICY "Users can view own plan"
  ON user_plans FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users cannot modify plan directly"
  ON user_plans FOR UPDATE
  USING (false);

-- ============================================================================
-- 7. HELPER FUNCTIONS
-- ============================================================================

-- Get user's rate limit
CREATE OR REPLACE FUNCTION get_user_rate_limit(p_user_id UUID)
RETURNS TABLE (
  requests INTEGER,
  window_seconds INTEGER
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    rate_limit_requests,
    rate_limit_window_seconds
  FROM user_plans
  WHERE user_id = p_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Check if user can create more API keys
CREATE OR REPLACE FUNCTION can_create_api_key(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_max_keys INTEGER;
  v_current_keys INTEGER;
BEGIN
  -- Get max keys for user's plan
  SELECT max_api_keys INTO v_max_keys
  FROM user_plans
  WHERE user_id = p_user_id;

  -- Count active keys
  SELECT COUNT(*) INTO v_current_keys
  FROM api_keys
  WHERE user_id = p_user_id AND revoked_at IS NULL;

  RETURN v_current_keys < v_max_keys;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- 8. SAMPLE PLAN CONFIGURATIONS (for reference)
-- ============================================================================

COMMENT ON TABLE user_plans IS 'User subscription plans with rate limits

Plan Tiers:
- FREE: 100 req/10min, 2 API keys, 5 patterns
- PRO: 1000 req/10min, 10 API keys, 50 patterns
- ENTERPRISE: 10000 req/10min, unlimited keys, unlimited patterns

Rate limits are enforced at API gateway level using request_count tracking.
';

COMMENT ON TABLE api_keys IS 'API keys for programmatic access

Security:
- Keys are hashed with SHA-256 before storage
- Plain key shown only once at creation
- Prefix stored for display (imggo_live_xxx)
- Scopes control fine-grained permissions

Usage:
Authorization: Bearer imggo_live_2kj4h8s9d7f6g5h4j3k2l1m0n9o8p7q6r5s4t3u2v1w0x9y8z7
';

-- ============================================================================
-- MIGRATION COMPLETE
-- ============================================================================
