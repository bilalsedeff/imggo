// Update pattern template from csv_schema
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const PATTERN_ID = "ed1b2a79-d89a-4281-88a8-2ebb9bcbb88e";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateTemplate() {
  // First get the pattern
  const { data: pattern, error: fetchError } = await supabase
    .from("patterns")
    .select("csv_schema")
    .eq("id", PATTERN_ID)
    .single();

  if (fetchError) {
    console.error("Fetch error:", fetchError);
    return;
  }

  console.log("Current csv_schema:");
  console.log(pattern.csv_schema);

  // Update template to match csv_schema
  const { data, error } = await supabase
    .from("patterns")
    .update({ template: pattern.csv_schema })
    .eq("id", PATTERN_ID)
    .select();

  if (error) {
    console.error("Update error:", error);
    return;
  }

  console.log("\n✅ Updated pattern template");
  console.log("Template:", data[0].template);
}

updateTemplate().catch(console.error);
