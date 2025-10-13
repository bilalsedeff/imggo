-- Migration 022: Add draft pattern support
-- Drafts are patterns with version = 0 and is_active = false
-- Users can save work-in-progress patterns and resume later

-- Update patterns table constraint to allow version = 0 for drafts
-- Note: version column already exists with default 1

-- Add comment to explain draft convention
comment on column patterns.version is 'Pattern version number. 0 = draft (unpublished), >= 1 = published versions';
comment on column patterns.is_active is 'Active status. Drafts have is_active = false and version = 0';

-- Update index to efficiently query drafts
-- Existing index: idx_patterns_user_id_active on patterns(user_id, is_active)
-- Add index for draft queries (version = 0)
create index if not exists idx_patterns_user_id_version on patterns(user_id, version);

-- No need to modify default value - drafts will be created with explicit version = 0
-- Published patterns continue to use version >= 1
