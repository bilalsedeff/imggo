/**
 * Pattern Versions API
 * GET /api/patterns/:id/versions - List all versions
 */

import { NextRequest } from "next/server";
import {
  requireAuth,
  successResponse,
  withErrorHandling,
} from "@/lib/api-helpers";
import * as patternService from "@/services/patternService";

async function handleGet(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  const { id } = await context.params;

  const versions = await patternService.getPatternVersions(id, user.userId);

  return successResponse({ versions });
}

export const GET = withErrorHandling(handleGet);
