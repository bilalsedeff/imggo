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
import * as patternService from "@/services/patternService";
import { convertManifest, getContentType, ManifestFormat } from "@/lib/formatConverter";
import { logger } from "@/lib/logger";

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id } = await context.params;

    if (!id) throw new ApiError("Missing job ID", 400);

    logger.info("Getting job via API", {
      job_id: id,
      user_id: user.userId,
    });

    const job = await jobService.getJob(id, user.userId);

    if (!job) {
      throw new ApiError("Job not found", 404, "NOT_FOUND");
    }

    // Get pattern to determine output format
    const pattern = await patternService.getPattern(job.pattern_id, user.userId);
    if (!pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    // Check if format parameter is provided in query string
    const url = new URL(request.url);
    const formatParam = url.searchParams.get("format") as ManifestFormat | null;
    const desiredFormat = (formatParam || pattern.format) as ManifestFormat;

    // If job has manifest and format is not JSON, convert it
    if (job.manifest && job.status === "succeeded" && desiredFormat !== "json") {
      const convertedManifest = convertManifest(
        job.manifest as Record<string, unknown>,
        desiredFormat
      );
      const contentType = getContentType(desiredFormat);

      logger.info("Returning formatted job manifest", {
        job_id: id,
        format: desiredFormat,
        content_type: contentType,
      });

      return new Response(convertedManifest, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "X-Job-Id": job.id,
          "X-Job-Status": job.status,
          "X-Pattern-Id": job.pattern_id,
        },
      });
    }

    // Return JSON response (default)
    return successResponse(job);
  }
);
