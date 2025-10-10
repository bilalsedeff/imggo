-- ============================================================================
-- ImgGo - Complete Database Setup
-- Run this entire file in Supabase SQL Editor
-- ============================================================================

-- ============================================================================
-- PART 1: Extensions and Enums
-- ============================================================================

-- Note: gen_random_uuid() is built-in for Postgres 13+
-- Note: pgmq needs to be installed via Database > Extensions in Supabase Dashboard first
-- Skip extension creation here and assume it's already installed

-- Create enums
DO $$ BEGIN
    CREATE TYPE public.manifest_format AS ENUM ('json', 'yaml', 'xml', 'csv', 'text');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE public.job_status AS ENUM ('queued', 'running', 'succeeded', 'failed');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- ============================================================================
-- PART 2: Tables
-- ============================================================================

-- Profiles table (shadow of auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.profiles IS 'User profiles synchronized with auth.users';

-- API Keys table
CREATE TABLE IF NOT EXISTS public.api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  hashed_key text NOT NULL,
  name text NOT NULL,
  scopes text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  last_used_at timestamptz,
  expires_at timestamptz,
  is_active boolean NOT NULL DEFAULT true
);

COMMENT ON TABLE public.api_keys IS 'API keys for programmatic access';

-- Patterns table
CREATE TABLE IF NOT EXISTS public.patterns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name text NOT NULL,
  format public.manifest_format NOT NULL DEFAULT 'json',
  json_schema jsonb,
  instructions text NOT NULL,
  model_profile text NOT NULL DEFAULT 'managed-default',
  version integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT patterns_name_user_unique UNIQUE (user_id, name)
);

COMMENT ON TABLE public.patterns IS 'Pattern definitions for image analysis';
COMMENT ON COLUMN public.patterns.json_schema IS 'Optional JSON Schema for strict validation';
COMMENT ON COLUMN public.patterns.model_profile IS 'LLM/VLM provider profile identifier';

-- Pattern Versions table
CREATE TABLE IF NOT EXISTS public.pattern_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES public.patterns(id) ON DELETE CASCADE,
  version integer NOT NULL,
  json_schema jsonb,
  instructions text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pattern_versions_unique UNIQUE (pattern_id, version)
);

COMMENT ON TABLE public.pattern_versions IS 'Version history for patterns';

-- Jobs table
CREATE TABLE IF NOT EXISTS public.jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pattern_id uuid NOT NULL REFERENCES public.patterns(id) ON DELETE RESTRICT,
  image_url text NOT NULL,
  status public.job_status NOT NULL DEFAULT 'queued',
  manifest jsonb,
  error text,
  latency_ms integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  started_at timestamptz,
  completed_at timestamptz,
  idempotency_key text UNIQUE,
  requested_by uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  extras jsonb
);

COMMENT ON TABLE public.jobs IS 'Image processing jobs queue and history';
COMMENT ON COLUMN public.jobs.idempotency_key IS 'Client-provided idempotency key for duplicate prevention';
COMMENT ON COLUMN public.jobs.extras IS 'Additional metadata from client';

-- Webhooks table
CREATE TABLE IF NOT EXISTS public.webhooks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url text NOT NULL,
  secret text NOT NULL,
  events text[] NOT NULL DEFAULT '{job.succeeded,job.failed}',
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_triggered_at timestamptz,
  CONSTRAINT webhooks_url_user_unique UNIQUE (user_id, url)
);

COMMENT ON TABLE public.webhooks IS 'Webhook endpoints for event notifications';

-- Rate limiting table
CREATE TABLE IF NOT EXISTS public.rate_limits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  endpoint text NOT NULL,
  tokens integer NOT NULL DEFAULT 0,
  last_refill_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT rate_limits_user_endpoint_unique UNIQUE (user_id, endpoint)
);

COMMENT ON TABLE public.rate_limits IS 'Token bucket rate limiting per user per endpoint';

