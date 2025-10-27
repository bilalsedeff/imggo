/**
 * POST /api/billing/webhook
 * Handle Stripe webhook events for subscription lifecycle
 *
 * IMPORTANT: This endpoint must receive raw body (not parsed JSON)
 * Configure Next.js to skip body parsing for this route
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature, processWebhookEvent } from "@/services/stripeService";
import { logger } from "@/lib/logger";

// Disable body parsing for webhook signature verification
export const runtime = "nodejs";

// ============================================================================
// ROUTE HANDLER
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const body = await request.text();

    // Get Stripe signature header
    const signature = request.headers.get("stripe-signature");

    if (!signature) {
      logger.error("Missing Stripe signature header");
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 400 }
      );
    }

    // Verify webhook signature and construct event
    let event;
    try {
      event = verifyWebhookSignature(body, signature);
    } catch (error) {
      logger.error("Webhook signature verification failed", {
        error: error instanceof Error ? error.message : String(error),
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 400 }
      );
    }

    // Process the webhook event
    await processWebhookEvent(event);

    logger.info("Webhook processed successfully", {
      event_type: event.type,
      event_id: event.id,
    });

    // Return 200 to acknowledge receipt
    return NextResponse.json({ received: true });
  } catch (error) {
    logger.error("Webhook processing failed", {
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });

    // Return 500 so Stripe will retry
    return NextResponse.json(
      {
        error: "Webhook processing failed",
        message: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
