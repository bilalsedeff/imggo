-- Migration: 032_add_tokens_to_jobs.sql
-- Description: Add token tracking and fair-use columns to jobs table
-- Date: 2025-01-28

BEGIN;

-- Add token tracking columns
ALTER TABLE jobs
  ADD COLUMN tokens_input INTEGER,
  ADD COLUMN tokens_output INTEGER,
  ADD COLUMN tokens_total INTEGER,
  ADD COLUMN image_size_bytes BIGINT,
  ADD COLUMN fair_use_warning TEXT;  -- NULL if within limits, warning message otherwise

-- Create index for token analytics
CREATE INDEX idx_jobs_tokens ON jobs(tokens_total) WHERE tokens_total IS NOT NULL;

-- Create index for fair-use monitoring
CREATE INDEX idx_jobs_fair_use_warnings ON jobs(fair_use_warning) WHERE fair_use_warning IS NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN jobs.tokens_input IS 'OpenAI input tokens (prompt + image analysis)';
COMMENT ON COLUMN jobs.tokens_output IS 'OpenAI output tokens (generated manifest)';
COMMENT ON COLUMN jobs.tokens_total IS 'Total tokens used (input + output)';
COMMENT ON COLUMN jobs.image_size_bytes IS 'Image file size in bytes (for fair-use monitoring)';
COMMENT ON COLUMN jobs.fair_use_warning IS 'Fair-use violation message if applicable (e.g., "Image size exceeds 5MB limit" or "Token usage exceeds 4K limit")';

COMMIT;
