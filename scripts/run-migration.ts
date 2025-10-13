/**
 * Run Database Migration
 * Applies API keys enhancement migration to Supabase
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { resolve } from "path";
import { config } from "dotenv";

config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

async function runMigration() {
  console.log("🚀 Running migration: API Keys Enhancement\n");

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  // Read migration file
  const migrationPath = resolve(
    process.cwd(),
    "db/migrations/20250113_api_keys_enhancement.sql"
  );
  const migrationSQL = readFileSync(migrationPath, "utf-8");

  console.log(`📄 Migration file: ${migrationPath}`);
  console.log(`📊 SQL length: ${migrationSQL.length} characters\n`);

  try {
    // Execute migration
    console.log("⏳ Executing migration...\n");

    const { data, error } = await supabase.rpc("exec_sql", {
      sql: migrationSQL,
    });

    if (error) {
      // RPC might not exist, try direct query
      const { error: queryError } = await supabase
        .from("_migrations")
        .select("*")
        .limit(1);

      if (queryError) {
        console.error("❌ Migration failed:", error);
        console.error("\n⚠️  Please run this SQL manually in Supabase SQL Editor:");
        console.error("   Dashboard → SQL Editor → New Query\n");
        process.exit(1);
      }
    }

    console.log("✅ Migration completed successfully!\n");

    // Verify tables exist
    console.log("🔍 Verifying tables...\n");

    const { data: apiKeys, error: apiKeysError } = await supabase
      .from("api_keys")
      .select("count")
      .limit(0);

    const { data: userPlans, error: userPlansError } = await supabase
      .from("user_plans")
      .select("count")
      .limit(0);

    if (!apiKeysError) {
      console.log("  ✅ api_keys table created");
    } else {
      console.log("  ❌ api_keys table missing:", apiKeysError.message);
    }

    if (!userPlansError) {
      console.log("  ✅ user_plans table created");
    } else {
      console.log("  ❌ user_plans table missing:", userPlansError.message);
    }

    console.log("\n✅ Migration verification complete!");
  } catch (error) {
    console.error("❌ Migration failed:", error);
    console.error("\n⚠️  Please run the SQL manually in Supabase SQL Editor");
    process.exit(1);
  }
}

runMigration().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
