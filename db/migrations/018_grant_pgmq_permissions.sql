-- ============================================================================
-- Grant PGMQ Function Permissions
-- ============================================================================
-- Allow authenticated users and service role to execute PGMQ wrapper functions
-- ============================================================================

-- Grant execute on PGMQ wrapper functions to authenticated role
GRANT EXECUTE ON FUNCTION pgmq_create(text) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_send(text, jsonb) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_read(text, int, int) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_delete(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_archive(text, bigint) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION pgmq_metrics(text) TO authenticated, service_role;

-- Grant usage on pgmq schema (for accessing message_record type)
GRANT USAGE ON SCHEMA pgmq TO authenticated, service_role;

-- Grant select on pgmq.meta table (for queue introspection)
GRANT SELECT ON pgmq.meta TO authenticated, service_role;

-- Note: We don't grant direct access to queue tables (pgmq.q_*)
-- All access should go through the wrapper functions for safety

COMMENT ON FUNCTION pgmq_send IS 'Enqueue a message to PGMQ - accessible by authenticated users';
