-- Migration: Add format_metadata column to patterns table
-- Purpose: Store metadata for format reconstruction (indentation, namespaces, headers, etc.)
-- This enables 100% accurate reconstruction of YAML/XML/CSV/TEXT from JSON responses

-- Add format_metadata column to patterns table
ALTER TABLE patterns ADD COLUMN IF NOT EXISTS format_metadata JSONB;

-- Add comment explaining the column's purpose
COMMENT ON COLUMN patterns.format_metadata IS 'Metadata for format reconstruction: yamlIndent, xmlNamespace, csvHeaders, textHeadingLevels, etc.';

-- Create index for efficient queries on format_metadata
CREATE INDEX IF NOT EXISTS idx_patterns_format_metadata ON patterns USING GIN (format_metadata);

-- Add comment on the index
COMMENT ON INDEX idx_patterns_format_metadata IS 'GIN index for efficient queries on format metadata JSONB column';
