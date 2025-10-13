/**
 * Storage Service - File upload and storage management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";

const BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || "images";
const SIGNED_URL_EXPIRY = 3600; // 1 hour

/**
 * Create signed upload URL for TUS upload
 */
export async function createSignedUploadUrl(params: {
  userId: string;
  path: string;
  contentType?: string;
}): Promise<{
  url: string;
  token: string;
  expiresAt: string;
  uploadPath: string;
}> {
  const { userId, path, contentType: _contentType = "image/jpeg" } = params;

  try {
    logger.info("Creating signed upload URL", {
      user_id: userId,
      path,
    });

    // Ensure user-scoped path
    const fullPath = `${userId}/${path}`;

    const { data, error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .createSignedUploadUrl(fullPath, {
        upsert: true,
      });

    if (error) {
      logger.error("Failed to create signed upload URL", error, {
        user_id: userId,
        path: fullPath,
      });
      throw new Error(`Failed to create signed upload URL: ${error.message}`);
    }

    const expiresAt = new Date(Date.now() + SIGNED_URL_EXPIRY * 1000).toISOString();

    logger.info("Signed upload URL created", {
      user_id: userId,
      path: fullPath,
    });

    return {
      url: data.signedUrl,
      token: data.token,
      expiresAt,
      uploadPath: fullPath,
    };
  } catch (error) {
    logger.error("Exception creating signed upload URL", error);
    throw error;
  }
}

/**
 * Upload file directly to Supabase Storage (for multipart/form-data)
 * Used when API receives file instead of URL
 */
export async function uploadToSupabaseStorage(params: {
  file: File;
  userId: string;
  patternId: string;
}): Promise<{
  path: string;
  publicUrl: string;
}> {
  const { file, userId, patternId } = params;

  try {
    // Generate unique filename
    const timestamp = Date.now();
    const randomSuffix = Math.random().toString(36).substring(2, 8);
    const extension = file.name.split(".").pop() || "jpg";
    const filename = `${timestamp}_${randomSuffix}.${extension}`;

    // User-scoped path: userId/patternId/filename
    const filePath = `${userId}/${patternId}/${filename}`;

    logger.info("Uploading file to storage", {
      user_id: userId,
      pattern_id: patternId,
      filename,
      size: file.size,
      type: file.type,
    });

    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Upload to Supabase Storage
    const { data, error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .upload(filePath, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (error) {
      logger.error("Failed to upload file to storage", error, {
        user_id: userId,
        pattern_id: patternId,
        path: filePath,
      });
      throw new Error(`Failed to upload file: ${error.message}`);
    }

    logger.info("File uploaded successfully", {
      user_id: userId,
      pattern_id: patternId,
      path: data.path,
    });

    // Get public URL
    const publicUrl = getPublicUrl(data.path);

    return {
      path: data.path,
      publicUrl,
    };
  } catch (error) {
    logger.error("Exception uploading file", error);
    throw error;
  }
}

/**
 * Get public URL for uploaded file
 */
export function getPublicUrl(path: string): string {
  const { data } = supabaseServer.storage.from(BUCKET_NAME).getPublicUrl(path);
  return data.publicUrl;
}

/**
 * Get signed URL for private file (for viewing)
 */
export async function getSignedUrl(
  path: string,
  expiresIn = 3600
): Promise<string> {
  try {
    const { data, error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .createSignedUrl(path, expiresIn);

    if (error) {
      logger.error("Failed to create signed URL", error, { path });
      throw error;
    }

    return data.signedUrl;
  } catch (error) {
    logger.error("Exception creating signed URL", error);
    throw error;
  }
}

/**
 * Delete file from storage
 */
export async function deleteFile(path: string): Promise<void> {
  try {
    const { error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .remove([path]);

    if (error) {
      logger.error("Failed to delete file", error, { path });
      throw error;
    }

    logger.info("File deleted", { path });
  } catch (error) {
    logger.error("Exception deleting file", error);
    throw error;
  }
}

/**
 * List files for user
 */
export async function listUserFiles(
  userId: string,
  options: {
    limit?: number;
    offset?: number;
  } = {}
): Promise<Array<{ name: string; size: number; createdAt: string }>> {
  try {
    const { limit = 100, offset = 0 } = options;

    const { data, error } = await supabaseServer.storage
      .from(BUCKET_NAME)
      .list(userId, {
        limit,
        offset,
        sortBy: { column: "created_at", order: "desc" },
      });

    if (error) {
      logger.error("Failed to list files", error, { user_id: userId });
      throw error;
    }

    return (
      data?.map((file) => ({
        name: file.name,
        size: file.metadata?.size || 0,
        createdAt: file.created_at,
      })) || []
    );
  } catch (error) {
    logger.error("Exception listing files", error);
    throw error;
  }
}

/**
 * Initialize storage bucket (run on startup)
 */
export async function initializeBucket(): Promise<void> {
  try {
    // Check if bucket exists
    const { data: buckets, error: listError } =
      await supabaseServer.storage.listBuckets();

    if (listError) {
      throw listError;
    }

    const bucketExists = buckets?.some((b) => b.name === BUCKET_NAME);

    if (!bucketExists) {
      const { error: createError } = await supabaseServer.storage.createBucket(
        BUCKET_NAME,
        {
          public: false,
          fileSizeLimit: 10485760, // 10MB
          allowedMimeTypes: [
            "image/jpeg",
            "image/png",
            "image/webp",
            "image/gif",
          ],
        }
      );

      if (createError) {
        throw createError;
      }

      logger.info("Storage bucket created", { bucket: BUCKET_NAME });
    } else {
      logger.info("Storage bucket exists", { bucket: BUCKET_NAME });
    }
  } catch (error) {
    logger.error("Failed to initialize bucket", error);
    throw error;
  }
}
