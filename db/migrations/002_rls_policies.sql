-- ImgGo RLS Policies
-- Migration 002: Row Level Security

-- Enable RLS on all tables
alter table profiles enable row level security;
alter table api_keys enable row level security;
alter table patterns enable row level security;
alter table pattern_versions enable row level security;
alter table jobs enable row level security;
alter table webhooks enable row level security;
alter table rate_limits enable row level security;

-- =============================================================================
-- PROFILES POLICIES
-- =============================================================================

-- Users can view and update their own profile
create policy "Users can view own profile"
  on profiles for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- Profiles are created via trigger on auth.users insert
create policy "Users can insert own profile"
  on profiles for insert
  with check (auth.uid() = id);

-- =============================================================================
-- API_KEYS POLICIES
-- =============================================================================

create policy "Users can view own API keys"
  on api_keys for select
  using (auth.uid() = user_id);

create policy "Users can create own API keys"
  on api_keys for insert
  with check (auth.uid() = user_id);

create policy "Users can update own API keys"
  on api_keys for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own API keys"
  on api_keys for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- PATTERNS POLICIES
-- =============================================================================

create policy "Users can view own patterns"
  on patterns for select
  using (auth.uid() = user_id);

create policy "Users can create own patterns"
  on patterns for insert
  with check (auth.uid() = user_id);

create policy "Users can update own patterns"
  on patterns for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own patterns"
  on patterns for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- PATTERN_VERSIONS POLICIES
-- =============================================================================

create policy "Users can view own pattern versions"
  on pattern_versions for select
  using (
    exists (
      select 1 from patterns p
      where p.id = pattern_versions.pattern_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can create own pattern versions"
  on pattern_versions for insert
  with check (
    exists (
      select 1 from patterns p
      where p.id = pattern_versions.pattern_id
      and p.user_id = auth.uid()
    )
  );

-- =============================================================================
-- JOBS POLICIES
-- =============================================================================

create policy "Users can view own jobs"
  on jobs for select
  using (
    exists (
      select 1 from patterns p
      where p.id = jobs.pattern_id
      and p.user_id = auth.uid()
    )
  );

create policy "Users can create jobs for own patterns"
  on jobs for insert
  with check (
    exists (
      select 1 from patterns p
      where p.id = jobs.pattern_id
      and p.user_id = auth.uid()
    )
  );

-- Jobs can be updated by the system (service role)
-- No user-facing update policy needed as updates happen via worker

-- =============================================================================
-- WEBHOOKS POLICIES
-- =============================================================================

create policy "Users can view own webhooks"
  on webhooks for select
  using (auth.uid() = user_id);

create policy "Users can create own webhooks"
  on webhooks for insert
  with check (auth.uid() = user_id);

create policy "Users can update own webhooks"
  on webhooks for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete own webhooks"
  on webhooks for delete
  using (auth.uid() = user_id);

-- =============================================================================
-- RATE_LIMITS POLICIES
-- =============================================================================

-- Rate limits are managed by the system
-- Users can view their own limits
create policy "Users can view own rate limits"
  on rate_limits for select
  using (auth.uid() = user_id);

-- System can manage rate limits (service role only)
