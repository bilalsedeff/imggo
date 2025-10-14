-- 🚀 Apply this SQL in Supabase Dashboard → SQL Editor
-- Migration 024: Allow multiple drafts with same name

-- Drop the existing unique constraint
ALTER TABLE patterns DROP CONSTRAINT IF EXISTS patterns_name_user_unique;

-- Create partial unique index for published patterns only
-- Drafts (version = 0) are excluded from uniqueness check
CREATE UNIQUE INDEX IF NOT EXISTS patterns_name_user_unique_published
  ON patterns(user_id, name)
  WHERE version >= 1 AND is_active = true;

-- Add comment explaining the logic
COMMENT ON INDEX patterns_name_user_unique_published IS
  'Unique constraint for published patterns only. Allows multiple drafts with same name since drafts (version=0) are temporary and will be merged to parent on publish.';

-- ✅ Migration complete!
-- Now you can create multiple drafts from the same pattern without name conflicts.
