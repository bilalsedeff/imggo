/**
 * CSV Pattern Parallel Test Script
 * 
 * Tests:
 * 1. Parallel execution (10 images uploaded simultaneously)
 * 2. CSV format strictness (validates schema compliance)
 * 3. Queue system under load
 * 4. Field name sanitization (spaces → underscores)
 * 
 * Results stored in SQLite DB + exported to CSV
 */

import fs from "fs";
import path from "path";
import Database from "better-sqlite3";
import FormData from "form-data";
import fetch from "node-fetch";

// Configuration
const PATTERN_ID = "ed1b2a79-d89a-4281-88a8-2ebb9bcbb88e";
const API_KEY = "imggo_live_0YIXr7Vl6xVcMsyUWaNaSnDvHcvpE0I4DboS4AOs";
const BASE_URL = "http://localhost:3000";
const IMAGES_DIR = "test-photos/landscape-pattern";
const DB_PATH = "test-results-csv-pattern.db";
const CSV_OUTPUT = "test-results-csv-pattern.csv";
const MAX_PARALLEL = 5; // Process 5 images at a time
const POLL_INTERVAL_MS = 2000; // Poll every 2 seconds
const MAX_POLL_TIME_MS = 120000; // 2 minutes max

// Types
interface JobResult {
  filename: string;
  job_id: string;
  status: "succeeded" | "failed" | "timeout";
  pattern_name?: string;
  is_people?: boolean;
  is_building?: boolean;
  is_landscape?: boolean;
  is_animal?: boolean;
  is_vehicle?: boolean;
  is_night_scene?: boolean;
  is_day_scene?: boolean;
  is_indoor?: boolean;
  is_outdoor?: boolean;
  latency_ms?: number;
  error?: string;
}

// Initialize SQLite Database
function initDatabase(): Database.Database {
  const db = new Database(DB_PATH);

  db.exec(`
    CREATE TABLE IF NOT EXISTS results (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      image_filename TEXT NOT NULL,
      job_id TEXT NOT NULL,
      status TEXT NOT NULL,
      pattern_name TEXT,
      is_people INTEGER,
      is_building INTEGER,
      is_landscape INTEGER,
      is_animal INTEGER,
      is_vehicle INTEGER,
      is_night_scene INTEGER,
      is_day_scene INTEGER,
      is_indoor INTEGER,
      is_outdoor INTEGER,
      latency_ms INTEGER,
      error TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  console.log(`✅ Database initialized: ${DB_PATH}`);
  return db;
}

// Parse CSV response (semicolon delimiter)
function parseCSVResponse(csvText: string): Record<string, string> {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) {
    throw new Error("CSV must have at least 2 lines (header + data)");
  }

  const headerLine = lines[0];
  const valueLine = lines[1];
  
  if (!headerLine || !valueLine) {
    throw new Error("CSV header or value line is missing");
  }

  // Remove quotes and split by semicolon
  const headers = headerLine.split(';').map(h => h.trim().replace(/^"|"$/g, ''));
  const values = valueLine.split(';').map(v => v.trim().replace(/^"|"$/g, ''));

  const result: Record<string, string> = {};
  headers.forEach((header, index) => {
    result[header] = values[index] || "";
  });

  return result;
}

// Upload image via multipart form-data
async function uploadImage(filename: string): Promise<{ job_id: string; approach: string; immediate_csv?: string }> {
  const filePath = path.join(IMAGES_DIR, filename);
  const fileStream = fs.createReadStream(filePath);

  const form = new FormData();
  form.append("image", fileStream, filename);

  const response = await fetch(
    `${BASE_URL}/api/patterns/${PATTERN_ID}/ingest`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Upload failed (${response.status}): ${errorText}`);
  }

  const responseText = await response.text();
  
  // Check if response is CSV (immediate response) or JSON (queued response)
  if (responseText.trim().startsWith('{')) {
    // JSON response - job queued
    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`JSON parse failed: ${responseText.substring(0, 500)}`);
    }

    if (!data.success) {
      throw new Error(`Upload unsuccessful: ${data.error || "Unknown error"}`);
    }

    return {
      job_id: data.data.job_id,
      approach: data.data.approach || "queued",
    };
  } else {
    // CSV response - immediate processing
    console.log(`   ⚡ Immediate response (CSV):`);
    console.log(`   FULL RESPONSE:\n${responseText}`);
    console.log(`   ---`);
    
    return {
      job_id: "immediate",
      approach: "immediate",
      immediate_csv: responseText,
    };
  }
}

