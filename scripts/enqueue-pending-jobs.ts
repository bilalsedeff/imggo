/**
 * Enqueue Pending Jobs to PGMQ
 * Uses direct SQL insertion as a workaround for permission issues
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log("📨 Enqueueing pending jobs to PGMQ...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all queued jobs that need to be enqueued
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "queued")
    .order("created_at", { ascending: true });

  if (error) {
    console.error("❌ Error fetching jobs:", error);
    process.exit(1);
  }

  if (!jobs || jobs.length === 0) {
    console.log("✅ No pending jobs to enqueue");
    return;
  }

  console.log(`Found ${jobs.length} pending job(s) to enqueue:\n`);

  for (const job of jobs) {
    console.log(`Processing job ${job.id}...`);
    console.log(`  Pattern: ${job.pattern_id}`);
    console.log(`  Image: ${job.image_url?.substring(0, 60)}...`);

    // Prepare the message payload
    const message = {
      job_id: job.id,
      pattern_id: job.pattern_id,
      image_url: job.image_url,
      extras: job.extras || {},
    };

    // Use the pgmq_send wrapper function with correct parameters
    try {
      // Try using the wrapper function first
      const { data: msgId, error: enqueueError } = await supabase.rpc("pgmq_send", {
        queue_name: "ingest_jobs",
        msg: message,
      });

      if (enqueueError) {
        console.error(`  ❌ Failed to enqueue: ${enqueueError.message}`);

        // If permission error, suggest manual fix
        if (enqueueError.code === "42501") {
          console.log(`  💡 Permission error detected. Please run this SQL in Supabase Dashboard:`);
          console.log(`
GRANT EXECUTE ON FUNCTION pgmq_send(text, jsonb) TO authenticated, service_role;
GRANT USAGE ON SCHEMA pgmq TO authenticated, service_role;
          `);
        }
      } else {
        console.log(`  ✅ Enqueued with msg_id: ${msgId}\n`);
      }
    } catch (err) {
      console.error(`  ❌ Exception: ${err}`);
    }
  }

  console.log("\n🎯 Next Steps:");
  console.log("1. If you see permission errors, copy the SQL above to Supabase SQL Editor");
  console.log("2. Run: npx tsx scripts/enqueue-pending-jobs.ts (to retry)");
  console.log("3. Invoke worker: curl -X POST <worker-url>");
  console.log("4. Check job status: npx tsx scripts/check-jobs.ts");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
