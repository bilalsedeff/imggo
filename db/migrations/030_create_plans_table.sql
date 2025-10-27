-- Migration: 030_create_plans_table.sql
-- Description: Create master plans table with pricing tiers and limits
-- Date: 2025-01-28

BEGIN;

-- Create plans table (master pricing definitions)
CREATE TABLE plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Plan identification
  name TEXT UNIQUE NOT NULL CHECK (name IN ('free', 'starter', 'plus', 'premium', 'enterprise')),
  display_name TEXT NOT NULL,
  description TEXT NOT NULL,

  -- Pricing (in cents)
  price_monthly_cents INTEGER NOT NULL,  -- 0, 2900, 9900, 29900, 99900
  price_yearly_cents INTEGER,            -- NULL, 29000, 99000, 299000, NULL (enterprise custom)
  stripe_price_monthly_id TEXT,          -- Stripe Price ID for monthly billing
  stripe_price_yearly_id TEXT,           -- Stripe Price ID for yearly billing

  -- Request limits (USER-LEVEL - shared across all API keys)
  requests_per_month INTEGER NOT NULL,   -- 50, 500, 3000, 15000, 50000 (-1 = unlimited)
  burst_rate_limit_seconds INTEGER,      -- 60 for free (1 req/min), NULL for paid plans

  -- Fair use limits
  max_image_size_mb INTEGER NOT NULL,    -- 2, 5, 10, 20, 50
  max_tokens_per_request INTEGER NOT NULL, -- 2000, 4000, 8000, 16000, 32000

  -- Feature limits
  max_api_keys INTEGER NOT NULL,         -- 2, 5, 15, -1 (unlimited), -1
  max_patterns INTEGER NOT NULL,         -- 5, 25, 100, -1, -1
  max_webhooks INTEGER NOT NULL,         -- 3, 10, 25, -1, -1

  -- Features (JSONB for flexibility)
  features JSONB DEFAULT '{}'::jsonb,
  -- Example: {"webhook_retry": true, "priority_support": true, "sla": "99.9%"}

  -- Display settings
  is_highlighted BOOLEAN DEFAULT false,  -- Plus plan
  sort_order INTEGER NOT NULL,           -- 1=Free, 2=Starter, 3=Plus, 4=Premium, 5=Enterprise
  cta_text TEXT NOT NULL,                -- "Get Started", "Upgrade Now", "Contact Sales"
  cta_url TEXT,                          -- NULL for Enterprise (handled in frontend)

  -- Status
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for active plans ordered by sort_order
CREATE INDEX idx_plans_active_sort ON plans(is_active, sort_order) WHERE is_active = true;

-- Seed initial plans
INSERT INTO plans (
  name, display_name, description,
  price_monthly_cents, price_yearly_cents,
  requests_per_month, burst_rate_limit_seconds,
  max_image_size_mb, max_tokens_per_request,
  max_api_keys, max_patterns, max_webhooks,
  features, is_highlighted, sort_order, cta_text, cta_url
) VALUES
  -- FREE PLAN
  (
    'free',
    'Free',
    'Perfect for testing and hobby projects',
    0,
    NULL,
    50,   -- 50 requests/month
    60,   -- 1 request per minute burst limit
    2,    -- 2MB max image size
    2000, -- 2K tokens max per request
    2,    -- 2 API keys
    5,    -- 5 patterns
    3,    -- 3 webhooks
    '{"support": "community"}'::jsonb,
    false,
    1,
    'Get Started',
    '/auth/signup'
  ),
  -- STARTER PLAN
  (
    'starter',
    'Starter',
    'For small projects and indie developers',
    2900,  -- $29/month
    29000, -- $290/year (save $58, 17% off)
    500,   -- 500 requests/month
    NULL,  -- No burst limit
    5,     -- 5MB max image size
    4000,  -- 4K tokens max per request
    5,     -- 5 API keys
    25,    -- 25 patterns
    10,    -- 10 webhooks
    '{"support": "email", "sla": "48hr"}'::jsonb,
    false,
    2,
    'Upgrade to Starter',
    '/billing/checkout?plan=starter'
  ),
  -- PLUS PLAN (Most Popular)
  (
    'plus',
    'Plus',
    'Most popular for growing teams',
    9900,  -- $99/month
    99000, -- $990/year (save $198, 17% off)
    3000,  -- 3,000 requests/month
    NULL,  -- No burst limit
    10,    -- 10MB max image size
    8000,  -- 8K tokens max per request
    15,    -- 15 API keys
    100,   -- 100 patterns
    25,    -- 25 webhooks
    '{"support": "priority", "sla": "24hr", "webhook_retry": true}'::jsonb,
    true,  -- HIGHLIGHTED
    3,
    'Upgrade to Plus',
    '/billing/checkout?plan=plus'
  ),
  -- PREMIUM PLAN
  (
    'premium',
    'Premium',
    'For high-volume production workloads',
    29900,  -- $299/month
    299000, -- $2,990/year (save $598, 17% off)
    15000,  -- 15,000 requests/month
    NULL,   -- No burst limit
    20,     -- 20MB max image size
    16000,  -- 16K tokens max per request
    -1,     -- Unlimited API keys
    -1,     -- Unlimited patterns
    -1,     -- Unlimited webhooks
    '{"support": "priority", "sla": "12hr", "webhook_retry": true, "uptime_sla": "99.9%"}'::jsonb,
    false,
    4,
    'Upgrade to Premium',
    '/billing/checkout?plan=premium'
  ),
  -- ENTERPRISE PLAN
  (
    'enterprise',
    'Enterprise',
    'Custom solutions for large organizations',
    99900,  -- Starting price (custom pricing)
    NULL,   -- No yearly option (custom pricing)
    50000,  -- 50,000 requests/month default (custom per contract)
    NULL,   -- No burst limit
    50,     -- 50MB max image size
    32000,  -- 32K tokens max per request
    -1,     -- Unlimited API keys
    -1,     -- Unlimited patterns
    -1,     -- Unlimited webhooks
    '{"support": "dedicated", "custom_sla": true, "white_label": true, "on_premise": true}'::jsonb,
    false,
    5,
    'Contact Sales',
    NULL  -- NULL cta_url, handled in frontend with mailto:contact@imggo.com
  );

-- Enable RLS on plans table
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;

-- Allow anyone to view active plans (for pricing page)
CREATE POLICY "Anyone can view active plans"
  ON plans FOR SELECT
  USING (is_active = true);

-- Add comments for documentation
COMMENT ON TABLE plans IS 'Master pricing plan definitions (single source of truth for all plan limits and pricing)';
COMMENT ON COLUMN plans.requests_per_month IS 'USER-LEVEL monthly request limit (shared across all API keys). -1 means unlimited.';
COMMENT ON COLUMN plans.burst_rate_limit_seconds IS 'Minimum seconds between requests (burst protection). NULL means no burst limit. Free plan: 60 (1 req/min)';
COMMENT ON COLUMN plans.max_api_keys IS 'Maximum API keys user can create. -1 means unlimited.';
COMMENT ON COLUMN plans.max_patterns IS 'Maximum patterns user can create. -1 means unlimited.';
COMMENT ON COLUMN plans.max_webhooks IS 'Maximum webhooks user can create. -1 means unlimited.';
COMMENT ON COLUMN plans.features IS 'JSON object with plan-specific features (webhook_retry, support level, SLA, etc.)';
COMMENT ON COLUMN plans.cta_url IS 'Call-to-action URL for upgrade button. NULL for Enterprise (contact sales)';

COMMIT;
