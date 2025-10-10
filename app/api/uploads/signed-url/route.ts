/**
 * Signed Upload URL API Route
 * POST /api/uploads/signed-url - Create signed upload URL for TUS
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  successResponse,
} from "@/lib/api-helpers";
import { CreateSignedUploadUrlRequestSchema } from "@/schemas/api";
import * as storageService from "@/services/storageService";
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const input = await parseBody(request, CreateSignedUploadUrlRequestSchema);

  logger.info("Creating signed upload URL via API", {
    user_id: user.userId,
    path: input.path,
  });

  const result = await storageService.createSignedUploadUrl({
    userId: user.userId,
    path: input.path,
    contentType: input.content_type,
  });

  return successResponse({
    url: result.url,
    token: result.token,
    expires_at: result.expiresAt,
    upload_path: result.uploadPath,
  });
});
