/**
 * Webhook Detail API Routes
 * DELETE /api/webhooks/:id - Delete webhook
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import * as webhookService from "@/services/webhookService";
import { logger } from "@/lib/logger";

export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    const user = await requireAuth(request);
    const { id } = await context.params;

    if (!id) throw new ApiError("Missing webhook ID", 400);

    logger.info("Deleting webhook via API", {
      webhook_id: id,
      user_id: user.userId,
    });

    await webhookService.deleteWebhook(id, user.userId);

    return successResponse({ message: "Webhook deleted successfully" });
  }
);
