/**
 * GET /api/plans
 * Get all active pricing plans for the pricing page
 * Public endpoint (no authentication required)
 */

import { NextResponse } from "next/server";
import { getActivePlans, formatPrice, calculateYearlySavings } from "@/services/planService";
import { logger } from "@/lib/logger";

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function GET() {
  try {
    // Get all active plans
    const plans = await getActivePlans();

    // Format response with pricing calculations
    const formattedPlans = plans.map((plan) => {
      // Calculate yearly savings if available
      let yearlySavings = null;
      if (plan.price_yearly_cents) {
        const savings = calculateYearlySavings(
          plan.price_monthly_cents,
          plan.price_yearly_cents
        );
        yearlySavings = {
          amount: formatPrice(savings.savingsCents),
          percent: savings.savingsPercent,
        };
      }

      return {
        id: plan.id,
        name: plan.name,
        displayName: plan.display_name,
        description: plan.description,
        pricing: {
          monthly: {
            cents: plan.price_monthly_cents,
            formatted: formatPrice(plan.price_monthly_cents),
          },
          yearly: plan.price_yearly_cents
            ? {
                cents: plan.price_yearly_cents,
                formatted: formatPrice(plan.price_yearly_cents),
                monthlyEquivalent: formatPrice(plan.price_yearly_cents / 12),
              }
            : null,
          yearlySavings,
        },
        limits: {
          requestsPerMonth:
            plan.requests_per_month === -1
              ? "Unlimited"
              : plan.requests_per_month.toLocaleString(),
          burstRateLimit: plan.burst_rate_limit_seconds
            ? `1 request per ${plan.burst_rate_limit_seconds} seconds`
            : null,
          maxImageSize: `${plan.max_image_size_mb}MB`,
          maxTokensPerRequest: plan.max_tokens_per_request.toLocaleString(),
          maxApiKeys:
            plan.max_api_keys === -1 ? "Unlimited" : plan.max_api_keys,
          maxPatterns:
            plan.max_patterns === -1 ? "Unlimited" : plan.max_patterns,
          maxWebhooks:
            plan.max_webhooks === -1 ? "Unlimited" : plan.max_webhooks,
        },
        features: plan.features,
        isHighlighted: plan.is_highlighted,
        cta: {
          text: plan.cta_text,
          url: plan.cta_url,
        },
      };
    });

    return NextResponse.json({ plans: formattedPlans });
  } catch (error) {
    logger.error("Failed to fetch plans", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Failed to fetch plans",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