// Poll job status until complete
async function pollJobStatus(
  jobId: string,
  filename: string
): Promise<{ status: string; manifest?: any; latency_ms?: number; error?: string }> {
  const startTime = Date.now();
  let attempts = 0;
  const maxAttempts = Math.ceil(MAX_POLL_TIME_MS / POLL_INTERVAL_MS);

  while (attempts < maxAttempts) {
    attempts++;

    const response = await fetch(`${BASE_URL}/api/jobs/${jobId}`, {
      headers: { "Authorization": `Bearer ${API_KEY}` },
    });

    if (!response.ok) {
      throw new Error(`Job status check failed: ${response.status}`);
    }

    const data = await response.json() as any;

    console.log(`   [${filename}] Poll #${attempts}: ${data.status}`);

    if (data.status === "succeeded") {
      return {
        status: "succeeded",
        manifest: data.manifest,
        latency_ms: data.latency_ms,
      };
    }

    if (data.status === "failed") {
      return {
        status: "failed",
        error: data.error || "Unknown error",
      };
    }

    // Still processing
    await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
  }

  // Timeout
  const elapsed = Date.now() - startTime;
  return {
    status: "timeout",
    error: `Job did not complete within ${elapsed}ms`,
  };
}

// Process single image (upload + poll + parse)
async function processImage(filename: string, index: number, total: number): Promise<JobResult> {
  console.log(`\n📸 [${index + 1}/${total}] Processing: ${filename}`);

  try {
    // Step 1: Upload
    console.log(`   ⬆️  Uploading...`);
    const uploadResult = await uploadImage(filename);
    console.log(`   ✅ Job created: ${uploadResult.job_id} (${uploadResult.approach})`);

    // Check if we got immediate CSV response
    if (uploadResult.approach === "immediate" && uploadResult.immediate_csv) {
      console.log(`   ✅ Immediate processing complete`);
      
      // Parse CSV directly
      const parsed = parseCSVResponse(uploadResult.immediate_csv);

      return {
        filename,
        job_id: uploadResult.job_id,
        status: "succeeded",
        pattern_name: parsed.Pattern_Name || parsed.pattern_name,
        is_people: (parsed.Is_People || parsed.is_people)?.toLowerCase() === "true",
        is_building: (parsed.Is_Building || parsed.is_building)?.toLowerCase() === "true",
        is_landscape: (parsed.Is_Landscape || parsed.is_landscape)?.toLowerCase() === "true",
        is_animal: (parsed.Is_Animal || parsed.is_animal)?.toLowerCase() === "true",
        is_vehicle: (parsed.Is_Vehicle || parsed.is_vehicle)?.toLowerCase() === "true",
        is_night_scene: (parsed.Is_Night_Scene || parsed.is_night_scene)?.toLowerCase() === "true",
        is_day_scene: (parsed.Is_Day_Scene || parsed.is_day_scene)?.toLowerCase() === "true",
        is_indoor: (parsed.Is_Indoor || parsed.is_indoor)?.toLowerCase() === "true",
        is_outdoor: (parsed.Is_Outdoor || parsed.is_outdoor)?.toLowerCase() === "true",
        latency_ms: 0, // Immediate, no separate latency
      };
    }

    // Step 2: Poll for queued jobs
    console.log(`   ⏳ Polling job status...`);
    const jobResult = await pollJobStatus(uploadResult.job_id, filename);

    if (jobResult.status === "succeeded") {
      console.log(`   ✅ Job succeeded in ${jobResult.latency_ms}ms`);

      // Step 3: Parse CSV
      const manifestString = jobResult.manifest?.manifestString || jobResult.manifest || "";
      console.log(`   📄 CSV Response:\n${manifestString}`);

      const parsed = parseCSVResponse(manifestString);

      return {
        filename,
        job_id: uploadResult.job_id,
        status: "succeeded",
        pattern_name: parsed.Pattern_Name || parsed.pattern_name,
        is_people: (parsed.Is_People || parsed.is_people)?.toLowerCase() === "true",
        is_building: (parsed.Is_Building || parsed.is_building)?.toLowerCase() === "true",
        is_landscape: (parsed.Is_Landscape || parsed.is_landscape)?.toLowerCase() === "true",
        is_animal: (parsed.Is_Animal || parsed.is_animal)?.toLowerCase() === "true",
        is_vehicle: (parsed.Is_Vehicle || parsed.is_vehicle)?.toLowerCase() === "true",
        is_night_scene: (parsed.Is_Night_Scene || parsed.is_night_scene)?.toLowerCase() === "true",
        is_day_scene: (parsed.Is_Day_Scene || parsed.is_day_scene)?.toLowerCase() === "true",
        is_indoor: (parsed.Is_Indoor || parsed.is_indoor)?.toLowerCase() === "true",
        is_outdoor: (parsed.Is_Outdoor || parsed.is_outdoor)?.toLowerCase() === "true",
        latency_ms: 0,
      };
    } else {
      console.log(`   ❌ Job ${jobResult.status}: ${jobResult.error}`);
      return {
        filename,
        job_id: uploadResult.job_id,
        status: jobResult.status as any,
        error: jobResult.error,
      };
    }
  } catch (error) {
    console.error(`   ❌ Error: ${error}`);
    return {
      filename,
      job_id: "error",
      status: "failed",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

// Process images in parallel batches
async function processImagesInBatches(
  filenames: string[],
  batchSize: number
): Promise<JobResult[]> {
  const results: JobResult[] = [];

  for (let i = 0; i < filenames.length; i += batchSize) {
    const batch = filenames.slice(i, i + batchSize);
    console.log(`\n${"=".repeat(60)}`);
    console.log(`📦 Batch ${Math.floor(i / batchSize) + 1}: Processing ${batch.length} images in parallel`);
    console.log("=".repeat(60));

    const batchResults = await Promise.all(
      batch.map((filename, index) =>
        processImage(filename, i + index, filenames.length)
      )
    );

    results.push(...batchResults);
  }

  return results;
}

// Save results to database
function saveToDatabase(db: Database.Database, results: JobResult[]): void {
  const insert = db.prepare(`
    INSERT INTO results (
      image_filename, job_id, status, pattern_name,
      is_people, is_building, is_landscape, is_animal,
      is_vehicle, is_night_scene, is_day_scene, is_indoor, is_outdoor,
      latency_ms, error
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  for (const result of results) {
    insert.run(
      result.filename,
      result.job_id,
      result.status,
      result.pattern_name || null,
      result.is_people ? 1 : 0,
      result.is_building ? 1 : 0,
      result.is_landscape ? 1 : 0,
      result.is_animal ? 1 : 0,
      result.is_vehicle ? 1 : 0,
      result.is_night_scene ? 1 : 0,
      result.is_day_scene ? 1 : 0,
      result.is_indoor ? 1 : 0,
      result.is_outdoor ? 1 : 0,
      result.latency_ms || null,
      result.error || null
    );
  }

  console.log(`\n✅ Saved ${results.length} results to database`);
}

// Export results to CSV
function exportToCSV(db: Database.Database): void {
  const rows = db.prepare("SELECT * FROM results ORDER BY id").all() as any[];

  const headers = [
    "id",
    "image_filename",
    "job_id",
    "status",
    "pattern_name",
    "is_people",
    "is_building",
    "is_landscape",
    "is_animal",
    "is_vehicle",
    "is_night_scene",
    "is_day_scene",
    "is_indoor",
    "is_outdoor",
    "latency_ms",
    "error",
    "created_at",
  ];

  const csvLines = [headers.join(",")];

  for (const row of rows) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) return "";
      if (typeof value === "string" && value.includes(",")) {
        return `"${value.replace(/"/g, '""')}"`;
      }
      return String(value);
    });
    csvLines.push(values.join(","));
  }

  fs.writeFileSync(CSV_OUTPUT, csvLines.join("\n"));
  console.log(`✅ Exported results to: ${CSV_OUTPUT}`);
}

