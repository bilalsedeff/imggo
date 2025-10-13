-- Migration 016: Add RPC function to get pattern-based job statistics
-- Returns job stats per pattern for dashboard (last 24 hours)

CREATE OR REPLACE FUNCTION public.get_pattern_job_stats(p_user_id uuid)
RETURNS TABLE (
  pattern_id uuid,
  pattern_name text,
  pattern_format manifest_format,
  total_jobs_24h bigint,
  successful_jobs_24h bigint,
  success_rate numeric,
  last_job_at timestamp with time zone
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    p.id as pattern_id,
    p.name as pattern_name,
    p.format as pattern_format,
    COUNT(j.id) as total_jobs_24h,
    COUNT(CASE WHEN j.status = 'succeeded' THEN 1 END) as successful_jobs_24h,
    CASE
      WHEN COUNT(j.id) > 0 THEN
        ROUND((COUNT(CASE WHEN j.status = 'succeeded' THEN 1 END)::numeric / COUNT(j.id)::numeric) * 100, 1)
      ELSE
        0
    END as success_rate,
    MAX(j.created_at) as last_job_at
  FROM public.patterns p
  LEFT JOIN public.jobs j ON j.pattern_id = p.id
    AND j.created_at >= NOW() - INTERVAL '24 hours'
  WHERE p.user_id = p_user_id
    AND p.is_active = true
  GROUP BY p.id, p.name, p.format
  HAVING COUNT(j.id) > 0  -- Only show patterns that have jobs in last 24h
  ORDER BY MAX(j.created_at) DESC NULLS LAST;
END;
$$;

COMMENT ON FUNCTION public.get_pattern_job_stats IS 'Get job statistics per pattern for dashboard (last 24 hours only, ordered by most recent job)';
