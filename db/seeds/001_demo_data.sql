-- ImgGo Demo Seed Data
-- For local development and testing

-- Note: This assumes you have a test user in auth.users
-- For production, never seed with real user data

-- Example: If you have a test user with ID '00000000-0000-0000-0000-000000000000'
-- Uncomment and modify the following:

/*
-- Insert demo pattern
insert into patterns (
  id,
  user_id,
  name,
  format,
  json_schema,
  instructions,
  model_profile,
  version,
  is_active
) values (
  '11111111-1111-1111-1111-111111111111',
  '00000000-0000-0000-0000-000000000000', -- Replace with actual test user ID
  'Retail Shelf Audit',
  'json',
  '{
    "type": "object",
    "properties": {
      "shelf_id": {"type": "string"},
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "brand": {"type": "string"},
            "price_tag_visible": {"type": "boolean"}
          },
          "required": ["name", "brand", "price_tag_visible"]
        }
      }
    },
    "required": ["shelf_id", "products"]
  }'::jsonb,
  'Identify all products on the retail shelf. For each product, extract the product name, brand, and whether the price tag is visible.',
  'managed-default',
  1,
  true
);

-- Insert initial pattern version
insert into pattern_versions (
  pattern_id,
  version,
  json_schema,
  instructions
) values (
  '11111111-1111-1111-1111-111111111111',
  1,
  '{
    "type": "object",
    "properties": {
      "shelf_id": {"type": "string"},
      "products": {
        "type": "array",
        "items": {
          "type": "object",
          "properties": {
            "name": {"type": "string"},
            "brand": {"type": "string"},
            "price_tag_visible": {"type": "boolean"}
          },
          "required": ["name", "brand", "price_tag_visible"]
        }
      }
    },
    "required": ["shelf_id", "products"]
  }'::jsonb,
  'Identify all products on the retail shelf. For each product, extract the product name, brand, and whether the price tag is visible.'
);
*/

-- For actual local dev, create your pattern via the UI after signup
