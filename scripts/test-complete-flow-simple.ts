/**
 * Test Complete ImgGo Flow (Simple API Approach)
 * Upload → API Ingest → Worker → Manifest
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

// Load environment
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "images";
const API_BASE = process.env.APP_BASE_URL || "http://localhost:3000";

// Test image path
const TEST_IMAGE_PATH = "test-photos/landscape-pattern/Screenshot 2025-10-10 155833.png";

async function main() {
  console.log("🚀 Testing Complete ImgGo Flow (Simple API Approach)\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Step 1: Upload test image to Storage
  console.log("📤 Step 1: Uploading test image to Storage...");
  const imageBuffer = readFileSync(TEST_IMAGE_PATH);
  const imagePath = `test/${Date.now()}-landscape.png`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(imagePath, imageBuffer, {
      contentType: "image/png",
      upsert: false,
    });

  if (uploadError) {
    console.error("❌ Upload failed:", uploadError);
    process.exit(1);
  }

  console.log(`✅ Image uploaded: ${uploadData.path}`);

  // Get public URL for the image
  const { data: urlData } = supabase.storage
    .from(BUCKET_NAME)
    .getPublicUrl(imagePath);

  const imageUrl = urlData.publicUrl;
  console.log(`📎 Image URL: ${imageUrl}\n`);

  // Step 2: Get test user auth token
  console.log("👤 Step 2: Getting test user auth token...");

  // Use the test user credentials
  const testUserId = "9d8036d4-70cf-4864-b580-1ea85587e7ad";

  // Get the user's JWT token using admin auth
  const { data: { user }, error: userError } = await supabase.auth.admin.getUserById(testUserId);

  if (userError || !user) {
    console.error("❌ Failed to get user:", userError);
    process.exit(1);
  }

  // Generate a token for this user
  const { data: sessionData, error: sessionError } = await supabase.auth.admin.createSession(testUserId);

  if (sessionError || !sessionData) {
    console.error("❌ Failed to create session:", sessionError);
    process.exit(1);
  }

  const authToken = sessionData.access_token;
  console.log(`✅ Got auth token for user: ${testUserId}\n`);

  // Step 3: Get pattern ID
  console.log("📋 Step 3: Getting landscape analysis pattern...");
  const patternId = "75ccf639-17d6-4e66-804a-d734efb0c1ee";
  console.log(`✅ Using pattern: ${patternId}\n`);

  // Step 4: Call ingest API endpoint
  console.log("⚙️  Step 4: Calling ingest API endpoint...");

  const ingestResponse = await fetch(`${API_BASE}/api/patterns/${patternId}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
      idempotency_key: `test-flow-simple-${Date.now()}`,
    }),
  });

  if (!ingestResponse.ok) {
    const error = await ingestResponse.text();
    console.error(`❌ Ingest API failed (${ingestResponse.status}):`, error);
    process.exit(1);
  }

  const ingestResult = await ingestResponse.json();
  const jobId = ingestResult.job_id;

  console.log(`✅ Job enqueued via API: ${jobId}`);
  console.log(`   Status: ${ingestResult.status}\n`);

  // Step 5: Wait for worker to process (poll job status)
  console.log("⏳ Step 5: Waiting for worker to process job...");
  console.log("   (Worker runs every 1 minute via cron)");

  let attempts = 0;
  const maxAttempts = 30; // 5 minutes max
  let jobStatus = "queued";
  let manifest = null;

  while (attempts < maxAttempts && jobStatus === "queued") {
    await new Promise((resolve) => setTimeout(resolve, 10000)); // Wait 10 seconds

    const { data: job } = await supabase
      .from("jobs")
      .select("status, manifest, error, latency_ms")
      .eq("id", jobId)
      .single();

    if (job) {
      jobStatus = job.status;
      manifest = job.manifest;

      if (jobStatus === "succeeded") {
        console.log(`\n✅ Job completed successfully!`);
        console.log(`   Latency: ${job.latency_ms}ms`);
        console.log(`\n📊 Generated Manifest:`);
        console.log(JSON.stringify(manifest, null, 2));
        break;
      } else if (jobStatus === "failed") {
        console.error(`\n❌ Job failed: ${job.error}`);
        process.exit(1);
      } else {
        attempts++;
        process.stdout.write(".");
      }
    }
  }

  if (jobStatus === "queued") {
    console.log("\n⏰ Job still queued after 5 minutes. Check worker status.");
    console.log(`   Job ID: ${jobId}`);
  }

  console.log("\n✅ Complete flow test finished!");
  console.log("\n📝 Summary:");
  console.log(`   Image: ${imagePath}`);
  console.log(`   Pattern: ${patternId}`);
  console.log(`   Job: ${jobId}`);
  console.log(`   Status: ${jobStatus}`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
