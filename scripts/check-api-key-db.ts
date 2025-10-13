/**
 * Check if API key exists in database
 * Usage: npx tsx scripts/check-api-key-db.ts
 */

import { createClient } from "@supabase/supabase-js";
import { createHash } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function checkApiKey() {
  const apiKey = "imggo_test_wXanBwVxlqtgOCzMQ0VCvYcrmU9qwNIR-rn5D0kZ";
  const hash = createHash("sha256").update(apiKey).digest("hex");

  console.log("🔍 Checking API key in database...\n");
  console.log("API Key:", apiKey);
  console.log("Key Prefix:", apiKey.substring(0, 12));
  console.log("SHA-256 Hash:", hash);
  console.log("");

  // Check if api_keys table exists
  const { data: tables, error: tablesError } = await supabase.rpc("exec_sql", {
    sql: "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'api_keys';",
  }).catch(() => {
    // RPC might not exist, try direct query
    return supabase
      .from("api_keys")
      .select("*")
      .limit(0);
  });

  if (tablesError) {
    console.error("❌ Error checking if api_keys table exists:", tablesError);
    console.log("\n💡 Tip: Run the migration first:");
    console.log("   Supabase Dashboard → SQL Editor → Paste migration SQL");
    return;
  }

  // Try to query the API key
  const { data: apiKeys, error } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash);

  if (error) {
    console.error("❌ Error querying api_keys:", error);
    console.log("\n💡 Tip: Table might not exist. Run migration first.");
    return;
  }

  if (!apiKeys || apiKeys.length === 0) {
    console.log("❌ API key NOT FOUND in database");
    console.log("\n💡 Solutions:");
    console.log("   1. Make sure migration ran successfully");
    console.log("   2. Create API key in dashboard: http://localhost:3000/settings/api-keys");
    console.log("   3. Check if you're using the correct API key");
    return;
  }

  console.log("✅ API key FOUND in database:\n");
  const key = apiKeys[0];
  console.log("  ID:", key.id);
  console.log("  Name:", key.name);
  console.log("  User ID:", key.user_id);
  console.log("  Environment:", key.environment);
  console.log("  Scopes:", key.scopes);
  console.log("  Revoked:", key.revoked_at ? "YES" : "NO");
  console.log("  Created:", key.created_at);

  if (key.revoked_at) {
    console.log("\n❌ This API key is REVOKED!");
  }
}

checkApiKey().catch(console.error);
