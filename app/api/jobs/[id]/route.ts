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
import { reorderManifestKeys, createStructuredOutputSchema } from "@/lib/manifestKeyOrdering";

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
    // Default to JSON for REST API compliance (status polling)
    // Users can explicitly request other formats with ?format=yaml|xml|csv|text
    const url = new URL(request.url);
    const formatParam = url.searchParams.get("format") as ManifestFormat | null;
    const desiredFormat = (formatParam || "json") as ManifestFormat;

    // 🎯 DIVINE RULE: Reorder manifest keys to match user's schema order
    // PostgreSQL JSONB doesn't preserve key order, so we reorder on read
    if (job.manifest && job.status === "succeeded") {
      if (pattern.format === "json" && pattern.json_schema) {
        const schema = createStructuredOutputSchema(pattern.json_schema as Record<string, unknown>);
        job.manifest = reorderManifestKeys(job.manifest, schema);

        logger.debug("JSON manifest keys reordered to match schema", {
          job_id: id,
          schema_required: schema.required,
          manifest_keys: Object.keys(job.manifest as Record<string, unknown>),
        });
      } else if (pattern.format === "csv" && pattern.csv_schema) {
        // Reorder CSV rows to match header order from schema
        const firstLine = (pattern.csv_schema as string).split('\n')[0];
        const delimiter = pattern.csv_delimiter === "semicolon" ? ";" : ",";
        const expectedHeaders = firstLine.split(delimiter).map(h => h.trim());

        const manifest = job.manifest as Record<string, unknown>;
        const rows = manifest.rows as Record<string, unknown>[] | undefined;

        if (rows && rows.length > 0) {
          const reorderedRows = rows.map(row => {
            const reordered: Record<string, unknown> = {};
            for (const header of expectedHeaders) {
              if (header in row) {
                reordered[header] = row[header];
              }
            }
            // Add any remaining keys
            for (const key in row) {
              if (!(key in reordered)) {
                reordered[key] = row[key];
              }
            }
            return reordered;
          });

          job.manifest = { ...manifest, rows: reorderedRows };

          logger.debug("CSV manifest rows reordered to match headers", {
            job_id: id,
            expected_headers: expectedHeaders,
            actual_headers: Object.keys(reorderedRows[0] || {}),
          });
        }
      }
    }

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
          // For JSON format request on non-JSON patterns:
          // Keep _raw and _format fields in the response so clients can parse if needed
          // Don't remove them as they're the primary data for these formats

          // Only clean up _raw/_format if there's actual structured data
          const hasStructuredData = Object.keys(manifest).some(
            key => key !== '_raw' && key !== '_format'
          );

          if (hasStructuredData) {
            // Has both structured + _raw, remove _raw for JSON response
            const cleanManifest = { ...manifest };
            delete cleanManifest._raw;
            delete cleanManifest._format;
            job.manifest = cleanManifest;
          }
          // else: Keep _raw/_format as they're the only data (YAML/XML/CSV/TEXT patterns)
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
