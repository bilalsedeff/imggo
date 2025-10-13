import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Try to read with correct parameter names
  const { data, error } = await supabase.rpc("pgmq_read", {
    queue_name: "ingest_jobs",
    vt: 30,
    qty: 5
  });

  console.log("📬 Queue messages:");
  if (error) {
    console.error("Error:", error);
  } else if (!data || data.length === 0) {
    console.log("✅ No messages (queue empty)");
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

main().catch(console.error);
