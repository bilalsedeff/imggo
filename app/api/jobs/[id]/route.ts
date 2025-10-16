/**
 * Job Detail API Route
 * GET /api/jobs/:id - Get job status and manifest
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
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
    const authContext = await requireAuthOrApiKey(request, "jobs:read");
    const { id } = await context.params;

    if (!id) throw new ApiError("Missing job ID", 400);

    logger.info("Getting job via API", {
      job_id: id,
      user_id: authContext.userId,
    });

    const job = await jobService.getJob(id, authContext.userId);

    if (!job) {
      throw new ApiError("Job not found", 404, "NOT_FOUND");
    }

    // Get pattern to determine output format
    const pattern = await patternService.getPattern(job.pattern_id, authContext.userId);
    if (!pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    // Check if format parameter is provided in query string
    const url = new URL(request.url);
    const formatParam = url.searchParams.get("format") as ManifestFormat | null;
    const desiredFormat = (formatParam || pattern.format) as ManifestFormat;

    // Clean up manifest before returning - remove internal fields
    if (job.manifest && job.status === "succeeded") {
      const manifest = job.manifest as Record<string, unknown>;

      // Handle _raw format (internal implementation detail)
      if ('_raw' in manifest && '_format' in manifest) {
        // For non-JSON formats, use the _raw content
        if (desiredFormat !== "json") {
          const rawContent = manifest._raw as string;
          const contentType = getContentType(desiredFormat);

          logger.info("Returning formatted job manifest from _raw", {
            job_id: id,
            format: desiredFormat,
            content_type: contentType,
          });

          return new Response(rawContent, {
            status: 200,
            headers: {
              "Content-Type": contentType,
              "X-Job-Id": job.id,
              "X-Job-Status": job.status,
              "X-Pattern-Id": job.pattern_id,
            },
          });
        } else {
          // For JSON, parse the _raw content if it's YAML/XML/CSV/TEXT that was stored as _raw
          // Otherwise return the manifest without internal fields
          const cleanManifest = { ...manifest };
          delete cleanManifest._raw;
          delete cleanManifest._format;

          // If the clean manifest is empty after removing internal fields,
          // it means we only had _raw content, which shouldn't happen for JSON
          if (Object.keys(cleanManifest).length === 0) {
            logger.warn("JSON pattern returned _raw format only", {
              job_id: id,
              format: manifest._format
            });
          }

          job.manifest = cleanManifest;
        }
      } else if (desiredFormat !== "json") {
        // Convert properly structured manifest to desired format
        const convertedManifest = convertManifest(
          manifest,
          desiredFormat,
          (pattern.csv_delimiter as "comma" | "semicolon" | undefined) ?? "comma",
          pattern.csv_schema ?? undefined
        );
        const contentType = getContentType(desiredFormat);

        logger.info("Returning converted job manifest", {
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
    }

    // Return JSON response (default) - manifest is already cleaned up above
    return successResponse(job);
  }
);
