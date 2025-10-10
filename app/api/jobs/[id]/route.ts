/**
 * Job Detail API Route
 * GET /api/jobs/:id - Get job status and manifest
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import * as jobService from "@/services/jobService";
import { logger } from "@/lib/logger";

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context: { params: Promise<{ id: string }> }
  ) => {
    const user = await requireAuth(request);
    const { id } = await context.params;

    logger.info("Getting job via API", {
      job_id: id,
      user_id: user.userId,
    });

    const job = await jobService.getJob(id, user.userId);

    if (!job) {
      throw new ApiError("Job not found", 404, "NOT_FOUND");
    }

    return successResponse(job);
  }
);
