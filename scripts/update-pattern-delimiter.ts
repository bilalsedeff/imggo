// Update pattern delimiter
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";

dotenv.config();

const PATTERN_ID = "ed1b2a79-d89a-4281-88a8-2ebb9bcbb88e";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function updateDelimiter() {
  const { data, error } = await supabase
    .from("patterns")
    .update({ csv_delimiter: "semicolon" })
    .eq("id", PATTERN_ID)
    .select();

  if (error) {
    console.error("Error:", error);
    return;
  }

  console.log("✅ Updated pattern delimiter to semicolon");
  console.log(data);
}

updateDelimiter().catch(console.error);
