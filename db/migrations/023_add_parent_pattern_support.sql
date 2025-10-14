-- Migration 023: Add parent pattern support for draft versioning
-- When a draft is created from an existing pattern, it stores reference to parent
-- When publishing a draft, it updates the parent pattern with new version

-- Add parent_pattern_id column to track parent-child relationship
alter table patterns
  add column parent_pattern_id uuid references patterns(id) on delete set null;

-- Add index for efficient querying of drafts by parent
create index if not exists idx_patterns_parent_id on patterns(parent_pattern_id);

-- Add comment to explain parent pattern relationship
comment on column patterns.parent_pattern_id is 'Reference to parent pattern when this is a draft. NULL for original patterns and published versions. Used to link drafts to their source pattern for proper versioning.';

-- Drafts workflow:
-- 1. User clicks "Create New Version" on pattern X (id=abc, name="My Pattern", version=3)
-- 2. System creates draft: (id=xyz, name="My Pattern (Draft)", version=0, is_active=false, parent_pattern_id=abc)
-- 3. User edits draft and clicks "Publish"
-- 4. System:
--    - Archives current version of parent (abc v3) to pattern_versions
--    - Updates parent (abc) with draft content, increments version to 4
--    - Deletes or archives draft (xyz)
--    - Result: Pattern X now has version 4 with draft's content
