-- ============================================================================
-- Setup Cron Job for Worker Invocation
-- Run this in Supabase SQL Editor
-- ============================================================================

-- Enable pg_cron extension if not already enabled
CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;

-- Enable pg_net extension for HTTP requests
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Create cron job to invoke worker every 10 seconds
-- Note: Replace the URL with your actual project URL if different
SELECT cron.schedule(
  'invoke-imggo-worker',
  '*/1 * * * *',  -- Every minute (adjust as needed, pg_cron doesn't support seconds)
  $$
  SELECT
    net.http_post(
      url := 'https://bgdlalagnctabfiyimpt.supabase.co/functions/v1/worker',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGxhbGFnbmN0YWJmaXlpbXB0Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTczNjQ5MzEzMCwiZXhwIjoyMDUyMDY5MTMwfQ.9-8hcfH6vNe-VPf71c9Hnn_KDL5J4_42qTgXL6VfLZ4'
      ),
      body := '{}'::jsonb
    );
  $$
);

-- Verify the cron job was created
SELECT * FROM cron.job WHERE jobname = 'invoke-imggo-worker';

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
SELECT '✅ Cron job setup complete!' AS status;
