/**
 * Backfill format_metadata for existing patterns
 *
 * This script fixes patterns that were created with the parameter order bug,
 * where convertToJsonSchema was called with (format, content) instead of (content, format).
 *
 * These patterns have xml_schema/yaml_schema/csv_schema/plain_text_schema but are missing
 * format_metadata, causing them to use the slow legacy processing path.
 *
 * Run with: npx tsx scripts/backfill-format-metadata.ts
 */

import { createClient } from "@supabase/supabase-js";
import { convertToJsonSchema } from "../src/lib/deconstructionConverter";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing required environment variables:");
  console.error("- NEXT_PUBLIC_SUPABASE_URL");
  console.error("- SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

interface Pattern {
  id: string;
  name: string;
  format: "json" | "yaml" | "xml" | "csv" | "text";
  xml_schema: string | null;
  yaml_schema: string | null;
  csv_schema: string | null;
  plain_text_schema: string | null;
  format_metadata: Record<string, unknown> | null;
}

async function backfillFormatMetadata() {
  console.log("🔍 Finding patterns with missing format_metadata...\n");

  // Find all patterns that need backfilling
  const { data: patterns, error } = await supabase
    .from("patterns")
    .select("id, name, format, xml_schema, yaml_schema, csv_schema, plain_text_schema, format_metadata")
    .in("format", ["xml", "yaml", "csv", "text"])
    .is("format_metadata", null);

  if (error) {
    console.error("❌ Error fetching patterns:", error);
    process.exit(1);
  }

  if (!patterns || patterns.length === 0) {
    console.log("✅ No patterns need backfilling. All patterns have format_metadata!");
    return;
  }

  console.log(`📦 Found ${patterns.length} pattern(s) that need format_metadata:\n`);

  let successCount = 0;
  let skipCount = 0;
  let errorCount = 0;

  for (const pattern of patterns as Pattern[]) {
    console.log(`\n📄 Pattern: ${pattern.name} (${pattern.id})`);
    console.log(`   Format: ${pattern.format}`);

    try {
      let schemaContent: string | null = null;

      // Get the schema content based on format
      switch (pattern.format) {
        case "xml":
          schemaContent = pattern.xml_schema;
          break;
        case "yaml":
          schemaContent = pattern.yaml_schema;
          break;
        case "csv":
          schemaContent = pattern.csv_schema;
          break;
        case "text":
          schemaContent = pattern.plain_text_schema;
          break;
      }

      if (!schemaContent) {
        console.log(`   ⏭️  Skipped: No ${pattern.format}_schema found`);
        skipCount++;
        continue;
      }

      // Convert schema to get json_schema and format_metadata
      console.log(`   🔄 Converting ${pattern.format}_schema to JSON Schema + metadata...`);
      const result = convertToJsonSchema(schemaContent, pattern.format);

      // Update the pattern
      const { error: updateError } = await supabase
        .from("patterns")
        .update({
          json_schema: result.jsonSchema,
          format_metadata: result.metadata,
        })
        .eq("id", pattern.id);

      if (updateError) {
        console.error(`   ❌ Error updating pattern:`, updateError);
        errorCount++;
        continue;
      }

      console.log(`   ✅ Successfully backfilled format_metadata`);
      console.log(`      Root element: ${result.metadata.xmlRootElement || result.metadata.yamlRootKey || 'N/A'}`);
      successCount++;
    } catch (err) {
      console.error(`   ❌ Error processing pattern:`, err);
      errorCount++;
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 Summary:");
  console.log(`   ✅ Successfully backfilled: ${successCount}`);
  console.log(`   ⏭️  Skipped (no schema): ${skipCount}`);
  console.log(`   ❌ Errors: ${errorCount}`);
  console.log("=".repeat(60) + "\n");

  if (successCount > 0) {
    console.log("🎉 Backfill complete! These patterns will now use the fast structured output path.");
  }
}

// Run the script
backfillFormatMetadata()
  .then(() => {
    console.log("\n✨ Script completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Fatal error:", error);
    process.exit(1);
  });
