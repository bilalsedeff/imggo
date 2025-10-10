/**
 * Sample Webhook Receiver (for documentation/testing)
 * POST /api/webhooks/ingest - Receive webhook notifications
 */

import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/crypto";
import { logger } from "@/lib/logger";

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get("x-imggo-signature");

    if (!signature) {
      return NextResponse.json(
        { error: "Missing signature" },
        { status: 401 }
      );
    }

    const payload = await request.json();

    // In production, use your webhook secret
    const secret = process.env.WEBHOOK_SECRET || "test-secret";

    const isValid = verifyWebhookSignature(payload, signature, secret);

    if (!isValid) {
      logger.warn("Invalid webhook signature", {
        signature,
      });
      return NextResponse.json(
        { error: "Invalid signature" },
        { status: 401 }
      );
    }

    // Process webhook payload
    logger.info("Webhook received", {
      event: payload.event,
      job_id: payload.job_id,
    });

    // Your webhook processing logic here
    // e.g., update your database, trigger downstream processes, etc.

    return NextResponse.json({
      success: true,
      received: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("Webhook processing error", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
