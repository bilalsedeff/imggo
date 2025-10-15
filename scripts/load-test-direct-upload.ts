/**
 * Load Test: Direct Upload + Ingest
 * Tests concurrent upload to 3 different patterns with multiple images
 */

import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

// Load environment variables
config();

// Configuration
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const API_BASE = "http://localhost:3000";

// API Key for authentication
const API_KEY = "imggo_live_0YIXr7Vl6xVcMsyUWaNaSnDvHcvpE0I4DboS4AOs";

// Validate env vars
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error("❌ Missing environment variables:");
  console.error("   NEXT_PUBLIC_SUPABASE_URL:", SUPABASE_URL ? "✓" : "✗");
  console.error("   NEXT_PUBLIC_SUPABASE_ANON_KEY:", SUPABASE_ANON_KEY ? "✓" : "✗");
  process.exit(1);
}

// Test patterns (user provided)
const TEST_PATTERNS = [
  {
    name: "general pattern 3",
    id: "1222558c-a91a-4387-b930-500db278cb60",
    format: "text",
  },
  {
    name: "football-xml",
    id: "22091ae8-1a51-4879-8d9f-81bf420ebccf",
    format: "xml",
  },
  {
    name: "csv-pattern3",
    id: "93acebcb-6198-4f29-bf0a-8a8631204352",
    format: "csv",
  },
];

// Test photos directory
const TEST_PHOTOS_DIR = "C:\\Users\\bilal\\OneDrive\\Masaüstü\\imggo\\test-photos\\landscape-pattern";

interface UploadResult {
  patternName: string;
  patternId: string;
  photoName: string;
  uploadTime: number;
  ingestTime: number;
  totalTime: number;
  success: boolean;
  error?: string;
  jobId?: string;
  imageUrl?: string;
}

/**
 * Upload image to Supabase Storage and return public URL
 * Uses service role key for storage (testing purposes)
 */
async function uploadImageToStorage(
  filePath: string,
  fileName: string
): Promise<string> {
  // Use service role key for direct storage access (test environment)
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Read file
  const fileBuffer = fs.readFileSync(filePath);
  const fileExt = path.extname(fileName);
  const storagePath = `test-uploads/${Date.now()}-${fileName}`;

  // Upload to Supabase Storage
  const { data, error } = await supabase.storage
    .from("images")
    .upload(storagePath, fileBuffer, {
      contentType: `image/${fileExt === ".png" ? "png" : "jpeg"}`,
      upsert: false,
    });

  if (error) {
    throw new Error(`Storage upload failed: ${error.message}`);
  }

  // Get public URL
  const { data: publicUrlData } = supabase.storage
    .from("images")
    .getPublicUrl(data.path);

  return publicUrlData.publicUrl;
}

/**
 * Ingest image via pattern endpoint
 */
