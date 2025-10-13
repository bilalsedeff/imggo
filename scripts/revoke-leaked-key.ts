/**
 * Revoke leaked API key from git history
 * Usage: npx tsx scripts/revoke-leaked-key.ts
 */

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function revokeLeakedKey() {
  const hash = "42f508b13c41fc6886f44d646a0ec33c2ee157e3e07333756a6b09c78137a118";

  console.log("🔍 Checking for leaked key in database...\n");

  const { data: keys, error: selectError } = await supabase
    .from("api_keys")
    .select("*")
    .eq("key_hash", hash);

  if (selectError) {
    console.error("❌ Error checking key:", selectError);
    return;
  }

  if (!keys || keys.length === 0) {
    console.log("✅ Leaked key NOT FOUND in database");
    console.log("   (Key was either never created or already deleted)");
    return;
  }

  const key = keys[0];
  console.log("⚠️  Found leaked key in database:");
  console.log("   ID:", key.id);
  console.log("   Name:", key.name);
  console.log("   Prefix:", key.key_prefix);
  console.log("   Created:", key.created_at);
  console.log("   Already Revoked:", key.revoked_at ? "YES" : "NO");
  console.log("");

  if (key.revoked_at) {
    console.log("✅ Key is already revoked. Nothing to do.");
    return;
  }

  console.log("🔒 Revoking leaked key...");

  const { error: updateError } = await supabase
    .from("api_keys")
    .update({
      revoked_at: new Date().toISOString(),
      revoked_reason: "Security: Key leaked in git history (scripts/check-api-key-db.ts)",
    })
    .eq("key_hash", hash);

  if (updateError) {
    console.error("❌ Error revoking key:", updateError);
    return;
  }

  console.log("✅ Key successfully revoked!");
  console.log("\n📝 Summary:");
  console.log("   - Leaked key has been permanently revoked");
  console.log("   - Any requests with this key will now fail");
  console.log("   - Create a new API key in dashboard if needed");
}

revokeLeakedKey().catch(console.error);
