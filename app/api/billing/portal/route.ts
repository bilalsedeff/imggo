/**
 * POST /api/billing/portal
 * Create a Stripe billing portal session for subscription management
 * Allows users to update payment methods, view invoices, and cancel subscriptions
 */

import { NextRequest, NextResponse } from "next/server";
import { createBillingPortalSession } from "@/services/stripeService";
import { authenticateRequest } from "@/lib/auth-unified";
import { logger } from "@/lib/logger";
import { z } from "zod";

// ============================================================================
// REQUEST SCHEMA
// ============================================================================

const PortalRequestSchema = z.object({
  returnUrl: z.string().url().optional(),
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
    const validation = PortalRequestSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: validation.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { returnUrl } = validation.data;

    // Get base URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_BASE_URL || "http://localhost:3000";

    // Create billing portal session
    const portalUrl = await createBillingPortalSession(
      authContext.userId,
      returnUrl || `${baseUrl}/dashboard/billing`
    );

    logger.info("Billing portal session created", {
      user_id: authContext.userId,
    });

    return NextResponse.json({ url: portalUrl });
  } catch (error) {
    logger.error("Failed to create billing portal session", {
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      {
        error: "Portal creation failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