-- ============================================================================
-- PART 3: Indexes
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON public.api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_hashed_key ON public.api_keys(hashed_key) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_patterns_user_id_active ON public.patterns(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_patterns_created_at ON public.patterns(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_versions_pattern_id ON public.pattern_versions(pattern_id);

CREATE INDEX IF NOT EXISTS idx_jobs_pattern_id_created ON public.jobs(pattern_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON public.jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON public.jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_idempotency_key ON public.jobs(idempotency_key) WHERE idempotency_key IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_jobs_manifest_gin ON public.jobs USING gin(manifest);

CREATE INDEX IF NOT EXISTS idx_webhooks_user_id_active ON public.webhooks(user_id, is_active);

CREATE INDEX IF NOT EXISTS idx_rate_limits_user_endpoint ON public.rate_limits(user_id, endpoint);

-- ============================================================================
-- PART 4: Triggers
-- ============================================================================

-- Updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  new.updated_at = now();
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Add triggers
DROP TRIGGER IF EXISTS update_profiles_updated_at ON public.profiles;
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_patterns_updated_at ON public.patterns;
CREATE TRIGGER update_patterns_updated_at BEFORE UPDATE ON public.patterns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_jobs_updated_at ON public.jobs;
CREATE TRIGGER update_jobs_updated_at BEFORE UPDATE ON public.jobs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_webhooks_updated_at ON public.webhooks;
CREATE TRIGGER update_webhooks_updated_at BEFORE UPDATE ON public.webhooks
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- PART 5: RLS Policies
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pattern_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;

-- Profiles policies
DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert own profile" ON public.profiles;
CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT
  WITH CHECK (auth.uid() = id);

-- API Keys policies
DROP POLICY IF EXISTS "Users can view own API keys" ON public.api_keys;
CREATE POLICY "Users can view own API keys"
  ON public.api_keys FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own API keys" ON public.api_keys;
CREATE POLICY "Users can create own API keys"
  ON public.api_keys FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own API keys" ON public.api_keys;
CREATE POLICY "Users can update own API keys"
  ON public.api_keys FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own API keys" ON public.api_keys;
CREATE POLICY "Users can delete own API keys"
  ON public.api_keys FOR DELETE
  USING (auth.uid() = user_id);

-- Patterns policies
DROP POLICY IF EXISTS "Users can view own patterns" ON public.patterns;
CREATE POLICY "Users can view own patterns"
  ON public.patterns FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own patterns" ON public.patterns;
CREATE POLICY "Users can create own patterns"
  ON public.patterns FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own patterns" ON public.patterns;
CREATE POLICY "Users can update own patterns"
  ON public.patterns FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own patterns" ON public.patterns;
CREATE POLICY "Users can delete own patterns"
  ON public.patterns FOR DELETE
  USING (auth.uid() = user_id);

-- Pattern Versions policies
DROP POLICY IF EXISTS "Users can view own pattern versions" ON public.pattern_versions;
CREATE POLICY "Users can view own pattern versions"
  ON public.pattern_versions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patterns p
      WHERE p.id = pattern_versions.pattern_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create own pattern versions" ON public.pattern_versions;
CREATE POLICY "Users can create own pattern versions"
  ON public.pattern_versions FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patterns p
      WHERE p.id = pattern_versions.pattern_id
      AND p.user_id = auth.uid()
    )
  );

-- Jobs policies
DROP POLICY IF EXISTS "Users can view own jobs" ON public.jobs;
CREATE POLICY "Users can view own jobs"
  ON public.jobs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patterns p
      WHERE p.id = jobs.pattern_id
      AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can create jobs for own patterns" ON public.jobs;
CREATE POLICY "Users can create jobs for own patterns"
  ON public.jobs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patterns p
      WHERE p.id = jobs.pattern_id
      AND p.user_id = auth.uid()
    )
  );

-- Webhooks policies
DROP POLICY IF EXISTS "Users can view own webhooks" ON public.webhooks;
CREATE POLICY "Users can view own webhooks"
  ON public.webhooks FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create own webhooks" ON public.webhooks;
CREATE POLICY "Users can create own webhooks"
  ON public.webhooks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update own webhooks" ON public.webhooks;
CREATE POLICY "Users can update own webhooks"
  ON public.webhooks FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete own webhooks" ON public.webhooks;
CREATE POLICY "Users can delete own webhooks"
  ON public.webhooks FOR DELETE
  USING (auth.uid() = user_id);

-- Rate Limits policies
DROP POLICY IF EXISTS "Users can view own rate limits" ON public.rate_limits;
CREATE POLICY "Users can view own rate limits"
  ON public.rate_limits FOR SELECT
  USING (auth.uid() = user_id);

-- ============================================================================
-- PART 6: Functions
-- ============================================================================

