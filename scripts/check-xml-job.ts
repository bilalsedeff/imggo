import { config } from "dotenv";
import { resolve } from "path";
import postgres from "postgres";

config({ path: resolve(process.cwd(), ".env") });

async function checkJob() {
  const sql = postgres(process.env.DATABASE_URL!);

  const jobId = process.argv[2] || "392541d6-e3b5-41d9-af8b-98628a3ad2a6";

  const job = await sql`
    SELECT id, status, manifest, error, created_at, updated_at
    FROM jobs
    WHERE id = ${jobId}
  `;

  if (job.length === 0) {
    console.log("❌ Job not found");
  } else {
    console.log("\n📊 Job Status:", job[0].status);
    console.log("Created:", job[0].created_at);
    console.log("Updated:", job[0].updated_at);
    
    if (job[0].error) {
      console.log("\n❌ Error:", job[0].error);
    }
    
    if (job[0].manifest) {
      console.log("\n📝 Manifest:");
      console.log(JSON.stringify(job[0].manifest, null, 2));
    }
  }

  await sql.end();
}

checkJob();