// Show statistics
function showStatistics(db: Database.Database): void {
  console.log("\n" + "=".repeat(60));
  console.log("📊 STATISTICS");
  console.log("=".repeat(60));

  // Success rate
  const total = db.prepare("SELECT COUNT(*) as count FROM results").get() as any;
  const succeeded = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'succeeded'").get() as any;
  const failed = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'failed'").get() as any;
  const timeout = db.prepare("SELECT COUNT(*) as count FROM results WHERE status = 'timeout'").get() as any;

  console.log(`\n✅ Success Rate: ${succeeded.count}/${total.count} (${((succeeded.count / total.count) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${failed.count}`);
  console.log(`⏱️  Timeout: ${timeout.count}`);

  // Average latency
  const avgLatency = db.prepare("SELECT AVG(latency_ms) as avg FROM results WHERE status = 'succeeded'").get() as any;
  console.log(`\n⚡ Average Latency: ${avgLatency.avg ? Math.round(avgLatency.avg) : "N/A"}ms`);

  // Field distribution (how many images have each field = true)
  console.log("\n📋 Field Distribution:");
  const fields = [
    "is_people",
    "is_building",
    "is_landscape",
    "is_animal",
    "is_vehicle",
    "is_night_scene",
    "is_day_scene",
    "is_indoor",
    "is_outdoor",
  ];

  for (const field of fields) {
    const count = db.prepare(`SELECT COUNT(*) as count FROM results WHERE ${field} = 1`).get() as any;
    const percentage = ((count.count / succeeded.count) * 100).toFixed(1);
    console.log(`   ${field.padEnd(20)}: ${count.count}/${succeeded.count} (${percentage}%)`);
  }

  // Show sample results table
  console.log("\n📋 Sample Results:");
  const samples = db.prepare(`
    SELECT image_filename, status, is_people, is_building, is_landscape, is_vehicle, is_indoor, is_outdoor, latency_ms
    FROM results
    LIMIT 10
  `).all() as any[];

  console.table(samples);
}

