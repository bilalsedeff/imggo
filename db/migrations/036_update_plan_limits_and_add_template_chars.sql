-- Migration: 036_update_plan_limits_and_add_template_chars.sql
-- Description: Add max_template_characters column and update plan limits
-- Date: 2025-01-29
--
-- Changes:
-- 1. Rename max_tokens_per_request to max_characters_per_request (use "characters" terminology)
-- 2. Add max_template_characters column (same as max_characters_per_request - they are NOT separate limits)
-- 3. Update image size limits: Free 2MB, Starter 5MB, Pro 10MB, Business 20MB
-- 4. Update character limits: Free 1000, Starter 5000, Pro 5000, Business 10000
-- 5. Update API key limits: Free 2 keys, Starter+ unlimited
-- 6. Update burst limits: Free 60s (1/min), Starter 6s (10/min), Pro+ no limits

BEGIN;

-- Rename tokens to characters for clarity
ALTER TABLE plans
  RENAME COLUMN max_tokens_per_request TO max_characters_per_request;

-- Add template characters column (same value as max_characters_per_request)
ALTER TABLE plans
  ADD COLUMN max_template_characters INTEGER NOT NULL DEFAULT 1000;

COMMENT ON COLUMN plans.max_characters_per_request IS 'Maximum characters allowed per LLM request (affects output quality and cost). Also the max size for pattern templates in Pattern Studio.';
COMMENT ON COLUMN plans.max_template_characters IS 'Maximum characters for pattern templates in Pattern Studio. SAME as max_characters_per_request (not a separate limit).';

-- Update FREE plan
UPDATE plans SET
  max_image_size_mb = 2,
  max_characters_per_request = 1000,
  max_template_characters = 1000,
  max_api_keys = 2,
  burst_rate_limit_seconds = 60  -- 1 request per minute
WHERE name = 'free';

-- Update STARTER plan
UPDATE plans SET
  max_image_size_mb = 5,
  max_characters_per_request = 5000,
  max_template_characters = 5000,
  max_api_keys = -1,  -- UNLIMITED
  burst_rate_limit_seconds = 6  -- 10 requests per minute
WHERE name = 'starter';

-- Update PLUS (PRO) plan
UPDATE plans SET
  max_image_size_mb = 10,
  max_characters_per_request = 5000,
  max_template_characters = 5000,
  max_api_keys = -1,  -- UNLIMITED
  burst_rate_limit_seconds = NULL  -- No burst limit
WHERE name = 'plus';

-- Update PREMIUM (BUSINESS) plan
UPDATE plans SET
  max_image_size_mb = 20,
  max_characters_per_request = 10000,
  max_template_characters = 10000,
  max_api_keys = -1,  -- Already unlimited
  burst_rate_limit_seconds = NULL  -- No burst limit
WHERE name = 'premium';

-- Update ENTERPRISE plan (not shown in UI)
UPDATE plans SET
  max_image_size_mb = 50,
  max_characters_per_request = 20000,
  max_template_characters = 20000,
  max_api_keys = -1,
  burst_rate_limit_seconds = NULL
WHERE name = 'enterprise';

COMMIT;
