/**
 * Webhooks API Routes
 * POST /api/webhooks - Create webhook
 * GET /api/webhooks - List webhooks
 */

import { NextRequest } from "next/server";
import {
  withErrorHandling,
  requireAuth,
  parseBody,
  successResponse,
} from "@/lib/api-helpers";
import { WebhookCreateSchema } from "@/schemas/api";
import * as webhookService from "@/services/webhookService";
import { generateWebhookSecret } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export const POST = withErrorHandling(async (request: NextRequest) => {
  const user = await requireAuth(request);

  const input = await parseBody(request, WebhookCreateSchema);

  logger.info("Creating webhook via API", {
    user_id: user.userId,
    url: input.url,
  });

  // Generate secret if not provided
  const secret = input.secret || generateWebhookSecret();

  const events = input.events || ["job.succeeded", "job.failed"];

  const result = await webhookService.createWebhook({
    userId: user.userId,
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
  const user = await requireAuth(request);

  logger.info("Listing webhooks via API", {
    user_id: user.userId,
  });

  const webhooks = await webhookService.listWebhooks(user.userId);

  return successResponse({
    data: webhooks,
  });
});
