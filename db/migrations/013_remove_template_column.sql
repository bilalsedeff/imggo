-- Migration 013: Remove template column (not needed - we use format-specific schema columns)
-- Template is just the content from the selected format's schema column

ALTER TABLE patterns
DROP COLUMN IF EXISTS template;

ALTER TABLE pattern_versions
DROP COLUMN IF EXISTS template;
