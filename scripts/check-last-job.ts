import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env") });

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error("❌ DATABASE_URL is required in .env file");
  process.exit(1);
}

const sql = postgres(DATABASE_URL);

async function checkJob() {
  try {
    const job = await sql`
      SELECT 
        id,
        pattern_id,
        status,
        manifest,
        error,
        latency_ms,
        created_at,
        updated_at
      FROM jobs
      WHERE id = '33a7a0d1-05ab-45c3-a17f-4b07226f5796'
    `;

    console.log("\n📊 Job Details:");
    console.log("================");
    console.log("ID:", job[0].id);
    console.log("Status:", job[0].status);
    console.log("Latency:", job[0].latency_ms, "ms");
    console.log("Error:", job[0].error || "None");
    console.log("\n📝 Manifest:");
    console.log(JSON.stringify(job[0].manifest, null, 2));
    console.log("\n⏰ Timestamps:");
    console.log("Created:", job[0].created_at);
    console.log("Updated:", job[0].updated_at);

    await sql.end();
  } catch (error) {
    console.error("❌ Error:", error);
    process.exit(1);
  }
}

checkJob();
