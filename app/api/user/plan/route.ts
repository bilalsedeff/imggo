/**
 * User Plan Information
 * GET /api/user/plan - Get current user's plan limits
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import { getUserPlanLimits } from "@/services/apiKeyService";
import { logger } from "@/lib/logger";

export async function GET(request: NextRequest) {
  try {
    const authContext = await requireAuthOrApiKey(request);

    logger.debug("Getting user plan limits", {
      user_id: authContext.userId,
    });

    const planLimits = await getUserPlanLimits(authContext.userId);

    return NextResponse.json({
      success: true,
      data: {
        plan_name: planLimits.planName,
        rate_limit: {
          requests: planLimits.rateLimitRequests,
          window_seconds: planLimits.rateLimitWindowSeconds,
        },
        limits: {
          max_api_keys: planLimits.maxApiKeys,
          max_patterns: planLimits.maxPatterns,
          max_webhooks: planLimits.maxWebhooks,
        },
      },
    });
  } catch (error) {
    logger.error("Failed to get user plan", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to get user plan",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
