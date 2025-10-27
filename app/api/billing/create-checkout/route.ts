/**
 * POST /api/billing/create-checkout
 * Create a Stripe checkout session for plan upgrade
 */

import { NextRequest, NextResponse } from "next/server";
import { createCheckoutSession } from "@/services/stripeService";
import { authenticateRequest } from "@/lib/auth-unified";
import { logger } from "@/lib/logger";
import { z } from "zod";

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const CreateCheckoutSchema = z.object({
  planName: z.enum(["starter", "plus", "premium"]),
  billingCycle: z.enum(["monthly", "yearly"]),
  successUrl: z.string().url().optional(),
  cancelUrl: z.string().url().optional(),
});

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Authenticate request
    const authContext = await authenticateRequest(request);
    if (!authContext.authenticated || !authContext.userId) {
      return NextResponse.json(
        { error: "Unauthorized", message: "Authentication required" },
        { status: 401 }
      );
    }

    // Parse and validate request body
    const body = await request.json();
    const validation = CreateCheckoutSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { planName, billingCycle, successUrl, cancelUrl } = validation.data;

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";

    // Create checkout session
    const session = await createCheckoutSession({
      userId: authContext.userId,
      planName,
      billingCycle,
      successUrl: successUrl || `${baseUrl}/dashboard?checkout=success`,
      cancelUrl: cancelUrl || `${baseUrl}/pricing?checkout=cancelled`,
    });

    logger.info("Checkout session created", {
      user_id: authContext.userId,
      plan: planName,
      billing_cycle: billingCycle,
      session_id: session.sessionId,
    });

    return NextResponse.json({
      sessionId: session.sessionId,
      url: session.url,
    });
  } catch (error) {
    logger.error("Failed to create checkout session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Checkout failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
