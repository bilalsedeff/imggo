-- ============================================================================
-- Metrics and Monitoring Functions
-- Migration 017: Functions for queue and job metrics
-- ============================================================================

-- =============================================================================
-- GET USER JOB COUNTS
-- =============================================================================
-- Returns job counts by status for a user (optionally filtered by time)

create or replace function public.get_user_job_counts(
  p_user_id uuid,
  p_since timestamptz default null
)
returns table (
  queued bigint,
  running bigint,
  succeeded bigint,
  failed bigint,
  total bigint
) as $$
begin
  return query
  select
    count(*) filter (where j.status = 'queued') as queued,
    count(*) filter (where j.status = 'running') as running,
    count(*) filter (where j.status = 'succeeded') as succeeded,
    count(*) filter (where j.status = 'failed') as failed,
    count(*) as total
  from jobs j
  inner join patterns p on p.id = j.pattern_id
  where p.user_id = p_user_id
    and (p_since is null or j.created_at >= p_since);
end;
$$ language plpgsql security definer;

comment on function public.get_user_job_counts is 'Get job counts by status for a user, optionally filtered by time';

-- =============================================================================
-- GET PATTERN JOB STATS (Enhanced)
-- =============================================================================
-- Get detailed stats for a specific pattern

create or replace function public.get_pattern_job_stats_detailed(
  p_pattern_id uuid
)
returns table (
  total_jobs bigint,
  queued bigint,
  running bigint,
  succeeded bigint,
  failed bigint,
  success_rate numeric,
  avg_latency_ms numeric,
  p95_latency_ms numeric,
  p99_latency_ms numeric,
  total_processing_time_ms bigint,
  last_job_at timestamptz,
  last_success_at timestamptz,
  last_failure_at timestamptz
) as $$
begin
  return query
  select
    count(*)::bigint as total_jobs,
    count(*) filter (where j.status = 'queued')::bigint as queued,
    count(*) filter (where j.status = 'running')::bigint as running,
    count(*) filter (where j.status = 'succeeded')::bigint as succeeded,
    count(*) filter (where j.status = 'failed')::bigint as failed,
    case
      when count(*) filter (where j.status in ('succeeded', 'failed')) > 0
      then (count(*) filter (where j.status = 'succeeded')::numeric /
            count(*) filter (where j.status in ('succeeded', 'failed'))::numeric * 100)
      else null
    end as success_rate,
    avg(j.latency_ms) filter (where j.status = 'succeeded')::numeric as avg_latency_ms,
    percentile_cont(0.95) within group (order by j.latency_ms) filter (where j.status = 'succeeded')::numeric as p95_latency_ms,
    percentile_cont(0.99) within group (order by j.latency_ms) filter (where j.status = 'succeeded')::numeric as p99_latency_ms,
    sum(j.latency_ms) filter (where j.latency_ms is not null)::bigint as total_processing_time_ms,
    max(j.created_at) as last_job_at,
    max(j.completed_at) filter (where j.status = 'succeeded') as last_success_at,
    max(j.completed_at) filter (where j.status = 'failed') as last_failure_at
  from jobs j
  inner join patterns p on p.id = j.pattern_id
  where j.pattern_id = p_pattern_id
    and p.user_id = auth.uid();
end;
$$ language plpgsql security definer;

comment on function public.get_pattern_job_stats_detailed is 'Get detailed job statistics for a specific pattern';

-- =============================================================================
-- GET SYSTEM-WIDE METRICS (Admin only)
-- =============================================================================
-- Returns aggregated metrics across all users (for admin dashboard)

create or replace function public.get_system_metrics(
  p_since timestamptz default null
)
returns table (
  total_users bigint,
  total_patterns bigint,
  total_jobs bigint,
  jobs_queued bigint,
  jobs_running bigint,
  jobs_succeeded bigint,
  jobs_failed bigint,
  success_rate numeric,
  avg_latency_ms numeric,
  total_processing_time_hours numeric,
  active_users_24h bigint
) as $$
begin
  -- For now, allow any authenticated user to see system metrics
  -- In production, add admin role check: if not is_admin(auth.uid()) then raise exception 'Unauthorized'; end if;

  return query
  select
    (select count(distinct user_id) from patterns)::bigint as total_users,
    (select count(*) from patterns)::bigint as total_patterns,
    count(*)::bigint as total_jobs,
    count(*) filter (where j.status = 'queued')::bigint as jobs_queued,
    count(*) filter (where j.status = 'running')::bigint as jobs_running,
    count(*) filter (where j.status = 'succeeded')::bigint as jobs_succeeded,
    count(*) filter (where j.status = 'failed')::bigint as jobs_failed,
    case
      when count(*) filter (where j.status in ('succeeded', 'failed')) > 0
      then (count(*) filter (where j.status = 'succeeded')::numeric /
            count(*) filter (where j.status in ('succeeded', 'failed'))::numeric * 100)
      else null
    end as success_rate,
    avg(j.latency_ms) filter (where j.status = 'succeeded')::numeric as avg_latency_ms,
    (sum(j.latency_ms) filter (where j.latency_ms is not null) / 3600000.0)::numeric as total_processing_time_hours,
    (select count(distinct p.user_id)
     from patterns p
     inner join jobs j2 on j2.pattern_id = p.id
     where j2.created_at >= now() - interval '24 hours')::bigint as active_users_24h
  from jobs j
  where p_since is null or j.created_at >= p_since;
end;
$$ language plpgsql security definer;

comment on function public.get_system_metrics is 'Get system-wide metrics (admin only in production)';

-- =============================================================================
-- GET JOB ERROR SUMMARY
-- =============================================================================
-- Returns aggregated error types and counts for debugging

create or replace function public.get_job_error_summary(
  p_user_id uuid,
  p_since timestamptz default null,
  p_limit integer default 20
)
returns table (
  error_message text,
  error_count bigint,
  pattern_names text[],
  first_occurrence timestamptz,
  last_occurrence timestamptz
) as $$
begin
  return query
  select
    j.error as error_message,
    count(*)::bigint as error_count,
    array_agg(distinct p.name)::text[] as pattern_names,
    min(j.created_at) as first_occurrence,
    max(j.created_at) as last_occurrence
  from jobs j
  inner join patterns p on p.id = j.pattern_id
  where p.user_id = p_user_id
    and j.status = 'failed'
    and j.error is not null
    and (p_since is null or j.created_at >= p_since)
  group by j.error
  order by error_count desc
  limit p_limit;
end;
$$ language plpgsql security definer;

comment on function public.get_job_error_summary is 'Get aggregated error types and counts for a user';

-- =============================================================================
-- CREATE INDEX FOR METRICS QUERIES
-- =============================================================================

-- Index for faster job status counts
create index if not exists idx_jobs_pattern_status on jobs(pattern_id, status);

-- Index for time-based queries
create index if not exists idx_jobs_created_status on jobs(created_at desc, status);

-- Index for error queries
create index if not exists idx_jobs_error on jobs(pattern_id, status, error) where status = 'failed' and error is not null;

-- ============================================================================
-- DONE! 🎉
-- ============================================================================
SELECT '✅ Metrics functions and indexes created!' AS status;
