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
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
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

    // Create and enqueue job
    const { jobId, status } = await jobService.createJob({
      patternId: pattern.id,
      imageUrl: input.image_url,
      userId: user.userId,
      idempotencyKey: input.idempotency_key,
      extras: input.extras,
    });

    return successResponse(
      {
        job_id: jobId,
        status,
        message: "Job queued successfully",
      },
      202
    );
  }
);
