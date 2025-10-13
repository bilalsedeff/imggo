# Database Migrations Guide

## Setup Order for New Environments

When setting up a new Supabase project, run migrations in this order:

### 1. Core Database Schema (Sequential)

Run these in order:

```bash
001_init_schema.sql           # Tables, indexes, triggers
002_rls_policies.sql          # Row Level Security
003_functions.sql             # Business logic functions
004_simple_queue_fallback.sql # Basic queue (if PGMQ unavailable)
005_pgmq_wrapper_functions.sql # PGMQ with SECURITY DEFINER
010_add_format_specific_schemas.sql
011_update_publish_pattern_version_with_schemas.sql
013_remove_template_column.sql
014_update_publish_pattern_version_no_template.sql
015_add_switch_pattern_version.sql
016_add_pattern_job_stats_rpc.sql
017_add_metrics_functions.sql
018_grant_pgmq_permissions.sql # PGMQ permissions (critical!)
```

### 2. Infrastructure Setup (Once per environment)

#### Storage Bucket

```bash
# Run in Supabase SQL Editor
db/migrations/setup_storage.sql
```

Then manually configure RLS policies in Dashboard (templates in the file).

#### Worker Cron Job

```bash
# Run in Supabase SQL Editor
db/migrations/setup_cron.sql
```

### 3. Optional: Demo Data (Dev only)

```bash
db/seeds/001_demo_data.sql  # Development/testing only
```

## Migration Principles

### ✅ Keep in Git

- All numbered migrations (001-018)
- Infrastructure files (setup_storage.sql, setup_cron.sql)
- Seed files (if using fake data)

### ❌ Don't Commit

- `.env` files
- Real user data
- API keys in SQL comments

## Production Deployment

### Option 1: Manual (Safe for first deployment)

1. Run migrations 001-018 sequentially in SQL Editor
2. Run setup_storage.sql
3. Configure storage RLS policies in Dashboard
4. Run setup_cron.sql
5. Verify with test request

### Option 2: Supabase CLI (Recommended)

```bash
# Link to production project
supabase link --project-ref <prod-project-id>

# Push migrations
supabase db push

# Then run infrastructure scripts manually
```

### Option 3: CI/CD

```yaml
# .github/workflows/deploy-db.yml
- name: Run migrations
  run: |
    for file in db/migrations/0*.sql; do
      supabase db execute -f $file
    done
```

## Troubleshooting

### PGMQ Extension Not Found

```sql
-- In Supabase Dashboard: Database > Extensions
-- Enable "pgmq" extension first
```

### Permission Errors

```sql
-- Ensure 018_grant_pgmq_permissions.sql has been run
-- Functions need SECURITY DEFINER to access PGMQ tables
```

### Storage Bucket Not Found

```sql
-- Run setup_storage.sql
-- Bucket is created in storage.buckets table
```

## Notes

- **IMPORTANT**: Migration `005_pgmq_wrapper_functions.sql` was updated to use `SECURITY DEFINER`
- **IMPORTANT**: Migration `018_grant_pgmq_permissions.sql` grants necessary permissions
- If you deployed before these fixes, run `PGMQ_COMPLETE_FIX.sql` (root directory)
