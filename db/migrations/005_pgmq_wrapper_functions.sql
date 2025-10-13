-- ============================================================================
-- PGMQ Wrapper Functions for RPC Access
-- ============================================================================
-- PGMQ extension installs functions in pgmq schema
-- These wrappers make them accessible via Supabase RPC calls
-- IMPORTANT: Functions use SECURITY DEFINER to access pgmq tables
-- ============================================================================

-- 1. Create queue wrapper
CREATE OR REPLACE FUNCTION pgmq_create(queue_name text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  PERFORM pgmq.create(queue_name);
END;
$$;

COMMENT ON FUNCTION pgmq_create(text) IS 'Wrapper for pgmq.create - Creates a new queue';

-- 2. Send message wrapper
CREATE OR REPLACE FUNCTION pgmq_send(queue_name text, msg jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN pgmq.send(queue_name, msg);
END;
$$;

COMMENT ON FUNCTION pgmq_send(text, jsonb) IS 'Wrapper for pgmq.send - Enqueues a message';

-- 3. Read messages wrapper
CREATE OR REPLACE FUNCTION pgmq_read(queue_name text, vt int, qty int)
RETURNS SETOF pgmq.message_record
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.read(queue_name, vt, qty);
END;
$$;

COMMENT ON FUNCTION pgmq_read(text, int, int) IS 'Wrapper for pgmq.read - Reads messages with visibility timeout';

-- 4. Delete message wrapper
CREATE OR REPLACE FUNCTION pgmq_delete(queue_name text, msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN pgmq.delete(queue_name, msg_id);
END;
$$;

COMMENT ON FUNCTION pgmq_delete(text, bigint) IS 'Wrapper for pgmq.delete - Deletes a message from queue';

-- 5. Archive message wrapper
CREATE OR REPLACE FUNCTION pgmq_archive(queue_name text, msg_id bigint)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN pgmq.archive(queue_name, msg_id);
END;
$$;

COMMENT ON FUNCTION pgmq_archive(text, bigint) IS 'Wrapper for pgmq.archive - Archives a failed message';

-- 6. Queue metrics wrapper
CREATE OR REPLACE FUNCTION pgmq_metrics(queue_name text)
RETURNS TABLE(
  queue_length bigint,
  oldest_msg_age_sec numeric,
  newest_msg_age_sec numeric,
  total_messages bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.metrics(queue_name);
END;
$$;

COMMENT ON FUNCTION pgmq_metrics(text) IS 'Wrapper for pgmq.metrics - Returns queue statistics';

-- ============================================================================
-- Grant Permissions
-- ============================================================================

-- Grant execute on all PGMQ wrapper functions
GRANT EXECUTE ON FUNCTION pgmq_create(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_send(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_read(text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_delete(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_archive(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_metrics(text) TO authenticated, service_role;

-- Grant schema usage
GRANT USAGE ON SCHEMA pgmq TO authenticated, service_role;

-- Grant select on meta table
GRANT SELECT ON pgmq.meta TO authenticated, service_role;

-- ============================================================================
-- Initialize default queue
-- ============================================================================

-- Create ingest_jobs queue if it doesn't exist
DO $$
BEGIN
  PERFORM pgmq_create('ingest_jobs');
EXCEPTION
  WHEN OTHERS THEN
    -- Queue already exists, ignore error
    NULL;
END $$;

-- Verify queue was created
SELECT queue_name, created_at
FROM pgmq.meta
WHERE queue_name = 'ingest_jobs';

-- ============================================================================
-- ✅ DONE! PGMQ is ready for use with proper security
-- ============================================================================
