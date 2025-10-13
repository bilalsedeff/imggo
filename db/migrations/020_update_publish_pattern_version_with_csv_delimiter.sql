-- Update publish_pattern_version function to include csv_delimiter

-- Drop the exact existing function signature (uuid, uuid, text, manifest_format, jsonb, text, text, text, text)
DROP FUNCTION IF EXISTS public.publish_pattern_version(uuid, uuid, text, manifest_format, jsonb, text, text, text, text);

CREATE OR REPLACE FUNCTION public.publish_pattern_version(
  p_pattern_id uuid,
  p_instructions text,
  p_format manifest_format,
  p_json_schema jsonb DEFAULT NULL,
  p_yaml_schema text DEFAULT NULL,
  p_xml_schema text DEFAULT NULL,
  p_csv_schema text DEFAULT NULL,
  p_csv_delimiter text DEFAULT 'comma',
  p_plain_text_schema text DEFAULT NULL
)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_new_version integer;
  v_user_id uuid;
BEGIN
  -- Verify ownership
  SELECT user_id, version INTO v_user_id, v_new_version
  FROM public.patterns
  WHERE id = p_pattern_id AND user_id = auth.uid();

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pattern not found or access denied';
  END IF;

  -- Increment version
  v_new_version := v_new_version + 1;

  -- Insert version history with all schema types including csv_delimiter
  INSERT INTO public.pattern_versions (
    pattern_id,
    version,
    json_schema,
    yaml_schema,
    xml_schema,
    csv_schema,
    csv_delimiter,
    plain_text_schema,
    instructions,
    format
  )
  VALUES (
    p_pattern_id,
    v_new_version,
    p_json_schema,
    p_yaml_schema,
    p_xml_schema,
    p_csv_schema,
    p_csv_delimiter,
    p_plain_text_schema,
    p_instructions,
    p_format
  );

  -- Update pattern with all schema types including csv_delimiter
  UPDATE public.patterns
  SET
    version = v_new_version,
    json_schema = p_json_schema,
    yaml_schema = p_yaml_schema,
    xml_schema = p_xml_schema,
    csv_schema = p_csv_schema,
    csv_delimiter = p_csv_delimiter,
    plain_text_schema = p_plain_text_schema,
    instructions = p_instructions,
    format = p_format,
    updated_at = now()
  WHERE id = p_pattern_id;

  RETURN v_new_version;
END;
$$;

COMMENT ON FUNCTION public.publish_pattern_version IS 'Create new version of pattern with format-specific schemas including CSV delimiter';
