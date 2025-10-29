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
import { getUserPlan } from "@/services/planService";
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

      // Prepare schemas object based on format
      const schemas: {
        json_schema?: Record<string, unknown> | null;
        yaml_schema?: string | null;
        xml_schema?: string | null;
        csv_schema?: string | null;
        plain_text_schema?: string | null;
        csv_delimiter?: string | null;
      } = {};

      // Set the appropriate schema based on format
      if (input.format === "json") {
        schemas.json_schema = input.json_schema || null;
      } else if (input.format === "yaml") {
        schemas.yaml_schema = input.yaml_schema || null;
      } else if (input.format === "xml") {
        schemas.xml_schema = input.xml_schema || null;
      } else if (input.format === "csv") {
        schemas.csv_schema = input.csv_schema || null;
        schemas.csv_delimiter = input.csv_delimiter || 'comma';
      } else if (input.format === "text") {
        schemas.plain_text_schema = input.plain_text_schema || null;
      }

      // Validate template character limit against user's plan
      const userPlan = await getUserPlan(user.userId);
      const maxTemplateChars = userPlan.plan.max_template_characters;

      // Calculate template length based on format
      let templateLength = 0;
      switch (input.format) {
        case "json":
          templateLength = schemas.json_schema ? JSON.stringify(schemas.json_schema).length : 0;
          break;
        case "yaml":
          templateLength = schemas.yaml_schema?.length || 0;
          break;
        case "xml":
          templateLength = schemas.xml_schema?.length || 0;
          break;
        case "csv":
          templateLength = schemas.csv_schema?.length || 0;
          break;
        case "text":
          templateLength = schemas.plain_text_schema?.length || 0;
          break;
      }

      logger.info("Validating template character limit (update)", {
        pattern_id: id,
        user_id: user.userId,
        format: input.format,
        template_length: templateLength,
        max_template_chars: maxTemplateChars,
        plan: userPlan.plan.name,
      });

      if (templateLength > maxTemplateChars) {
        logger.warn("Template exceeds plan character limit (update)", {
          pattern_id: id,
          user_id: user.userId,
          template_length: templateLength,
          max_template_chars: maxTemplateChars,
          plan: userPlan.plan.name,
        });
        throw new ApiError(
          `Template exceeds your plan limit of ${maxTemplateChars.toLocaleString()} characters. Your template is ${templateLength.toLocaleString()} characters. Please reduce the template size or upgrade your plan.`,
          400,
          "TEMPLATE_TOO_LARGE"
        );
      }

      newVersion = await patternService.publishPatternVersion(
        id,
        user.userId,
        input.instructions,
        input.format,
        schemas
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
