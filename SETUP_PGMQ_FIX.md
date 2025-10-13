# PGMQ Permissions Fix - One-Time Setup ⚡

## Problem

The PGMQ wrapper functions were created **without `SECURITY DEFINER`**, causing them to execute with the caller's permissions instead of the database owner's permissions. This results in:

- ✅ First error fixed: "permission denied for schema pgmq"
- ❌ Second error: "permission denied for table q_ingest_jobs"

## Root Cause

The wrapper functions need `SECURITY DEFINER` to access the underlying PGMQ queue tables on behalf of the caller.

## Solution - Use PGMQ_COMPLETE_FIX.sql 🔧

### Step 1: Apply Complete SQL Fix

**Open this file in your editor:** `PGMQ_COMPLETE_FIX.sql`

**Then:**

1. Open Supabase SQL Editor: <https://supabase.com/dashboard/project/bgdlalagnctabfiyimpt/sql/new>

2. Copy the **ENTIRE contents** of `PGMQ_COMPLETE_FIX.sql` and paste into the editor

3. Click **"Run"** (or Ctrl+Enter)

4. ✅ You should see a successful test message with a message ID returned at the bottom

**What this SQL does:**

- Drops the existing wrapper functions (without SECURITY DEFINER)
- Recreates them **with `SECURITY DEFINER`** (runs with owner's permissions)
- Adds `SET search_path` for security
- Grants execute permissions to authenticated and service_role
- **Tests the fix** by sending a test message (you'll see the msg_id)

### Step 2: Enqueue Your Pending Jobs

After the SQL runs successfully:

```bash
npx tsx scripts/enqueue-pending-jobs.ts
```

You should now see:

```plaintext
✅ Enqueued with msg_id: 1
✅ Enqueued with msg_id: 2
```

### Step 3: Process the Jobs

Trigger the worker to process:

```bash
curl -X POST "https://bgdlalagnctabfiyimpt.supabase.co/functions/v1/worker" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGxhbGFnbmN0YWJmaXlpbXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzcwODAsImV4cCI6MjA3NTY1MzA4MH0.uUcuVjZ70zdRlQpw83LPMYHAwzN3_xmx3xvcJ0McY7c" \
  -H "Content-Type: application/json"
```

### Step 4: See Your Results! 🎉

```bash
npx tsx scripts/check-jobs.ts
```

You should see both jobs with `status: "succeeded"` and beautiful structured manifests!

## Why SECURITY DEFINER?

```sql
-- ❌ Without SECURITY DEFINER (original)
CREATE FUNCTION pgmq_send(queue_name text, msg jsonb)
RETURNS bigint AS $$
BEGIN
  RETURN pgmq.send(queue_name, msg);  -- Runs with CALLER'S permissions (service_role)
END;
$$ LANGUAGE plpgsql;

-- ✅ With SECURITY DEFINER (fixed)
CREATE FUNCTION pgmq_send(queue_name text, msg jsonb)
RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER  -- Runs with OWNER'S permissions (postgres)
SET search_path = public, pgmq
AS $$
BEGIN
  RETURN pgmq.send(queue_name, msg);  -- Now has access to pgmq tables!
END;
$$;
```

## What Changed Between Attempts

**First attempt (your initial SQL):**

- Only granted EXECUTE permissions
- Functions still executed with caller's permissions
- ✅ Fixed: Function execution permission
- ❌ Still broken: Table access permission

**Second attempt (PGMQ_COMPLETE_FIX.sql):**

- Recreates functions with `SECURITY DEFINER`
- Functions now execute with database owner's permissions
- ✅ Fixes: Both function execution AND table access
- ✅ Includes built-in test to verify it works

## Your Test Data Ready to Process

We have 2 real landscape screenshots uploaded and ready:

1. **Job ID:** `c3b399bc-d469-492d-a2b6-8ba3ed17c1a8`
   - Image: `test/1760310206843-landscape.png`
   - Created: Just now
   - Waiting for: PGMQ enqueue

2. **Job ID:** `4bb5816b-17cc-4989-ab0f-8fef8a4b5e89`
   - Image: `test/1760310358017-landscape.png`
   - Created: Just now
   - Waiting for: PGMQ enqueue

**Expected manifests:**

```json
{
  "landscape_type": "mountain range with snow",
  "weather": "clear sky with clouds",
  "time_of_day": "daytime",
  "description": "A panoramic view of snow-capped mountains..."
}
```

## TL;DR - Quick Fix

```bash
# 1. Copy PGMQ_COMPLETE_FIX.sql to Supabase SQL Editor and run it
# 2. Then run:
npx tsx scripts/enqueue-pending-jobs.ts
curl -X POST "https://bgdlalagnctabfiyimpt.supabase.co/functions/v1/worker" \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZGxhbGFnbmN0YWJmaXlpbXB0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAwNzcwODAsImV4cCI6MjA3NTY1MzA4MH0.uUcuVjZ70zdRlQpw83LPMYHAwzN3_xmx3xvcJ0McY7c" \
  -H "Content-Type: application/json"
npx tsx scripts/check-jobs.ts
```

Done! 🚀
