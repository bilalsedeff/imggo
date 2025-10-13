/**
 * Apply PGMQ permissions migration
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { config } from "dotenv";
import { resolve } from "path";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function main() {
  console.log("🔐 Applying PGMQ permissions migration...\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  // Read the migration file
  const migrationSQL = readFileSync(
    "db/migrations/018_grant_pgmq_permissions.sql",
    "utf-8"
  );

  console.log("📄 Migration SQL:");
  console.log(migrationSQL);
  console.log("\n");

  // Execute the migration
  const { data, error } = await supabase.rpc("exec_sql", {
    sql: migrationSQL,
  });

  if (error) {
    // Try direct approach if RPC doesn't exist
    console.log("⚠️  exec_sql RPC not found, trying direct SQL execution...\n");

    // Split by semicolon and execute each statement
    const statements = migrationSQL
      .split(";")
      .map((s) => s.trim())
      .filter((s) => s && !s.startsWith("--") && s.length > 0);

    for (const statement of statements) {
      if (!statement) continue;

      console.log(`Executing: ${statement.substring(0, 80)}...`);

      const { error: stmtError } = await supabase.rpc("exec", {
        query: statement,
      }).then((result) => {
        // If RPC doesn't work, we need to use Supabase Dashboard SQL Editor
        return result;
      });

      if (stmtError) {
        console.error(`❌ Error: ${stmtError.message}`);
      } else {
        console.log(`✅ Success`);
      }
    }
  } else {
    console.log("✅ Migration applied successfully!");
    if (data) {
      console.log("Result:", data);
    }
  }

  console.log("\n📝 Note: If this script fails, copy the migration SQL above");
  console.log("and run it directly in Supabase SQL Editor.");
  console.log(`URL: ${SUPABASE_URL.replace("https://", "https://supabase.com/dashboard/project/").replace(".supabase.co", "")}/sql/new`);
}

main().catch((error) => {
  console.error("Fatal error:", error);
  console.log("\n📝 Manual Application Required:");
  console.log("1. Go to Supabase Dashboard → SQL Editor");
  console.log("2. Copy the contents of db/migrations/018_grant_pgmq_permissions.sql");
  console.log("3. Run the SQL statements");
  process.exit(1);
});
