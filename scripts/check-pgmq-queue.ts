import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Check queue metrics
  const { data: metrics, error: metricsError } = await supabase.rpc("pgmq_metrics", {
    q_name: "ingest_jobs"
  });

  console.log("📊 Queue Metrics:");
  if (metricsError) {
    console.error("Error:", metricsError);
  } else {
    console.log(JSON.stringify(metrics, null, 2));
  }

  // Try to read messages
  const { data: messages, error: readError } = await supabase.rpc("pgmq_read", {
    queue_name: "ingest_jobs",
    vt_seconds: 30,
    batch_size: 5
  });

  console.log("\n📬 Messages in queue:");
  if (readError) {
    console.error("Error:", readError);
  } else if (!messages || messages.length === 0) {
    console.log("No messages");
  } else {
    console.log(JSON.stringify(messages, null, 2));
  }
}

main().catch(console.error);
