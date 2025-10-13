/**
 * Check jobs in database
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Get recent jobs
  const { data: jobs, error } = await supabase
    .from("jobs")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error fetching jobs:", error);
    return;
  }

  console.log(`\n📋 Recent Jobs (last 5):\n`);

  if (!jobs || jobs.length === 0) {
    console.log("No jobs found");
    return;
  }

  jobs.forEach((job, index) => {
    console.log(`${index + 1}. Job ID: ${job.id}`);
    console.log(`   Status: ${job.status}`);
    console.log(`   Pattern: ${job.pattern_id}`);
    console.log(`   Image: ${job.image_url}`);
    console.log(`   Created: ${job.created_at}`);
    if (job.error) {
      console.log(`   Error: ${job.error}`);
    }
    if (job.manifest) {
      console.log(`   Manifest: ${JSON.stringify(job.manifest).substring(0, 100)}...`);
    }
    console.log("");
  });
}

main();
