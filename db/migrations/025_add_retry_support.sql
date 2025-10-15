-- Migration 025: Add retry support to jobs table
-- Purpose: Track retry attempts and prevent infinite retry loops

-- Add retry tracking columns
alter table jobs
  add column retry_count integer not null default 0,
  add column max_retries integer not null default 2,
  add column last_error text;

-- Comments
comment on column jobs.retry_count is 'Number of retry attempts made (0 = first attempt)';
comment on column jobs.max_retries is 'Maximum number of retries allowed before marking as permanently failed';
comment on column jobs.last_error is 'Most recent error message (preserved across retries)';

-- Index for monitoring retry statistics
create index idx_jobs_retry_count on jobs(retry_count) where retry_count > 0;
