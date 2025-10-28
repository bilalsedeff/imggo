/**
 * Simple demo testing script (no TypeScript, works with node directly)
 * Tests CSV, XML, YAML, and Text formats
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = "http://localhost:3000";
const TEST_IMAGE_PATH = path.join(__dirname, "..", "test-photos", "landscape-pattern", "road-8376079_1280.png");

const DEMO_PATTERNS = [
  { id: "00000000-0000-0000-0000-000000000002", name: "CSV Analysis", format: "csv" },
  { id: "00000000-0000-0000-0000-000000000003", name: "XML Analysis", format: "xml" },
  { id: "00000000-0000-0000-0000-000000000004", name: "YAML Analysis", format: "yaml" },
  { id: "00000000-0000-0000-0000-000000000005", name: "Text Analysis", format: "text" },
];

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function testPattern(pattern) {
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
      throw new Error(`Failed to get signed URL: ${signedUrlResponse.status}`);
    }

    const { url: uploadUrl, path: uploadPath } = await signedUrlResponse.json();
    console.log(`✓ Got signed URL for path: ${uploadPath}`);

    // Step 2: Upload image
    console.log("\nStep 2: Uploading image...");
    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);

    const uploadResponse = await fetch(uploadUrl, {
      method: "PUT",
      body: imageBuffer,
      headers: {
        "Content-Type": "image/png",
        "x-upsert": "true",
      },
    });

    if (!uploadResponse.ok) {
      throw new Error(`Failed to upload: ${uploadResponse.status}`);
    }

    console.log("✓ Image uploaded successfully");

    // Build public URL
    const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://bgdlalagnctabfiyimpt.supabase.co";
    const BUCKET = process.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET || "images";
    const imageUrl = `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${imagePath}`;

    // Step 3: Process
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
      await sleep(1000);
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
        console.log(typeof manifest === 'string' ? manifest : JSON.stringify(manifest, null, 2));
        console.log("-".repeat(80));
        return { success: true, manifest };
      }

      if (status === "failed") {
        throw new Error(`Job failed: ${jobError}`);
      }
    }

    throw new Error("Processing timeout");
  } catch (error) {
    console.error(`\n✗ Test failed:`, error.message);
    return { success: false, error: error.message };
  }
}

async function runAllTests() {
  console.log("\n");
  console.log("╔" + "═".repeat(78) + "╗");
  console.log("║" + " ".repeat(20) + "DEMO PATTERN TESTING SUITE" + " ".repeat(32) + "║");
  console.log("╚" + "═".repeat(78) + "╝");

  const results = [];

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
    console.log(`${status} ${result.pattern}`);
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