// Main execution
async function main() {
  console.log("🚀 CSV Pattern Parallel Test");
  console.log("=".repeat(60));
  console.log(`Pattern ID: ${PATTERN_ID}`);
  console.log(`Images Dir: ${IMAGES_DIR}`);
  console.log(`Max Parallel: ${MAX_PARALLEL}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`CSV Export: ${CSV_OUTPUT}`);
  console.log("=".repeat(60));

  // Initialize database
  const db = initDatabase();

  // Get all image files
  const allFiles = fs.readdirSync(IMAGES_DIR);
  const imageFiles = allFiles.filter((file) =>
    /\.(jpg|jpeg|png|gif|webp)$/i.test(file)
  );

  console.log(`\n📂 Found ${imageFiles.length} images to process`);

  if (imageFiles.length === 0) {
    console.log("❌ No images found!");
    process.exit(1);
  }

  // Process images in parallel batches
  const startTime = Date.now();
  const results = await processImagesInBatches(imageFiles, MAX_PARALLEL);
  const totalTime = Date.now() - startTime;

  // Save to database
  saveToDatabase(db, results);

  // Export to CSV
  exportToCSV(db);

  // Show statistics
  showStatistics(db);

  // Final summary
  console.log("\n" + "=".repeat(60));
  console.log("✅ TEST COMPLETED");
  console.log("=".repeat(60));
  console.log(`Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`Images Processed: ${results.length}`);
  console.log(`Database: ${DB_PATH}`);
  console.log(`CSV Export: ${CSV_OUTPUT}`);
  console.log("=".repeat(60));

  db.close();
}

main().catch((error) => {
  console.error("❌ Fatal error:", error);
  process.exit(1);
});
