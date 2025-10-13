-- ImgGo Helper Functions
-- Migration 003: Stored procedures and helper functions

-- =============================================================================
-- AUTO-CREATE PROFILE ON USER SIGNUP
-- =============================================================================

create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email);
  return new;
end;
$$ language plpgsql security definer;

-- Trigger on auth.users insert
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =============================================================================
-- GET USER'S JOBS WITH PATTERN INFO
-- =============================================================================

create or replace function public.get_my_jobs(
  p_pattern_id uuid default null,
  p_status job_status default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid,
  pattern_id uuid,
  pattern_name text,
  image_url text,
  status job_status,
  manifest jsonb,
  error text,
  latency_ms integer,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
) as $$
begin
  return query
  select
    j.id,
    j.pattern_id,
    p.name as pattern_name,
    j.image_url,
    j.status,
    j.manifest,
    j.error,
    j.latency_ms,
    j.created_at,
    j.updated_at,
    j.completed_at
  from jobs j
  inner join patterns p on p.id = j.pattern_id
  where p.user_id = auth.uid()
    and (p_pattern_id is null or j.pattern_id = p_pattern_id)
    and (p_status is null or j.status = p_status)
  order by j.created_at desc
  limit p_limit
  offset p_offset;
end;
$$ language plpgsql security definer;

comment on function public.get_my_jobs is 'Get paginated jobs for the authenticated user with optional filters';

-- =============================================================================
-- CHECK RATE LIMIT
-- =============================================================================

create or replace function public.check_rate_limit(
  p_endpoint text,
  p_max_tokens integer default 100,
  p_refill_rate integer default 10,
  p_refill_interval interval default '1 minute'
)
returns boolean as $$
declare
  v_user_id uuid;
  v_current_tokens integer;
  v_last_refill timestamptz;
  v_elapsed_intervals integer;
  v_new_tokens integer;
begin
  v_user_id := auth.uid();

  if v_user_id is null then
    raise exception 'Unauthorized';
  end if;

  -- Get or create rate limit record
  select tokens, last_refill_at
  into v_current_tokens, v_last_refill
  from rate_limits
  where user_id = v_user_id and endpoint = p_endpoint;

  if not found then
    -- First request, create record with full tokens
    insert into rate_limits (user_id, endpoint, tokens, last_refill_at)
    values (v_user_id, p_endpoint, p_max_tokens - 1, now());
    return true;
  end if;

  -- Calculate token refill
  v_elapsed_intervals := extract(epoch from (now() - v_last_refill)) / extract(epoch from p_refill_interval);
  v_new_tokens := least(p_max_tokens, v_current_tokens + (v_elapsed_intervals * p_refill_rate));

  -- Check if we have tokens
  if v_new_tokens < 1 then
    return false;
  end if;

  -- Consume one token
  update rate_limits
  set
    tokens = v_new_tokens - 1,
    last_refill_at = case
      when v_elapsed_intervals > 0 then now()
      else last_refill_at
    end
  where user_id = v_user_id and endpoint = p_endpoint;

  return true;
end;
$$ language plpgsql security definer;

comment on function public.check_rate_limit is 'Token bucket rate limiter: returns true if request is allowed';

-- =============================================================================
-- GET PATTERN WITH LATEST VERSION
-- =============================================================================

create or replace function public.get_pattern_with_version(p_pattern_id uuid)
returns table (
  id uuid,
  user_id uuid,
  name text,
  format manifest_format,
  json_schema jsonb,
  instructions text,
  model_profile text,
  version integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) as $$
begin
  return query
  select
    p.id,
    p.user_id,
    p.name,
    p.format,
    p.json_schema,
    p.instructions,
    p.model_profile,
    p.version,
    p.is_active,
    p.created_at,
    p.updated_at
  from patterns p
  where p.id = p_pattern_id
    and p.user_id = auth.uid();
end;
$$ language plpgsql security definer;

-- =============================================================================
-- PUBLISH PATTERN VERSION
-- =============================================================================

create or replace function public.publish_pattern_version(
  p_pattern_id uuid,
  p_json_schema jsonb,
  p_instructions text
)
returns integer as $$
declare
  v_new_version integer;
  v_user_id uuid;
begin
  -- Verify ownership
  select user_id, version into v_user_id, v_new_version
  from patterns
  where id = p_pattern_id and user_id = auth.uid();

  if not found then
    raise exception 'Pattern not found or access denied';
  end if;

  -- Increment version
  v_new_version := v_new_version + 1;

  -- Insert version history
  insert into pattern_versions (pattern_id, version, json_schema, instructions)
  values (p_pattern_id, v_new_version, p_json_schema, p_instructions);

  -- Update pattern
  update patterns
  set
    version = v_new_version,
    json_schema = p_json_schema,
    instructions = p_instructions,
    updated_at = now()
  where id = p_pattern_id;

  return v_new_version;
end;
$$ language plpgsql security definer;

comment on function public.publish_pattern_version is 'Create new version of pattern and update current';
