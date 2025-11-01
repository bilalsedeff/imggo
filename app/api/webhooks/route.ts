/**
 * Webhooks API Routes
 * POST /api/webhooks - Create webhook
 * GET /api/webhooks - List webhooks
 */

import { NextRequest, NextResponse } from "next/server";
import {
  withErrorHandling,
  parseBody,
  successResponse,
} from "@/lib/api-helpers";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import { WebhookCreateSchema } from "@/schemas/api";
import * as webhookService from "@/services/webhookService";
import { checkFeatureLimit } from "@/services/planService";
import { generateWebhookSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(async (request: NextRequest) => {
  // 🔒 SECURITY: Require webhooks:write scope for webhook creation
  const authContext = await requireAuthOrApiKey(request, "webhooks:write");
  const userId = authContext.userId;

  const input = await parseBody(request, WebhookCreateSchema);

  // 🔒 SECURITY: Check webhook creation limit
  const existingWebhooks = await webhookService.listWebhooks(userId);
  const limitCheck = await checkFeatureLimit(userId, 'webhooks', existingWebhooks.length);

  if (!limitCheck.allowed) {
    logger.warn("Webhook creation blocked - plan limit reached", {
      user_id: userId,
      current_count: existingWebhooks.length,
      limit: limitCheck.limit,
    });
    return NextResponse.json(
      {
        error: "Plan limit exceeded",
        message: limitCheck.message || "Webhook creation limit reached",
        code: "PLAN_LIMIT_EXCEEDED",
      },
      { status: 403 }
    );
  }

  logger.info("Creating webhook via API", {
    user_id: userId,
    url: input.url,
  });

  // Generate secret if not provided
  const secret = input.secret || generateWebhookSecret();

  const events = input.events || ["job.succeeded", "job.failed"];

  const result = await webhookService.createWebhook({
    userId,
    url: input.url,
    secret,
    events,
  });

  return successResponse(
    {
      id: result.id,
      url: input.url,
      events,
      secret, // Return secret only on creation
    },
    201
  );
});

export const GET = withErrorHandling(async (request: NextRequest) => {
  // 🔒 SECURITY: Require webhooks:read scope for listing webhooks
  const authContext = await requireAuthOrApiKey(request, "webhooks:read");
  const userId = authContext.userId;

  logger.info("Listing webhooks via API", {
    user_id: userId,
  });

  const webhooks = await webhookService.listWebhooks(userId);

  return successResponse({
    data: webhooks,
  });
});
