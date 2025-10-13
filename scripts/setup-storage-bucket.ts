/**
 * Setup Supabase Storage Bucket for ImgGo
 */
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { resolve } from "path";

// Load .env file from project root
config({ path: resolve(process.cwd(), ".env") });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "images";

async function main() {
  console.log("Setting up Supabase Storage Bucket...");
  console.log(`Project URL: ${SUPABASE_URL}`);
  console.log(`Bucket Name: ${BUCKET_NAME}`);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // 1. Check if bucket exists
  const { data: buckets, error: listError } = await supabase.storage.listBuckets();

  if (listError) {
    console.error("❌ Failed to list buckets:", listError);
    process.exit(1);
  }

  const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

  if (bucketExists) {
    console.log(`✅ Bucket "${BUCKET_NAME}" already exists`);
  } else {
    console.log(`Creating bucket "${BUCKET_NAME}"...`);

    const { data: newBucket, error: createError } = await supabase.storage.createBucket(
      BUCKET_NAME,
      {
        public: false, // Private by default
        fileSizeLimit: 10485760, // 10MB
        allowedMimeTypes: [
          "image/jpeg",
          "image/jpg",
          "image/png",
          "image/webp",
          "image/gif",
          "image/bmp",
          "image/tiff",
        ],
      }
    );

    if (createError) {
      console.error("❌ Failed to create bucket:", createError);
      process.exit(1);
    }

    console.log(`✅ Bucket "${BUCKET_NAME}" created successfully`);
    console.log("Bucket details:", newBucket);
  }

  // 2. Check bucket details
  const { data: bucketInfo, error: infoError } = await supabase.storage.getBucket(BUCKET_NAME);

  if (infoError) {
    console.error("❌ Failed to get bucket info:", infoError);
  } else {
    console.log("\n📦 Bucket Configuration:");
    console.log(`  Name: ${bucketInfo.name}`);
    console.log(`  Public: ${bucketInfo.public}`);
    console.log(`  File size limit: ${(bucketInfo.file_size_limit || 0) / 1024 / 1024}MB`);
    console.log(`  Allowed MIME types: ${bucketInfo.allowed_mime_types?.join(", ") || "all"}`);
  }

  // 3. Test upload (small test file)
  console.log("\n🧪 Testing file upload...");
  const testContent = "Test file for ImgGo storage";
  const testPath = `test/upload-test-${Date.now()}.txt`;

  const { data: uploadData, error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(testPath, testContent, {
      contentType: "text/plain",
    });

  if (uploadError) {
    console.error("❌ Test upload failed:", uploadError);
  } else {
    console.log(`✅ Test upload successful: ${uploadData.path}`);

    // Clean up test file
    await supabase.storage.from(BUCKET_NAME).remove([testPath]);
    console.log("✅ Test file cleaned up");
  }

  // 4. Test signed upload URL
  console.log("\n🔐 Testing signed upload URL...");
  const signedUrlPath = `test/signed-upload-${Date.now()}.txt`;

  const { data: signedUrlData, error: signedUrlError } = await supabase.storage
    .from(BUCKET_NAME)
    .createSignedUploadUrl(signedUrlPath);

  if (signedUrlError) {
    console.error("❌ Failed to create signed upload URL:", signedUrlError);
  } else {
    console.log("✅ Signed upload URL created successfully");
    console.log(`  Token: ${signedUrlData.token}`);
    console.log(`  URL: ${signedUrlData.signedUrl}`);
  }

  console.log("\n✅ Storage bucket setup complete!");
  console.log("\n📝 Next steps:");
  console.log("  1. Upload test image: npm run upload-test-image");
  console.log("  2. Create pattern via API");
  console.log("  3. Test complete flow");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
