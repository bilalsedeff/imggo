-- Add format-specific schema columns to patterns and pattern_versions tables
-- Only one schema column should be populated per pattern based on its format

-- Add schema columns to patterns table
ALTER TABLE patterns
ADD COLUMN yaml_schema TEXT,
ADD COLUMN xml_schema TEXT,
ADD COLUMN csv_schema TEXT,
ADD COLUMN plain_text_schema TEXT;

COMMENT ON COLUMN patterns.yaml_schema IS 'Schema definition for YAML format patterns';
COMMENT ON COLUMN patterns.xml_schema IS 'Schema definition for XML format patterns';
COMMENT ON COLUMN patterns.csv_schema IS 'Schema definition for CSV format patterns';
COMMENT ON COLUMN patterns.plain_text_schema IS 'Schema definition for plain text format patterns';

-- Add schema columns to pattern_versions table
ALTER TABLE pattern_versions
ADD COLUMN yaml_schema TEXT,
ADD COLUMN xml_schema TEXT,
ADD COLUMN csv_schema TEXT,
ADD COLUMN plain_text_schema TEXT;

COMMENT ON COLUMN pattern_versions.yaml_schema IS 'Schema definition for YAML format patterns';
COMMENT ON COLUMN pattern_versions.xml_schema IS 'Schema definition for XML format patterns';
COMMENT ON COLUMN pattern_versions.csv_schema IS 'Schema definition for CSV format patterns';
COMMENT ON COLUMN pattern_versions.plain_text_schema IS 'Schema definition for plain text format patterns';
