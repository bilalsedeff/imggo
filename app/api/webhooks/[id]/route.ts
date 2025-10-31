/**
 * Webhook Detail API Routes
 * DELETE /api/webhooks/:id - Delete webhook
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  successResponse,
  ApiError,
} from "@/lib/api-helpers";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import * as webhookService from "@/services/webhookService";
import { logger } from "@/lib/logger";

export const DELETE = withErrorHandling(
  async (
    request: NextRequest,
    context?: { params: Promise<Record<string, string>> }
  ) => {
    if (!context) throw new ApiError("Missing params", 400);
    // 🔒 SECURITY: Require webhooks:delete scope for webhook deletion
    const authContext = await requireAuthOrApiKey(request, "webhooks:delete");
    const { id } = await context.params;

    if (!id) throw new ApiError("Missing webhook ID", 400);

    logger.info("Deleting webhook via API", {
      webhook_id: id,
      user_id: authContext.userId,
    });

    await webhookService.deleteWebhook(id, authContext.userId);

    return successResponse({ message: "Webhook deleted successfully" });
  }
);
