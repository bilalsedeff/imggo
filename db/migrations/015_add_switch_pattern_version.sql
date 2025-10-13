-- Migration 015: Add function to switch to a previous pattern version
-- Allows users to revert to any previous version from the version history

CREATE OR REPLACE FUNCTION public.switch_to_pattern_version(
  p_pattern_id uuid,
  p_user_id uuid,
  p_target_version integer
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_user_id uuid;
  v_version_data record;
BEGIN
  -- Verify ownership
  SELECT user_id INTO v_user_id
  FROM public.patterns
  WHERE id = p_pattern_id AND user_id = p_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pattern not found or access denied';
  END IF;

  -- Get the target version data from pattern_versions
  SELECT
    json_schema,
    yaml_schema,
    xml_schema,
    csv_schema,
    plain_text_schema,
    instructions,
    format
  INTO v_version_data
  FROM public.pattern_versions
  WHERE pattern_id = p_pattern_id AND version = p_target_version;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Version % not found for this pattern', p_target_version;
  END IF;

  -- Update patterns table with the target version's data
  UPDATE public.patterns
  SET
    version = p_target_version,
    json_schema = v_version_data.json_schema,
    yaml_schema = v_version_data.yaml_schema,
    xml_schema = v_version_data.xml_schema,
    csv_schema = v_version_data.csv_schema,
    plain_text_schema = v_version_data.plain_text_schema,
    instructions = v_version_data.instructions,
    format = v_version_data.format,
    updated_at = now()
  WHERE id = p_pattern_id;

END;
$$;

COMMENT ON FUNCTION public.switch_to_pattern_version IS 'Switch a pattern to use a specific version from its version history';
