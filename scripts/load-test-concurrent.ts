/**
 * Load Test: Concurrent Image Processing
 * Tests hybrid architecture with multiple simultaneous uploads
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Test images
const TEST_IMAGES = [
  "test-photos/landscape-pattern/Screenshot 2025-10-10 155833.png",
  "test-photos/landscape-pattern/road-8376079_1280.png",
  "test-photos/landscape-pattern/HD-wallpaper-wet-road-autumn-fall-leaves-nature-rainy-road-tree-thumbnail.jpg",
  "test-photos/landscape-pattern/EGS_Road96_Digixart_S3_2560x1440-411bfe9f5bbc608f59ce90e173bac927.jpeg",
];

// Pattern ID (landscape-pattern2 from user's message)
const PATTERN_ID = "82e1e6f3-4983-4ab3-86df-02d9d84887b4";
const USER_ID = "0c1dd2a1-36ee-4189-9b65-25b453e4f69b";
const API_ENDPOINT = `http://localhost:3000/api/patterns/${PATTERN_ID}/ingest`;

interface TestResult {
  imageIndex: number;
  fileName: string;
  uploadTime: number;
  processingTime: number;
  totalTime: number;
  success: boolean;
  approach: "direct" | "queued";
  manifest?: Record<string, unknown>;
  error?: string;
  jobId?: string;
}

async function uploadImage(
  imagePath: string,
  userId: string
): Promise<{ url: string; path: string }> {
  const fileName = imagePath.split("/").pop()!;
  const timestamp = Date.now();
  const storagePath = `${userId}/${timestamp}_${fileName}`;

  const fileBuffer = readFileSync(imagePath);

  const { data, error } = await supabase.storage
    .from("images")
    .upload(storagePath, fileBuffer, {
      contentType: getContentType(fileName),
      upsert: false,
    });

  if (error) {
    throw new Error(`Upload failed: ${error.message}`);
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("images").getPublicUrl(storagePath);

  return { url: publicUrl, path: storagePath };
}

function getContentType(fileName: string): string {
  if (fileName.endsWith(".png")) return "image/png";
  if (fileName.endsWith(".jpg") || fileName.endsWith(".jpeg"))
    return "image/jpeg";
  return "image/png";
}

async function processImage(
  imageUrl: string,
  imageIndex: number,
  fileName: string
): Promise<TestResult> {
  const startTime = Date.now();
  const uploadTime = 0; // Already uploaded

  try {
    const response = await fetch(API_ENDPOINT, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // Note: No Authorization header - testing public access issue
      },
      body: JSON.stringify({
        image_url: imageUrl,
      }),
    });

    const processingTime = Date.now() - startTime;
    const result = await response.json();

    if (!response.ok) {
      return {
        imageIndex,
        fileName,
        uploadTime,
        processingTime,
        totalTime: processingTime,
        success: false,
        approach: "queued",
        error: result.message || "Request failed",
      };
    }

    return {
      imageIndex,
      fileName,
      uploadTime,
      processingTime,
      totalTime: processingTime,
      success: true,
      approach: result.approach || "unknown",
      manifest: result.manifest,
      jobId: result.job_id,
    };
  } catch (error) {
    const processingTime = Date.now() - startTime;
    return {
      imageIndex,
      fileName,
      uploadTime,
      processingTime,
      totalTime: processingTime,
      success: false,
      approach: "queued",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function main() {
  console.log("🚀 Starting Load Test: Concurrent Image Processing\n");
  console.log(`Pattern ID: ${PATTERN_ID}`);
  console.log(`API Endpoint: ${API_ENDPOINT}`);
  console.log(`Test Images: ${TEST_IMAGES.length}\n`);

  // Step 1: Upload all images first
  console.log("📤 Uploading test images...\n");
  const uploadedImages: { url: string; path: string; fileName: string }[] = [];

  for (let i = 0; i < TEST_IMAGES.length; i++) {
    const imagePath = TEST_IMAGES[i];
    const fileName = imagePath.split("/").pop()!;

    try {
      console.log(`  [${i + 1}/${TEST_IMAGES.length}] Uploading ${fileName}...`);
      const { url, path } = await uploadImage(imagePath, USER_ID);
      uploadedImages.push({ url, path, fileName });
      console.log(`    ✅ Uploaded: ${path}`);
    } catch (error) {
      console.error(
        `    ❌ Failed: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  console.log(`\n✅ Uploaded ${uploadedImages.length}/${TEST_IMAGES.length} images\n`);

  // Step 2: Process all images CONCURRENTLY
  console.log("⚡ Processing images concurrently...\n");
  const testStartTime = Date.now();

  const promises = uploadedImages.map((img, index) =>
    processImage(img.url, index, img.fileName)
  );

  const results = await Promise.all(promises);
  const totalTestTime = Date.now() - testStartTime;

  // Step 3: Display results
  console.log("\n" + "=".repeat(80));
  console.log("📊 LOAD TEST RESULTS");
  console.log("=".repeat(80) + "\n");

  results.forEach((result) => {
    const status = result.success ? "✅ SUCCESS" : "❌ FAILED";
    const approach = result.approach === "direct" ? "⚡ DIRECT" : "🔄 QUEUED";

    console.log(`[${result.imageIndex + 1}] ${result.fileName}`);
    console.log(`  Status: ${status} | Approach: ${approach}`);
    console.log(`  Processing Time: ${result.processingTime}ms`);

    if (result.manifest) {
      console.log(
        `  Manifest Keys: ${Object.keys(result.manifest).join(", ")}`
      );
    }

    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }

    console.log();
  });

  // Step 4: Summary statistics
  const successCount = results.filter((r) => r.success).length;
  const failedCount = results.filter((r) => !r.success).length;
  const directCount = results.filter((r) => r.approach === "direct").length;
  const queuedCount = results.filter((r) => r.approach === "queued").length;

  const avgProcessingTime =
    results.reduce((sum, r) => sum + r.processingTime, 0) / results.length;
  const maxProcessingTime = Math.max(...results.map((r) => r.processingTime));
  const minProcessingTime = Math.min(...results.map((r) => r.processingTime));

  console.log("=".repeat(80));
  console.log("📈 SUMMARY STATISTICS");
  console.log("=".repeat(80) + "\n");
  console.log(`Total Images:         ${results.length}`);
  console.log(`✅ Successful:        ${successCount}`);
  console.log(`❌ Failed:            ${failedCount}`);
  console.log(`⚡ Direct Processing: ${directCount} (${((directCount / results.length) * 100).toFixed(1)}%)`);
  console.log(`🔄 Queued:            ${queuedCount} (${((queuedCount / results.length) * 100).toFixed(1)}%)`);
  console.log();
  console.log(`⏱️  Total Test Time:   ${totalTestTime}ms`);
  console.log(`📊 Avg Processing:    ${avgProcessingTime.toFixed(0)}ms`);
  console.log(`⚡ Min Processing:    ${minProcessingTime}ms`);
  console.log(`🐌 Max Processing:    ${maxProcessingTime}ms`);
  console.log();

  // Step 5: Verify image cleanup
  console.log("=".repeat(80));
  console.log("🔍 VERIFYING IMAGE CLEANUP (Privacy Check)");
  console.log("=".repeat(80) + "\n");

  console.log("Waiting 5 seconds for cleanup to complete...");
  await new Promise((resolve) => setTimeout(resolve, 5000));

  for (const img of uploadedImages) {
    const { data, error } = await supabase.storage
      .from("images")
      .list(img.path.split("/")[0]);

    if (error) {
      console.log(`❌ Error checking ${img.fileName}: ${error.message}`);
      continue;
    }

    const fileExists = data?.some((file) => img.path.includes(file.name));

    if (fileExists) {
      console.log(`⚠️  ${img.fileName}: Still exists (cleanup may be pending)`);
    } else {
      console.log(`✅ ${img.fileName}: Deleted (privacy compliant)`);
    }
  }

  console.log("\n✅ Load test complete!\n");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
