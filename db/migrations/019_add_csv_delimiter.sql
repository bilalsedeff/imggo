-- Add csv_delimiter column to patterns and pattern_versions tables
-- Supports comma and semicolon delimiters for CSV format

-- Add delimiter column to patterns table
ALTER TABLE patterns
ADD COLUMN csv_delimiter TEXT DEFAULT 'comma' CHECK (csv_delimiter IN ('comma', 'semicolon'));

COMMENT ON COLUMN patterns.csv_delimiter IS 'CSV delimiter type: comma or semicolon';

-- Add delimiter column to pattern_versions table
ALTER TABLE pattern_versions
ADD COLUMN csv_delimiter TEXT DEFAULT 'comma' CHECK (csv_delimiter IN ('comma', 'semicolon'));

COMMENT ON COLUMN pattern_versions.csv_delimiter IS 'CSV delimiter type: comma or semicolon';
