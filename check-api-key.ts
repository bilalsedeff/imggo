import { createHash } from "crypto";

const apiKey = "imggo_test_wXanBwVxlqtgOCzMQ0VCvYcrmU9qwNIR-rn5D0kZ";
const hash = createHash("sha256").update(apiKey).digest("hex");

console.log("API Key:", apiKey);
console.log("Key Prefix:", apiKey.substring(0, 12));
console.log("SHA-256 Hash:", hash);
console.log("\nRun this SQL in Supabase to check:");
console.log(`SELECT id, name, key_prefix, key_hash, scopes, revoked_at FROM api_keys WHERE key_hash = '${hash}';`);
