/**
 * GET /api/user/usage
 * Get current user's usage statistics and plan details
 * Requires authentication
 */

import { NextRequest, NextResponse } from "next/server";
import { requireAuthOrApiKey } from "@/lib/auth-unified";
import { getUserPlan } from "@/services/planService";
import { logger } from "@/lib/logger";

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET(request: NextRequest) {
  try {
    // Authenticate request (throws ApiError if not authenticated)
    const authContext = await requireAuthOrApiKey(request);

    // Get user plan and usage details
    const userPlan = await getUserPlan(authContext.userId);

    // Format response
    const response = {
      plan: {
        id: userPlan.plan.id,
        name: userPlan.plan.name,
        displayName: userPlan.plan.display_name,
        billingCycle: userPlan.billing_cycle,
      },
      usage: {
        requests: {
          used: userPlan.requests_used_current_period,
          limit:
            userPlan.plan.requests_per_month === -1
              ? "Unlimited"
              : userPlan.plan.requests_per_month,
          remaining:
            userPlan.requests_remaining === -1
              ? "Unlimited"
              : userPlan.requests_remaining,
          percentUsed: userPlan.usage_percent,
        },
        burstLimit: userPlan.plan.burst_rate_limit_seconds
          ? {
              seconds: userPlan.plan.burst_rate_limit_seconds,
              description: `1 request per ${userPlan.plan.burst_rate_limit_seconds} seconds`,
            }
          : null,
      },
      period: {
        start: userPlan.current_period_start,
        end: userPlan.current_period_end,
        daysRemaining: Math.ceil(
          (new Date(userPlan.current_period_end).getTime() - Date.now()) /
            (1000 * 60 * 60 * 24)
        ),
      },
      limits: {
        maxImageSize: `${userPlan.plan.max_image_size_mb}MB`,
        maxCharactersPerRequest: userPlan.plan.max_characters_per_request.toLocaleString(),
        maxTemplateCharacters: userPlan.plan.max_template_characters.toLocaleString(),
        maxApiKeys:
          userPlan.plan.max_api_keys === -1
            ? "Unlimited"
            : userPlan.plan.max_api_keys,
        maxPatterns:
          userPlan.plan.max_patterns === -1
            ? "Unlimited"
            : userPlan.plan.max_patterns,
        maxWebhooks:
          userPlan.plan.max_webhooks === -1
            ? "Unlimited"
            : userPlan.plan.max_webhooks,
      },
      subscription: {
        isActive: !!userPlan.stripe_subscription_id,
        stripeCustomerId: userPlan.stripe_customer_id,
        stripeSubscriptionId: userPlan.stripe_subscription_id,
      },
    };

    return NextResponse.json(response);
  } catch (error) {
    logger.error("Failed to fetch user usage", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to fetch usage",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
