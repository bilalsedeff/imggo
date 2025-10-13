/**
 * E2E Test: Complete Image Processing Flow
 * Tests the full pipeline: Pattern → Upload → Ingest → Queue → Worker → Manifest
 */

import { test, expect } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";
import * as path from "path";

// Test configuration
const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Test user credentials (create these in your test database)
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || "test@imggo.ai";
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || "test123456";

// Sample test image (create this in tests/fixtures/)
const TEST_IMAGE_PATH = path.join(__dirname, "../test-photos/landscape-pattern/Screenshot 2025-10-10 155833.png");

test.describe("Image Processing Pipeline E2E", () => {
  let supabase: ReturnType<typeof createClient>;
  let authToken: string;
  let userId: string;

  test.beforeAll(async () => {
    // Initialize Supabase client
    supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Sign in test user
    const { data, error } = await supabase.auth.signInWithPassword({
      email: TEST_USER_EMAIL,
      password: TEST_USER_PASSWORD,
    });

    if (error) {
      throw new Error(`Failed to sign in test user: ${error.message}`);
    }

    authToken = data.session!.access_token;
    userId = data.user!.id;

    console.log("✅ Test user authenticated:", userId);
  });

  test.afterAll(async () => {
    // Sign out
    await supabase.auth.signOut();
  });

  test("Full pipeline: Create pattern → Upload image → Process → Get manifest", async ({
    request,
  }) => {
    // =========================================================================
    // STEP 1: Create a pattern with JSON schema
    // =========================================================================
    console.log("\n📝 Step 1: Creating pattern...");

    const patternPayload = {
      name: `E2E Test Pattern ${Date.now()}`,
      format: "json",
      instructions:
        "Analyze this image and extract: (1) dominant colors (array of color names), (2) objects detected (array of object names), (3) scene description (string)",
      json_schema: {
        type: "object",
        properties: {
          dominant_colors: {
            type: "array",
            items: { type: "string" },
            description: "List of dominant colors in the image",
          },
          objects: {
            type: "array",
            items: { type: "string" },
            description: "List of objects detected in the image",
          },
          scene_description: {
            type: "string",
            description: "Brief description of the scene",
          },
        },
        required: ["dominant_colors", "objects", "scene_description"],
        additionalProperties: false,
      },
    };

    const createPatternResponse = await request.post(
      `${BASE_URL}/api/patterns`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        data: patternPayload,
      }
    );

    expect(createPatternResponse.ok()).toBeTruthy();
    const patternData = await createPatternResponse.json();
    const patternId = patternData.id;
    const endpointUrl = patternData.endpoint_url;

    console.log(`✅ Pattern created: ${patternId}`);
    console.log(`   Endpoint: ${endpointUrl}`);

    // =========================================================================
    // STEP 2: Upload test image to Supabase Storage
    // =========================================================================
    console.log("\n📤 Step 2: Uploading test image...");

    // Check if test image exists
    if (!fs.existsSync(TEST_IMAGE_PATH)) {
      throw new Error(
        `Test image not found at ${TEST_IMAGE_PATH}. Please create tests/fixtures/test-image.jpg`
      );
    }

    const imageBuffer = fs.readFileSync(TEST_IMAGE_PATH);
    const imageName = `test-${Date.now()}.jpg`;
    const storagePath = `${userId}/${imageName}`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "images")
      .upload(storagePath, imageBuffer, {
        contentType: "image/jpeg",
        upsert: false,
      });

    if (uploadError) {
      throw new Error(`Failed to upload test image: ${uploadError.message}`);
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "images")
      .getPublicUrl(storagePath);

    const imageUrl = urlData.publicUrl;
    console.log(`✅ Image uploaded: ${imageUrl}`);

    // =========================================================================
    // STEP 3: Ingest image for processing
    // =========================================================================
    console.log("\n⚙️ Step 3: Ingesting image for processing...");

    const ingestPayload = {
      image_url: imageUrl,
      idempotency_key: `e2e-test-${Date.now()}`,
    };

    const ingestResponse = await request.post(endpointUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      data: ingestPayload,
    });

    expect(ingestResponse.ok()).toBeTruthy();
    expect(ingestResponse.status()).toBe(202); // Accepted

    const ingestData = await ingestResponse.json();
    const jobId = ingestData.job_id;

    console.log(`✅ Job queued: ${jobId}`);
    console.log(`   Status: ${ingestData.status}`);

    // =========================================================================
    // STEP 4: Poll job status until completed
    // =========================================================================
    console.log("\n⏳ Step 4: Waiting for job to complete...");

    let jobStatus = "queued";
    let manifest = null;
    let attempts = 0;
    const maxAttempts = 60; // 60 attempts x 5 seconds = 5 minutes max
    const pollInterval = 5000; // 5 seconds

    while (
      attempts < maxAttempts &&
      !["succeeded", "failed"].includes(jobStatus)
    ) {
      await new Promise((resolve) => setTimeout(resolve, pollInterval));

      const jobResponse = await request.get(`${BASE_URL}/api/jobs/${jobId}`, {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      });

      if (jobResponse.ok()) {
        const jobData = await jobResponse.json();
        jobStatus = jobData.status;
        manifest = jobData.manifest;

        console.log(`   [Attempt ${attempts + 1}] Status: ${jobStatus}`);

        if (jobStatus === "failed") {
          console.error(`   ❌ Job failed: ${jobData.error}`);
          throw new Error(`Job failed: ${jobData.error}`);
        }
      }

      attempts++;
    }

    // Check if we timed out
    if (attempts >= maxAttempts) {
      throw new Error(
        `Job did not complete within ${(maxAttempts * pollInterval) / 1000} seconds`
      );
    }

    console.log(`✅ Job completed after ${attempts} attempts`);

    // =========================================================================
    // STEP 5: Validate manifest structure and content
    // =========================================================================
    console.log("\n✅ Step 5: Validating manifest...");

    expect(jobStatus).toBe("succeeded");
    expect(manifest).toBeTruthy();
    expect(manifest).toHaveProperty("dominant_colors");
    expect(manifest).toHaveProperty("objects");
    expect(manifest).toHaveProperty("scene_description");

    // Validate types
    expect(Array.isArray(manifest.dominant_colors)).toBeTruthy();
    expect(Array.isArray(manifest.objects)).toBeTruthy();
    expect(typeof manifest.scene_description).toBe("string");

    console.log("\n📊 Manifest extracted:");
    console.log(JSON.stringify(manifest, null, 2));

    // =========================================================================
    // STEP 6: Test idempotency - same idempotency key returns same job
    // =========================================================================
    console.log("\n🔒 Step 6: Testing idempotency...");

    const idempotentIngestResponse = await request.post(endpointUrl, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json",
      },
      data: ingestPayload, // Same payload with same idempotency_key
    });

    expect(idempotentIngestResponse.ok()).toBeTruthy();
    const idempotentData = await idempotentIngestResponse.json();

    // Should return the same job_id
    expect(idempotentData.job_id).toBe(jobId);
    console.log(`✅ Idempotency works: returned same job_id ${jobId}`);

    // =========================================================================
    // STEP 7: Test rate limiting
    // =========================================================================
    console.log("\n🚦 Step 7: Testing rate limiting...");

    // Make 5 rapid requests (rate limit is 100 per 10 min, so this should pass)
    const rateLimitPromises = Array.from({ length: 5 }, (_, i) =>
      request.post(endpointUrl, {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json",
        },
        data: {
          image_url: imageUrl,
          idempotency_key: `rate-limit-test-${i}-${Date.now()}`,
        },
      })
    );

    const rateLimitResponses = await Promise.all(rateLimitPromises);

    // All should succeed (202)
    rateLimitResponses.forEach((response, i) => {
      expect(response.ok()).toBeTruthy();
      console.log(`   Request ${i + 1}: ${response.status()}`);
    });

    console.log("✅ Rate limiting allows normal traffic");

    // =========================================================================
    // STEP 8: Fetch pattern metrics
    // =========================================================================
    console.log("\n📈 Step 8: Fetching pattern metrics...");

    const metricsResponse = await request.get(
      `${BASE_URL}/api/patterns/${patternId}/metrics`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(metricsResponse.ok()).toBeTruthy();
    const metricsData = await metricsResponse.json();

    expect(metricsData.jobs.total).toBeGreaterThan(0);
    console.log(`✅ Metrics: ${metricsData.jobs.total} total jobs`);
    console.log(
      `   Success rate: ${metricsData.jobs.success_rate?.toFixed(1)}%`
    );

    // =========================================================================
    // CLEANUP: Delete test pattern and image
    // =========================================================================
    console.log("\n🧹 Cleanup: Deleting test data...");

    // Delete pattern (cascade deletes jobs via RLS)
    await request.delete(`${BASE_URL}/api/patterns/${patternId}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
      },
    });

    // Delete image from storage
    await supabase.storage
      .from(process.env.SUPABASE_STORAGE_BUCKET || "images")
      .remove([storagePath]);

    console.log("✅ Cleanup complete");

    console.log("\n🎉 E2E TEST PASSED: Full pipeline working correctly!");
  });

  test("Health check endpoint is accessible", async ({ request }) => {
    console.log("\n💚 Testing health check endpoint...");

    const healthResponse = await request.get(`${BASE_URL}/api/health`);

    expect(healthResponse.ok()).toBeTruthy();
    const healthData = await healthResponse.json();

    expect(healthData).toHaveProperty("status");
    expect(healthData).toHaveProperty("services");
    expect(healthData.services).toHaveProperty("database");
    expect(healthData.services).toHaveProperty("queue");
    expect(healthData.services).toHaveProperty("storage");

    console.log(`✅ Health status: ${healthData.status}`);
    console.log(`   Database: ${healthData.services.database.status}`);
    console.log(`   Queue: ${healthData.services.queue.status}`);
    console.log(`   Storage: ${healthData.services.storage.status}`);
  });

  test("Queue metrics endpoint returns valid data", async ({ request }) => {
    console.log("\n📊 Testing queue metrics endpoint...");

    const metricsResponse = await request.get(
      `${BASE_URL}/api/metrics/queue`,
      {
        headers: {
          Authorization: `Bearer ${authToken}`,
        },
      }
    );

    expect(metricsResponse.ok()).toBeTruthy();
    const metricsData = await metricsResponse.json();

    expect(metricsData).toHaveProperty("queue");
    expect(metricsData).toHaveProperty("jobs");
    expect(metricsData).toHaveProperty("health");

    console.log(`✅ Queue length: ${metricsData.queue.length}`);
    console.log(`   Health: ${metricsData.health.status}`);
  });
});
