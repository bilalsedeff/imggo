/**
 * Pattern Ingest API Route
 * POST /api/patterns/:id/ingest - Enqueue image processing job
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withErrorHandling,
  parseBody,
  successResponse,
  ApiError,
  handleIdempotency,
} from "@/lib/api-helpers";
import { IngestRequestSchema } from "@/schemas/manifest";
import * as patternService from "@/services/patternService";
import * as jobService from "@/services/jobService";
import { processImage } from "@/services/imageProcessingService";
import { logger } from "@/lib/logger";
import { requireAuthOrApiKey, getRequestIp } from "@/lib/auth-unified";
import {
  enforceRateLimit,
  checkRateLimit,
  getRateLimitHeaders,
  RateLimitStatus,
} from "@/middleware/rateLimitParametric";
import { deleteFile, uploadToSupabaseStorage } from "@/services/storageService";
import { convertManifest, getContentType, ManifestFormat } from "@/lib/formatConverter";

// Configure Vercel function timeout (Pro: 30s max)
export const maxDuration = 30;

/**
 * Determine if an error is transient (retryable) or permanent
 * Transient errors: Network issues, temporary API failures, timeouts
 * Permanent errors: Invalid schema, missing files, authentication failures
 */
function isTransientError(errorMsg: string): boolean {
  const transientPatterns = [
    /timeout/i,
    /network/i,
    /ECONNREFUSED/i,
    /ECONNRESET/i,
    /ETIMEDOUT/i,
    /socket hang up/i,
    /rate limit/i,
    /429/i, // Too Many Requests
    /503/i, // Service Unavailable
    /502/i, // Bad Gateway
    /504/i, // Gateway Timeout
    /downloading/i, // Image download issues
    /fetch.*failed/i,
  ];

  return transientPatterns.some((pattern) => pattern.test(errorMsg));
}

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);

    // Dual authentication: API Key or Session
    const authContext = await requireAuthOrApiKey(request, "patterns:ingest");

    // Get request IP for rate limiting
    const requestIp = getRequestIp(request);

    // Parametric rate limiting based on user plan
    const endpoint = "/api/patterns/[id]/ingest";
    const rateLimitStatusRef: { current?: RateLimitStatus } = {};
    const rateLimitResponse = await enforceRateLimit(
      authContext.userId,
      authContext,
      endpoint,
      requestIp,
      { statusRef: rateLimitStatusRef }
    );
    if (rateLimitResponse) return rateLimitResponse;

    let rateLimitStatus = rateLimitStatusRef.current;
    if (!rateLimitStatus) {
      logger.warn("Rate limit status missing after enforcement, recomputing", {
        user_id: authContext.userId,
        endpoint,
      });
      rateLimitStatus = await checkRateLimit(authContext.userId, authContext);
    }
    const rateLimitHeaders = getRateLimitHeaders(rateLimitStatus);

    const { id: patternId } = await context.params;
    if (!patternId) throw new ApiError("Missing pattern ID", 400);

    // Check content type: JSON or multipart/form-data
    const contentType = request.headers.get("content-type") || "";
    const isMultipart = contentType.includes("multipart/form-data");
    let imageUrl: string;
    let idempotencyKey: string | undefined;
    let extras: Record<string, unknown> | undefined;

    let uploadedFilePath: string | undefined;

    if (isMultipart) {
      // 📤 MULTIPART: Direct file upload
      logger.info("Processing multipart/form-data upload", {
        pattern_id: patternId,
        user_id: authContext.userId,
      });

      const formData = await request.formData();
      const imageFile = formData.get("image") as File | null;
      idempotencyKey = (formData.get("idempotency_key") as string) || undefined;
      const extrasString = formData.get("extras") as string | null;

      if (extrasString) {
        try {
          extras = JSON.parse(extrasString);
        } catch {
          throw new ApiError("Invalid extras JSON", 400);
        }
      }

      if (!imageFile) {
        throw new ApiError("Missing 'image' field in form data", 400);
      }

      // Validate file type
      if (!imageFile.type.startsWith("image/")) {
        throw new ApiError("File must be an image", 400);
      }

      // Validate file size (max 10MB)
      const maxSize = 10 * 1024 * 1024;
      if (imageFile.size > maxSize) {
        throw new ApiError("Image too large (max 10MB)", 400);
      }

      logger.info("Uploading image to storage", {
        filename: imageFile.name,
        size: imageFile.size,
        type: imageFile.type,
      });

      // Upload to Supabase Storage
      const uploadResult = await uploadToSupabaseStorage({
        file: imageFile,
        userId: authContext.userId,
        patternId,
      });

      imageUrl = uploadResult.publicUrl;
      uploadedFilePath = uploadResult.path;

      logger.info("Image uploaded successfully", {
        image_url: imageUrl,
        path: uploadResult.path,
      });
    } else {
      // 🔗 JSON: Image URL provided
      const input = await parseBody(request, IngestRequestSchema);
      imageUrl = input.image_url;
      idempotencyKey = input.idempotency_key;
      extras = input.extras;
    }

    logger.info("Ingesting image via API", {
      pattern_id: patternId,
      user_id: authContext.userId,
      auth_type: authContext.authType,
      idempotency_key: idempotencyKey,
      upload_method: isMultipart ? "multipart" : "json",
    });

    // Verify pattern exists and user owns it
    const pattern = await patternService.getPattern(patternId, authContext.userId);
    if (!pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    if (!pattern.is_active) {
      throw new ApiError("Pattern is not active", 400, "PATTERN_INACTIVE");
    }

    // Handle idempotency
    if (idempotencyKey) {
      const idempotencyCheck = await handleIdempotency(idempotencyKey);

      if (idempotencyCheck.isDuplicate && idempotencyCheck.existingData) {
        logger.info("Returning existing job for idempotent request", {
          idempotency_key: idempotencyKey,
        });

        return successResponse(idempotencyCheck.existingData, 200);
      }
    }

    // Create job record first (status: 'queued')
    const { jobId } = await jobService.createJobRecord({
      patternId: pattern.id,
      imageUrl: imageUrl,
      userId: authContext.userId,
      idempotencyKey: idempotencyKey,
      extras: extras,
    });

    logger.info("Job created, enqueuing for worker processing", {
      job_id: jobId,
      pattern_id: pattern.id,
    });

    // 🚀 QUEUE-FIRST: All jobs processed by Supabase worker (reliable, uses Supabase secrets)
    await jobService.enqueueExistingJob(jobId, {
      job_id: jobId,
      pattern_id: pattern.id,
      image_url: imageUrl,
      extras: extras,
    });

    // Return 202 - client should poll
    const response = successResponse(
      {
        job_id: jobId,
        status: "queued",
        message: "Job queued for background processing",
        approach: "queued",
      },
      202
    );

    // Add rate limit headers
    Object.entries(rateLimitHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    return response;
  }
);
