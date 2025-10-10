/**
 * Pattern Detail API Routes
 * GET /api/patterns/:id - Get pattern
 * PATCH /api/patterns/:id - Update pattern
 * DELETE /api/patterns/:id - Delete pattern
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { UpdatePatternSchema } from "@/schemas/pattern";
import * as patternService from "@/services/patternService";
import { logger } from "@/lib/logger";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export const GET = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id } = await context.params;
    if (!id) throw new ApiError("Missing pattern ID", 400);

    logger.info("Getting pattern via API", {
      pattern_id: id,
      user_id: user.userId,
    });

    const pattern = await patternService.getPattern(id, user.userId);

    if (!pattern) {
      throw new ApiError("Pattern not found", 404, "NOT_FOUND");
    }

    const patternWithEndpoint = {
      ...pattern,
      endpoint_url: `${BASE_URL}/api/patterns/${pattern.id}/ingest`,
    };

    return successResponse(patternWithEndpoint);
  }
);

export const PATCH = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id } = await context.params;
    if (!id) throw new ApiError("Missing pattern ID", 400);

    const input = await parseBody(request, UpdatePatternSchema);

    logger.info("Updating pattern via API", {
      pattern_id: id,
      user_id: user.userId,
      publish_new_version: input.publish_new_version,
    });

    let pattern;
    let newVersion: number | null = null;

    if (input.publish_new_version) {
      // Publish new version (increments version number)
      if (!input.instructions || !input.format) {
        throw new ApiError("Instructions and format are required for publishing a new version", 400);
      }

      newVersion = await patternService.publishPatternVersion(
        id,
        user.userId,
        input.json_schema || null,
        input.instructions,
        input.format
      );

      // Fetch updated pattern
      pattern = await patternService.getPattern(id, user.userId);
      if (!pattern) {
        throw new ApiError("Pattern not found after version publish", 404);
      }
    } else {
      // Regular update (no version increment)
      pattern = await patternService.updatePattern(
        id,
        user.userId,
        input
      );
    }

    const patternWithEndpoint = {
      ...pattern,
      endpoint_url: `${BASE_URL}/api/patterns/${pattern.id}/ingest`,
      ...(newVersion !== null && { new_version: newVersion }),
    };

    return successResponse(patternWithEndpoint);
  }
);

export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id } = await context.params;
    if (!id) throw new ApiError("Missing pattern ID", 400);

    logger.info("Deleting pattern via API", {
      pattern_id: id,
      user_id: user.userId,
    });

    await patternService.deletePattern(id, user.userId);

    return successResponse({ message: "Pattern deleted successfully" });
  }
);
