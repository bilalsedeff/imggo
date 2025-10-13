/**
 * Fix Storage Access for Worker
 * Creates signed URLs for failed jobs and re-enqueues them
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "images";

async function main() {
  console.log("🔧 Fixing storage access for failed jobs...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get failed jobs with storage download errors
  const { data: failedJobs, error } = await supabase
    .from("jobs")
    .select("*")
    .eq("status", "failed")
    .like("error", "%Error while downloading%")
    .order("created_at", { ascending: false })
    .limit(10);

  if (error) {
    console.error("❌ Error fetching failed jobs:", error);
    return;
  }

  if (!failedJobs || failedJobs.length === 0) {
    console.log("✅ No failed jobs with storage errors found");
    return;
  }

  console.log(`Found ${failedJobs.length} job(s) with storage access errors\n`);

  for (const job of failedJobs) {
    console.log(`Processing job ${job.id}...`);

    // Extract the storage path from the public URL
    const imageUrl = job.image_url;
    const publicUrlPattern = /\/storage\/v1\/object\/public\/[^/]+\/(.+)$/;
    const match = imageUrl.match(publicUrlPattern);

    if (!match) {
      console.log(`  ⚠️  Cannot extract storage path from: ${imageUrl}`);
      continue;
    }

    const storagePath = match[1];
    console.log(`  📁 Storage path: ${storagePath}`);

    // Create a signed URL (valid for 1 hour)
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from(BUCKET_NAME)
      .createSignedUrl(storagePath, 3600);

    if (signedUrlError) {
      console.log(`  ❌ Failed to create signed URL: ${signedUrlError.message}`);
      continue;
    }

    const signedUrl = signedUrlData.signedUrl;
    console.log(`  ✅ Created signed URL`);

    // Update job with signed URL and reset status to queued
    const { error: updateError } = await supabase
      .from("jobs")
      .update({
        image_url: signedUrl,
        status: "queued",
        error: null,
      })
      .eq("id", job.id);

    if (updateError) {
      console.log(`  ❌ Failed to update job: ${updateError.message}`);
      continue;
    }

    console.log(`  ✅ Job reset to queued with signed URL`);

    // Re-enqueue to PGMQ
    const message = {
      job_id: job.id,
      pattern_id: job.pattern_id,
      image_url: signedUrl,
      extras: job.extras || {},
    };

    const { data: msgId, error: enqueueError } = await supabase.rpc("pgmq_send", {
      queue_name: "ingest_jobs",
      msg: message,
    });

    if (enqueueError) {
      console.log(`  ❌ Failed to enqueue: ${enqueueError.message}`);
      continue;
    }

    console.log(`  ✅ Re-enqueued with msg_id: ${msgId}\n`);
  }

  console.log("\n✅ Done! Run these commands to process:");
  console.log(`
curl -X POST "${SUPABASE_URL}/functions/v1/worker" \\
  -H "Authorization: Bearer YOUR_ANON_KEY" \\
  -H "Content-Type: application/json"

npx tsx scripts/check-jobs.ts
  `);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
