/**
 * Webhook Service - Webhook delivery and management
 */

import { supabaseServer } from "@/lib/supabase-server";
import { logger } from "@/lib/logger";
import { insertRow, updateRowNoReturn, deleteRow } from "@/lib/supabase-helpers";
import { signWebhookPayload } from "@/lib/crypto";
import { WebhookPayload } from "@/schemas/manifest";

/**
 * Send webhook notification
 */
export async function sendWebhook(params: {
  userId: string;
  event: "job.succeeded" | "job.failed";
  jobId: string;
  patternId: string;
  manifest?: Record<string, unknown>;
  error?: string;
}): Promise<void> {
  const { userId, event, jobId, patternId, manifest, error } = params;

  try {
    logger.info("Sending webhook", {
      user_id: userId,
      event,
      job_id: jobId,
    });

    // Get active webhooks for this user and event
    const { data: webhooks, error: fetchError } = await supabaseServer
      .from("webhooks")
      .select("id, url, secret")
      .eq("user_id", userId)
      .eq("is_active", true)
      .contains("events", [event]);

    if (fetchError) {
      logger.error("Failed to fetch webhooks", fetchError, {
        user_id: userId,
      });
      return;
    }

    if (!webhooks || webhooks.length === 0) {
      logger.debug("No webhooks configured", {
        user_id: userId,
        event,
      });
      return;
    }

    // Prepare payload
    const payload: WebhookPayload = {
      event,
      job_id: jobId,
      pattern_id: patternId,
      manifest: manifest || null,
      error: error || null,
      timestamp: new Date().toISOString(),
    };

    // Send to each webhook
    await Promise.allSettled(
      webhooks.map(async (webhook) => {
        try {
          // Type assertion needed because select with specific columns returns partial type
          const webhookData = webhook as { id: string; url: string; secret: string };
          const signature = signWebhookPayload(payload, webhookData.secret);

          const response = await fetch(webhookData.url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-ImgGo-Signature": signature,
              "User-Agent": "ImgGo-Webhook/1.0",
            },
            body: JSON.stringify(payload),
            signal: AbortSignal.timeout(30000), // 30s timeout
          });

          if (!response.ok) {
            logger.warn("Webhook delivery failed", {
              webhook_id: webhookData.id,
              status: response.status,
              job_id: jobId,
            });
          } else {
            logger.info("Webhook delivered", {
              webhook_id: webhookData.id,
              job_id: jobId,
            });

            // Update last triggered timestamp
            await updateRowNoReturn(
              supabaseServer,
              "webhooks",
              { last_triggered_at: new Date().toISOString() },
              { column: "id", value: webhookData.id }
            );
          }
        } catch (err) {
          logger.error("Webhook delivery exception", err, {
            webhook_id: (webhook as { id: string }).id,
            job_id: jobId,
          });
        }
      })
    );
  } catch (error) {
    logger.error("Exception in webhook service", error);
  }
}

/**
 * Create webhook
 */
export async function createWebhook(params: {
  userId: string;
  url: string;
  secret: string;
  events: string[];
}): Promise<{ id: string }> {
  try {
    const { data, error } = await insertRow(supabaseServer, "webhooks", {
      user_id: params.userId,
      url: params.url,
      secret: params.secret,
      events: params.events,
      is_active: true,
    });

    if (error) {
      logger.error("Failed to create webhook", error);
      throw new Error(`Failed to create webhook: ${error.message}`);
    }

    if (!data) {
      throw new Error("No data returned from webhook creation");
    }

    logger.info("Webhook created", {
      webhook_id: data.id,
      user_id: params.userId,
    });

    return { id: data.id };
  } catch (error) {
    logger.error("Exception creating webhook", error);
    throw error;
  }
}

/**
 * List user's webhooks
 */
export async function listWebhooks(userId: string): Promise<
  Array<{
    id: string;
    url: string;
    events: string[];
    is_active: boolean;
    created_at: string;
    last_triggered_at: string | null;
  }>
> {
  try {
    const { data, error } = await supabaseServer
      .from("webhooks")
      .select("id, url, events, is_active, created_at, last_triggered_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (error) {
      logger.error("Failed to list webhooks", error);
      throw error;
    }

    return data || [];
  } catch (error) {
    logger.error("Exception listing webhooks", error);
    throw error;
  }
}

/**
 * Delete webhook
 */
export async function deleteWebhook(
  webhookId: string,
  userId: string
): Promise<void> {
  try {
    // Verify ownership first
    const { data: existingWebhook } = await supabaseServer
      .from("webhooks")
      .select("id")
      .eq("id", webhookId)
      .eq("user_id", userId)
      .single();

    if (!existingWebhook) {
      throw new Error("Webhook not found or access denied");
    }

    const { error } = await deleteRow(supabaseServer, "webhooks", {
      column: "id",
      value: webhookId,
    });

    if (error) {
      logger.error("Failed to delete webhook", error);
      throw error;
    }

    logger.info("Webhook deleted", { webhook_id: webhookId });
  } catch (error) {
    logger.error("Exception deleting webhook", error);
    throw error;
  }
}
