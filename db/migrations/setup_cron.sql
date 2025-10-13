-- ============================================================================
-- Setup Cron Job for Worker Invocation
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- ============================================================================
-- IMPORTANT: pg_cron Limitation
-- ============================================================================
-- pg_cron only supports minute-level granularity (no sub-minute intervals).
-- For sub-minute processing, you have two options:
--
-- OPTION 1 (Default): Single cron job every minute
--   - Simple and sufficient for most workloads
--   - Worker processes 10 jobs per invocation with concurrency=3
--   - Throughput: ~600-1200 jobs/hour depending on image complexity
--
-- OPTION 2 (High Volume): Multiple offset cron jobs
--   - Uncomment the section below to create 6 jobs offset by 10 seconds
--   - Simulates every-10-seconds processing
--   - Throughput: ~3600-7200 jobs/hour
--   - Only use if you regularly have >500 jobs queued
-- ============================================================================

-- OPTION 1: Default - Single job every minute
-- IMPORTANT: Replace <YOUR_PROJECT_REF> and <YOUR_SERVICE_ROLE_KEY> with actual values
-- Get service role key from: Dashboard > Settings > API > service_role (secret)
SELECT cron.schedule(
  'invoke-imggo-worker',
  '*/1 * * * *',  -- Every minute
  $$
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- ============================================================================
-- OPTION 2: High-Volume Configuration (Uncomment if needed)
-- ============================================================================
-- Creates 6 jobs that run every minute, effectively simulating every 10 seconds
-- Only enable this if you regularly have hundreds of jobs queued
-- ============================================================================
/*
-- Unschedule the default job first
SELECT cron.unschedule('invoke-imggo-worker');

-- Job 1: Runs at :00 seconds of every minute
SELECT cron.schedule(
  'invoke-imggo-worker-1',
  '*/1 * * * *',
  $$
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 2: Runs at :10 seconds (simulated with pg_sleep)
SELECT cron.schedule(
  'invoke-imggo-worker-2',
  '*/1 * * * *',
  $$
  SELECT pg_sleep(10);
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 3: Runs at :20 seconds
SELECT cron.schedule(
  'invoke-imggo-worker-3',
  '*/1 * * * *',
  $$
  SELECT pg_sleep(20);
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 4: Runs at :30 seconds
SELECT cron.schedule(
  'invoke-imggo-worker-4',
  '*/1 * * * *',
  $$
  SELECT pg_sleep(30);
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 5: Runs at :40 seconds
SELECT cron.schedule(
  'invoke-imggo-worker-5',
  '*/1 * * * *',
  $$
  SELECT pg_sleep(40);
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Job 6: Runs at :50 seconds
SELECT cron.schedule(
  'invoke-imggo-worker-6',
  '*/1 * * * *',
  $$
  SELECT pg_sleep(50);
  SELECT
    net.http_post(
      url := 'https://<YOUR_PROJECT_REF>.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer <YOUR_SERVICE_ROLE_KEY>'
      ),
      body := '{}'::jsonb
    );
  $$
);
*/

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'invoke-imggo-worker';

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
SELECT '✅ Cron job setup complete!' AS status;
