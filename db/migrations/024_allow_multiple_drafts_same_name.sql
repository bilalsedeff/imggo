-- Migration 024: Allow multiple drafts with same name
-- Problem: Current unique constraint (user_id, name) prevents multiple drafts from same pattern
-- Solution: Change to partial unique index that only applies to published patterns (version >= 1)

-- Drop the existing unique constraint
ALTER TABLE patterns DROP CONSTRAINT IF EXISTS patterns_name_user_unique;

-- Create partial unique index for published patterns only
-- Drafts (version = 0) are excluded from uniqueness check
CREATE UNIQUE INDEX patterns_name_user_unique_published
  ON patterns(user_id, name)
  WHERE version >= 1 AND is_active = true;

-- Add comment explaining the logic
COMMENT ON INDEX patterns_name_user_unique_published IS
  'Unique constraint for published patterns only. Allows multiple drafts with same name since drafts (version=0) are temporary and will be merged to parent on publish.';

-- Rationale:
-- 1. Published patterns must have unique names (UX: clear pattern identification)
-- 2. Drafts can share names (temporary, invisible, merge to parent)
-- 3. Enables multiple concurrent drafts from same pattern (collaborative editing ready)
-- 4. Simplifies draft naming (no need for "Draft 1", "Draft 2", timestamps, etc.)