async function ingestImage(
  patternId: string,
  imageUrl: string,
  apiKey: string
): Promise<string> {
  const response = await fetch(`${API_BASE}/api/patterns/${patternId}/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      image_url: imageUrl,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(`Ingest failed: ${errorData.message || response.statusText}`);
  }

  // Check content type to determine response format
  const contentType = response.headers.get("content-type") || "";

  if (contentType.includes("application/json")) {
    // JSON format pattern - response is JSON with job_id
    const result = await response.json();
    return result.data.job_id;
  } else {
    // Non-JSON format (XML/CSV/TEXT) - job_id is in header
    const jobId = response.headers.get("X-Job-Id");
    if (!jobId) {
      throw new Error("Missing X-Job-Id header in response");
    }
    return jobId;
  }
}

/**
 * Process single upload + ingest
 */
async function processUpload(
  patternName: string,
  patternId: string,
  photoPath: string,
  photoName: string,
  apiKey: string
): Promise<UploadResult> {
  const startTime = Date.now();
  let uploadTime = 0;
  let ingestTime = 0;
  let imageUrl: string | undefined;
  let jobId: string | undefined;

  try {
    // Step 1: Upload to Storage (using service role key)
    const uploadStart = Date.now();
    imageUrl = await uploadImageToStorage(photoPath, photoName);
    uploadTime = Date.now() - uploadStart;

    console.log(`✓ [${patternName}] Uploaded ${photoName} in ${uploadTime}ms`);

    // Step 2: Ingest via API (using API key)
    const ingestStart = Date.now();
    jobId = await ingestImage(patternId, imageUrl, apiKey);
    ingestTime = Date.now() - ingestStart;

    console.log(`✓ [${patternName}] Ingested ${photoName} in ${ingestTime}ms (Job: ${jobId})`);

    const totalTime = Date.now() - startTime;

    return {
      patternName,
      patternId,
      photoName,
      uploadTime,
      ingestTime,
      totalTime,
      success: true,
      jobId,
      imageUrl,
    };
  } catch (error) {
    const totalTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    console.error(`✗ [${patternName}] Failed ${photoName}: ${errorMessage}`);

    return {
      patternName,
      patternId,
      photoName,
      uploadTime,
      ingestTime,
      totalTime,
      success: false,
      error: errorMessage,
      imageUrl,
    };
  }
}

/**
 * Main load test
 */
async function runLoadTest() {
  console.log("🚀 ImgGo Load Test - Direct Upload + Ingest\n");

  // Use API key for authentication
  const apiKey = API_KEY;

  console.log(`🔑 Using API key authentication\n`);

  // Get all test photos
  const photos = fs.readdirSync(TEST_PHOTOS_DIR)
    .filter(f => f.match(/\.(jpg|jpeg|png)$/i));

  console.log(`📸 Found ${photos.length} test photos`);
  console.log(`🎯 Testing ${TEST_PATTERNS.length} patterns\n`);

  // Distribute photos across patterns (round-robin)
  const uploadTasks: Promise<UploadResult>[] = [];

  photos.forEach((photo, index) => {
    const pattern = TEST_PATTERNS[index % TEST_PATTERNS.length];
    const photoPath = path.join(TEST_PHOTOS_DIR, photo);

    uploadTasks.push(
      processUpload(pattern.name, pattern.id, photoPath, photo, apiKey)
    );
  });

  // Run all uploads concurrently
  console.log(`⚡ Starting ${uploadTasks.length} concurrent upload+ingest operations...\n`);
  const testStartTime = Date.now();

  const results = await Promise.allSettled(uploadTasks);

  const totalTestTime = Date.now() - testStartTime;

  // Analyze results
  console.log("\n" + "=".repeat(80));
  console.log("📊 LOAD TEST RESULTS");
  console.log("=".repeat(80) + "\n");

  const successfulResults = results
    .filter(r => r.status === "fulfilled" && r.value.success)
    .map(r => (r as PromiseFulfilledResult<UploadResult>).value);

  const failedResults = results
    .filter(r => r.status === "rejected" || (r.status === "fulfilled" && !r.value.success))
    .map(r => {
      if (r.status === "rejected") {
        return { error: r.reason };
      }
      return (r as PromiseFulfilledResult<UploadResult>).value;
    });

  console.log(`✅ Successful: ${successfulResults.length}/${results.length}`);
  console.log(`❌ Failed: ${failedResults.length}/${results.length}`);
  console.log(`⏱️  Total Test Time: ${totalTestTime}ms (${(totalTestTime / 1000).toFixed(2)}s)\n`);

  // Performance metrics
  if (successfulResults.length > 0) {
    const avgUploadTime = successfulResults.reduce((sum, r) => sum + r.uploadTime, 0) / successfulResults.length;
    const avgIngestTime = successfulResults.reduce((sum, r) => sum + r.ingestTime, 0) / successfulResults.length;
    const avgTotalTime = successfulResults.reduce((sum, r) => sum + r.totalTime, 0) / successfulResults.length;

    console.log("📈 Performance Metrics (Average):");
    console.log(`   Upload Time: ${avgUploadTime.toFixed(0)}ms`);
    console.log(`   Ingest Time: ${avgIngestTime.toFixed(0)}ms`);
    console.log(`   Total Time: ${avgTotalTime.toFixed(0)}ms\n`);
  }

  // Per-pattern breakdown
  console.log("🎯 Per-Pattern Breakdown:");
  TEST_PATTERNS.forEach(pattern => {
    const patternResults = successfulResults.filter(r => r.patternId === pattern.id);
    console.log(`   ${pattern.name} (${pattern.format}): ${patternResults.length} successful`);
  });

  // Show failures if any
  if (failedResults.length > 0) {
    console.log("\n❌ Failed Operations:");
    failedResults.forEach((result: any) => {
      console.log(`   • ${result.photoName || 'Unknown'}: ${result.error || 'Unknown error'}`);
    });
  }

  console.log("\n" + "=".repeat(80));

  // Show job IDs for tracking
  if (successfulResults.length > 0) {
    console.log("\n🔍 Created Job IDs (for tracking):");
    successfulResults.slice(0, 5).forEach(r => {
      console.log(`   ${r.jobId} - ${r.patternName} - ${r.photoName}`);
    });
    if (successfulResults.length > 5) {
      console.log(`   ... and ${successfulResults.length - 5} more`);
    }
  }
}

// Run the test
runLoadTest().catch(console.error);
