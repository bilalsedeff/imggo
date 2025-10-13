/**
 * Patterns API Routes
 * POST /api/patterns - Create pattern
 * GET /api/patterns - List patterns
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  parseQuery,
  successResponse,
} from "@/lib/api-helpers";
import { CreatePatternSchema } from "@/schemas/pattern";
import { ListPatternsQuerySchema } from "@/schemas/api";
import * as patternService from "@/services/patternService";
import { logger } from "@/lib/logger";
import { checkRateLimitOrFail } from "@/middleware/rateLimit";

const BASE_URL = process.env.APP_BASE_URL || "http://localhost:3000";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  // Rate limiting check (10 patterns per hour)
  const rateLimitResponse = await checkRateLimitOrFail(
    request,
    "patterns.create"
  );
  if (rateLimitResponse) return rateLimitResponse;

  const input = await parseBody(request, CreatePatternSchema);

  logger.info("Creating pattern via API", {
    user_id: user.userId,
    name: input.name,
  });

  // The input is already transformed by Zod, so it has the correct type
  const pattern = await patternService.createPattern(user.userId, input as import("@/schemas/pattern").CreatePatternInput);

  // Return pattern with endpoint URL
  const patternWithEndpoint = {
    ...pattern,
    endpoint_url: `${BASE_URL}/api/patterns/${pattern.id}/ingest`,
  };

  return successResponse(patternWithEndpoint, 201);
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const query = parseQuery(request, ListPatternsQuerySchema);

  logger.info("Listing patterns via API", {
    user_id: user.userId,
  });

  const { patterns, total } = await patternService.listPatterns(user.userId, {
    isActive: query.is_active,
    page: query.page,
    perPage: query.per_page,
  });

  // Add endpoint URLs
  const patternsWithEndpoints = patterns.map((p) => ({
    ...p,
    endpoint_url: `${BASE_URL}/api/patterns/${p.id}/ingest`,
  }));

  const perPage = query.per_page ?? 20;

  return successResponse({
    data: patternsWithEndpoints,
    pagination: {
      page: query.page ?? 1,
      per_page: perPage,
      total,
      total_pages: Math.ceil(total / perPage),
    },
  });
});
