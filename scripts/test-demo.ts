/**
 * Test script for landing page demo
 * Tests all 5 demo patterns (JSON, CSV, XML, YAML, Text)
 *
 * Prerequisites:
 * 1. Docker Desktop running
 * 2. Supabase started (npm run supabase:start)
 * 3. Next.js dev server running (npm run dev)
 *
 * Usage: npx tsx scripts/test-demo.ts
 */

import { readFileSync } from "fs";
import { join } from "path";

const BASE_URL = "http://localhost:3000";
const TEST_IMAGE_PATH = join(process.cwd(), "test-photos", "landscape-pattern", "road-8376079_1280.png");

interface DemoPattern {
  id: string;
  name: string;
  format: string;
}

const DEMO_PATTERNS: DemoPattern[] = [
  { id: "00000000-0000-0000-0000-000000000001", name: "JSON Analysis", format: "json" },
  { id: "00000000-0000-0000-0000-000000000002", name: "CSV Analysis", format: "csv" },
  { id: "00000000-0000-0000-0000-000000000003", name: "XML Analysis", format: "xml" },
  { id: "00000000-0000-0000-0000-000000000004", name: "YAML Analysis", format: "yaml" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Text Analysis", format: "text" },
];

async function testPattern(pattern: DemoPattern) {
  console.log(`\n${"=".repeat(80)}`);
  console.log(`Testing: ${pattern.name} (${pattern.format.toUpperCase()})`);
  console.log(`${"=".repeat(80)}\n`);

  try {
    // Step 1: Get signed upload URL
    console.log("Step 1: Getting signed upload URL...");
    const imagePath = `demo/${Date.now()}-test-image.png`;

    const signedUrlResponse = await fetch(`${BASE_URL}/api/demo/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: imagePath }),
    });

    if (!signedUrlResponse.ok) {
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status} ${await signedUrlResponse.text()}`);
    }

    const { url: uploadUrl, path } = await signedUrlResponse.json();
    console.log(`✓ Got signed URL for path: ${path}`);

    // Step 2: Upload image to signed URL
    console.log("\nStep 2: Uploading image to storage...");
    const imageBuffer = readFileSync(TEST_IMAGE_PATH);

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: imageBuffer,
      headers: {
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload image: ${uploadResponse.status} ${await uploadResponse.text()}`);
    }

    console.log("✓ Image uploaded successfully");

    // Build public URL for worker
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "images";
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${imagePath}`;

    console.log(`✓ Public URL: ${imageUrl}`);

    // Step 3: Process with demo endpoint
    console.log("\nStep 3: Enqueueing job...");
    const processResponse = await fetch(`${BASE_URL}/api/demo/process`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern_id: pattern.id,
        image_url: imageUrl,
      }),
    });

    if (!processResponse.ok) {
      const errorData = await processResponse.json();
      throw new Error(`Failed to process: ${processResponse.status} ${JSON.stringify(errorData)}`);
    }

    const { job_id } = await processResponse.json();
    console.log(`✓ Job enqueued: ${job_id}`);

    // Step 4: Poll for result
    console.log("\nStep 4: Polling for result...");
    let attempts = 0;
    const maxAttempts = 60;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      attempts++;

      const statusResponse = await fetch(`${BASE_URL}/api/demo/status/${job_id}`);

      if (!statusResponse.ok) {
        throw new Error(`Failed to check status: ${statusResponse.status}`);
      }

      const { status, manifest, error: jobError } = await statusResponse.json();

      process.stdout.write(`\r  Attempt ${attempts}/${maxAttempts} - Status: ${status}${" ".repeat(20)}`);

      if (status === "succeeded") {
        console.log("\n\n✓ Processing completed successfully!\n");
        console.log("Result:");
        console.log("-".repeat(80));

        // Display result based on format
        if (pattern.format === "json") {
          console.log(JSON.stringify(manifest, null, 2));
        } else {
          console.log(manifest);
        }

        console.log("-".repeat(80));

        // Verify schema compliance
        console.log("\nSchema Verification:");
        await verifySchemaCompliance(manifest, pattern.format);

        return { success: true, manifest };
      }

      if (status === "failed") {
        throw new Error(`Job failed: ${jobError}`);
      }
    }

    throw new Error("Processing timeout");
  } catch (error) {
    console.error(`\n✗ Test failed:`, error);
    return { success: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function verifySchemaCompliance(manifest: any, format: string) {
  const expectedFields = ["title", "colors", "tags", "is_person", "is_animal", "is_landscape"];

  console.log(`  Format: ${format.toUpperCase()}`);

  if (format === "json") {
    // JSON should have all fields as properties
    const hasAllFields = expectedFields.every((field) => field in manifest);
    console.log(`  ✓ Has all expected fields: ${hasAllFields ? "YES" : "NO"}`);

    // Check array types
    const colorsIsArray = Array.isArray(manifest.colors);
    const tagsIsArray = Array.isArray(manifest.tags);
    console.log(`  ✓ colors is array: ${colorsIsArray ? "YES" : "NO"}`);
    console.log(`  ✓ tags is array: ${tagsIsArray ? "YES" : "NO"}`);

    // Check boolean types
    const isPersonBool = typeof manifest.is_person === "boolean";
    const isAnimalBool = typeof manifest.is_animal === "boolean";
    const isLandscapeBool = typeof manifest.is_landscape === "boolean";
    console.log(`  ✓ Boolean fields correct: ${isPersonBool && isAnimalBool && isLandscapeBool ? "YES" : "NO"}`);
  } else if (format === "csv") {
    // CSV should have comma-separated strings for arrays
    const manifestStr = JSON.stringify(manifest);
    console.log(`  ✓ Contains expected field names: ${expectedFields.every((f) => manifestStr.includes(f)) ? "YES" : "NO"}`);
    console.log(`  ✓ Arrays as comma-separated strings: ${manifestStr.includes(",") ? "YES (likely)" : "NO"}`);
  } else if (format === "xml") {
    // XML should have nested elements
    const manifestStr = typeof manifest === "string" ? manifest : JSON.stringify(manifest);
    console.log(`  ✓ Contains XML tags: ${manifestStr.includes("<") && manifestStr.includes(">") ? "YES" : "NO"}`);
    console.log(`  ✓ Contains expected fields: ${expectedFields.every((f) => manifestStr.includes(f)) ? "YES" : "NO"}`);
  } else if (format === "yaml") {
    // YAML should have list syntax with dashes
    const manifestStr = typeof manifest === "string" ? manifest : JSON.stringify(manifest);
    console.log(`  ✓ Contains YAML list syntax: ${manifestStr.includes("- ") ? "YES" : "NO"}`);
    console.log(`  ✓ Contains expected fields: ${expectedFields.every((f) => manifestStr.includes(f)) ? "YES" : "NO"}`);
  } else if (format === "text") {
    // Text should have markdown headings
    const manifestStr = typeof manifest === "string" ? manifest : JSON.stringify(manifest);
    console.log(`  ✓ Contains markdown headings: ${manifestStr.includes("#") ? "YES" : "NO"}`);
    console.log(`  ✓ Contains expected field names: ${expectedFields.some((f) => manifestStr.toLowerCase().includes(f.toLowerCase())) ? "YES" : "NO"}`);
  }
}

async function runAllTests() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "DEMO PATTERN TESTING SUITE" + " ".repeat(32) + "║");
  console.log("╚" + "═".repeat(78) + "╝");

  const results: { pattern: string; success: boolean; error?: string }[] = [];

  for (const pattern of DEMO_PATTERNS) {
    const result = await testPattern(pattern);
    results.push({
      pattern: `${pattern.name} (${pattern.format})`,
      success: result.success,
      error: result.error,
    });
  }

  // Summary
  console.log("\n\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(30) + "TEST SUMMARY" + " ".repeat(36) + "║");
  console.log("╚" + "═".repeat(78) + "╝");
  console.log("");

  const passed = results.filter((r) => r.success).length;
  const failed = results.filter((r) => !r.success).length;

  results.forEach((result) => {
    const status = result.success ? "✓ PASS" : "✗ FAIL";
    const color = result.success ? "\x1b[32m" : "\x1b[31m";
    const reset = "\x1b[0m";
    console.log(`${color}${status}${reset} ${result.pattern}`);
    if (result.error) {
      console.log(`       Error: ${result.error}`);
    }
  });

  console.log("");
  console.log(`Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log("");

  process.exit(failed > 0 ? 1 : 0);
}

// Run tests
runAllTests().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
