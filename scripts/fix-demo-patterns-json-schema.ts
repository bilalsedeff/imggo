/**
 * Fix demo patterns by adding json_schema to all 5 demo patterns
 * This is required because ALL formats need json_schema filled
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error("Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
  console.error("Make sure .env file exists with these variables");
  process.exit(1);
}

console.log(`Using Supabase URL: ${SUPABASE_URL}`);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const DEMO_PATTERN_IDS = [
  "00000000-0000-0000-0000-000000000001", // JSON
  "00000000-0000-0000-0000-000000000002", // CSV
  "00000000-0000-0000-0000-000000000003", // XML
  "00000000-0000-0000-0000-000000000004", // YAML
  "00000000-0000-0000-0000-000000000005", // Text
];

// Common JSON schema for all demo patterns
const DEMO_JSON_SCHEMA = {
  type: "object",
  required: ["title", "colors", "tags", "is_person", "is_animal", "is_landscape"],
  properties: {
    title: {
      type: "string",
      description: "Title or description of the image",
    },
    colors: {
      type: "array",
      description: "Dominant colors in the image",
      items: {
        type: "string",
      },
    },
    tags: {
      type: "array",
      description: "Keywords and tags describing the image",
      items: {
        type: "string",
      },
    },
    is_person: {
      type: "boolean",
      description: "Whether the image contains a person",
    },
    is_animal: {
      type: "boolean",
      description: "Whether the image contains an animal",
    },
    is_landscape: {
      type: "boolean",
      description: "Whether the image is a landscape",
    },
  },
  additionalProperties: false,
};

async function fixDemoPatterns() {
  console.log("🔧 Fixing demo patterns json_schema...\n");

  // First, check current state
  const { data: before, error: beforeError } = await supabase
    .from("patterns")
    .select("id, name, format, json_schema, csv_schema, xml_schema, yaml_schema, plain_text_schema")
    .in("id", DEMO_PATTERN_IDS)
    .order("id");

  if (beforeError) {
    console.error("Error fetching patterns:", beforeError);
    process.exit(1);
  }

  console.log("📊 Current state:");
  console.log("─".repeat(80));
  before?.forEach((pattern) => {
    console.log(`ID: ${pattern.id}`);
    console.log(`Name: ${pattern.name}`);
    console.log(`Format: ${pattern.format}`);
    console.log(`Has json_schema: ${pattern.json_schema ? "✓" : "✗"}`);
    console.log(`Has format schema: ${
      pattern.csv_schema || pattern.xml_schema || pattern.yaml_schema || pattern.plain_text_schema ? "✓" : "✗"
    }`);
    console.log("");
  });

  // Update all demo patterns with json_schema
  console.log("🔄 Updating patterns with json_schema...\n");

  const { data: updated, error: updateError } = await supabase
    .from("patterns")
    .update({ json_schema: DEMO_JSON_SCHEMA })
    .in("id", DEMO_PATTERN_IDS)
    .select("id, name, format, json_schema");

  if (updateError) {
    console.error("Error updating patterns:", updateError);
    process.exit(1);
  }

  console.log("✅ Successfully updated patterns:");
  console.log("─".repeat(80));
  updated?.forEach((pattern) => {
    console.log(`${pattern.name} (${pattern.format})`);
    console.log(`  json_schema properties: ${Object.keys((pattern.json_schema as any).properties).join(", ")}`);
  });

  console.log("\n📋 Verification query:");
  console.log("─".repeat(80));

  // Verify final state
  const { data: after, error: afterError } = await supabase
    .from("patterns")
    .select("id, name, format, json_schema, csv_schema, xml_schema, yaml_schema, plain_text_schema")
    .in("id", DEMO_PATTERN_IDS)
    .order("id");

  if (afterError) {
    console.error("Error verifying patterns:", afterError);
    process.exit(1);
  }

  let allValid = true;

  after?.forEach((pattern) => {
    const hasJsonSchema = !!pattern.json_schema;
    const hasFormatSchema = !!(
      pattern.csv_schema ||
      pattern.xml_schema ||
      pattern.yaml_schema ||
      pattern.plain_text_schema
    );

    const isValid = hasJsonSchema && (pattern.format === "json" || hasFormatSchema);

    if (!isValid) {
      allValid = false;
    }

    console.log(
      `${isValid ? "✓" : "✗"} ${pattern.name} (${pattern.format}) - json_schema: ${hasJsonSchema ? "✓" : "✗"}, format_schema: ${hasFormatSchema ? "✓" : "✗"}`
    );
  });

  console.log("\n" + "=".repeat(80));
  if (allValid) {
    console.log("✅ All demo patterns are now correctly configured!");
  } else {
    console.log("⚠️  Some patterns still have issues");
    process.exit(1);
  }

  console.log("=".repeat(80));
}

fixDemoPatterns().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
