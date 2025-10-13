/**
 * Pattern Ingest API Route
 * POST /api/patterns/:id/ingest - Enqueue image processing job
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
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
import { checkRateLimitOrFail } from "@/middleware/rateLimit";

// Configure Vercel function timeout (Pro: 30s max)
export const maxDuration = 30;

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);

    // Rate limiting check (100 images per 10 min sustained)
    const rateLimitResponse = await checkRateLimitOrFail(
      request,
      "patterns.ingest"
    );
    if (rateLimitResponse) return rateLimitResponse;

    const { id: patternId } = await context.params;
    if (!patternId) throw new ApiError("Missing pattern ID", 400);

    const input = await parseBody(request, IngestRequestSchema);

    logger.info("Ingesting image via API", {
      pattern_id: patternId,
      user_id: user.userId,
      idempotency_key: input.idempotency_key,
    });

    // Verify pattern exists and user owns it
    const pattern = await patternService.getPattern(patternId, user.userId);
    if (!pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    if (!pattern.is_active) {
      throw new ApiError("Pattern is not active", 400, "PATTERN_INACTIVE");
    }

    // Handle idempotency
    if (input.idempotency_key) {
      const idempotencyCheck = await handleIdempotency(input.idempotency_key);

      if (idempotencyCheck.isDuplicate && idempotencyCheck.existingData) {
        logger.info("Returning existing job for idempotent request", {
          idempotency_key: input.idempotency_key,
        });

        return successResponse(idempotencyCheck.existingData, 200);
      }
    }

    // Create job record first (status: 'queued')
    const { jobId } = await jobService.createJobRecord({
      patternId: pattern.id,
      imageUrl: input.image_url,
      userId: user.userId,
      idempotencyKey: input.idempotency_key,
      extras: input.extras,
    });

    logger.info("Job created, attempting direct processing", {
      job_id: jobId,
      pattern_id: pattern.id,
    });

    // 🚀 HYBRID APPROACH: Try direct processing first (25s timeout)
    try {
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("PROCESSING_TIMEOUT")), 25000)
      );

      const processingPromise = processImage({
        jobId,
        patternId: pattern.id,
        imageUrl: input.image_url,
        userId: user.userId,
      });

      const result = await Promise.race([processingPromise, timeoutPromise]);

      if (result.success && result.manifest) {
        // ⚡ SUCCESS! Return instant response (90% of cases)
        logger.info("Direct processing succeeded", {
          job_id: jobId,
          latency_ms: result.latencyMs,
          approach: "direct",
        });

        return successResponse(
          {
            job_id: jobId,
            status: "succeeded",
            manifest: result.manifest,
            latency_ms: result.latencyMs,
            approach: "direct", // Indicate this was processed instantly
          },
          200 // 200 OK - instant response!
        );
      } else {
        throw new Error(result.error || "Processing failed");
      }
    } catch (error) {
      // FALLBACK: Enqueue to PGMQ for worker processing
      const errorMsg = error instanceof Error ? error.message : "Unknown error";
      const isTimeout = errorMsg === "PROCESSING_TIMEOUT";

      logger.warn("Direct processing failed, falling back to queue", {
        job_id: jobId,
        reason: isTimeout ? "timeout" : "error",
        error: errorMsg,
      });

      // Enqueue job for background processing
      await jobService.enqueueExistingJob(jobId, {
        job_id: jobId,
        pattern_id: pattern.id,
        image_url: input.image_url,
        extras: input.extras,
      });

      // Return 202 - client should poll
      return successResponse(
        {
          job_id: jobId,
          status: "queued",
          message: "Job queued for background processing",
          approach: "queued",
          reason: isTimeout ? "Processing timeout, moved to queue" : "Processing error, moved to queue",
        },
        202
      );
    }
  }
);