-- Auto-create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email)
  VALUES (new.id, new.email);
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Get user's jobs with pattern info
CREATE OR REPLACE FUNCTION public.get_my_jobs(
  p_pattern_id uuid DEFAULT NULL,
  p_status public.job_status DEFAULT NULL,
  p_limit integer DEFAULT 50,
  p_offset integer DEFAULT 0
)
RETURNS TABLE (
  id uuid,
  pattern_id uuid,
  pattern_name text,
  image_url text,
  status public.job_status,
  manifest jsonb,
  error text,
  latency_ms integer,
  created_at timestamptz,
  updated_at timestamptz,
  completed_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    j.id,
    j.pattern_id,
    p.name AS pattern_name,
    j.image_url,
    j.status,
    j.manifest,
    j.error,
    j.latency_ms,
    j.created_at,
    j.updated_at,
    j.completed_at
  FROM public.jobs j
  INNER JOIN public.patterns p ON p.id = j.pattern_id
  WHERE p.user_id = auth.uid()
    AND (p_pattern_id IS NULL OR j.pattern_id = p_pattern_id)
    AND (p_status IS NULL OR j.status = p_status)
  ORDER BY j.created_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.get_my_jobs IS 'Get paginated jobs for the authenticated user with optional filters';

-- Check rate limit
CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_endpoint text,
  p_max_tokens integer DEFAULT 100,
  p_refill_rate integer DEFAULT 10,
  p_refill_interval interval DEFAULT '1 minute'
)
RETURNS boolean AS $$
DECLARE
  v_user_id uuid;
  v_current_tokens integer;
  v_last_refill timestamptz;
  v_elapsed_intervals integer;
  v_new_tokens integer;
BEGIN
  v_user_id := auth.uid();

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Get or create rate limit record
  SELECT tokens, last_refill_at
  INTO v_current_tokens, v_last_refill
  FROM public.rate_limits
  WHERE user_id = v_user_id AND endpoint = p_endpoint;

  IF NOT FOUND THEN
    -- First request, create record with full tokens
    INSERT INTO public.rate_limits (user_id, endpoint, tokens, last_refill_at)
    VALUES (v_user_id, p_endpoint, p_max_tokens - 1, now());
    RETURN true;
  END IF;

  -- Calculate token refill
  v_elapsed_intervals := EXTRACT(epoch FROM (now() - v_last_refill)) / EXTRACT(epoch FROM p_refill_interval);
  v_new_tokens := LEAST(p_max_tokens, v_current_tokens + (v_elapsed_intervals * p_refill_rate));

  -- Check if we have tokens
  IF v_new_tokens < 1 THEN
    RETURN false;
  END IF;

  -- Consume one token
  UPDATE public.rate_limits
  SET
    tokens = v_new_tokens - 1,
    last_refill_at = CASE
      WHEN v_elapsed_intervals > 0 THEN now()
      ELSE last_refill_at
    END
  WHERE user_id = v_user_id AND endpoint = p_endpoint;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.check_rate_limit IS 'Token bucket rate limiter: returns true if request is allowed';

-- Get pattern with version
CREATE OR REPLACE FUNCTION public.get_pattern_with_version(p_pattern_id uuid)
RETURNS TABLE (
  id uuid,
  user_id uuid,
  name text,
  format public.manifest_format,
  json_schema jsonb,
  instructions text,
  model_profile text,
  version integer,
  is_active boolean,
  created_at timestamptz,
  updated_at timestamptz
) AS $$
BEGIN
  RETURN QUERY
  SELECT
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
  FROM public.patterns p
  WHERE p.id = p_pattern_id
    AND p.user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Publish pattern version
CREATE OR REPLACE FUNCTION public.publish_pattern_version(
  p_pattern_id uuid,
  p_json_schema jsonb,
  p_instructions text
)
RETURNS integer AS $$
DECLARE
  v_new_version integer;
  v_user_id uuid;
BEGIN
  -- Verify ownership
  SELECT user_id, version INTO v_user_id, v_new_version
  FROM public.patterns
  WHERE id = p_pattern_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pattern not found or access denied';
  END IF;

  -- Increment version
  v_new_version := v_new_version + 1;

  -- Insert version history
  INSERT INTO public.pattern_versions (pattern_id, version, json_schema, instructions)
  VALUES (p_pattern_id, v_new_version, p_json_schema, p_instructions);

  -- Update pattern
  UPDATE public.patterns
  SET
    version = v_new_version,
    json_schema = p_json_schema,
    instructions = p_instructions,
    updated_at = now()
  WHERE id = p_pattern_id;

  RETURN v_new_version;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.publish_pattern_version IS 'Create new version of pattern and update current';

-- ============================================================================
-- PART 7: PGMQ Queue
-- ============================================================================

-- Create PGMQ queue (requires pgmq extension to be installed first)
-- If pgmq is not installed, install it from Database > Extensions in Supabase Dashboard
DO $$
BEGIN
  PERFORM pgmq.create('ingest_jobs');
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'pgmq extension not installed. Please install it from Database > Extensions.';
  WHEN duplicate_object THEN
    RAISE NOTICE 'Queue ingest_jobs already exists.';
END
$$;

-- ============================================================================
-- DONE! 🎉
-- ============================================================================

-- Verify installation
SELECT 'Tables created: ' || COUNT(*)::text FROM information_schema.tables WHERE table_schema = 'public';
SELECT 'Queues created: ' || COUNT(*)::text FROM pgmq.list_queues();
SELECT '✅ Database setup complete!' AS status;
