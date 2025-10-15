// Check pattern template directly from database
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

// Load environment variables
dotenv.config();

const PATTERN_ID = "ed1b2a79-d89a-4281-88a8-2ebb9bcbb88e";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTemplate() {
  const { data: pattern, error } = await supabase
    .from("patterns")
    .select("*")
    .eq("id", PATTERN_ID)
    .single();

  if (error) {
    console.error("Error fetching pattern:", error);
    return;
  }

  console.log("Pattern ID:", pattern.id);
  console.log("Pattern Name:", pattern.name);
  console.log("Format:", pattern.format);
  console.log("CSV Delimiter:", pattern.csv_delimiter);
  console.log("\nTemplate:");
  console.log("=".repeat(60));
  console.log(pattern.template);
  console.log("=".repeat(60));
  console.log("\nTemplate Length:", pattern.template?.length || 0);
  console.log("\nTemplate Lines:");
  const lines = (pattern.template || "").split('\n');
  lines.forEach((line: string, i: number) => {
    console.log(`Line ${i+1}: ${line}`);
  });
}

checkTemplate().catch(console.error);
