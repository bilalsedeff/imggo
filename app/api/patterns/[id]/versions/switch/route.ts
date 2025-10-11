/**
 * Pattern Version Switch API
 * POST /api/patterns/:id/versions/switch - Switch to a specific version
 */

import { NextRequest } from "next/server";
import { z } from "zod";
import {
  requireAuth,
  parseBody,
  successResponse,
  withErrorHandling,
} from "@/lib/api-helpers";
import * as patternService from "@/services/patternService";

const SwitchVersionSchema = z.object({
  version: z.number().int().positive(),
});

async function handlePost(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const user = await requireAuth(request);
  const { id } = await context.params;
  const input = await parseBody(request, SwitchVersionSchema);

  await patternService.switchToPatternVersion(id, user.userId, input.version);

  // Fetch the updated pattern
  const pattern = await patternService.getPattern(id, user.userId);

  return successResponse({ pattern, message: `Switched to version ${input.version}` });
}

export const POST = withErrorHandling(handlePost);
