-- ============================================================================
-- COMPLETE PGMQ PERMISSIONS FIX
-- ============================================================================
-- This recreates the wrapper functions with SECURITY DEFINER so they can
-- access the underlying PGMQ tables on behalf of the caller
-- ============================================================================

-- Drop existing wrapper functions
DROP FUNCTION IF EXISTS pgmq_create(text);
DROP FUNCTION IF EXISTS pgmq_send(text, jsonb);
DROP FUNCTION IF EXISTS pgmq_read(text, int, int);
DROP FUNCTION IF EXISTS pgmq_delete(text, bigint);
DROP FUNCTION IF EXISTS pgmq_archive(text, bigint);
DROP FUNCTION IF EXISTS pgmq_metrics(text);

-- Recreate with SECURITY DEFINER
-- This allows the functions to execute with the owner's (postgres) permissions

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
-- Note: PGMQ metrics returns: queue_name (text), queue_length, newest_msg_age_sec, oldest_msg_age_sec, total_messages, scrape_time
CREATE OR REPLACE FUNCTION pgmq_metrics(q_name text)
RETURNS TABLE(
  queue_name text,
  queue_length bigint,
  newest_msg_age_sec integer,
  oldest_msg_age_sec integer,
  total_messages bigint,
  scrape_time timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN QUERY SELECT * FROM pgmq.metrics(q_name);
END;
$$;

COMMENT ON FUNCTION pgmq_metrics(text) IS 'Wrapper for pgmq.metrics - Returns queue statistics';

-- Grant execute permissions to authenticated and service_role
GRANT EXECUTE ON FUNCTION pgmq_create(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_send(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_read(text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_delete(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_archive(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_metrics(text) TO authenticated, service_role;

-- Grant schema usage
GRANT USAGE ON SCHEMA pgmq TO authenticated, service_role;

-- Grant select on meta table for queue introspection
GRANT SELECT ON pgmq.meta TO authenticated, service_role;

-- ============================================================================
-- TEST THE FIX
-- ============================================================================

-- Test send function (should not error)
SELECT pgmq_send('ingest_jobs', '{"test": true}'::jsonb) as test_msg_id;

-- ============================================================================
-- ✅ DONE! You should see a message ID returned from the test
-- ============================================================================
