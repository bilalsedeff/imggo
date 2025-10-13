/**
 * Cleanup Stuck Jobs in PGMQ Queue
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log("🧹 Cleaning up stuck jobs in PGMQ queue...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get all messages in queue
  const { data: messages, error } = await supabase.rpc("pgmq_read", {
    queue_name: "ingest_jobs",
    vt: 1,
    qty: 100,
  });

  if (error) {
    console.error("❌ Error reading queue:", error);
    return;
  }

  if (!messages || messages.length === 0) {
    console.log("✅ Queue is empty, nothing to clean up");
    return;
  }

  console.log(`Found ${messages.length} message(s) in queue\n`);

  let deletedCount = 0;
  for (const msg of messages) {
    const msgId = msg.msg_id;
    console.log(`Deleting message ${msgId}...`);

    const { error: deleteError } = await supabase.rpc("pgmq_delete", {
      queue_name: "ingest_jobs",
      msg_id: msgId,
    });

    if (deleteError) {
      console.log(`  ❌ Failed to delete: ${deleteError.message}`);
      continue;
    }

    deletedCount++;
    console.log(`  ✅ Deleted`);
  }

  console.log(`\n✅ Cleanup complete! Deleted ${deletedCount}/${messages.length} message(s)`);
  console.log("\nYou can now test with a fresh image upload.");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
