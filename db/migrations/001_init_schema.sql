-- ImgGo Database Schema
-- Migration 001: Initial schema setup

-- Enable required extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgmq";

-- Create enums
create type manifest_format as enum ('json', 'yaml', 'xml', 'csv', 'text');
create type job_status as enum ('queued', 'running', 'succeeded', 'failed');

-- Profiles table (shadow of auth.users)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table profiles is 'User profiles synchronized with auth.users';

-- API Keys table
create table api_keys (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  hashed_key text not null,
  name text not null,
  scopes text[] not null default '{}',
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean not null default true
);

comment on table api_keys is 'API keys for programmatic access';

-- Patterns table
create table patterns (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  format manifest_format not null default 'json',
  json_schema jsonb,
  instructions text not null,
  model_profile text not null default 'managed-default',
  version integer not null default 1,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint patterns_name_user_unique unique (user_id, name)
);

comment on table patterns is 'Pattern definitions for image analysis';
comment on column patterns.json_schema is 'Optional JSON Schema for strict validation';
comment on column patterns.model_profile is 'LLM/VLM provider profile identifier';

-- Pattern Versions table
create table pattern_versions (
  id uuid primary key default uuid_generate_v4(),
  pattern_id uuid not null references patterns(id) on delete cascade,
  version integer not null,
  json_schema jsonb,
  instructions text not null,
  created_at timestamptz not null default now(),

  constraint pattern_versions_unique unique (pattern_id, version)
);

comment on table pattern_versions is 'Version history for patterns';

-- Jobs table
create table jobs (
  id uuid primary key default uuid_generate_v4(),
  pattern_id uuid not null references patterns(id) on delete restrict,
  image_url text not null,
  status job_status not null default 'queued',
  manifest jsonb,
  error text,
  latency_ms integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  idempotency_key text unique,
  requested_by uuid references profiles(id) on delete set null,
  extras jsonb
);

comment on table jobs is 'Image processing jobs queue and history';
comment on column jobs.idempotency_key is 'Client-provided idempotency key for duplicate prevention';
comment on column jobs.extras is 'Additional metadata from client';

-- Webhooks table
create table webhooks (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  url text not null,
  secret text not null,
  events text[] not null default '{job.succeeded,job.failed}',
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_triggered_at timestamptz,

  constraint webhooks_url_user_unique unique (user_id, url)
);

comment on table webhooks is 'Webhook endpoints for event notifications';

-- Rate limiting table
create table rate_limits (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  tokens integer not null default 0,
  last_refill_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint rate_limits_user_endpoint_unique unique (user_id, endpoint)
);

comment on table rate_limits is 'Token bucket rate limiting per user per endpoint';

-- Create indexes
create index idx_api_keys_user_id on api_keys(user_id);
create index idx_api_keys_hashed_key on api_keys(hashed_key) where is_active = true;

create index idx_patterns_user_id_active on patterns(user_id, is_active);
create index idx_patterns_created_at on patterns(created_at desc);

create index idx_pattern_versions_pattern_id on pattern_versions(pattern_id);

create index idx_jobs_pattern_id_created on jobs(pattern_id, created_at desc);
create index idx_jobs_status on jobs(status);
create index idx_jobs_created_at on jobs(created_at desc);
create index idx_jobs_idempotency_key on jobs(idempotency_key) where idempotency_key is not null;
create index idx_jobs_manifest_gin on jobs using gin(manifest);

create index idx_webhooks_user_id_active on webhooks(user_id, is_active);

create index idx_rate_limits_user_endpoint on rate_limits(user_id, endpoint);

-- Create updated_at trigger function
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add updated_at triggers
create trigger update_profiles_updated_at before update on profiles
  for each row execute function update_updated_at_column();

create trigger update_patterns_updated_at before update on patterns
  for each row execute function update_updated_at_column();

create trigger update_jobs_updated_at before update on jobs
  for each row execute function update_updated_at_column();

create trigger update_webhooks_updated_at before update on webhooks
  for each row execute function update_updated_at_column();

-- Create PGMQ queue
-- Note: Queue name comes from env variable SUPABASE_PGMQ_QUEUE (default: 'ingest_jobs')
-- This will be created at runtime in the application initialization
